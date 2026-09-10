// graph-analysis.js — Pure graph pre-pass for the export engine (Phase 6)
//
// analyzeGraph() runs BEFORE the main walk and detects:
//   - Loops:   back-edges drawn by the user from a node back to an ancestor
//              Choice node (FEAT-01, D2 — user draws the loop on the canvas).
//              The Choice gets a `~ cue` title and the looping branch ends
//              with `=> cue` instead of re-walking the Choice.
//   - Merges:  convergence nodes (in-degree >= 2) where multiple branches
//              rejoin the same chain (FEAT-02). Shared content is emitted
//              once under a `~ cue` section; each branch jumps with `=> cue`.
//              Cue naming is hybrid (D3): a Marker at the merge point names
//              the cue; otherwise the engine generates merge_01, merge_02...
//
// Merge points are registered regardless of whether the merge point or its
// subtree contains a Choice: the shared section hoists the whole branching
// structure to the top level, so content is always deduplicated. The only
// exclusion is a conditional-link group whose arms re-converge (inline
// fall-through, Pass 2.5) — those keep their inline if/else output.
//
// Lint passes (warnings only, output unchanged):
//   - Pass 3: reachable non-End nodes with no outgoing links at all are
//     dead ends — at runtime the branch falls through to the next section
//     instead of terminating. Loop back-edges count as a valid terminal
//     (they emit `=> cue`).
//   - Pass 4: a single Choice option with multiple outgoing links where any
//     link lacks requirements is ambiguous — the exporter keeps only the
//     first link. Conditional links (e.g. check passed/failed) are the
//     legitimate multi-exit pattern and stay silent.
//
// Regression contract: for acyclic graphs without convergence this returns
// all-empty results and the main walk is byte-identical to the pre-Phase-6
// behavior (10 golden files).
//
// Pure module: no obsidian imports, no DOM access (engine-purity guard).

const { slugifyCueName } = require('./gd-format');

/**
 * Detect whether every arm of a conditional-link group re-converges on one
 * shared node through simple linear chains (no Choices, no nested branches,
 * no merge/loop targets in between). Returns the convergence node id, or
 * null when the pattern does not apply and the caller should fall back to
 * the legacy block walk.
 *
 * Used twice: statically in analyzeGraph (Pass 2.5, to keep such convergence
 * points out of the merge registry) and at walk time in export-engine (to
 * drive the inline fall-through emission).
 *
 * @param {Array<Object>} children - Outgoing links of the branching node
 * @param {Map<string, Array<Object>>} adjacency - from -> link[]
 * @param {Map<string, Object>} nodeMap - id -> node
 * @param {Object} graph - { loops, loopEdges, merges } (partially built during analysis)
 * @returns {string|null} Convergence node id
 */
function findBranchConvergence(children, adjacency, nodeMap, graph) {
    if (children.length < 2) return null;
    const chains = [];
    for (const link of children) {
        const chain = [];
        let cur = link.to;
        while (true) {
            // Arms terminating in a merge/loop jump end there; they take no
            // part in fall-through convergence.
            if (graph.merges.has(cur) || graph.loops.has(cur)) break;
            const node = nodeMap.get(cur);
            // A Choice (or unknown node) ends the simple chain.
            if (!node || node.type === 'Choice') break;
            if (chain.includes(cur)) break; // cycle safety
            chain.push(cur);
            const out = (adjacency.get(cur) || []).filter(l => !graph.loopEdges.has(l.id));
            if (out.length !== 1) break; // dead end or nested branch
            cur = out[0].to;
        }
        if (chain.length === 0) return null;
        chains.push(chain);
    }
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < chains[0].length; i++) {
        const id = chains[0][i];
        let maxIdx = i;
        let common = true;
        for (let c = 1; c < chains.length; c++) {
            const idx = chains[c].indexOf(id);
            if (idx === -1) { common = false; break; }
            if (idx > maxIdx) maxIdx = idx;
        }
        if (common && maxIdx < bestScore) { best = id; bestScore = maxIdx; }
    }
    if (!best) return null;
    // A merge-registered target is already handled by jump-to-section.
    if (graph.merges.has(best)) return null;
    // An arm starting directly at the convergence node would emit an empty
    // if/else arm — bail to the legacy walk.
    for (const chain of chains) {
        if (chain[0] === best) return null;
    }
    return best;
}

/**
 * Analyze the dialogue graph for loops and merge points.
 *
 * @param {Array<Object>} nodes - project.nodes[] array
 * @param {Array<Object>} links - project.links[] array (each link has id/from/to)
 * @param {string} startId - ID of the walk start node
 * @returns {{
 *   loops: Map<string, string>,      // choiceNodeId -> cue name
 *   loopEdges: Set<string>,          // link.id of back-edges into loop Choices
 *   merges: Map<string, string>,     // mergeNodeId -> cue name
 *   warnings: Array<string>
 * }}
 */
function analyzeGraph(nodes, links, startId) {
    const loops = new Map();
    const loopEdges = new Set();
    const merges = new Map();
    const warnings = [];
    const deferredCycleWarnings = [];

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Build adjacency list: from -> link[] (array order preserved)
    const adjacency = new Map();
    for (const link of links) {
        if (!adjacency.has(link.from)) {
            adjacency.set(link.from, []);
        }
        adjacency.get(link.from).push(link);
    }

    // ----- Cue name registry: existing Marker/Event cues are reserved so
    // generated cues never collide with user-authored ones -----
    const usedCueNames = new Set();
    for (const n of nodes) {
        if (n.type === 'Marker' || n.type === 'Event') {
            usedCueNames.add(slugifyCueName(n.title, n.id));
        }
    }

    function uniqueCue(base) {
        let cue = base || 'cue';
        let i = 2;
        while (usedCueNames.has(cue)) {
            cue = base + '_' + i;
            i++;
        }
        usedCueNames.add(cue);
        return cue;
    }

    // ----- Pass 1: iterative DFS from startId, detect back-edges -----
    // A back-edge (u -> v where v is on the current DFS path) into a Choice
    // node is a user-drawn loop (D2). Back-edges to non-Choice nodes are not
    // supported: keep the legacy visited-set behavior and warn.
    const visited = new Set([startId]);
    const onPath = new Set([startId]);
    const stack = [{ id: startId, idx: 0 }];

    while (stack.length > 0) {
        const top = stack[stack.length - 1];
        const children = adjacency.get(top.id) || [];
        if (top.idx >= children.length) {
            onPath.delete(top.id);
            stack.pop();
            continue;
        }
        const link = children[top.idx++];
        const targetNode = nodeMap.get(link.to);

        if (onPath.has(link.to)) {
            // Back-edge: target is an ancestor on the current path
            if (targetNode && targetNode.type === 'Choice') {
                if (!loops.has(link.to)) {
                    loops.set(link.to, uniqueCue(slugifyCueName(targetNode.title, targetNode.id)));
                }
                loopEdges.add(link.id);
            } else {
                // Defer the warning: a non-Choice cycle target with in-degree
                // >= 2 becomes a merge section in Pass 2, which represents
                // the cycle faithfully — only warn when it does not.
                deferredCycleWarnings.push(link.to);
            }
            continue;
        }

        if (!visited.has(link.to)) {
            visited.add(link.to);
            onPath.add(link.to);
            stack.push({ id: link.to, idx: 0 });
        }
        // Cross/forward edge to an already-visited node: candidate convergence,
        // handled by the in-degree pass below.
    }

    // ----- Pass 2.5: conditional-group inline fall-through exclusions -----
    // A node whose outgoing links carry requirements (at least one) is a
    // conditional (MED) group; when its arms re-converge on one shared node,
    // the walk emits that convergence inline (fall-through) instead of a
    // merge jump. Such convergence points are excluded from the merge
    // registry below — but only when their subtree contains a Choice.
    // Choice-free convergence subtrees were always merge-registered (the
    // walk-time convergence check bails on registered merges), so excluding
    // them would change output.
    const inlineConvergences = new Set();
    const analysisGraph = { loops, loopEdges, merges: new Map() };
    for (const id of visited) {
        const children = adjacency.get(id) || [];
        if (children.length < 2) continue;
        if (!children.some(l =>
            l && typeof l.requirements === 'string' && l.requirements.trim().length > 0)) continue;
        const conv = findBranchConvergence(children, adjacency, nodeMap, analysisGraph);
        if (conv && subtreeContainsChoice(conv, adjacency, nodeMap, loopEdges)) {
            inlineConvergences.add(conv);
        }
    }

    // ----- Pass 2: convergence detection (in-degree >= 2, loop edges excluded) -----
    const indegree = new Map();
    for (const link of links) {
        if (loopEdges.has(link.id)) continue;
        if (!visited.has(link.from) || !visited.has(link.to)) continue;
        indegree.set(link.to, (indegree.get(link.to) || 0) + 1);
    }

    let mergeCounter = 0;
    for (const [nodeId, degree] of indegree) {
        if (degree < 2) continue;
        if (nodeId === startId) continue;
        if (loops.has(nodeId)) continue; // loop target — not a merge
        if (inlineConvergences.has(nodeId)) continue; // inline fall-through — not a merge

        const node = nodeMap.get(nodeId);
        if (!node) continue;

        // D3 hybrid naming: a Marker at the merge point names the cue.
        if (node.type === 'Marker') {
            // The Marker's own slug was pre-reserved in usedCueNames by this
            // very node — use it directly (its `~ cue` line doubles as the
            // shared section header), no uniqueness suffix.
            merges.set(nodeId, slugifyCueName(node.title, node.id));
        } else {
            mergeCounter++;
            merges.set(nodeId, uniqueCue('merge_' + String(mergeCounter).padStart(2, '0')));
        }
    }

    // Flush deferred cycle warnings: a non-Choice cycle target registered as
    // a merge is faithfully represented (the section jumps back to itself);
    // anything else is genuinely unsupported and the walk truncates it.
    for (const to of deferredCycleWarnings) {
        if (merges.has(to)) continue;
        warnings.push(
            `Cycle to non-Choice node '${to}' is not supported; ` +
            `the edge is ignored (draw the loop back to a Choice node instead).`
        );
    }

    // ----- Pass 3: dead-end lint -----
    // A reachable non-End node with no outgoing links at all terminates
    // nothing: at runtime the branch (or shared section) falls through to
    // whatever follows in document order. Nodes whose only out-edges are
    // loop back-edges end with a `=> cue` jump and are valid terminals.
    for (const id of visited) {
        const node = nodeMap.get(id);
        if (!node || node.type === 'End') continue;
        const out = adjacency.get(id) || [];
        if (out.length > 0) continue;
        const label = node.title ? ` ("${node.title}")` : '';
        warnings.push(
            `Dead end at ${node.type} node '${id}'${label}: ` +
            `no outgoing link leads anywhere — connect it to an End node ` +
            `(or loop it back to a Choice) so the dialogue can terminate.`
        );
    }

    // ----- Pass 4: unconditional multi-exit choice option lint -----
    // The exporter resolves an option's target with links.find(...), so only
    // the FIRST link of an option group is ever followed. Multiple links on
    // one option are legitimate when each carries requirements (e.g. a check
    // passed/failed pair); without any condition the extra links are dead
    // weight and almost always a authoring mistake.
    for (const id of visited) {
        const node = nodeMap.get(id);
        if (!node || node.type !== 'Choice') continue;
        const out = adjacency.get(id) || [];
        if (out.length < 2) continue;
        const groups = new Map();
        for (let i = 0; i < out.length; i++) {
            const link = out[i];
            const key = link.choiceOptionId !== undefined && link.choiceOptionId !== null
                ? 'opt:' + link.choiceOptionId
                : link.choiceIndex !== undefined && link.choiceIndex !== null
                    ? 'idx:' + link.choiceIndex
                    : 'pos:' + i;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(link);
        }
        for (const [key, group] of groups) {
            if (group.length < 2) continue;
            const hasRequirements = l =>
                typeof l.requirements === 'string' && l.requirements.trim().length > 0;
            if (group.every(hasRequirements)) continue;
            // Resolve a human-readable option label: rich choiceOptions[]
            // (keyed by choiceOptionId) or the legacy choices[] string array
            // (keyed by choiceIndex).
            let optionText;
            if (key.startsWith('opt:') && Array.isArray(node.choiceOptions)) {
                const opt = node.choiceOptions.find(o => o && o.id === key.slice(4));
                optionText = opt && (opt.label || opt.text);
            } else if (key.startsWith('idx:') && Array.isArray(node.choices)) {
                optionText = node.choices[Number(key.slice(4))];
            }
            const optionLabel = optionText ? ` ("${optionText}")` : '';
            warnings.push(
                `Choice node '${id}' option${optionLabel} has ${group.length} outgoing links ` +
                `without requirements; only the first is exported. ` +
                `Add conditions (e.g. check passed/failed) or remove the extra links.`
            );
        }
    }

    return { loops, loopEdges, merges, warnings };
}

/**
 * Check whether the subtree reachable from nodeId contains a Choice node.
 * Follows non-loop edges only; bounded by a visited set.
 *
 * @param {string} nodeId - Root of the subtree to scan
 * @param {Map<string, Array<Object>>} adjacency - from -> link[]
 * @param {Map<string, Object>} nodeMap - id -> node
 * @param {Set<string>} loopEdges - link.id set of loop back-edges (not followed)
 * @returns {boolean}
 */
function subtreeContainsChoice(nodeId, adjacency, nodeMap, loopEdges) {
    const seen = new Set([nodeId]);
    const stack = [nodeId];
    while (stack.length > 0) {
        const id = stack.pop();
        const node = nodeMap.get(id);
        if (node && node.type === 'Choice') return true;
        const children = adjacency.get(id) || [];
        for (const link of children) {
            if (loopEdges.has(link.id)) continue;
            if (seen.has(link.to)) continue;
            seen.add(link.to);
            stack.push(link.to);
        }
    }
    return false;
}

module.exports = {
    analyzeGraph,
    findBranchConvergence
};

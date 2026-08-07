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
// Ambiguity rule: when a merged subtree contains a Choice, or the merge
// point is itself a Choice / loop target, content is NOT deduplicated —
// the engine keeps the current duplicate output and records a warning.
//
// Regression contract: for acyclic graphs without convergence this returns
// all-empty results and the main walk is byte-identical to the pre-Phase-6
// behavior (10 golden files).
//
// Pure module: no obsidian imports, no DOM access (engine-purity guard).

const { slugifyCueName } = require('./gd-format');

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
                warnings.push(
                    `Cycle to non-Choice node '${link.to}' is not supported; ` +
                    `the edge is ignored (draw the loop back to a Choice node instead).`
                );
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

        const node = nodeMap.get(nodeId);
        if (!node) continue;

        // Ambiguity: the merge point is itself a Choice — deduplicating would
        // require hoisting a branching structure into the shared section.
        if (node.type === 'Choice') {
            warnings.push(
                `Ambiguous convergence at Choice node '${nodeId}'; ` +
                `content is duplicated instead of deduplicated.`
            );
            continue;
        }

        // Ambiguity: merged subtree contains a Choice somewhere downstream.
        if (subtreeContainsChoice(nodeId, adjacency, nodeMap, loopEdges)) {
            warnings.push(
                `Ambiguous convergence at node '${nodeId}' (subtree contains a Choice); ` +
                `content is duplicated instead of deduplicated.`
            );
            continue;
        }

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
    analyzeGraph
};

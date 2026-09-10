// export-engine.js — Core export engine for converting .ncanvas JSON to Godot DM format
//
// Provides the main exportEngine() function that orchestrates graph traversal,
// character name resolution, and format dispatch.
//
// As specified in 02-01-PLAN.md and RESEARCH.md Pattern 1 (Topological Sort Traversal)
// and Pattern 4 (Character Name Resolution).

const { formatNode } = require('./gd-format');
const { detectMedState, formatMedNode, formatMedHeader, formatMutationsForEffects, formatLinkConditionalBlocks } = require('./med-format');
const { analyzeGraph, findBranchConvergence } = require('./graph-analysis');

// -------------------------------------------------------------------------
// Character name resolution
//
// Resolution priority (from RESEARCH.md Pattern 4):
//   1. node.cast[] with role==="Speaker" → use cast entry's `name` field
//   2. Lookup characters[] by characterId from cast entry (project.characters
//      merged with config.externalCharacters; project entries win on collision)
//   3. Fallback to node.title (Dialog nodes often use title as character name),
//      skipping the untouched type-default title ("Dialog"/"对话" → speakerless)
//   4. Return null → narrator line (no Character: prefix)
// -------------------------------------------------------------------------

/**
 * Resolve the character display name for a node.
 *
 * @param {Object} node - The .ncanvas node object
 * @param {Array<Object>} characters - project.characters[] array (character objects with id, name)
 * @returns {string|null} Character display name, or null for narrator lines
 */
function resolveCharacter(node, characters) {
    const charMap = new Map();
    if (Array.isArray(characters)) {
        for (const c of characters) {
            if (c && c.id) {
                charMap.set(c.id, c);
            }
        }
    }

    // Priority 1: cast[] with role==="Speaker"
    if (Array.isArray(node.cast) && node.cast.length > 0) {
        const speaker = node.cast.find(c => c.role === 'Speaker') || node.cast[0];
        // If cast entry has a 'name' field directly, use it
        if (speaker && speaker.name) {
            return speaker.name;
        }
        // Priority 2: Lookup project.characters[] by characterId
        if (speaker && speaker.characterId) {
            const charObj = charMap.get(speaker.characterId);
            if (charObj && charObj.name) {
                return charObj.name;
            }
        }
    }

    // Priority 3: Fallback to node.title (for Dialog nodes without cast) —
    // but skip the untouched type-default title ("Dialog", or its localized
    // form "对话"). A default title marks a speakerless node, not a character
    // literally named "Dialog": treating it as the speaker prepends a bogus
    // "Dialog: " prefix to every body line whose embedded speaker is a temp
    // character absent from the roster (stripSpeakerPrefix only recognizes
    // known names).
    const title = node.title && node.title.trim().length > 0 ? node.title.trim() : null;
    if (title && title.toLowerCase() !== 'dialog' && title !== '对话') {
        return title;
    }

    // Priority 4: Narrator line
    return null;
}

// -------------------------------------------------------------------------
// Topological sort (DFS-based)
//
// From RESEARCH.md Pattern 1: walk nodes from start node following
// project.links[], track visited Set to prevent cycles.
// Returns ordered array of node objects reachable from startId.
// -------------------------------------------------------------------------

/**
 * Topological sort: returns nodes in DFS order reachable from startId.
 * Excludes orphan/unreachable nodes.
 *
 * @param {Array<Object>} nodes - project.nodes[] array
 * @param {Array<Object>} links - project.links[] array
 * @param {string} startId - ID of the starting node
 * @returns {Array<Object>} Ordered array of node objects
 */
function topologicalSort(nodes, links, startId) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Build adjacency list: from -> [to, to, ...]
    const adjacency = new Map();
    for (const link of links) {
        if (!adjacency.has(link.from)) {
            adjacency.set(link.from, []);
        }
        adjacency.get(link.from).push(link.to);
    }

    const visited = new Set();
    const order = [];

    function walk(nodeId) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        const node = nodeMap.get(nodeId);
        if (node) {
            order.push(node);
        }
        const children = adjacency.get(nodeId) || [];
        for (const childId of children) {
            walk(childId);
        }
    }

    walk(startId);
    return order;
}

// -------------------------------------------------------------------------
// Conditional-group convergence (inline fall-through)
//
// findBranchConvergence lives in graph-analysis.js (shared between the
// static Pass 2.5 exclusion and the walk-time emission).
// -------------------------------------------------------------------------

/**
 * Check whether a branch link leads into a simple chain that ends at a node
 * with no outgoing links (a dead end), never reaching a merge or loop jump.
 *
 * @param {Object} link - The branch's first link
 * @param {Map<string, Array<Object>>} adjacency - from -> link[]
 * @param {Object} graph - analyzeGraph() result
 * @returns {boolean}
 */
function branchIsDeadEnd(link, adjacency, graph) {
    const seen = new Set();
    let cur = link.to;
    while (true) {
        if (seen.has(cur)) return false;
        seen.add(cur);
        if (graph.merges.has(cur) || graph.loops.has(cur)) return false;
        const out = (adjacency.get(cur) || []).filter(l => !graph.loopEdges.has(l.id));
        if (out.length === 0) return true;
        if (out.length > 1) return false; // nested structure decides for itself
        cur = out[0].to;
    }
}

// -------------------------------------------------------------------------
// Variable resolution
// -------------------------------------------------------------------------

/**
 * Resolve a nested key path against an object (e.g., "inventory.coins" -> 3).
 *
 * @param {Object} obj - The variables object
 * @param {string} dotPath - Dot-separated key path
 * @returns {*} The resolved value, or undefined
 */
function resolveNestedKey(obj, dotPath) {
    const parts = dotPath.split('.');
    let current = obj;
    for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined;
        current = current[part];
    }
    return current;
}

/**
 * Replace {variable_name} and {nested.key} patterns in text with literal values.
 * When medEnabled is true, variables with flag_/res_ prefixes are converted to
 * MED inline display syntax: {{res(&"name")}}.
 * Unresolved patterns stay as-is (per RESEARCH.md Pitfall handling).
 *
 * @param {string} text - Body text potentially containing {variable} templates
 * @param {Object} variables - project.variables{} object
 * @param {boolean} [medEnabled] - If true, convert state-prefixed vars to MED display syntax
 * @returns {string} Text with resolved variables
 */
function resolveVariables(text, variables, medEnabled) {
    if (!text || typeof text !== 'string') return text || '';
    if (!variables) return text;

    return text.replace(/\{(\w+(?:\.\w+)*)\}/g, (match, key) => {
        // MED mode: convert flag_ and res_ prefixed variables to inline display syntax
        if (medEnabled && (key.startsWith('flag_') || key.startsWith('res_'))) {
            const medKey = key.replace(/^(flag_|res_)/, '');
            return '{{res(&"' + medKey + '")}}';
        }
        // Standard mode: resolve to literal value
        const value = resolveNestedKey(variables, key);
        if (value !== undefined) {
            return String(value);
        }
        return match; // Unresolved — leave as-is
    });
}

// -------------------------------------------------------------------------
// Main export engine
// -------------------------------------------------------------------------

/**
 * Convert a parsed .ncanvas JSON object to a Godot DM .dialogue string.
 *
 * @param {Object} ncanvasJson - Parsed .ncanvas JSON (must have project.nodes)
 * @param {Object} config - { medEnabled: boolean, externalCharacters?: Array<{id, name}>, externalVariables?: Object }
 *   externalCharacters: shared vault characters (SHR-01), used only as a
 *   fallback lookup — project.characters always wins on id collisions.
 *   externalVariables: global vault variables table (NG-06), merged UNDER
 *   project.variables — file-local entries always win on name conflicts.
 * @returns {string} The .dialogue formatted string (trailing newline)
 *
 * Throws if project.nodes is missing.
 * Returns empty string for empty nodes array.
 */
function exportEngine(ncanvasJson, config) {
    const cfg = config || { medEnabled: false };

    // Validate structure — T-02-02: return clear error, don't crash silently
    if (!ncanvasJson || !ncanvasJson.project) {
        throw new Error('Invalid .ncanvas: missing project object');
    }
    if (!ncanvasJson.project.nodes) {
        throw new Error('Invalid .ncanvas: missing project.nodes array');
    }

    const nodes = ncanvasJson.project.nodes;
    if (nodes.length === 0) {
        return '';
    }

    const links = ncanvasJson.project.links || [];
    const characters = ncanvasJson.project.characters || [];
    // NG-06: global vault variables injected via config.externalVariables,
    // merged UNDER file-local project.variables (file-local wins on conflict).
    // With no globals this reduces to project.variables verbatim — byte-exact
    // backward compat for all pre-NG-06 fixtures.
    const externalVariables = (cfg.externalVariables && typeof cfg.externalVariables === 'object')
        ? cfg.externalVariables
        : {};
    const variables = Object.assign({}, externalVariables, ncanvasJson.project.variables || {});

    // SHR-01: shared vault characters injected via config.externalCharacters.
    // They are a fallback lookup only — external entries are placed first so
    // project.characters overwrite them on id collisions in the maps below.
    const externalCharacters = Array.isArray(cfg.externalCharacters)
        ? cfg.externalCharacters
        : [];
    const mergedCharacters = externalCharacters.concat(characters);

    // Build character map for lookups
    const characterMap = new Map();
    for (const c of mergedCharacters) {
        if (c && c.id) {
            characterMap.set(c.id, c);
        }
    }

    // Known speaker names (project + external characters + cast entry names).
    // Dialog body lines already starting with a known "Name:" / "Name：" prefix
    // are emitted as-is instead of getting a duplicated prefix. External names
    // must be included here: a shared character missing from this set would
    // re-introduce the "王裕昌: 王裕昌: ..." double-prefix bug (C1 regression).
    const knownCharacterNames = new Set();
    for (const c of mergedCharacters) {
        if (c && c.name) knownCharacterNames.add(c.name);
    }
    for (const n of nodes) {
        if (Array.isArray(n.cast)) {
            for (const entry of n.cast) {
                if (entry && entry.name) knownCharacterNames.add(entry.name);
            }
        }
    }

    // Build adjacency list from links
    const adjacency = new Map();
    // Build node map for O(1) lookup
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    for (const link of links) {
        if (!adjacency.has(link.from)) {
            adjacency.set(link.from, []);
        }
        adjacency.get(link.from).push(link);
    }

    // Find start node: first node with type "Entry", fallback to first node
    const entryNodes = nodes.filter(n => n.type === 'Entry');
    const startNode = entryNodes.length > 0 ? entryNodes[0] : nodes[0];

    // ----- Phase 6 pre-pass: loop + merge graph analysis (FEAT-01 / FEAT-02) -----
    // Pure analysis over the graph. When no loops or merges are found, the
    // walk below takes the exact pre-Phase-6 code paths (golden contract:
    // existing .dialogue output stays byte-identical).
    const graph = analyzeGraph(nodes, links, startNode.id);
    // Warnings are collected locally and flushed to cfg.warnings at the end
    // of the walk.
    const warnings = [...graph.warnings];

    // FEAT-02: ordered record of merge points already jumped to during the
    // walk; their shared subtrees are emitted once after the main walk.
    const emittedMerges = [];

    // Loop targets (FEAT-01) get the same section treatment: every entry
    // into a loop-target Choice emits `=> cue`; the Choice itself is emitted
    // once as a top-level section after the main walk. This keeps `~ cue`
    // titles unique and at column 0 no matter how many paths reach the loop.
    const emittedLoops = [];

    // MED auto-detection (from RESEARCH.md Pattern 5; NG-06: global variables
    // with flag_/res_ keys also count toward detection)
    let medDetected = false;
    if (cfg.medEnabled) {
        medDetected = detectMedState(ncanvasJson, externalVariables);
    }

    const lines = [];

    // Emit MED header if detected
    if (medDetected) {
        const medHeader = formatMedHeader(ncanvasJson, externalVariables);
        if (medHeader && medHeader.length > 0) {
            lines.push(...medHeader);
        }
    }

    // ----- Forward declaration of walkNode (defined before ctx, used by ctx.walkChildren) -----
    const visited = new Set();
    // walkNode is declared HERE as a variable so that ctx can close over it
    let walkNode;

    // ----- Context object passed to all format functions -----
    const ctx = {
        depth: 0,
        characters: characterMap,
        variables: variables,
        medEnabled: cfg.medEnabled && medDetected,
        formatNode: function(node, childCtx) {
            // Always emit base DM lines first
            const baseLines = formatNode(node, childCtx);
            // Then append MED-specific lines if enabled. Choice nodes handle
            // their own per-option mutations and inline [if cond /] suffixes
            // inside formatChoiceNode — calling formatMedNode here would
            // re-emit merged mutations and stray conditional block lines
            // for nested choices (WR-01). Mirrors the top-level
            // walkNode Choice branch, which never calls formatMedNode.
            if (childCtx.medEnabled && node.type !== 'Choice') {
                const medLines = formatMedNode(node, childCtx);
                return baseLines.concat(medLines || []);
            }
            return baseLines;
        },
        formatMedNode: function(node, childCtx) {
            if (!medDetected) return [];
            return formatMedNode(node, childCtx) || [];
        },
        formatMutationLines: function(effects, effDepth) {
            if (!medDetected) return [];
            return formatMutationsForEffects(effects, effDepth) || [];
        },
        resolveCharacter: resolveCharacter,
        resolveVariables: resolveVariables,
        knownCharacterNames: knownCharacterNames,
        adjacency: adjacency,
        nodeMap: nodeMap,
        links: links,
        graph: graph,
        emittedMerges: emittedMerges,
        emittedLoops: emittedLoops,
        warnings: warnings,
        charactersArr: mergedCharacters,
        variablesObj: variables,
        walkChildren: function(nodeId, depth) {
            walkChildLinks(nodeId, depth);
        }
    };

    // ----- Child-link walker with loop-edge handling (FEAT-01) -----
    // Emits `=> cue` jump lines for user-drawn loop back-edges instead of
    // recursing into the already-emitted Choice. When graph.loopEdges is
    // empty this behaves exactly like the pre-Phase-6 inline loops.
    //
    // stopAtId: while walking the arms of a conditional-link group whose
    // branches re-converge (inline fall-through), this holds the convergence
    // node id; links into it are not walked inside the block — the shared
    // trunk is walked once, inline, right after the if/else closes.
    let stopAtId = null;

    function walkChildLinks(nodeId, depth) {
        const children = adjacency.get(nodeId) || [];
        // MED-08 (links): when MED is enabled and any outgoing link carries
        // requirements, wrap the branches in native if/else blocks. The
        // capture callback splices out the lines walkSingleLink just pushed
        // so the block keywords can bracket them (walkNode pushes into the
        // shared `lines` array; everything here runs synchronously).
        if (ctx.medEnabled) {
            const hasReq = (l) => l && typeof l.requirements === 'string'
                && l.requirements.trim().length > 0;
            if (children.some(hasReq)) {
                // Non-exhaustive condition group: no unconditional link to
                // fall back on, so unmatched states produce no output.
                if (children.every(hasReq)) {
                    warnings.push({
                        level: 'warn',
                        text:
                            `Conditional group at '${nodeId}' has no unconditional else link; ` +
                            `unmatched states produce no output.`
                    });
                }
                // Diamond detection: when every arm of the group re-converges
                // on one shared node through simple linear chains, close the
                // if/else at that point and continue the shared trunk inline
                // (fall-through), instead of letting the first arm swallow
                // the trunk and silently truncating the others.
                const convergence = stopAtId === null
                    ? findBranchConvergence(children, adjacency, nodeMap, graph)
                    : null;
                if (convergence) {
                    stopAtId = convergence;
                }
                const blockLines = formatLinkConditionalBlocks(children, depth,
                    (link, d) => {
                        const start = lines.length;
                        walkSingleLink(link, d);
                        // Dead-end arm inside a block: without an explicit
                        // terminator the flow would fall through into the
                        // merge sections appended after this walk.
                        if (!convergence && d >= 1 && graph.merges.size > 0
                            && branchIsDeadEnd(link, adjacency, graph)) {
                            lines.push('\t'.repeat(d) + '=> END');
                        }
                        return lines.splice(start, lines.length - start);
                    }, variables);
                stopAtId = null;
                if (blockLines) {
                    lines.push(...blockLines);
                    if (convergence) {
                        walkNode(convergence, depth);
                    }
                    return;
                }
            }
        }
        for (const link of children) {
            walkSingleLink(link, depth);
        }
    }

    function walkSingleLink(link, depth) {
        // Inline fall-through: the arm stops at the convergence node; the
        // shared trunk is emitted once after the if/else block closes.
        if (stopAtId && link.to === stopAtId) return;
        // Loop target: back-edges (loopEdges) and forward entries alike emit
        // a jump; the loop-target Choice is emitted once as a top-level
        // section after the main walk (unique, non-nested `~ cue` titles).
        if (graph.loopEdges.has(link.id) || graph.loops.has(link.to)) {
            if (graph.loops.has(link.to) && !emittedLoops.includes(link.to)) {
                emittedLoops.push(link.to);
            }
            lines.push('\t'.repeat(depth) + '=> ' + graph.loops.get(link.to));
            return;
        }
        // FEAT-02: convergence point — jump to the shared section, do not
        // duplicate the subtree inline.
        if (graph.merges.has(link.to)) {
            if (!emittedMerges.includes(link.to)) {
                emittedMerges.push(link.to);
            }
            lines.push('\t'.repeat(depth) + '=> ' + graph.merges.get(link.to));
            return;
        }
        // A plain edge into an already-emitted node means this branch is
        // being silently truncated (typically a convergence the merge
        // pre-pass declined to register). Surface it instead of dropping
        // the rest of the branch without a trace.
        if (visited.has(link.to)) {
            warnings.push({
                level: 'error',
                text:
                    `Link '${link.id}' -> '${link.to}' skipped: target already emitted ` +
                    `on another path; the remainder of this branch is unreachable in the export.`
            });
            return;
        }
        walkNode(link.to, depth);
    }

    // ----- Define walkNode now that ctx is fully formed -----
    walkNode = function(nodeId, depth) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const node = nodeMap.get(nodeId);
        if (!node) return;

        const nodeCtx = { ...ctx, depth: depth };

        if (node.type === 'Choice') {
            // Choice nodes handle their own children inline via formatChoiceNode.
            // Per-option MED mutations are emitted inside formatChoiceNode's subtree walk.
            // Do NOT call formatMedNode on the Choice node itself here — mutations and
            // conditional blocks are per-option scoped.
            // walkVisited seeds the path-carried visited set so cycles that
            // cross Choice boundaries terminate inside formatChoiceNode.
            const result = formatNode(node, { ...nodeCtx, walkVisited: new Set([node.id]) });
            lines.push(...result);
        } else if (node.type === 'Entry') {
            // Entry nodes emit cue + body, then walk children at depth 0
            const result = formatNode(node, { ...nodeCtx, depth: 0 });
            lines.push(...result);
            if (medDetected) {
                const medLines = formatMedNode(node, { ...nodeCtx, depth: 0 });
                lines.push(...medLines);
            }
            walkChildLinks(node.id, 0);
        } else if (node.type === 'Marker' || node.type === 'Event') {
            // Marker/Event nodes emit cue + body, then walk children at same depth
            const result = formatNode(node, nodeCtx);
            lines.push(...result);
            if (medDetected) {
                const medLines = formatMedNode(node, nodeCtx);
                lines.push(...medLines);
            }
            walkChildLinks(node.id, depth);
        } else {
            // Dialog and Content nodes: emit their line, then walk children at same depth
            const result = formatNode(node, nodeCtx);
            lines.push(...result);
            if (medDetected) {
                const medLines = formatMedNode(node, nodeCtx);
                lines.push(...medLines);
            }
            walkChildLinks(node.id, depth);
        }
    };

    // ----- Start walking from the start node -----
    // If there's no Entry node, emit ~ start as the default opening cue
    if (entryNodes.length === 0) {
        lines.push('~ start');
    }
    walkNode(startNode.id, 0);

    // ----- FEAT-01/02: emit shared loop + merge sections (deduplicated content) -----
    // Interleaved drain: walking a shared section may record further nested
    // loops/merges, which are appended to the queues and emitted after the
    // sections that referenced them.
    let mergeIdx = 0;
    let loopIdx = 0;
    while (mergeIdx < emittedMerges.length || loopIdx < emittedLoops.length) {
        if (mergeIdx < emittedMerges.length) {
            const mergeNode = nodeMap.get(emittedMerges[mergeIdx++]);
            if (mergeNode) {
                // A Marker merge point emits its own `~ cue` header via formatNode;
                // other node types need the generated section header first.
                if (mergeNode.type !== 'Marker') {
                    lines.push('~ ' + graph.merges.get(mergeNode.id));
                }
                walkNode(mergeNode.id, 0);
            }
        }
        if (loopIdx < emittedLoops.length) {
            const loopNode = nodeMap.get(emittedLoops[loopIdx++]);
            if (loopNode) {
                lines.push('~ ' + graph.loops.get(loopNode.id));
                walkNode(loopNode.id, 0);
            }
        }
    }

    // Flush collected warnings to the caller. Identical warnings raised from
    // independent subtree walks are deduped (entries are { level, text } —
    // identity is the level+text pair).
    const seenWarnings = new Set();
    const finalWarnings = [];
    for (const w of warnings) {
        const key = (w && w.level ? w.level : 'warn') + '\n' + (w && w.text ? w.text : String(w));
        if (seenWarnings.has(key)) continue;
        seenWarnings.add(key);
        finalWarnings.push(w);
    }
    if (Array.isArray(cfg.warnings)) {
        cfg.warnings.push(...finalWarnings);
    }

    return lines.join('\n') + '\n';
}

/**
 * Split a warnings array ({ level, text } entries) into error/warn counts.
 * Red (error) entries block auto-export and stick in the status bar.
 *
 * @param {Array<{level: string, text: string}>} warnings
 * @returns {{ errors: number, warns: number }}
 */
function countWarningLevels(warnings) {
    let errors = 0;
    let warns = 0;
    for (const w of warnings || []) {
        if (w && w.level === 'error') errors++;
        else warns++;
    }
    return { errors, warns };
}

// -------------------------------------------------------------------------
// Exports
// -------------------------------------------------------------------------

module.exports = {
    exportEngine,
    topologicalSort,
    resolveCharacter,
    countWarningLevels
};

// export-engine.js — Core export engine for converting .ncanvas JSON to Godot DM format
//
// Provides the main exportEngine() function that orchestrates graph traversal,
// character name resolution, and format dispatch.
//
// As specified in 02-01-PLAN.md and RESEARCH.md Pattern 1 (Topological Sort Traversal)
// and Pattern 4 (Character Name Resolution).

const { formatNode } = require('./gd-format');
const { detectMedState, formatMedNode, formatMedHeader, formatMutationsForEffects } = require('./med-format');
const { analyzeGraph } = require('./graph-analysis');

// -------------------------------------------------------------------------
// Character name resolution
//
// Resolution priority (from RESEARCH.md Pattern 4):
//   1. node.cast[] with role==="Speaker" → use cast entry's `name` field
//   2. Lookup project.characters[] by characterId from cast entry
//   3. Fallback to node.title (Dialog nodes often use title as character name)
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

    // Priority 3: Fallback to node.title (for Dialog nodes without cast)
    if (node.title && node.title.trim().length > 0) {
        return node.title.trim();
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
 * @param {Object} config - { medEnabled: boolean }
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
    const variables = ncanvasJson.project.variables || {};

    // Build character map for lookups
    const characterMap = new Map();
    for (const c of characters) {
        if (c && c.id) {
            characterMap.set(c.id, c);
        }
    }

    // Known speaker names (project characters + cast entry names). Dialog
    // body lines already starting with a known "Name:" / "Name：" prefix are
    // emitted as-is instead of getting a duplicated prefix.
    const knownCharacterNames = new Set();
    for (const c of characters) {
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
    if (Array.isArray(cfg.warnings)) {
        cfg.warnings.push(...graph.warnings);
    }

    // FEAT-02: ordered record of merge points already jumped to during the
    // walk; their shared subtrees are emitted once after the main walk.
    const emittedMerges = [];

    // MED auto-detection (from RESEARCH.md Pattern 5)
    let medDetected = false;
    if (cfg.medEnabled) {
        medDetected = detectMedState(ncanvasJson);
    }

    const lines = [];

    // Emit MED header if detected
    if (medDetected) {
        const medHeader = formatMedHeader(ncanvasJson);
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
            // re-emit merged mutations and stray [if]/[else]/[/if] block
            // lines for nested choices (WR-01). Mirrors the top-level
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
        charactersArr: characters,
        variablesObj: variables,
        walkChildren: function(nodeId, depth) {
            walkChildLinks(nodeId, depth);
        }
    };

    // ----- Child-link walker with loop-edge handling (FEAT-01) -----
    // Emits `=> cue` jump lines for user-drawn loop back-edges instead of
    // recursing into the already-emitted Choice. When graph.loopEdges is
    // empty this behaves exactly like the pre-Phase-6 inline loops.
    function walkChildLinks(nodeId, depth) {
        const children = adjacency.get(nodeId) || [];
        for (const link of children) {
            if (graph.loopEdges.has(link.id)) {
                lines.push('\t'.repeat(depth) + '=> ' + graph.loops.get(link.to));
                continue;
            }
            // FEAT-02: convergence point — jump to the shared section, do not
            // duplicate the subtree inline.
            if (graph.merges.has(link.to)) {
                if (!emittedMerges.includes(link.to)) {
                    emittedMerges.push(link.to);
                }
                lines.push('\t'.repeat(depth) + '=> ' + graph.merges.get(link.to));
                continue;
            }
            walkNode(link.to, depth);
        }
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
            const result = formatNode(node, nodeCtx);
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

    // ----- FEAT-02: emit shared merge sections (deduplicated content) -----
    // Index-based loop: walking a shared section may record further nested
    // merges, which are appended here and emitted after their parents.
    for (let i = 0; i < emittedMerges.length; i++) {
        const mergeNode = nodeMap.get(emittedMerges[i]);
        if (!mergeNode) continue;
        // A Marker merge point emits its own `~ cue` header via formatNode;
        // other node types need the generated section header first.
        if (mergeNode.type !== 'Marker') {
            lines.push('~ ' + graph.merges.get(emittedMerges[i]));
        }
        walkNode(mergeNode.id, 0);
    }

    return lines.join('\n') + '\n';
}

// -------------------------------------------------------------------------
// Exports
// -------------------------------------------------------------------------

module.exports = {
    exportEngine,
    topologicalSort,
    resolveCharacter
};

// export-engine.js — Core export engine for converting .ncanvas JSON to Godot DM format
//
// Provides the main exportEngine() function that orchestrates graph traversal,
// character name resolution, and format dispatch.
//
// As specified in 02-01-PLAN.md and RESEARCH.md Pattern 1 (Topological Sort Traversal)
// and Pattern 4 (Character Name Resolution).

const { formatNode } = require('./gd-format');
const { detectMedState, formatMedNode, formatMedHeader } = require('./med-format');

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
 * Unresolved patterns stay as-is (per RESEARCH.md Pitfall handling).
 *
 * @param {string} text - Body text potentially containing {variable} templates
 * @param {Object} variables - project.variables{} object
 * @returns {string} Text with resolved variables
 */
function resolveVariables(text, variables) {
    if (!text || typeof text !== 'string') return text || '';
    if (!variables) return text;

    return text.replace(/\{(\w+(?:\.\w+)*)\}/g, (match, key) => {
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

    // MED auto-detection (from RESEARCH.md Pattern 5)
    let medDetected = false;
    if (cfg.medEnabled) {
        medDetected = detectMedState(ncanvasJson);
    }

    const lines = [];

    // Emit MED header if detected
    if (medDetected) {
        const medHeader = formatMedHeader(ncanvasJson);
        if (medHeader) {
            lines.push(medHeader);
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
            // Check if MED formatting should be used for this node
            if (childCtx.medEnabled) {
                const medLines = formatMedNode(node, childCtx);
                if (medLines && medLines.length > 0) {
                    return medLines;
                }
            }
            return formatNode(node, childCtx);
        },
        resolveCharacter: resolveCharacter,
        resolveVariables: resolveVariables,
        adjacency: adjacency,
        nodeMap: nodeMap,
        links: links,
        charactersArr: characters,
        variablesObj: variables,
        walkChildren: function(nodeId, depth) {
            const children = adjacency.get(nodeId) || [];
            for (const link of children) {
                walkNode(link.to, depth);
            }
        }
    };

    // ----- Define walkNode now that ctx is fully formed -----
    walkNode = function(nodeId, depth) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const node = nodeMap.get(nodeId);
        if (!node) return;

        const nodeCtx = { ...ctx, depth: depth };

        if (node.type === 'Choice') {
            // Choice nodes handle their own children inline via formatChoiceNode
            const result = formatNode(node, nodeCtx);
            lines.push(...result);
        } else if (node.type === 'Entry') {
            // Entry nodes emit cue + body, then walk children at depth 0
            const result = formatNode(node, { ...nodeCtx, depth: 0 });
            lines.push(...result);
            const children = adjacency.get(nodeId) || [];
            for (const link of children) {
                walkNode(link.to, 0);
            }
        } else if (node.type === 'Marker' || node.type === 'Event') {
            // Marker/Event nodes emit cue + body, then walk children at same depth
            const result = formatNode(node, nodeCtx);
            lines.push(...result);
            const children = adjacency.get(nodeId) || [];
            for (const link of children) {
                walkNode(link.to, depth);
            }
        } else {
            // Dialog and Content nodes: emit their line, then walk children at same depth
            const result = formatNode(node, nodeCtx);
            lines.push(...result);
            const children = adjacency.get(nodeId) || [];
            for (const link of children) {
                walkNode(link.to, depth);
            }
        }
    };

    // ----- Start walking from the start node -----
    // If there's no Entry node, emit ~ start as the default opening cue
    if (entryNodes.length === 0) {
        lines.push('~ start');
    }
    walkNode(startNode.id, 0);

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

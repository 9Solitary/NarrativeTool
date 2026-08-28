// ids.js — ID allocation for narrative-graph (Phase 11)
//
// Follows NarrativeCanvas conventions: nodes n0/n1/..., links l0/l1/...,
// choice options opt_1/opt_2/... Each helper scans existing ids and returns
// max+1, so ids never collide with NC-written content (NG-01).
//
// Pure module: no obsidian imports, no DOM access (purity guard).

/**
 * Find the next free numeric id with the given prefix.
 *
 * @param {Array<string>} ids - Existing ids to scan
 * @param {RegExp} pattern - Regex with one capture group for the number
 * @param {string} prefix - Id prefix for the result
 * @param {number} first - Starting number when no ids match
 * @returns {string}
 */
function nextNumericId(ids, pattern, prefix, first) {
    let max = first - 1;
    for (const id of ids) {
        if (typeof id !== 'string') continue;
        const m = id.match(pattern);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > max) max = n;
        }
    }
    return prefix + (max + 1);
}

/**
 * Next node id (n0/n1/... convention).
 *
 * @param {Array<Object>} nodes - project.nodes[]
 * @returns {string}
 */
function nextNodeId(nodes) {
    const ids = Array.isArray(nodes) ? nodes.map(n => n && n.id) : [];
    return nextNumericId(ids, /^n(\d+)$/, 'n', 0);
}

/**
 * Next link id (l0/l1/... convention).
 *
 * @param {Array<Object>} links - project.links[]
 * @returns {string}
 */
function nextLinkId(links) {
    const ids = Array.isArray(links) ? links.map(l => l && l.id) : [];
    return nextNumericId(ids, /^l(\d+)$/, 'l', 0);
}

/**
 * Next choice option id (opt_1/opt_2/... convention).
 * Scans choiceOptions across all nodes — option ids are file-global.
 *
 * @param {Array<Object>} nodes - project.nodes[]
 * @returns {string}
 */
function nextOptionId(nodes) {
    const ids = [];
    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (node && Array.isArray(node.choiceOptions)) {
                for (const opt of node.choiceOptions) {
                    if (opt && typeof opt.id === 'string') ids.push(opt.id);
                }
            }
        }
    }
    return nextNumericId(ids, /^opt_(\d+)$/, 'opt_', 1);
}

module.exports = {
    nextNodeId,
    nextLinkId,
    nextOptionId
};

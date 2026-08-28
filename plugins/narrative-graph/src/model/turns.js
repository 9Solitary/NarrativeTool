// turns.js — Dialog node multi-turn model (Phase 11, NG-05)
//
// A Dialog node carries single-node multi-turn dialogue in turns[]
// ({speaker, line} entries). The node body is a derived artifact: on save it
// is regenerated from turns as `speaker: line` joined with '\n'
// (verified format from real files, e.g. node n34 in 【选择】老佟家车马店).
//
// Legacy nodes (all hand-written fixtures) have a body but no turns;
// deriveTurns() reconstructs them: a line starting with `<title>:` (half- or
// full-width colon) has that prefix stripped, otherwise line = raw line and
// speaker = title.
//
// Pure module: no obsidian imports, no DOM access (purity guard).

/**
 * Flatten a turns[] array into the on-disk body string.
 *
 * @param {Array<{speaker: string, line: string}>} turns
 * @returns {string} `speaker: line` entries joined with '\n'
 */
function flattenTurns(turns) {
    if (!Array.isArray(turns)) return '';
    return turns
        .filter(t => t && typeof t.line === 'string')
        .map(t => `${t.speaker}: ${t.line}`)
        .join('\n');
}

/**
 * Strip a leading `<speaker>:` prefix from a body line.
 * Recognizes half-width ':' and full-width '：' (U+FF1A).
 *
 * @param {string} line - A single body line
 * @param {string} speaker - Speaker name to match
 * @returns {string|null} The line without the prefix, or null when absent
 */
function stripSpeakerPrefix(line, speaker) {
    if (!speaker) return null;
    for (const sep of [':', '：']) {
        if (line.startsWith(speaker + sep)) {
            return line.slice(speaker.length + 1).replace(/^\s+/, '');
        }
    }
    return null;
}

/**
 * Derive turns[] for a node that has a body but no turns (NG-05).
 * Nodes that already carry turns are returned as-is.
 *
 * @param {Object} node - A Dialog node ({ title, body, turns? })
 * @returns {Array<{speaker: string, line: string}>}
 */
function deriveTurns(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node.turns) && node.turns.length > 0) return node.turns;

    const body = typeof node.body === 'string' ? node.body : '';
    if (body.trim().length === 0) return [];

    const speaker = (typeof node.title === 'string' ? node.title : '').trim();
    const turns = [];
    for (const rawLine of body.split('\n')) {
        if (rawLine.trim().length === 0) continue;
        const stripped = stripSpeakerPrefix(rawLine, speaker);
        turns.push({ speaker: speaker, line: stripped !== null ? stripped : rawLine });
    }
    return turns;
}

module.exports = {
    flattenTurns,
    deriveTurns
};

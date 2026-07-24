// med-format.js — MED (Mind Elixir Dialogue) state extension formatter (SKELETON)
//
// As specified in 02-01-PLAN.md: Skeleton with stub export functions.
// Real MED logic filled in by Plan 02-02.
//
// Exports three stub functions:
//   detectMedState(ncanvas)   — returns false (stub)
//   formatMedNode(node, ctx)  — returns [] (stub)
//   formatMedHeader(ncanvas)  — returns '' (stub)

/**
 * Detect whether a .ncanvas project uses MED state system constructs.
 * Stub: always returns false. Real detection logic in Plan 02-02
 * (scans variables for flag_/res_ prefixes, script actions, choice conditions).
 *
 * @param {Object} ncanvas - Parsed .ncanvas JSON
 * @returns {boolean} Whether MED state system is in use
 */
function detectMedState(ncanvas) {
    // Stub — real logic in Plan 02-02
    return false;
}

/**
 * Format a node using MED extended syntax.
 * Stub: always returns empty array. Real formatting logic in Plan 02-02
 * (handles using S, do set_flag, do add_res, [#check], [term], {{res()}}, ~ direct_check).
 *
 * @param {Object} node - The .ncanvas node object
 * @param {Object} ctx - Context object
 * @returns {Array<string>} Empty array (stub)
 */
function formatMedNode(node, ctx) {
    // Stub — real formatting in Plan 02-02
    return [];
}

/**
 * Generate the MED header string (e.g., "using S\n").
 * Stub: always returns empty string. Real header logic in Plan 02-02.
 *
 * @param {Object} ncanvas - Parsed .ncanvas JSON
 * @returns {string} Empty string (stub)
 */
function formatMedHeader(ncanvas) {
    // Stub — real header in Plan 02-02
    return '';
}

module.exports = {
    detectMedState,
    formatMedNode,
    formatMedHeader
};

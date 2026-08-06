// nc-bridge.js -- Optional-chained NarrativeCanvasHost bridge (D-12 / D-13)
//
// The ONLY module allowed to reference window.NarrativeCanvasHost
// (ARCHITECTURE.md §3 — Host API Bridge).
//
// D-13: zero callers in v1.0 — this file exists as future-proofing so the
// NC integration point is ready when the merged plugin needs it.
//
// CONSTRAINT: this module MUST NOT assign, replace, or delete
// window.NarrativeCanvasHost. It only READS it via optional chaining.

/**
 * Get the NarrativeCanvasHost bridge object, if present.
 * @returns {Object|null}
 */
function getNC() {
    return (typeof window !== 'undefined') ? window.NarrativeCanvasHost : null;
}

/**
 * Whether the Narrative Canvas host bridge is active.
 * @returns {boolean}
 */
function isNarrativeCanvasActive() {
    return !!getNC();
}

/**
 * Ask the host to choose a project file.
 * @returns {*} Host result, or null when unavailable
 */
function chooseProjectFile(...args) {
    const nc = getNC();
    if (!nc?.chooseProjectFile) return null;
    return nc.chooseProjectFile(...args);
}

/**
 * Read a project file through the host.
 * @returns {*} Host result, or null when unavailable
 */
function getProjectFile(...args) {
    const nc = getNC();
    if (!nc?.getProjectFile) return null;
    return nc.getProjectFile(...args);
}

/**
 * Ensure a project file exists through the host.
 * @returns {*} Host result, or null when unavailable
 */
function ensureProjectFile(...args) {
    const nc = getNC();
    if (!nc?.ensureProjectFile) return null;
    return nc.ensureProjectFile(...args);
}

/**
 * Create a project file through the host.
 * @returns {*} Host result, or null when unavailable
 */
function createProjectFile(...args) {
    const nc = getNC();
    if (!nc?.createProjectFile) return null;
    return nc.createProjectFile(...args);
}

/**
 * Show a notice through the host.
 * @returns {*} Host result, or null when unavailable
 */
function showNotice(...args) {
    const nc = getNC();
    if (!nc?.showNotice) return null;
    return nc.showNotice(...args);
}

module.exports = {
    getNC,
    isNarrativeCanvasActive,
    chooseProjectFile,
    getProjectFile,
    ensureProjectFile,
    createProjectFile,
    showNotice
};

// blank.js — blank saved-state factory for narrative-graph (Phase 11, NG-01)
//
// Mirrors narrative-tool's createBlankNcanvas (src/main.js), which itself
// mirrors NarrativeCanvas's createBlankSavedState: a single Entry start node.
//
// Pure module: no obsidian imports, no DOM access (purity guard).

const { SAVED_STATE_VERSION } = require('./constants');

/**
 * Create a blank .ncanvas saved-state v1 object.
 *
 * @param {string} title - Project title (falls back to 'Untitled')
 * @returns {Object} A saved-state object ready for serializeSavedState()
 */
function createBlankSavedState(title) {
    const projectTitle = String(title || '').trim() || 'Untitled';
    return {
        version: SAVED_STATE_VERSION,
        savedAt: new Date().toISOString(),
        project: {
            title: projectTitle,
            notes: '',
            variables: {},
            characters: [],
            nodes: [
                { id: 'n0', type: 'Entry', title: 'Start', body: 'Adventure Begins', x: 120, y: 120 }
            ],
            links: []
        },
        ui: {
            selectedNodeId: 'n0',
            selectedLinkId: null,
            panel: 'project',
            activeFileId: 'adventure',
            view: { x: 0, y: 0, scale: 0.5 },
            search: '',
            characterSearch: '',
            eventSearch: '',
            playbookJsonOpen: false
        }
    };
}

module.exports = {
    createBlankSavedState
};

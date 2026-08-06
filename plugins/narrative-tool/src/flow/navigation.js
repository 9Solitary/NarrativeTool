// navigation.js -- Cross-file navigation helper functions
//
// Provides: openDialogueFile, openFlowCanvas, openFileInSplit
//
// This module is function-based -- it receives `app` as a parameter rather than
// holding a reference to the Obsidian Plugin instance. This design enables
// testability (mock `app` in tests without needing an Obsidian runtime).
//
// All paths must be vault-relative (e.g., "Dialogues/innkeeper.ncanvas",
// "Flows/ch1.canvas"). Path validation is delegated to Obsidian's built-in
// link resolution via `openLinkText`.
//
// Error handling: all functions wrap openLinkText in try/catch, show a Notice
// on failure, and do not re-throw (to avoid breaking Obsidian command execution
// flow).

const { Notice } = require('obsidian');

/**
 * Open a Narrative Canvas dialogue file (.ncanvas) in split view.
 * Used for FLW-04: Flow -> Dialogue navigation from file-menu "Open linked dialogue".
 *
 * @param {import('obsidian').App} app - Obsidian App instance
 * @param {string} dialoguePath - vault-relative path to .ncanvas file (e.g., "Dialogues/innkeeper.ncanvas")
 * @returns {Promise<void>}
 */
async function openDialogueFile(app, dialoguePath) {
    try {
        const file = app.vault.getAbstractFileByPath(dialoguePath);
        if (!file) {
            new Notice('Dialogue file not found: ' + dialoguePath);
            return;
        }
        await app.workspace.openLinkText(dialoguePath, '', 'split');
    } catch (err) {
        new Notice('Failed to open: ' + dialoguePath + ' -- ' + (err.message || err));
    }
}

/**
 * Open a Flow Canvas (.canvas) in split view.
 * Used for FLW-05: Dialogue -> Flow reverse navigation.
 *
 * @param {import('obsidian').App} app - Obsidian App instance
 * @param {string} flowPath - vault-relative path to .canvas file (e.g., "Flows/ch1.canvas")
 * @returns {Promise<void>}
 */
async function openFlowCanvas(app, flowPath) {
    try {
        const file = app.vault.getAbstractFileByPath(flowPath);
        if (!file) {
            new Notice('Flow canvas not found: ' + flowPath);
            return;
        }
        await app.workspace.openLinkText(flowPath, '', 'split');
    } catch (err) {
        new Notice('Failed to open: ' + flowPath + ' -- ' + (err.message || err));
    }
}

/**
 * Open any file in a new pane (split).
 * Generic helper -- always opens in a new leaf without replacing the current view.
 *
 * @param {import('obsidian').App} app - Obsidian App instance
 * @param {string} filePath - vault-relative path to any file
 * @returns {Promise<void>}
 */
async function openFileInSplit(app, filePath) {
    try {
        await app.workspace.openLinkText(filePath, '', true);
    } catch (err) {
        new Notice('Failed to open: ' + filePath + ' -- ' + (err.message || err));
    }
}

module.exports = {
    openDialogueFile,
    openFlowCanvas,
    openFileInSplit,
};

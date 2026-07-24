// Minimal Plugin wrapper for Dialogue Export
// Following Pattern 1: Minimal Plugin Wrapper from RESEARCH.md
// Phase 2 will add full .ncanvas to .dialogue export engine.
const { Plugin } = require('obsidian');

module.exports = class DialogueExportPlugin extends Plugin {
    async onload() {
        console.log('[Dialogue Export] loaded');

        this.addCommand({
            id: 'export-current-dialogue',
            name: 'Export current dialogue',
            callback: () => {
                console.log('[Dialogue Export] export triggered (not yet implemented)');
            }
        });
    }

    async onunload() {
        console.log('[Dialogue Export] unloaded');
    }
};

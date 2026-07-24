// Minimal Plugin wrapper for Narrative Project
// Following Pattern 1: Minimal Plugin Wrapper from RESEARCH.md
// Phase 4 will add project-wide configuration and coordination logic.
const { Plugin } = require('obsidian');

module.exports = class NarrativeProjectPlugin extends Plugin {
    async onload() {
        console.log('[Narrative Project] loaded');

        this.addCommand({
            id: 'configure-project',
            name: 'Configure project settings',
            callback: () => {
                console.log('[Narrative Project] configure-project triggered (not yet implemented)');
            }
        });
    }

    async onunload() {
        console.log('[Narrative Project] unloaded');
    }
};

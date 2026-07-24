// Minimal Plugin wrapper for Flow Tools
// Following Pattern 1: Minimal Plugin Wrapper from RESEARCH.md
// Phase 3 will add full Flow Canvas creation and navigation logic.
const { Plugin } = require('obsidian');

module.exports = class FlowToolsPlugin extends Plugin {
    async onload() {
        console.log('[Flow Tools] loaded');

        this.addCommand({
            id: 'create-flow-canvas',
            name: 'Create Flow Canvas',
            callback: () => {
                console.log('[Flow Tools] create-flow-canvas triggered (not yet implemented)');
            }
        });
    }

    async onunload() {
        console.log('[Flow Tools] unloaded');
    }
};

// Narrative Project Plugin — project-wide configuration and coordination
// Follows ARCHITECTURE.md Pattern 3: Shared Settings via Plugin Data API.
//
// Settings are exposed directly on the plugin instance (not private) so
// other plugins can read them via:
//   app.plugins.plugins['narrative-project'].settings

const { Plugin } = require('obsidian');
const { DEFAULT_SETTINGS, NarrativeProjectSettingTab } = require('./settings');

module.exports = class NarrativeProjectPlugin extends Plugin {
    async onload() {
        // 1. Load saved settings, merging with defaults for any new fields
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // 2. Register the settings tab so it appears in Obsidian Settings
        this.addSettingTab(new NarrativeProjectSettingTab(this.app, this));

        console.log('[Narrative Project] loaded with settings:', this.settings);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async onunload() {
        console.log('[Narrative Project] unloaded');
    }
};

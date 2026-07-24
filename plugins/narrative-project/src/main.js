// Narrative Project Plugin — project-wide configuration and coordination
// Follows ARCHITECTURE.md Pattern 3: Shared Settings via Plugin Data API.
//
// Settings are exposed directly on the plugin instance (not private) so
// other plugins can read them via:
//   app.plugins.plugins['narrative-project'].settings

const { Plugin } = require('obsidian');
const { DEFAULT_SETTINGS, NarrativeProjectSettingTab } = require('./settings');
const { StatusBarManager } = require('./status-bar');
const { exportAllDialogues } = require('./batch-export');

module.exports = class NarrativeProjectPlugin extends Plugin {
    async onload() {
        // 1. Load saved settings, merging with defaults for any new fields
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // 2. Register the settings tab so it appears in Obsidian Settings
        this.addSettingTab(new NarrativeProjectSettingTab(this.app, this));

        // 3. Initialize the status bar for export progress feedback
        this.statusBar = new StatusBarManager(this);

        // 4. Register the batch export command
        this.addCommand({
            id: 'batch-export-all-dialogues',
            name: 'Batch Export All Dialogues',
            callback: () => this.batchExportAllDialogues()
        });

        console.log('[Narrative Project] loaded with settings:', this.settings);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * Execute a batch export of all .ncanvas files in the configured scope.
     * Updates the status bar through pending -> exporting -> success/failure.
     */
    async batchExportAllDialogues() {
        const { exportPath, exportScope, medEnabled } = this.settings;

        // Show exporting state on the status bar
        this.statusBar.setState('exporting');

        try {
            const result = await exportAllDialogues(
                this.app, exportPath, exportScope, medEnabled
            );

            // Update status bar with result
            this.statusBar.setState('success', result);

            // Show ephemeral notification for summary
            const { Notice } = require('obsidian');
            new Notice(`[NP] ${result.exported} exported, ${result.failed} failed`);
        } catch (err) {
            // Show failure state on status bar
            this.statusBar.setState('failure', { message: err.message });

            // Show ephemeral notification for error
            const { Notice } = require('obsidian');
            new Notice(`[NP] Batch export failed: ${err.message}`);
        }
    }

    async onunload() {
        if (this.statusBar) {
            this.statusBar.destroy();
        }
        console.log('[Narrative Project] unloaded');
    }
};

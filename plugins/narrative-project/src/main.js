// Narrative Project Plugin — project-wide configuration and coordination
// Follows ARCHITECTURE.md Pattern 3: Shared Settings via Plugin Data API.
//
// Settings are exposed directly on the plugin instance (not private) so
// other plugins can read them via:
//   app.plugins.plugins['narrative-project'].settings

const { Plugin } = require('obsidian');
// 05-03: modules moved into the merged narrative-tool plugin — re-pointed (Rule 3 fix)
const { DEFAULT_SETTINGS, NarrativeToolSettingTab } = require('../../narrative-tool/src/ui/settings');
const { StatusBarManager } = require('../../narrative-tool/src/ui/status-bar');
const { exportAllDialogues } = require('../../narrative-tool/src/commands/batch-export');
const { setupAutoExport, teardownAutoExport } = require('../../narrative-tool/src/commands/auto-export');
const { validateReferences } = require('../../narrative-tool/src/commands/reference-validator');

module.exports = class NarrativeProjectPlugin extends Plugin {
    async onload() {
        // 1. Load saved settings, merging with defaults for any new fields
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // 2. Register the settings tab so it appears in Obsidian Settings
        this.addSettingTab(new NarrativeToolSettingTab(this.app, this));

        // 3. Initialize the status bar for export progress feedback
        this.statusBar = new StatusBarManager(this);

        // 4. Register the batch export command
        this.addCommand({
            id: 'batch-export-all-dialogues',
            name: 'Batch Export All Dialogues',
            callback: () => this.batchExportAllDialogues()
        });

        // 5. Install auto-export listener: debounced .ncanvas → .dialogue on save
        setupAutoExport(this, (results) => {
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;
            if (successCount > 0 && failCount === 0) {
                this.statusBar.setState('success', { exported: successCount, failed: 0 });
                // Auto-revert to pending after 5 seconds
                if (this._autoExportTimeout) clearTimeout(this._autoExportTimeout);
                this._autoExportTimeout = setTimeout(() => {
                    this.statusBar.setState('pending');
                }, 5000);
            } else if (failCount > 0) {
                this.statusBar.setState('failure', { message: `${failCount} auto-export failed` });
            }
        });

        // 6. Register the "Validate Flow→Dialogue references" command
        this.addCommand({
            id: 'validate-references',
            name: 'Validate Flow→Dialogue references',
            callback: () => this.runReferenceValidation()
        });

        // 7. Register the "Export Current Dialogue" single-file export command
        this.addCommand({
            id: 'export-current-dialogue',
            name: 'Export current .ncanvas dialogue',
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile || activeFile.extension !== 'ncanvas') {
                    const { Notice } = require('obsidian');
                    new Notice('[NP] Open a .ncanvas file first');
                    return;
                }
                this.statusBar.setState('exporting', { count: 1 });
                const { exportSingleFile } = require('../../narrative-tool/src/commands/auto-export');
                const result = await exportSingleFile(
                    this.app, activeFile, this.settings.exportPath, this.settings.medEnabled
                );
                if (result.success) {
                    this.statusBar.setState('success', { exported: 1, failed: 0 });
                    const { Notice } = require('obsidian');
                    new Notice(`[NP] Exported: ${activeFile.basename}`);
                    setTimeout(() => this.statusBar.setState('pending'), 5000);
                } else {
                    this.statusBar.setState('failure', { message: result.error });
                    const { Notice } = require('obsidian');
                    new Notice(`[NP] Export failed: ${result.error}`);
                }
            }
        });

        console.log('[Narrative Project] loaded with settings:', this.settings);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * Execute a batch export of all .ncanvas files in the configured scope.
     * Updates the status bar through exporting -> success/failure -> pending (5s).
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

            // Auto-revert to pending after 5 seconds
            setTimeout(() => this.statusBar.setState('pending'), 5000);

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

    /**
     * Run the Flow→Dialogue reference integrity check.
     * Scans all .canvas files for .ncanvas file references and reports
     * broken links via status bar, notification, and console.warn.
     */
    async runReferenceValidation() {
        this.statusBar.setState('exporting');
        try {
            const result = await validateReferences(this.app);
            if (result.brokenRefs === 0) {
                this.statusBar.setState('success', { exported: result.totalRefs, failed: 0 });
                const { Notice } = require('obsidian');
                new Notice(`[NP] All ${result.totalRefs} references valid`);
                // Auto-revert to pending after 5 seconds
                setTimeout(() => this.statusBar.setState('pending'), 5000);
            } else {
                this.statusBar.setState('failure', { message: `${result.brokenRefs} broken refs` });
                const { Notice } = require('obsidian');
                new Notice(`[NP] ${result.brokenRefs} broken references found. See console for details.`);
                console.warn('[NP] Broken Flow→Dialogue references:', result.details);
            }
        } catch (err) {
            this.statusBar.setState('failure', { message: 'Reference check failed' });
            const { Notice } = require('obsidian');
            new Notice(`[NP] Reference validation failed: ${err.message}`);
        }
    }

    async onunload() {
        teardownAutoExport(this);
        if (this._autoExportTimeout) clearTimeout(this._autoExportTimeout);
        if (this.statusBar) {
            this.statusBar.destroy();
        }
        console.log('[Narrative Project] unloaded');
    }
};

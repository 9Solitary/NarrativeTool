// settings.js — Narrative Project settings tab
//
// Provides DEFAULT_SETTINGS constants and NarrativeToolSettingTab class.
// Follows ARCHITECTURE.md Pattern 3: Shared Settings via Plugin Data API.
//
// DEFAULT_SETTINGS values align with:
//   - exportPath: "Exports" (PROJ-01 vault-relative path)
//   - medEnabled: true (consistent with Phase 2 exportCurrentDialogue default)
//   - exportScope: "/" (vault root — all .ncanvas files are in export scope)

const { PluginSettingTab, Setting } = require('obsidian');

// ---------------------------------------------------------------------------
// DEFAULT_SETTINGS — project-wide configuration defaults
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = Object.freeze({
    /** Vault-relative directory for Godot .dialogue exports */
    exportPath: 'Exports',

    /** Whether to include MED project state extension syntax in exports */
    medEnabled: true,

    /** Vault path to scope export operations. "/" means entire vault. */
    exportScope: '/'
});

// ---------------------------------------------------------------------------
// NarrativeToolSettingTab — Obsidian Settings tab for project configuration
// ---------------------------------------------------------------------------

class NarrativeToolSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;

        containerEl.empty();

        // --- Export Path ---
        new Setting(containerEl)
            .setName('Export Path')
            .setDesc('Vault-relative directory where exported .dialogue files are written.')
            .addText(text => text
                .setPlaceholder('e.g., Exports')
                .setValue(this.plugin.settings.exportPath)
                .onChange(async (value) => {
                    this.plugin.settings.exportPath = value;
                    await this.plugin.saveSettings();
                }));

        // --- MED Enabled ---
        new Setting(containerEl)
            .setName('MED Enabled')
            .setDesc('Include MED project state extension syntax in dialogue exports (using S, do set_flag, [#check], [term]).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.medEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.medEnabled = value;
                    await this.plugin.saveSettings();
                }));

        // --- Export Scope ---
        new Setting(containerEl)
            .setName('Export Scope Directory')
            .setDesc('Vault directory to scope export operations. "/" means all .ncanvas files in the vault.')
            .addText(text => text
                .setPlaceholder('/')
                .setValue(this.plugin.settings.exportScope)
                .onChange(async (value) => {
                    this.plugin.settings.exportScope = value;
                    await this.plugin.saveSettings();
                }));
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { DEFAULT_SETTINGS, NarrativeToolSettingTab };

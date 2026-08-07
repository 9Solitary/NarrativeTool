// settings.js — Narrative Tool 设置页
//
// Provides DEFAULT_SETTINGS constants and NarrativeToolSettingTab class.
// Follows ARCHITECTURE.md Pattern 3: Shared Settings via Plugin Data API.
//
// DEFAULT_SETTINGS values align with:
//   - exportPath: "Exports" (PROJ-01 vault-relative path)
//   - medEnabled: true (consistent with Phase 2 exportCurrentDialogue default)
//   - exportScope: "/" (vault root — all .ncanvas files are in export scope)
//
// Phase 8 (UX-01): Export Path gains a "浏览…" button using Electron's
// native folder picker. require('electron') is lazy + guarded so this file
// stays importable from plain Node (tests) where electron does not exist.

const { PluginSettingTab, Setting } = require('obsidian');
const { notify } = require('./notify');

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
// pickExportDirectory — Electron native folder picker (UX-01)
//
// Returns the chosen absolute path, or null when cancelled / unavailable.
// Lazy require + try/catch: electron.remote is only present inside the
// Obsidian desktop app (verified remote-ok, D5); in Node tests or mobile
// it throws and we return null so the caller can fall back to manual entry.
// ---------------------------------------------------------------------------

async function pickExportDirectory() {
    let dialog = null;
    try {
        dialog = require('electron').remote.dialog;
    } catch (e) {
        return null;
    }
    try {
        const result = await dialog.showOpenDialog({
            title: '选择导出目录',
            properties: ['openDirectory', 'createDirectory']
        });
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            return null;
        }
        // Normalize Windows backslashes to forward slashes (paths.js convention)
        return result.filePaths[0].replace(/\\/g, '/');
    } catch (e) {
        return null;
    }
}

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

        // --- 导出路径 ---
        new Setting(containerEl)
            .setName('导出路径')
            .setDesc('导出的 .dialogue 文件写入目录。支持 vault 相对路径（如 Exports）或绝对路径（如 D:/Godot/dialogues）；留空则写到 .ncanvas 源文件旁。')
            .addText(text => {
                this._exportPathText = text;
                text
                    .setPlaceholder('例如 Exports')
                    .setValue(this.plugin.settings.exportPath)
                    .onChange(async (value) => {
                        this.plugin.settings.exportPath = value;
                        await this.plugin.saveSettings();
                    });
            })
            .addButton(button => button
                .setButtonText('浏览…')
                .onClick(async () => {
                    const dir = await pickExportDirectory();
                    if (!dir) {
                        // null = 取消或选择器不可用；仅在选择器不可用时提示
                        let available = true;
                        try { require('electron').remote.dialog; } catch (e) { available = false; }
                        if (!available) {
                            notify('文件夹选择器不可用，请手动输入路径', 'error');
                        }
                        return;
                    }
                    this.plugin.settings.exportPath = dir;
                    this._exportPathText.setValue(dir);
                    await this.plugin.saveSettings();
                }));

        // --- MED 扩展语法 ---
        new Setting(containerEl)
            .setName('MED 扩展语法')
            .setDesc('在导出的对话中包含 MED 项目状态扩展语法（using S、do set_flag、[#check]、[term]）。')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.medEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.medEnabled = value;
                    await this.plugin.saveSettings();
                }));

        // --- 导出范围目录 ---
        new Setting(containerEl)
            .setName('导出范围目录')
            .setDesc('批量导出的 vault 目录范围。"/" 表示整个库中的所有 .ncanvas 文件。')
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

module.exports = { DEFAULT_SETTINGS, NarrativeToolSettingTab, pickExportDirectory };

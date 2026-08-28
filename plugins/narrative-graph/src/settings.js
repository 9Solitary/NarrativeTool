// settings.js — narrative-graph 设置页（Phase 11 M2a, NG-06）
//
// 目前只有一项：全局变量表路径。与 narrative-tool 的 variablesPath 指向
// 同一文件（契约见 model/variables.js 头注）。

const { PluginSettingTab, Setting } = require('obsidian');
const { DEFAULT_VARIABLES_PATH } = require('./model/variables');

const DEFAULT_SETTINGS = Object.freeze({
    /** 全局变量表的 vault 相对路径（NG-06） */
    variablesPath: DEFAULT_VARIABLES_PATH
});

class NarrativeGraphSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('全局变量表路径')
            .setDesc('变量表面板读写、以及 narrative-tool 导出合并的全局变量表（markdown 表格：变量|类型|初始值|备注）。')
            .addText(text => text
                .setPlaceholder(DEFAULT_VARIABLES_PATH)
                .setValue(this.plugin.settings.variablesPath)
                .onChange(async (value) => {
                    this.plugin.settings.variablesPath = value;
                    await this.plugin.saveSettings();
                }));
    }
}

module.exports = { DEFAULT_SETTINGS, NarrativeGraphSettingTab };

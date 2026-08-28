// Narrative Graph Plugin — Phase 11 canvas view (NG-01/NG-02/NG-09) + M2a
// global variables (NG-06)
//
// Replaces the NarrativeCanvas visual node editor while keeping 100%
// saved-state v1 / .ncanvas compatibility (NG-01/NG-02). M1 ships the canvas
// rendering + navigation + editing closed loop (src/view/); M2a adds the
// global variables table (Variables.md) — settings field, canvas-view side
// panel, and the merge-file-variables command.
//
// Transition: keep the file extension; disable the NarrativeCanvas plugin so
// this view takes over .ncanvas files (NG-02).

const { Plugin, Notice } = require('obsidian');
const { NarrativeGraphView, VIEW_TYPE_NARRATIVE_GRAPH } = require('./view/canvas-view');
const { DEFAULT_SETTINGS, NarrativeGraphSettingTab } = require('./settings');
const varsModel = require('./model/variables');
const styles = require('./styles.css');

const STYLE_ID = 'narrative-graph-styles';

module.exports = class NarrativeGraphPlugin extends Plugin {
    async onload() {
        console.log('[Narrative Graph] loaded v' + this.manifest.version);

        await this.loadSettings();
        this.addSettingTab(new NarrativeGraphSettingTab(this.app, this));

        // Runtime style injection (same pattern as narrative-tool BUG-06)
        const styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
        this.register(() => styleEl.remove());

        this.registerView(VIEW_TYPE_NARRATIVE_GRAPH, (leaf) => {
            const view = new NarrativeGraphView(leaf);
            view.plugin = this; // settings access (variablesPath)
            return view;
        });
        this.registerExtensions(['ncanvas'], VIEW_TYPE_NARRATIVE_GRAPH);

        // NG-06: 把当前 .ncanvas 的 project.variables 并入全局变量表
        // （并从文件内移除——有意迁移，结果通过 Notice 确认，不用 modal）
        this.addCommand({
            id: 'merge-file-variables',
            name: '将当前对话的局部变量并入全局表',
            callback: () => this.mergeFileVariablesIntoGlobal()
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // 找到当前活动的 narrative-graph 视图
    _activeGraphView() {
        if (typeof this.app.workspace.getActiveViewOfType === 'function') {
            const v = this.app.workspace.getActiveViewOfType(NarrativeGraphView);
            if (v) return v;
        }
        const leaf = this.app.workspace.activeLeaf;
        return (leaf && leaf.view instanceof NarrativeGraphView) ? leaf.view : null;
    }

    /**
     * NG-06 迁移命令：当前文件的 project.variables 并入全局 Variables.md，
     * 并从文件内移除已并入的名字。类型推断值优先（bool→bool、number→number，
     * UAT-6），其余按前缀推断（flag_→bool、res_→number）。
     */
    async mergeFileVariablesIntoGlobal() {
        const view = this._activeGraphView();
        if (!view || !view._state || !view._state.project) {
            new Notice('请先打开一个 .ncanvas 对话文件');
            return;
        }
        const project = view._state.project;
        const fileVars = (project.variables && typeof project.variables === 'object')
            ? project.variables : {};
        if (Object.keys(fileVars).length === 0) {
            new Notice('当前文件没有局部变量可并入');
            return;
        }

        try {
            const path = (this.settings.variablesPath && this.settings.variablesPath.trim())
                || varsModel.DEFAULT_VARIABLES_PATH;
            let file = this.app.vault.getAbstractFileByPath(path);
            let content;
            if (file) {
                content = await this.app.vault.read(file);
            } else {
                content = varsModel.EMPTY_VARIABLES_FILE;
                await this.app.vault.create(path, content);
                file = this.app.vault.getAbstractFileByPath(path);
            }

            const { entries } = varsModel.parseVariablesTable(content);
            const newEntries = varsModel.mergeFileVariables(entries, fileVars);
            if (newEntries.length === 0) {
                new Notice('所有局部变量已存在于全局表，无需并入');
                return;
            }

            const next = varsModel.serializeVariablesTable(content, entries.concat(newEntries));
            await this.app.vault.modify(file, next);

            // 从文件内移除已并入的名字（字节级 round-trip 由模型层 serialize 保证）
            for (const e of newEntries) {
                delete project.variables[e.name];
            }
            view._afterMutation();

            new Notice(`已并入 ${newEntries.length} 个变量到 ${path}：`
                + newEntries.map(e => e.name).join('、'));
        } catch (err) {
            console.warn('[Narrative Graph] 合并变量失败:', err.message);
            new Notice(`合并变量失败：${err.message}`);
        }
    }
};

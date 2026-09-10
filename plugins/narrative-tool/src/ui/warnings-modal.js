// warnings-modal.js -- Persistent diagnostics viewer (red/yellow lint list)
//
// Opened by clicking the status bar while it shows the diagnostic state.
// Lists every export diagnostic entry ({ level: 'error'|'warn', text }),
// errors first. Red entries mean the export is wrong or lossy and block
// auto-export until resolved.

const { Modal } = require('obsidian');

class WarningsModal extends Modal {
    /**
     * @param {import('obsidian').App} app
     * @param {Array<{level: string, text: string}>} entries - diagnostics to list
     */
    constructor(app, entries) {
        super(app);
        this._entries = Array.isArray(entries) ? entries : [];
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('nt-warnings-modal');
        const errors = this._entries.filter(e => e && e.level === 'error');
        const warns = this._entries.filter(e => !e || e.level !== 'error');

        contentEl.createEl('h2', { text: '导出诊断' });
        if (errors.length > 0) {
            contentEl.createEl('p', {
                cls: 'nt-warnings-modal__hint',
                text: `存在 ${errors.length} 条错误（红）：自动导出已停用，修复后自动恢复。`
            });
        }

        const list = contentEl.createEl('div', { cls: 'nt-warnings-modal__list' });
        if (this._entries.length === 0) {
            list.createEl('p', { text: '（当前没有诊断信息）' });
            return;
        }
        for (const entry of [...errors, ...warns]) {
            const row = list.createEl('div', {
                cls: 'nt-warnings-modal__row nt-warnings-modal__row--' +
                    (entry && entry.level === 'error' ? 'error' : 'warn')
            });
            row.createEl('span', {
                cls: 'nt-warnings-modal__badge',
                text: entry && entry.level === 'error' ? '错误' : '警告'
            });
            row.createEl('span', { text: entry ? entry.text : String(entry) });
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

module.exports = { WarningsModal };

// variables-panel.js — 全局变量表编辑面板（Phase 11 M2a, NG-06）
//
// 画布视图侧栏：把 Variables.md 全局表渲染为可编辑网格（变量名 / 类型下拉 /
// 初始值 / 备注 + 增删行）。本文件只做 DOM；解析/序列化/校验全部在纯模块
// model/variables.js。编辑通过 callbacks.onCommit(entries) 提交，由
// canvas-view 负责防抖写回 Variables.md。
//
// entry 形状：{ name, type, initial, note } —— 全部为原始字符串（契约见
// model/variables.js 头注）。

const { validateEntries } = require('../model/variables');

const TYPE_OPTIONS = ['bool', 'number', 'string'];

class VariablesPanel {
    /**
     * @param {Object} callbacks
     * @param {Function} callbacks.onCommit - (entries) => void，任一行 change/删除时调用
     * @param {Function} callbacks.onClose - 关闭按钮点击
     */
    constructor(callbacks) {
        this._onCommit = callbacks.onCommit;
        this._onClose = callbacks.onClose;

        const el = document.createElement('div');
        el.className = 'ng-vars-panel ng-vars-panel--hidden';

        const header = document.createElement('div');
        header.className = 'ng-vars-panel__header';
        const title = document.createElement('span');
        title.className = 'ng-vars-panel__title';
        title.textContent = '全局变量';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'ng-vars-panel__close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => this._onClose());
        header.appendChild(title);
        header.appendChild(closeBtn);
        el.appendChild(header);

        const table = document.createElement('table');
        table.className = 'ng-vars-panel__grid';
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (const col of ['变量', '类型', '初始值', '备注', '']) {
            const th = document.createElement('th');
            th.textContent = col;
            headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);
        this._tbody = document.createElement('tbody');
        table.appendChild(this._tbody);
        el.appendChild(table);

        const footer = document.createElement('div');
        footer.className = 'ng-vars-panel__footer';
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'ng-vars-panel__add';
        addBtn.textContent = '+ 添加变量';
        addBtn.addEventListener('click', () => {
            const row = this._buildRow({ name: '', type: '', initial: '', note: '' });
            this._tbody.appendChild(row);
            const nameInput = row.querySelector('.ng-vars-panel__name');
            if (nameInput) nameInput.focus();
        });
        footer.appendChild(addBtn);
        this._warningsEl = document.createElement('div');
        this._warningsEl.className = 'ng-vars-panel__warnings';
        footer.appendChild(this._warningsEl);
        el.appendChild(footer);

        this.el = el;
    }

    /** 全量重渲染网格（外部刷新 / 初次加载）。 */
    setEntries(entries, warnings) {
        this._tbody.textContent = '';
        for (const entry of entries || []) {
            this._tbody.appendChild(this._buildRow(entry));
        }
        this.setWarnings(warnings);
    }

    /** 只更新警告行（编辑提交时用，避免重渲染打断输入）。 */
    setWarnings(warnings) {
        this._warningsEl.textContent = (warnings || []).join('；');
    }

    _buildRow(entry) {
        const row = document.createElement('tr');

        const nameTd = document.createElement('td');
        const nameInput = document.createElement('input');
        nameInput.className = 'ng-vars-panel__name';
        nameInput.type = 'text';
        nameInput.placeholder = 'flag_/res_';
        nameInput.value = entry.name || '';
        nameTd.appendChild(nameInput);
        row.appendChild(nameTd);

        const typeTd = document.createElement('td');
        const typeSel = document.createElement('select');
        typeSel.className = 'ng-vars-panel__type';
        for (const t of TYPE_OPTIONS) {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            typeSel.appendChild(opt);
        }
        typeSel.value = TYPE_OPTIONS.includes(entry.type) ? entry.type : '';
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '(推断)';
        typeSel.insertBefore(emptyOpt, typeSel.firstChild);
        typeTd.appendChild(typeSel);
        row.appendChild(typeTd);

        const initTd = document.createElement('td');
        const initInput = document.createElement('input');
        initInput.className = 'ng-vars-panel__initial';
        initInput.type = 'text';
        initInput.value = entry.initial || '';
        initTd.appendChild(initInput);
        row.appendChild(initTd);

        const noteTd = document.createElement('td');
        const noteInput = document.createElement('input');
        noteInput.className = 'ng-vars-panel__note';
        noteInput.type = 'text';
        noteInput.value = entry.note || '';
        noteTd.appendChild(noteInput);
        row.appendChild(noteTd);

        const delTd = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'ng-vars-panel__del';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', () => {
            row.remove();
            this._onCommit(this._collectEntries());
        });
        delTd.appendChild(delBtn);
        row.appendChild(delTd);

        // change（blur/Enter）才提交，避免逐键写入文件
        const commit = () => this._onCommit(this._collectEntries());
        nameInput.addEventListener('change', commit);
        typeSel.addEventListener('change', commit);
        initInput.addEventListener('change', commit);
        noteInput.addEventListener('change', commit);

        return row;
    }

    _collectEntries() {
        const entries = [];
        for (const row of this._tbody.querySelectorAll('tr')) {
            entries.push({
                name: row.querySelector('.ng-vars-panel__name').value.trim(),
                type: row.querySelector('.ng-vars-panel__type').value,
                initial: row.querySelector('.ng-vars-panel__initial').value,
                note: row.querySelector('.ng-vars-panel__note').value
            });
        }
        return entries;
    }

    /** 当前网格内容的校验警告（供宿主即时显示）。 */
    validateCurrent() {
        return validateEntries(this._collectEntries());
    }

    destroy() {
        this.el.remove();
    }
}

module.exports = { VariablesPanel };

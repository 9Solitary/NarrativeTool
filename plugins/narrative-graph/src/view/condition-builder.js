// condition-builder.js — 条件可视化构建器（Phase 11 M2b, NG-07）
//
// 薄 DOM 层：嵌在 editor.js 的连线条件编辑器与 Choice 选项行里。表达式模型
// 与解析/序列化全部在纯模块 model/conditions.js；本文件只做控件与双向同步。
//
// 用法：attachConditionBuilder(host, field, { getVariables })
//   - field 是宿主已有的文本输入（提交路径读 field.value，保持兼容）；
//     构建器把它挪进可折叠的「文本编辑」区，并接管双向同步：
//       构建器编辑 → 序列化 → field.value
//       field change → 可解析则重建子句行，否则显示「仅支持文本编辑」
//   - getVariables() → [{ name, type }]（全局 Variables.md 条目缓存；
//     缺失/为空时变量名自由文本输入仍然可用）
//
// 子句行：类型（变量/时间段）+ 变量名（datalist 补全）+ 运算符 + 值控件
// （按变量类型：bool → true/false 下拉；number → 数字输入；其余 → 文本，
// 序列化时自动加引号）+ 删除。时间段子句 = 上午/下午/黄昏/深夜复选框
// （at_period(0-3)，多选序列化为 (at_period(2) || at_period(3))）。

const condModel = require('../model/conditions');

let datalistSeq = 0;

const PERIOD_LABELS = ['上午', '下午', '黄昏', '深夜'];
const OP_LABELS = [
    ['===', '等于'], ['!==', '不等于'], ['>=', '≥'], ['<=', '≤'], ['>', '＞'], ['<', '＜'],
    ['truthy', '为真'], ['falsy', '为假']
];

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

/**
 * 给宿主的条件文本输入挂上可视化构建器。
 *
 * @param {HTMLElement} host - 构建器 UI 插入到 field 之前的容器
 * @param {HTMLInputElement} field - 宿主的条件文本输入（保持 class/读取路径不变）
 * @param {{ getVariables?: () => Array<{name: string, type: string}> }} [opts]
 * @returns {{ syncFromText: () => void }} syncFromText 供宿主在外部改写
 *   field.value 后主动重建（一般不需要——field 的 change 事件已监听）
 */
function attachConditionBuilder(host, field, opts) {
    const getVariables = (opts && opts.getVariables) || (() => []);
    const datalistId = `ng-cond-vars-${++datalistSeq}`;

    const root = el('div', 'ng-cond');
    const rowsEl = el('div', 'ng-cond__rows');
    const bar = el('div', 'ng-cond__bar');
    const note = el('div', 'ng-cond__note', '表达式较复杂，仅支持文本编辑');
    note.style.display = 'none';
    const details = el('details', 'ng-cond__raw');
    const summary = el('summary', '', '文本编辑');
    details.appendChild(summary);
    details.appendChild(field);

    const addBtn = el('button', 'ng-cond__add', '+ 子句');
    addBtn.type = 'button';
    const combBtn = el('button', 'ng-cond__comb');
    combBtn.type = 'button';
    bar.appendChild(addBtn);
    bar.appendChild(combBtn);

    root.appendChild(rowsEl);
    root.appendChild(bar);
    root.appendChild(note);
    root.appendChild(details);
    host.insertBefore(root, field.parentNode === host ? field : null);
    if (field.parentNode !== details) details.appendChild(field); // 挪进折叠区

    // 变量名 datalist（自由文本仍然合法）
    const datalist = document.createElement('datalist');
    datalist.id = datalistId;
    root.appendChild(datalist);

    let model = condModel.parseCondition(field.value);
    let rawOnly = !Array.isArray(model.clauses);

    function variableTypeOf(name) {
        const found = getVariables().find(v => v && v.name === name);
        return found ? found.type : '';
    }

    function syncText() {
        field.value = condModel.serializeCondition(model);
    }

    function refreshDatalist() {
        datalist.textContent = '';
        for (const v of getVariables()) {
            if (!v || !v.name) continue;
            const opt = document.createElement('option');
            opt.value = v.name;
            datalist.appendChild(opt);
        }
    }

    function rebuild() {
        rawOnly = !Array.isArray(model.clauses);
        note.style.display = rawOnly ? '' : 'none';
        rowsEl.style.display = rawOnly ? 'none' : '';
        bar.style.display = rawOnly ? 'none' : '';
        if (rawOnly) {
            details.open = true;
            return;
        }
        combBtn.textContent = model.combinator === '||' ? '任一满足 (||)' : '全部满足 (&&)';
        refreshDatalist();
        rowsEl.textContent = '';
        model.clauses.forEach((clause, index) => rowsEl.appendChild(buildRow(clause, index)));
    }

    function buildRow(clause, index) {
        const row = el('div', 'ng-cond__row');

        // 子句类型
        const typeSel = el('select', 'ng-cond__clause-type');
        for (const [value, label] of [['state', '变量'], ['period', '时间段']]) {
            const opt = el('option', '', label);
            opt.value = value;
            if (clause.type === value) opt.selected = true;
            typeSel.appendChild(opt);
        }
        typeSel.addEventListener('change', () => {
            model.clauses[index] = typeSel.value === 'period'
                ? { type: 'period', periods: [] }
                : { type: 'state', key: '', op: '===', value: '' };
            rebuild();
            syncText();
        });
        row.appendChild(typeSel);

        if (clause.type === 'period') {
            const group = el('span', 'ng-cond__periods');
            PERIOD_LABELS.forEach((label, period) => {
                const item = el('label', 'ng-cond__period');
                const box = document.createElement('input');
                box.type = 'checkbox';
                box.checked = clause.periods.includes(period);
                box.addEventListener('change', () => {
                    const set = new Set(model.clauses[index].periods);
                    if (box.checked) set.add(period); else set.delete(period);
                    model.clauses[index].periods = [...set];
                    syncText();
                });
                item.appendChild(box);
                item.appendChild(document.createTextNode(label));
                group.appendChild(item);
            });
            row.appendChild(group);
        } else {
            // 变量名（datalist 补全 + 自由文本）
            const keyInput = el('input', 'ng-cond__key');
            keyInput.type = 'text';
            keyInput.placeholder = '变量名';
            keyInput.value = clause.key;
            keyInput.setAttribute('list', datalistId);
            keyInput.addEventListener('input', () => {
                model.clauses[index].key = keyInput.value.trim();
                refreshValueControl();
                syncText();
            });
            row.appendChild(keyInput);

            // 运算符
            const opSel = el('select', 'ng-cond__op');
            for (const [value, label] of OP_LABELS) {
                const opt = el('option', '', label);
                opt.value = value;
                if (clause.op === value) opt.selected = true;
                opSel.appendChild(opt);
            }
            opSel.addEventListener('change', () => {
                model.clauses[index].op = opSel.value;
                refreshValueControl();
                syncText();
            });
            row.appendChild(opSel);

            // 值控件（按变量类型；truthy/falsy 无值）
            const valueSlot = el('span', 'ng-cond__value');
            row.appendChild(valueSlot);
            const refreshValueControl = () => {
                valueSlot.textContent = '';
                const op = model.clauses[index].op;
                if (op === 'truthy' || op === 'falsy') {
                    model.clauses[index].value = '';
                    return;
                }
                const type = variableTypeOf(model.clauses[index].key);
                const raw = model.clauses[index].value;
                if (type === 'bool') {
                    const valSel = el('select', 'ng-cond__val');
                    for (const [v, label] of [['true', 'true'], ['false', 'false']]) {
                        const opt = el('option', '', label);
                        opt.value = v;
                        if (raw === v) opt.selected = true;
                        valSel.appendChild(opt);
                    }
                    valSel.addEventListener('change', () => {
                        model.clauses[index].value = valSel.value;
                        syncText();
                    });
                    valueSlot.appendChild(valSel);
                    return;
                }
                const valInput = el('input', 'ng-cond__val');
                valInput.type = 'text';
                if (type === 'number') {
                    valInput.placeholder = '数字';
                    valInput.value = raw;
                    valInput.addEventListener('input', () => {
                        model.clauses[index].value = valInput.value.trim();
                        syncText();
                    });
                } else {
                    // string / 未知类型：显示去引号原文，序列化时加引号
                    valInput.placeholder = '文本';
                    valInput.value = displayStringValue(raw);
                    valInput.addEventListener('input', () => {
                        model.clauses[index].value =
                            condModel.formatConditionLiteral('string', valInput.value) || '';
                        syncText();
                    });
                }
                valueSlot.appendChild(valInput);
            };
            refreshValueControl();
        }

        const delBtn = el('button', 'ng-cond__del', '×');
        delBtn.type = 'button';
        delBtn.addEventListener('click', () => {
            model.clauses.splice(index, 1);
            rebuild();
            syncText();
        });
        row.appendChild(delBtn);
        return row;
    }

    addBtn.addEventListener('click', () => {
        model.clauses.push({ type: 'state', key: '', op: '===', value: '' });
        rebuild();
        syncText();
    });

    combBtn.addEventListener('click', () => {
        model.combinator = model.combinator === '||' ? '&&' : '||';
        rebuild();
        syncText();
    });

    // 文本编辑 → 构建器（可解析才接管）
    field.addEventListener('change', () => {
        const parsed = condModel.parseCondition(field.value);
        if (Array.isArray(parsed.clauses)) {
            model = parsed;
        } else {
            model = parsed; // { raw } —— 保持文本独占
        }
        rebuild();
    });

    rebuild();
    return { syncFromText: rebuild };
}

// raw 字面量 → string 控件的显示值（去引号；非字符串字面量原样显示）
function displayStringValue(raw) {
    const t = String(raw || '');
    if (t.length >= 2 && t.startsWith('"')) {
        try { return JSON.parse(t); } catch (_e) { return t; }
    }
    return t;
}

module.exports = { attachConditionBuilder };

// variables.js — 全局变量表 Variables.md 解析/序列化/校验（Phase 11 M2a, NG-06）
//
// 契约（NG-06，narrative-tool 侧 commands/shared-variables.js 独立实现同一契约）：
//   - 全 vault 单文件，默认路径 vault 根下 `Variables.md`（DEFAULT_VARIABLES_PATH，
//     设置页可改），人工可编辑的 markdown 表格：
//       | 变量 | 类型 | 初始值 | 备注 |
//       | --- | --- | --- | --- |
//       | flag_helped_laotong | bool | false | 是否帮过老佟 |
//       | res_money | number | 100 | 现钱 |
//   - 变量名保留 flag_*/res_* 前缀约定（驱动 MED 翻译）；类型 ∈ bool|number|string
//     （仅展示+校验用）；初始值 = 字面量（true/false、数字或字符串）；备注自由文本
//   - 解析容忍：按表头行定位表格（匹配 4 个中文列名，允许空白差异），忽略其他
//     markdown；序列化只重写表格数据行，其余内容与列序逐字保留
//   - 校验只产警告不阻塞：前缀与类型不一致（flag_=bool、res_=number）、
//     重名、初始值无法按类型解析。无前缀名本身合法、不警告（UAT-6：引擎按
//     初始值字面量类型分类——bool→flag_ok/set_flag、number→res_ok——游戏
//     实测可用，见 11-01-PLAN.md UAT-6 条目）
//
// entry 形状：{ name, type, initial, note } —— 全部为表格单元格原始字符串
// （type 归一化为小写；initial 的字面量解析见 parseInitialValue / 引擎侧在
// narrative-tool 独立实现）。这样面板编辑与文件读写共用同一份原始字符串，
// 不存在双向转换损耗。
//
// Pure module: no obsidian imports, no DOM access (purity guard).

const DEFAULT_VARIABLES_PATH = 'Variables.md';

const VALID_TYPES = Object.freeze(['bool', 'number', 'string']);

// 新文件的初始内容（说明头 + 空表）
const EMPTY_VARIABLES_FILE = [
    '# 全局变量表',
    '',
    '全 vault 共享的对话变量（NG-06）。变量名保留 flag_/res_ 前缀（驱动 MED 翻译）；',
    '类型 ∈ bool|number|string；初始值为字面量（true/false、数字或字符串）。',
    '',
    '| 变量 | 类型 | 初始值 | 备注 |',
    '| --- | --- | --- | --- |',
    ''
].join('\n');

const HEADER_CELLS = ['变量', '类型', '初始值', '备注'];

// -------------------------------------------------------------------------
// 小工具
// -------------------------------------------------------------------------

function isTableLine(line) {
    const t = line.trim();
    return t.length >= 2 && t.startsWith('|') && t.endsWith('|');
}

function splitCells(line) {
    // 去掉首尾 | 后按未转义的 | 切分；单元格内 \| 表示字面竖线
    const inner = line.trim().slice(1, -1);
    return inner.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
}

function escapeCell(text) {
    return String(text === undefined || text === null ? '' : text).replace(/\|/g, '\\|');
}

function isSeparatorLine(line) {
    if (!isTableLine(line)) return false;
    return splitCells(line).every(c => /^:?-+:?$/.test(c.replace(/\s/g, '')));
}

// flag_→bool、res_→number、其余→string（NG-06 前缀约定）
function inferTypeFromPrefix(name) {
    if (typeof name === 'string') {
        if (name.startsWith('flag_')) return 'bool';
        if (name.startsWith('res_')) return 'number';
    }
    return 'string';
}

// 初始值字符串能否按类型解析为字面量（string 恒合法）
function isValidInitial(type, raw) {
    const t = String(raw === undefined || raw === null ? '' : raw).trim();
    if (type === 'bool') return /^(true|false)$/i.test(t);
    if (type === 'number') return t !== '' && !Number.isNaN(Number(t));
    return true;
}

/**
 * 把初始值字符串解析为 JS 字面量（bool/number/string）。
 * 解析失败时返回原始字符串（调用方应已通过 isValidInitial 校验）。
 *
 * @param {string} type - bool | number | string
 * @param {string} raw - 单元格原始字符串
 * @returns {boolean|number|string}
 */
function parseInitialValue(type, raw) {
    const t = String(raw === undefined || raw === null ? '' : raw).trim();
    if (type === 'bool') return /^true$/i.test(t);
    if (type === 'number') {
        const n = Number(t);
        return Number.isNaN(n) ? t : n;
    }
    return String(raw === undefined || raw === null ? '' : raw);
}

// -------------------------------------------------------------------------
// 表格定位（表头行匹配 4 个中文列名，允许空白差异与额外表格列）
// -------------------------------------------------------------------------

/**
 * 在 markdown 行数组中定位变量表格。
 *
 * @param {Array<string>} lines
 * @returns {{headerIdx:number, sepIdx:number, rowStart:number, rowEnd:number, colMap:Object}|null}
 *   rowEnd 为数据行结束的_exclusive_ 行号（第一个非表格行）。
 */
function locateTable(lines) {
    for (let i = 0; i < lines.length - 1; i++) {
        if (!isTableLine(lines[i])) continue;
        const cells = splitCells(lines[i]);
        const colMap = {};
        let ok = true;
        for (const name of HEADER_CELLS) {
            const idx = cells.indexOf(name);
            if (idx === -1) { ok = false; break; }
            colMap[name] = idx;
        }
        if (!ok) continue;
        if (!isSeparatorLine(lines[i + 1])) continue;
        let rowEnd = i + 2;
        while (rowEnd < lines.length && isTableLine(lines[rowEnd])) rowEnd++;
        return { headerIdx: i, sepIdx: i + 1, rowStart: i + 2, rowEnd, colMap };
    }
    return null;
}

// -------------------------------------------------------------------------
// parse
// -------------------------------------------------------------------------

/**
 * 解析 Variables.md 内容，返回表格条目与警告。
 * 找不到表格时返回空 entries（不视为错误——可能是新文件）。
 *
 * @param {string} markdown
 * @returns {{entries: Array<{name,type,initial,note}>, warnings: Array<string>}}
 */
function parseVariablesTable(markdown) {
    const lines = String(markdown || '').split('\n');
    const table = locateTable(lines);
    if (!table) return { entries: [], warnings: [] };

    const entries = [];
    for (let i = table.rowStart; i < table.rowEnd; i++) {
        const cells = splitCells(lines[i]);
        const get = (col) => {
            const idx = table.colMap[col];
            return idx < cells.length ? cells[idx] : '';
        };
        const entry = {
            name: get('变量'),
            type: get('类型').toLowerCase(),
            initial: get('初始值'),
            note: get('备注')
        };
        // 全空行跳过（容忍表格尾部留空行）
        if (!entry.name && !entry.type && !entry.initial && !entry.note) continue;
        entries.push(entry);
    }
    return { entries, warnings: validateEntries(entries) };
}

// -------------------------------------------------------------------------
// serialize（只重写数据行；其余内容与列序逐字保留）
// -------------------------------------------------------------------------

/**
 * 用 entries 重写原文中的变量表格数据行，返回完整 markdown。
 * 原文没有表格时在文末追加一个新表（列序 = 契约列序）。
 *
 * @param {string} originalMarkdown
 * @param {Array<{name,type,initial,note}>} entries
 * @returns {string}
 */
function serializeVariablesTable(originalMarkdown, entries) {
    const text = String(originalMarkdown === undefined || originalMarkdown === null ? '' : originalMarkdown);
    const lines = text.split('\n');
    const rows = (entries || [])
        .filter(e => e && String(e.name || '').trim() !== '')
        .map(e => '| ' + [e.name, e.type, e.initial, e.note].map(escapeCell).join(' | ') + ' |');

    const table = locateTable(lines);
    if (!table) {
        const block = [
            '| ' + HEADER_CELLS.join(' | ') + ' |',
            '| --- | --- | --- | --- |',
            ...rows
        ];
        // 空文档：直接输出表格块
        if (text.trim() === '') return block.join('\n');
        // 非空文档：保证新表前有一个空行
        const out = lines.slice();
        if (out[out.length - 1].trim() !== '') out.push('');
        out.push(...block);
        return out.join('\n');
    }

    const out = lines.slice(0, table.rowStart).concat(rows, lines.slice(table.rowEnd));
    return out.join('\n');
}

// -------------------------------------------------------------------------
// validate（警告不阻塞）
// -------------------------------------------------------------------------

/**
 * 校验条目数组，返回人类可读警告（不阻塞任何操作）。
 * 检查：前缀与类型不一致；重名；初始值无法按类型解析；
 * 未知类型（空类型按前缀推断，不警告）。
 * 无 flag_/res_ 前缀不是警告（UAT-6）：无前缀变量按初始值类型参与 MED
 * 翻译（bool→flag、number→res），真实文件【选择】老佟家车马店.ncanvas
 * 的 first_choose_* 即此形态，游戏实测正常。
 *
 * @param {Array<{name,type,initial,note}>} entries
 * @returns {Array<string>}
 */
function validateEntries(entries) {
    const warnings = [];
    const seen = new Set();
    for (const e of entries || []) {
        if (!e) continue;
        const name = String(e.name || '').trim();
        const label = name || '(未命名)';
        if (!name) {
            warnings.push('存在未填写变量名的行');
            continue;
        }
        if (seen.has(name)) {
            warnings.push(`变量 "${name}" 重复定义`);
        }
        seen.add(name);
        let type = String(e.type || '').trim().toLowerCase();
        if (type && !VALID_TYPES.includes(type)) {
            warnings.push(`变量 "${label}" 类型 "${e.type}" 未知（应为 bool|number|string），按前缀推断处理`);
            type = '';
        }
        const effectiveType = type || inferTypeFromPrefix(name);
        if (name.startsWith('flag_') && effectiveType !== 'bool') {
            warnings.push(`变量 "${name}" 前缀 flag_ 要求 bool 类型，当前为 ${effectiveType}`);
        }
        if (name.startsWith('res_') && effectiveType !== 'number') {
            warnings.push(`变量 "${name}" 前缀 res_ 要求 number 类型，当前为 ${effectiveType}`);
        }
        if (!isValidInitial(effectiveType, e.initial)) {
            warnings.push(`变量 "${name}" 初始值 "${e.initial}" 无法按 ${effectiveType} 解析`);
        }
    }
    return warnings;
}

// -------------------------------------------------------------------------
// merge（局部变量并入全局表命令用）
// -------------------------------------------------------------------------

/**
 * 计算需要追加到全局表的新条目：fileVariablesObj 中尚未出现在 entries
 * 里的名字。类型推断值优先（UAT-6：boolean→bool、number→number——引擎按
 * 初始值字面量类型做 MED 分类，并入全局表后语义必须不变；无前缀 bool 变量
 * 若写成 string 会让 flag_ok 翻译失效），其余回退前缀推断；初始值取自
 * 文件内的值（字面量字符串化）。
 *
 * @param {Array<{name,type,initial,note}>} entries - 现有全局条目
 * @param {Object} fileVariablesObj - .ncanvas project.variables 对象
 * @returns {Array<{name,type,initial,note}>} 仅含新增条目
 */
function mergeFileVariables(entries, fileVariablesObj) {
    const existing = new Set((entries || []).map(e => e && e.name));
    const out = [];
    for (const [name, value] of Object.entries(fileVariablesObj || {})) {
        if (existing.has(name)) continue;
        let initial;
        let type;
        if (typeof value === 'boolean') {
            type = 'bool';
            initial = value ? 'true' : 'false';
        } else if (typeof value === 'number') {
            type = 'number';
            initial = String(value);
        } else {
            type = inferTypeFromPrefix(name);
            if (value === null || value === undefined) initial = '';
            else initial = String(value);
        }
        out.push({ name, type, initial, note: '' });
    }
    return out;
}

module.exports = {
    DEFAULT_VARIABLES_PATH,
    EMPTY_VARIABLES_FILE,
    VALID_TYPES,
    inferTypeFromPrefix,
    isValidInitial,
    parseInitialValue,
    parseVariablesTable,
    serializeVariablesTable,
    validateEntries,
    mergeFileVariables
};

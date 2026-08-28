// shared-variables.js -- 加载 vault 全局变量表（NG-06，Phase 11 M2a）
//
// 全局变量存在 vault 根级 `Variables.md`（默认，可在设置页改路径）的 markdown
// 表格中，不写入 .ncanvas 文件。导出时把本模块的结果作为
// config.externalVariables 注入 exportEngine，由引擎合并：
// 生效变量 = 全局表 UNDER 文件内 project.variables（文件内同名优先）。
//
// 契约（与 narrative-graph 侧 model/variables.js 一致，两边独立实现——
// 与 gc- 共享角色同一模式，见 10-01-PLAN.md / 11-01-PLAN.md）：
//   - 按表头行定位表格（匹配 4 个中文列名 变量/类型/初始值/备注，允许空白
//     差异与额外表格列），忽略其他 markdown
//   - 类型 ∈ bool|number|string（仅用于把初始值字符串解析为字面量；
//     空类型按 flag_→bool、res_→number、否则 string 推断）
//   - 解析失败的行静默跳过（编辑侧 narrative-graph 负责展示警告）
//
// 本文件零依赖（不 require narrative-graph），可直接在 Node 测试里跑。

const DEFAULT_VARIABLES_PATH = 'Variables.md';

// -------------------------------------------------------------------------
// 解析（契约的 narrative-tool 侧独立实现）
// -------------------------------------------------------------------------

function isTableLine(line) {
    const t = line.trim();
    return t.length >= 2 && t.startsWith('|') && t.endsWith('|');
}

function splitCells(line) {
    const inner = line.trim().slice(1, -1);
    return inner.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
}

function isSeparatorLine(line) {
    if (!isTableLine(line)) return false;
    return splitCells(line).every(c => /^:?-+:?$/.test(c.replace(/\s/g, '')));
}

function inferTypeFromPrefix(name) {
    if (name.startsWith('flag_')) return 'bool';
    if (name.startsWith('res_')) return 'number';
    return 'string';
}

function parseValue(type, raw) {
    const t = raw.trim();
    if (type === 'bool') {
        if (/^true$/i.test(t)) return true;
        if (/^false$/i.test(t)) return false;
        return undefined; // 无法解析 → 跳过该行
    }
    if (type === 'number') {
        if (t === '') return undefined;
        const n = Number(t);
        return Number.isNaN(n) ? undefined : n;
    }
    return raw;
}

/**
 * 解析 Variables.md 内容为 { 变量名: 字面量值 } 映射。
 *
 * @param {string} markdown
 * @returns {Object} 变量名 → bool|number|string
 */
function parseVariablesTable(markdown) {
    const lines = String(markdown || '').split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
        if (!isTableLine(lines[i])) continue;
        const headerCells = splitCells(lines[i]);
        const idxName = headerCells.indexOf('变量');
        const idxType = headerCells.indexOf('类型');
        const idxInitial = headerCells.indexOf('初始值');
        if (idxName === -1 || idxType === -1 || idxInitial === -1) continue;
        if (!isSeparatorLine(lines[i + 1])) continue;

        const variables = {};
        let row = i + 2;
        while (row < lines.length && isTableLine(lines[row])) {
            const cells = splitCells(lines[row]);
            const name = (cells[idxName] || '').trim();
            if (name) {
                let type = (cells[idxType] || '').trim().toLowerCase();
                if (!['bool', 'number', 'string'].includes(type)) {
                    type = inferTypeFromPrefix(name);
                }
                const value = parseValue(type, cells[idxInitial] || '');
                if (value !== undefined) variables[name] = value;
            }
            row++;
        }
        return variables;
    }
    return {};
}

// -------------------------------------------------------------------------
// vault 加载
// -------------------------------------------------------------------------

/**
 * 读取全局变量表文件并解析为 { 变量名: 字面量值 }。
 * 文件缺失 / vault API 不可用 / 解析失败时返回 {}（不阻塞导出）。
 *
 * @param {Object} app - Obsidian App 实例（需 vault.getAbstractFileByPath + vault.read）
 * @param {string} [path='Variables.md'] - 变量表 vault 路径；空字符串视为禁用
 * @returns {Promise<Object>}
 */
async function loadSharedVariables(app, path) {
    const filePath = (path === undefined || path === null)
        ? DEFAULT_VARIABLES_PATH
        : String(path).trim();
    if (!filePath) return {};
    try {
        if (!app || !app.vault || typeof app.vault.getAbstractFileByPath !== 'function'
            || typeof app.vault.read !== 'function') {
            return {};
        }
        const file = app.vault.getAbstractFileByPath(filePath);
        if (!file) return {};
        const content = await app.vault.read(file);
        return parseVariablesTable(content);
    } catch (err) {
        console.warn('[Narrative Tool] 读取全局变量表失败:', err.message);
        return {};
    }
}

module.exports = { DEFAULT_VARIABLES_PATH, parseVariablesTable, loadSharedVariables };

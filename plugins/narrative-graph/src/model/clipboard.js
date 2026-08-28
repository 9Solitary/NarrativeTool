// clipboard.js — 跨文件复制/粘贴的子图编码与落账（Phase 11 M3, NG-08）
//
// 剪贴板信封格式（JSON 文本）：
//   { "narrativeGraphClipboard": 1, "nodes": [...], "links": [...] }
//   - nodes：选中节点的完整深拷贝（未知字段逐字保留，NG-01），按 project 顺序
//   - links：两端都在选中集内的连线深拷贝
//
// 粘贴（applyPaste）落账规则：
//   - 全部节点 id 按目标文件 nextNodeId 序列重新分配（旧→新映射）；
//     连线 id 同理；Choice 选项 id 用 nextOptionId 重分配并回写
//     link.choiceOptionId（choiceIndex 不变）
//   - 粘贴的 Entry 节点降级为 Content（每文件恰好一个 Entry）；目标文件
//     无 Entry 时保留本次粘贴的第一个 Entry
//   - 位置：给了 opts.center 就把粘贴子图的包围盒中心对齐到该中心
//     （视图侧传视口中心），否则相对原包围盒左上角偏移 (+40, +40)
//   - 引用变量：粘贴内容引用的 flag_*/res_* 变量名与 opts.knownVariables
//     比对，缺失名单返回给视图弹 Notice（不自动写入全局表）
//
// Pure module: no obsidian imports, no DOM access (purity guard).

const { nextNodeId, nextLinkId, nextOptionId } = require('./ids');
const condModel = require('./conditions');

const CLIPBOARD_MARKER = 'narrativeGraphClipboard';
const CLIPBOARD_VERSION = 1;

function deepClone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// 编码（复制）
// ---------------------------------------------------------------------------

/**
 * 把选中子图编码为剪贴板信封对象。
 *
 * @param {Object} state - saved-state 对象
 * @param {Array<string>} nodeIds - 选中的节点 id
 * @returns {Object|null} 信封对象；选择为空时返回 null
 */
function encodeSelection(state, nodeIds) {
    const project = state && state.project;
    const nodes = project && Array.isArray(project.nodes) ? project.nodes : [];
    const links = project && Array.isArray(project.links) ? project.links : [];
    const selected = new Set(Array.isArray(nodeIds) ? nodeIds : []);
    if (selected.size === 0) return null;

    const pickedNodes = nodes
        .filter(n => n && selected.has(n.id))
        .map(n => deepClone(n));
    if (pickedNodes.length === 0) return null;
    const pickedLinks = links
        .filter(l => l && selected.has(l.from) && selected.has(l.to))
        .map(l => deepClone(l));

    return {
        [CLIPBOARD_MARKER]: CLIPBOARD_VERSION,
        nodes: pickedNodes,
        links: pickedLinks
    };
}

/**
 * 解析剪贴板文本为信封对象。非 JSON / 非本格式信封 → null。
 *
 * @param {string} text - 剪贴板文本
 * @returns {Object|null}
 */
function parseEnvelopeText(text) {
    if (typeof text !== 'string' || text.trim() === '') return null;
    let obj;
    try {
        obj = JSON.parse(text);
    } catch (_err) {
        return null;
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    if (obj[CLIPBOARD_MARKER] !== CLIPBOARD_VERSION) return null;
    if (!Array.isArray(obj.nodes)) return null;
    return obj;
}

// ---------------------------------------------------------------------------
// 引用变量提取（缺失检测用）
// ---------------------------------------------------------------------------

const VAR_NAME_RE = /\b(?:flag|res)_[A-Za-z0-9_]+/g;

// 条件文本 → 引用的变量名（可解析走 clauses；raw 退化为前缀正则）
function variablesInCondition(text) {
    const out = [];
    const trimmed = String(text || '').trim();
    if (!trimmed) return out;
    const parsed = condModel.parseCondition(trimmed);
    if (Array.isArray(parsed.clauses)) {
        for (const clause of parsed.clauses) {
            if (clause.type === 'state' && clause.key) out.push(clause.key);
        }
        return out;
    }
    // raw：保守地按 flag_/res_ 前缀抓取标识符
    const found = trimmed.match(VAR_NAME_RE);
    return found || [];
}

/**
 * 信封内容引用的全部变量名（去重，按出现顺序）。
 * 来源：连线 requirements、选项 requires、效果 key。
 *
 * @param {Object} envelope
 * @returns {Array<string>}
 */
function referencedVariables(envelope) {
    const seen = new Set();
    const out = [];
    const add = (name) => {
        const key = String(name || '').trim();
        if (key && !seen.has(key)) {
            seen.add(key);
            out.push(key);
        }
    };
    for (const link of envelope && Array.isArray(envelope.links) ? envelope.links : []) {
        for (const name of variablesInCondition(link && link.requirements)) add(name);
    }
    for (const node of envelope && Array.isArray(envelope.nodes) ? envelope.nodes : []) {
        const options = node && Array.isArray(node.choiceOptions) ? node.choiceOptions : [];
        for (const option of options) {
            for (const name of variablesInCondition(option && option.requires)) add(name);
            for (const effect of option && Array.isArray(option.effects) ? option.effects : []) {
                if (effect && effect.key) add(effect.key);
            }
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// 落账（粘贴）
// ---------------------------------------------------------------------------

/**
 * 把信封内容落账到目标 state（原地追加；调用方负责历史快照与保存）。
 *
 * @param {Object} state - 目标 saved-state 对象
 * @param {Object} envelope - parseEnvelopeText 通过的信封
 * @param {{ center?: {x: number, y: number}, knownVariables?: Array<string> }} [opts]
 *   center = 粘贴子图包围盒中心要对齐到的世界坐标（视图传视口中心）
 *   knownVariables = 全局变量表已登记的变量名（缺失检测）
 * @returns {{ addedNodeIds: Array<string>, addedLinkIds: Array<string>,
 *   missingVariables: Array<string>, downgradedEntry: number }}
 * @throws {Error} 信封结构不合法（节点缺 id/type）
 */
function applyPaste(state, envelope, opts) {
    const project = state && state.project;
    if (!project || typeof project !== 'object') {
        throw new Error('applyPaste: not a saved-state object');
    }
    if (!Array.isArray(project.nodes)) project.nodes = [];
    if (!Array.isArray(project.links)) project.links = [];

    const srcNodes = envelope && Array.isArray(envelope.nodes) ? envelope.nodes : [];
    const srcLinks = envelope && Array.isArray(envelope.links) ? envelope.links : [];
    for (const node of srcNodes) {
        if (!node || typeof node.id !== 'string' || typeof node.type !== 'string') {
            throw new Error('applyPaste: envelope node missing id/type');
        }
    }
    if (srcNodes.length === 0) {
        return { addedNodeIds: [], addedLinkIds: [], missingVariables: [], downgradedEntry: 0 };
    }

    const options = opts || {};

    // 位置偏移：包围盒中心 → opts.center；缺省 = 原包围盒左上角 +40/+40
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of srcNodes) {
        const x = Number.isFinite(node.x) ? node.x : 0;
        const y = Number.isFinite(node.y) ? node.y : 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    let dx;
    let dy;
    if (options.center && Number.isFinite(options.center.x) && Number.isFinite(options.center.y)) {
        dx = options.center.x - (minX + maxX) / 2;
        dy = options.center.y - (minY + maxY) / 2;
    } else {
        dx = 40;
        dy = 40;
    }

    // id 重映射：目标已有节点/连线 + 本批已分配的，一起进扫描池
    const idMap = new Map();
    const optionIdMap = new Map();
    const nodePool = [...project.nodes];
    const linkPool = [...project.links];

    // Entry 降级：目标已有 Entry（或本批已保留一个）时，粘贴的 Entry → Content
    let entryAvailable = !project.nodes.some(n => n && n.type === 'Entry');
    let downgradedEntry = 0;

    const addedNodeIds = [];
    for (const src of srcNodes) {
        const node = deepClone(src);
        const freshId = nextNodeId(nodePool);
        idMap.set(src.id, freshId);
        node.id = freshId;
        node.x = Math.round((Number.isFinite(node.x) ? node.x : 0) + dx);
        node.y = Math.round((Number.isFinite(node.y) ? node.y : 0) + dy);
        if (node.type === 'Entry') {
            if (entryAvailable) {
                entryAvailable = false; // 本批第一个 Entry 顶岗
            } else {
                node.type = 'Content';
                downgradedEntry++;
            }
        }
        // Choice 选项 id 文件全局，全部重分配（节点先入池，让同节点内
        // 先分配的选项 id 进入 nextOptionId 的扫描范围）
        nodePool.push(node);
        if (Array.isArray(node.choiceOptions)) {
            for (const option of node.choiceOptions) {
                if (option && typeof option.id === 'string') {
                    const freshOptId = nextOptionId(nodePool);
                    optionIdMap.set(option.id, freshOptId);
                    option.id = freshOptId;
                }
            }
        }
        project.nodes.push(node);
        addedNodeIds.push(freshId);
    }

    const addedLinkIds = [];
    for (const src of srcLinks) {
        if (!src || !idMap.has(src.from) || !idMap.has(src.to)) continue;
        const link = deepClone(src);
        link.id = nextLinkId(linkPool);
        link.from = idMap.get(src.from);
        link.to = idMap.get(src.to);
        if (link.choiceOptionId != null) {
            const mapped = optionIdMap.get(String(link.choiceOptionId));
            if (!mapped) continue; // 选项 id 不在信封里 —— 防御性跳过
            link.choiceOptionId = mapped;
        }
        linkPool.push(link);
        project.links.push(link);
        addedLinkIds.push(link.id);
    }

    const known = new Set(Array.isArray(options.knownVariables) ? options.knownVariables : []);
    const missingVariables = referencedVariables(envelope).filter(name => !known.has(name));

    return { addedNodeIds, addedLinkIds, missingVariables, downgradedEntry };
}

module.exports = {
    CLIPBOARD_MARKER,
    CLIPBOARD_VERSION,
    encodeSelection,
    parseEnvelopeText,
    referencedVariables,
    applyPaste
};

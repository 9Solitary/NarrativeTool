// history.js — 快照式 undo/redo 栈（Phase 11 M3, NG-08）
//
// 设计（M3 决策）：快照式而非命令逆操作——saved-state 很小，深拷贝快照
// 便宜且不会漏掉任何字段。快照只含 state.project + ui 的选择字段
// （selectedNodeId/selectedLinkId）；ui.view（相机）不入快照，undo/redo
// 不移动相机。导航/选择变化/变量面板编辑（写的是另一个文件）不产生
// undo 条目。
//
// 用法（视图侧）：每次已提交变更前先 push 变更前快照（push 会清空 redo
// 栈）；undo(h, current) 把 current 压入 redo、弹出 undo 顶返回；
// redo 对称。快照用 structuredClone，与活体状态完全隔离。
//
// Pure module: no obsidian imports, no DOM access (purity guard).

const DEFAULT_CAP = 50;

/**
 * @param {number} [cap=50] - undo 栈深度上限
 * @returns {{ cap: number, undo: Array, redo: Array }}
 */
function createHistory(cap) {
    return {
        cap: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : DEFAULT_CAP,
        undo: [],
        redo: []
    };
}

/**
 * 取 state 的历史快照：project 全量 + ui 选择字段（相机刻意排除）。
 * structuredClone 深隔离 —— 之后对活体 state 的任何修改都不影响快照。
 *
 * @param {Object} state - saved-state 对象
 * @returns {{ project: Object, ui: { selectedNodeId: *, selectedLinkId: * } }}
 */
function takeSnapshot(state) {
    const ui = state && state.ui && typeof state.ui === 'object' ? state.ui : {};
    return structuredClone({
        project: state && state.project,
        ui: {
            selectedNodeId: ui.selectedNodeId != null ? ui.selectedNodeId : null,
            selectedLinkId: ui.selectedLinkId != null ? ui.selectedLinkId : null
        }
    });
}

/**
 * 压入一条变更前快照（新变更清空 redo 栈；超出深度上限淘汰最旧条目）。
 */
function push(h, snapshot) {
    h.undo.push(snapshot);
    while (h.undo.length > h.cap) h.undo.shift();
    h.redo.length = 0;
}

/**
 * 撤销：把 current 压入 redo 栈，弹出 undo 栈顶。
 *
 * @returns {{ snapshot: Object }|null} 无可撤销条目时 null
 */
function undo(h, current) {
    if (h.undo.length === 0) return null;
    h.redo.push(current);
    return { snapshot: h.undo.pop() };
}

/**
 * 重做：把 current 压回 undo 栈，弹出 redo 栈顶。
 *
 * @returns {{ snapshot: Object }|null} 无可重做条目时 null
 */
function redo(h, current) {
    if (h.redo.length === 0) return null;
    h.undo.push(current);
    return { snapshot: h.redo.pop() };
}

module.exports = { DEFAULT_CAP, createHistory, takeSnapshot, push, undo, redo };

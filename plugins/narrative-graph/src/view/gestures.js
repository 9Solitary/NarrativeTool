// gestures.js — pure pointer-gesture decider for the narrative-graph canvas
// (Phase 11 M1b UAT fix, NG-08 input remap)
//
// UAT root-cause class: gesture wiring lived inside DOM handlers and was
// untestable headless, so "everything click-based is dead" shipped. This
// module is the single source of truth for WHICH gesture a pointerdown
// starts, fully unit-testable; canvas-view.js only classifies the event
// target (closest() checks) and applies the decision.
//
// Input mapping (2026-08-27 UAT decision, supersedes NG-08 "拖拽平移"):
//   wheel                 -> zoom (viewport.js, unchanged)
//   left-drag empty/edge  -> marquee (box multi-select, promoted from v1.1)
//   middle-drag anywhere  -> pan
//   Space + left-drag     -> pan (touchpad fallback)
//   left-drag node        -> node drag (moves whole selection set)
//   left-drag output port -> link drag
//   left-drag side handle -> link drag (UAT-6 #1 four-side handles; the view
//                          maps End/Choice handles to 'in-port' = no drag)
//   left on toolbar/editor-> none (the UI element handles itself)
//
// UAT-7/UAT-8 #1 hit priority on ANY node (selected or not — the view
// hit-tests coordinates and passes portHit/resizeZone; _startResize
// single-selects an unselected node):
//   1. port dot (its 16px box, even when invisible)      -> link-drag
//   2. border resize zone (~8px band at the node border) -> resize-drag
//   3. anywhere else on the node body                    -> node-drag
//
// Pure module: no obsidian imports, no DOM access.

// Target kinds as classified by the view from DOM hit-testing.
const TARGET_KINDS = Object.freeze([
    'ui',       // toolbar / editor panel / any plugin UI chrome
    'out-port', // output port dot (link drag source)
    'port-handle', // UAT-6 #1 four-side handle (link drag source)
    'in-port',  // input-side affordance (drop target only; also End/Choice handles)
    'node',     // node body/header
    'edge',     // edge hit path / label
    'empty'     // bare canvas
]);

// Gesture types the view knows how to run.
const GESTURES = Object.freeze([
    'none', 'pan', 'marquee', 'node-drag', 'link-drag', 'resize-drag'
]);

/**
 * Decide which gesture a pointerdown starts.
 *
 * @param {{ button: number, spaceHeld: boolean, targetKind: string,
 *           portHit?: boolean, resizeZone?: string|null }} input
 *   button: 0 = left, 1 = middle, 2 = right
 *   spaceHeld: Space key currently held (touchpad pan fallback)
 *   targetKind: one of TARGET_KINDS
 *   portHit: pointerdown lands inside a port dot's hit box (view-computed;
 *            UAT-8 #1: computed for any node, selected or not)
 *   resizeZone: border resize zone name ('n','ne',... — view-computed via
 *               geometry.resizeZoneAt; null when outside the band)
 * @returns {{ type: string }} One of GESTURES
 */
function decidePointerDown(input) {
    const { button, spaceHeld, targetKind, portHit, resizeZone } = input;

    if (targetKind === 'ui') return { type: 'none' };
    if (targetKind === 'out-port' && button === 0) return { type: 'link-drag' };
    if (targetKind === 'port-handle' && button === 0) return { type: 'link-drag' };
    if (targetKind === 'in-port') return { type: 'none' };

    // Middle-drag pans from anywhere (over nodes too — fast canvas moves).
    if (button === 1) return { type: 'pan' };
    if (button !== 0) return { type: 'none' };

    // Space + left-drag pans (touchpad-friendly fallback).
    if (spaceHeld) return { type: 'pan' };

    // UAT-7/UAT-8 hit priority on a node: port dot > resize zone > body.
    if (targetKind === 'node') {
        if (portHit) return { type: 'link-drag' };
        if (resizeZone) return { type: 'resize-drag' };
        return { type: 'node-drag' };
    }
    if (targetKind === 'empty' || targetKind === 'edge') return { type: 'marquee' };
    return { type: 'none' };
}

/**
 * Merge marquee results into the selection set.
 * additive (Shift) unions; otherwise the marquee replaces the selection.
 *
 * @param {Iterable<string>} currentIds - Currently selected node ids
 * @param {Array<string>} hitIds - Ids inside the marquee rect
 * @param {boolean} additive
 * @returns {Array<string>}
 */
function mergeMarqueeSelection(currentIds, hitIds, additive) {
    if (!additive) return [...hitIds];
    return [...new Set([...currentIds, ...hitIds])];
}

/**
 * Selection adjustment when a node drag STARTS (pointerdown on a node).
 *
 * UAT-5 contract (Shift+click toggles membership — click-time toggle lives
 * in the view's click handler; pointerdown must not clobber the set first):
 *   - Shift held   -> selection untouched (the trailing click toggles)
 *   - node already in the set -> untouched (group drag)
 *   - otherwise    -> replace with [nodeId] (plain click select-single)
 *
 * @param {Iterable<string>} currentIds
 * @param {string} nodeId
 * @param {boolean} shiftKey
 * @returns {Array<string>}
 */
function pointerDownSelection(currentIds, nodeId, shiftKey) {
    const current = [...currentIds];
    if (shiftKey || current.includes(nodeId)) return current;
    return [nodeId];
}

module.exports = { TARGET_KINDS, GESTURES, decidePointerDown, mergeMarqueeSelection, pointerDownSelection };

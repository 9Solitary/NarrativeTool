// geometry.js — pure pan/zoom + edge-routing math for narrative-graph
// (Phase 11 M1a, NG-08/NG-09)
//
// View transform convention: screen = world * scale + offset, i.e. the world
// container gets `transform: translate(view.x px, view.y px) scale(s)` with
// transform-origin 0 0. view.x/view.y are screen-space pixels.
//
// Pure module: no obsidian imports, no DOM access — unit-testable under
// node:test (tests/narrative-graph-geometry.test.js).

// Zoom limits + step (NG-08: wheel zoom without modifier key).
const MIN_SCALE = 0.15;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 1.1;

// Default node width when the file carries no explicit width (auto height:
// height comes from the DOM measurement, never from the file — except nodes
// manually resized in narrative-graph, marked `manualSize`, UAT-6 #5).
const DEFAULT_NODE_WIDTH = 260;

// Fit-to-content padding (screen px) around the node bounding box.
const FIT_PADDING = 60;

// Bezier handle length bounds (world units).
const MIN_HANDLE = 40;
const MAX_HANDLE = 160;

// ---------------------------------------------------------------------------
// Scale clamping
// ---------------------------------------------------------------------------

function clampScale(scale) {
    if (!Number.isFinite(scale) || scale <= 0) return 1;
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

// ---------------------------------------------------------------------------
// Coordinate transforms
// ---------------------------------------------------------------------------

function worldToScreen(point, view) {
    return {
        x: point.x * view.scale + view.x,
        y: point.y * view.scale + view.y
    };
}

function screenToWorld(point, view) {
    return {
        x: (point.x - view.x) / view.scale,
        y: (point.y - view.y) / view.scale
    };
}

// Zoom by `factor` keeping the world point under `screenPoint` fixed on
// screen (pointer-centered wheel zoom). Returns a new view object.
function zoomAtPoint(view, screenPoint, factor) {
    const scale = clampScale(view.scale * factor);
    const world = screenToWorld(screenPoint, view);
    return {
        x: screenPoint.x - world.x * scale,
        y: screenPoint.y - world.y * scale,
        scale
    };
}

// ---------------------------------------------------------------------------
// Node sizing + ports
// ---------------------------------------------------------------------------

// Resolve the rendered size of a node. Width: explicit file width if present,
// else DEFAULT_NODE_WIDTH. Height (UAT-6 #5): auto — measured DOM height if
// given, else the estimate — UNLESS the node carries the `manualSize` marker
// written by a narrative-graph resize drag, in which case the stored height
// is authoritative (fixed-size node, content scrolls). NC-imported stored
// heights without the marker stay informational (ignored), as before.
function resolveNodeSize(node, measuredHeight) {
    const width = Number.isFinite(node.width) && node.width > 0 ? node.width : DEFAULT_NODE_WIDTH;
    if (node.manualSize && Number.isFinite(node.height) && node.height > 0) {
        return { width, height: node.height };
    }
    const height = Number.isFinite(measuredHeight) && measuredHeight > 0
        ? measuredHeight
        : estimateNodeHeight(node);
    return { width, height };
}

// Rough height estimate used before DOM measurement is available (fit-to-
// content on first paint, dev SVG render). Header + text lines.
function estimateNodeHeight(node) {
    const width = Number.isFinite(node.width) && node.width > 0 ? node.width : DEFAULT_NODE_WIDTH;
    const charsPerLine = Math.max(10, Math.floor((width - 24) / 13));
    const body = typeof node.body === 'string' ? node.body : '';
    let lines = 0;
    for (const raw of body.split('\n')) {
        lines += Math.max(1, Math.ceil(raw.length / charsPerLine));
    }
    if (Array.isArray(node.choiceOptions) && node.choiceOptions.length > 0) {
        lines += node.choiceOptions.length;
    }
    return 34 /* header+padding */ + Math.max(1, lines) * 20 + 16;
}

// Outward unit normal for a port side.
function sideNormal(side) {
    switch (side) {
        case 'left': return { x: -1, y: 0 };
        case 'right': return { x: 1, y: 0 };
        case 'top': return { x: 0, y: -1 };
        case 'bottom': return { x: 0, y: 1 };
        default: return { x: 1, y: 0 };
    }
}

// World-space anchor point of a port. `side` is one of left/right/top/bottom,
// `t` is the fractional position along that side (0..1), `size` the rendered
// node size. Defaults: input left / output right at t=0.5 (NG format spec).
function portAnchor(node, size, side, t) {
    const s = side || 'left';
    const frac = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0.5;
    switch (s) {
        case 'left': return { x: node.x, y: node.y + size.height * frac, side: s };
        case 'right': return { x: node.x + size.width, y: node.y + size.height * frac, side: s };
        case 'top': return { x: node.x + size.width * frac, y: node.y, side: s };
        case 'bottom': return { x: node.x + size.width * frac, y: node.y + size.height, side: s };
        default: return { x: node.x + size.width, y: node.y + size.height * 0.5, side: 'right' };
    }
}

// Port position as FRACTIONS of the node box (x/y in 0..1) — the renderer
// turns these into the port dot's inline left/top percentages so the visible
// dot sits exactly on the anchor layoutEdge() computes (UAT-5 contract:
// edges anchor exactly at the visible port dots; stored/default ports win).
function portFraction(side, t) {
    const s = side || 'left';
    const frac = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0.5;
    switch (s) {
        case 'left': return { x: 0, y: frac };
        case 'right': return { x: 1, y: frac };
        case 'top': return { x: frac, y: 0 };
        case 'bottom': return { x: frac, y: 1 };
        default: return { x: 1, y: 0.5 };
    }
}

// ---------------------------------------------------------------------------
// Four-side handles (UAT-6 #1, native .canvas semantics)
// ---------------------------------------------------------------------------

// Canonical side order for the four edge-center handles.
const SIDE_ORDER = Object.freeze(['top', 'right', 'bottom', 'left']);

const OPPOSITE_SIDE = Object.freeze({ left: 'right', right: 'left', top: 'bottom', bottom: 'top' });

function oppositeSide(side) {
    return OPPOSITE_SIDE[side] || 'left';
}

// Handles to render on a node. Every node exposes the four edge-midpoint
// handles for drag/drop (native .canvas); a side OCCUPIED by a stored port
// keeps its handle at the stored t so existing files' edge endpoints retain
// a dot exactly on them (UAT-5 contract generalized to 4 sides). Unoccupied
// sides sit at t=0.5. Input+output sharing one side with different t yields
// two handles on that side; identical positions dedupe to one.
//
// @param {Object} ports - resolved { input: {side,t}, output: {side,t} }
// @returns {Array<{side: string, t: number}>}
function sideHandles(ports) {
    const out = [];
    for (const side of SIDE_ORDER) {
        const ts = [];
        for (const role of ['input', 'output']) {
            const p = ports && ports[role];
            if (p && p.side === side) {
                const t = Number.isFinite(p.t) ? Math.min(1, Math.max(0, p.t)) : 0.5;
                if (!ts.includes(t)) ts.push(t);
            }
        }
        if (ts.length === 0) ts.push(0.5);
        for (const t of ts) out.push({ side, t });
    }
    return out;
}

// Nearest edge side of a node box to a world-space point (native canvas
// forgiving drop: releasing a link drag over the node BODY connects to the
// side nearest the drop point). Distance is measured to each edge line;
// ties resolve in SIDE_ORDER priority (top, right, bottom, left).
function nearestSide(node, size, point) {
    const dLeft = Math.abs(point.x - node.x);
    const dRight = Math.abs(point.x - (node.x + size.width));
    const dTop = Math.abs(point.y - node.y);
    const dBottom = Math.abs(point.y - (node.y + size.height));
    let best = 'top';
    let bestD = dTop;
    if (dRight < bestD) { best = 'right'; bestD = dRight; }
    if (dBottom < bestD) { best = 'bottom'; bestD = dBottom; }
    if (dLeft < bestD) { best = 'left'; }
    return best;
}

// ---------------------------------------------------------------------------
// Edge bezier path
// ---------------------------------------------------------------------------

// Cubic bezier SVG path between two port anchors. Handles extend along each
// port's outward normal so edges leave/arrive perpendicular to the node edge.
// Returns { d, mid } where mid is the curve point at t=0.5 (label position).
function edgePath(from, to) {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const handle = Math.min(MAX_HANDLE, Math.max(MIN_HANDLE, Math.max(dx, dy) / 2));
    const n0 = sideNormal(from.side);
    const n1 = sideNormal(to.side);
    const c1 = { x: from.x + n0.x * handle, y: from.y + n0.y * handle };
    const c2 = { x: to.x + n1.x * handle, y: to.y + n1.y * handle };
    const d = `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
    // Cubic bezier at t=0.5: (p0 + 3*c1 + 3*c2 + p1) / 8
    const mid = {
        x: (from.x + 3 * c1.x + 3 * c2.x + to.x) / 8,
        y: (from.y + 3 * c1.y + 3 * c2.y + to.y) / 8
    };
    return { d, mid };
}

// ---------------------------------------------------------------------------
// Fit-to-content
// ---------------------------------------------------------------------------

// Bounding box over nodes using their resolved (or estimated) sizes.
// sizesById: optional Map nodeId -> {width, height} of measured sizes.
function nodeBounds(nodes, sizesById) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
        const measured = sizesById ? sizesById.get(node.id) : undefined;
        const size = resolveNodeSize(node, measured && measured.height);
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + size.width);
        maxY = Math.max(maxY, node.y + size.height);
    }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
}

// View that centers `bounds` in a viewport of `viewportWidth`x`viewportHeight`
// screen px, clamped to the zoom range.
function fitView(bounds, viewportWidth, viewportHeight, padding) {
    const pad = Number.isFinite(padding) ? padding : FIT_PADDING;
    const vw = viewportWidth > 0 ? viewportWidth : 800;
    const vh = viewportHeight > 0 ? viewportHeight : 600;
    const w = Math.max(1, bounds.maxX - bounds.minX);
    const h = Math.max(1, bounds.maxY - bounds.minY);
    const scale = clampScale(Math.min((vw - pad * 2) / w, (vh - pad * 2) / h));
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    return {
        x: vw / 2 - cx * scale,
        y: vh / 2 - cy * scale,
        scale
    };
}

// True when a stored ui.view object is usable for restoring the camera.
function isValidStoredView(view) {
    return !!view
        && Number.isFinite(view.x) && Number.isFinite(view.y)
        && Number.isFinite(view.scale) && view.scale > 0;
}

// ---------------------------------------------------------------------------
// Marquee (box selection) rect math — M1b UAT: left-drag on empty canvas
// ---------------------------------------------------------------------------

// Normalize two corner points into {x0, y0, x1, y1} with x0<=x1, y0<=y1.
function normalizeRect(a, b) {
    return {
        x0: Math.min(a.x, b.x),
        y0: Math.min(a.y, b.y),
        x1: Math.max(a.x, b.x),
        y1: Math.max(a.y, b.y)
    };
}

// A node's world-space rect from its position + rendered size.
function nodeRect(node, size) {
    return {
        x0: node.x,
        y0: node.y,
        x1: node.x + size.width,
        y1: node.y + size.height
    };
}

// Inclusive edge intersection (touching edges count as intersecting).
function rectsIntersect(r1, r2) {
    return r1.x0 <= r2.x1 && r1.x1 >= r2.x0 && r1.y0 <= r2.y1 && r1.y1 >= r2.y0;
}

// Ids of nodes whose world rect intersects the marquee rect.
function nodesInRect(nodes, rect, sizesById) {
    const hit = [];
    for (const node of nodes) {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
        const measured = sizesById ? sizesById.get(node.id) : undefined;
        const size = resolveNodeSize(node, measured && measured.height);
        if (rectsIntersect(rect, nodeRect(node, size))) hit.push(node.id);
    }
    return hit;
}

// ---------------------------------------------------------------------------
// Background grid (UAT-6 #2)
// ---------------------------------------------------------------------------

// Grid spacing in world px — a multiple of the 8px drag-snap grid (M3).
const GRID_SPACING = 40;

// The dot grid lives on the FRAME as a CSS tiled background and must track
// the world transform: tile origin = view offset (screen px), tile size =
// spacing * scale. Dots keep constant screen size while spacing zooms.
// Returns inline-style values for backgroundPosition / backgroundSize.
function gridBackground(view, spacing) {
    const s = Number.isFinite(spacing) && spacing > 0 ? spacing : GRID_SPACING;
    const scale = view && Number.isFinite(view.scale) ? view.scale : 1;
    const size = Math.max(2, s * scale);
    const x = view && Number.isFinite(view.x) ? view.x : 0;
    const y = view && Number.isFinite(view.y) ? view.y : 0;
    return {
        backgroundPosition: `${x}px ${y}px`,
        backgroundSize: `${size}px ${size}px`
    };
}

// ---------------------------------------------------------------------------
// Free resize (UAT-6 #5, native .canvas style)
// ---------------------------------------------------------------------------

// Minimum node box for manual resize (world px).
const MIN_NODE_WIDTH = 120;
const MIN_NODE_HEIGHT = 60;

// Border resize hit-zone band (screen px) — UAT-7: the node's whole border
// is the resize area, no handle elements to grab.
const RESIZE_BORDER = 8;

// Outside slack beyond the border (screen px) — UAT-8: tightened from
// RESIZE_BORDER/2 (4px) to 2px now that resize works on UNSELECTED nodes
// too; a wide outside band would eat casual node grabs near the border.
const RESIZE_OUTER_SLACK = 2;

// Which resize zone a point falls in, relative to a node rect (any unit —
// the caller uses screen px from getBoundingClientRect). The band extends
// `borderWidth` px inside each edge and RESIZE_OUTER_SLACK px outside.
// Corners (both axes in band) win over edges; points outside the
// expanded rect or in the dead center return null. For nodes narrower/
// shorter than 2*band the nearer edge wins the overlap.
//
// @param {{left:number, top:number, right:number, bottom:number}} rect
// @param {number} x
// @param {number} y
// @param {number} [borderWidth=RESIZE_BORDER]
// @returns {string|null} One of n/ne/e/se/s/sw/w/nw, or null
function resizeZoneAt(rect, x, y, borderWidth) {
    const w = Number.isFinite(borderWidth) && borderWidth > 0 ? borderWidth : RESIZE_BORDER;
    const out = RESIZE_OUTER_SLACK;
    if (x < rect.left - out || x > rect.right + out
        || y < rect.top - out || y > rect.bottom + out) return null;

    // The nearer edge in each axis claims the point when within the band
    // (points beyond the RESIZE_OUTER_SLACK outside slack were already
    // excluded by the bounds check above). Narrow rects resolve to the
    // nearer edge.
    const dL = Math.abs(x - rect.left);
    const dR = Math.abs(x - rect.right);
    const dT = Math.abs(y - rect.top);
    const dB = Math.abs(y - rect.bottom);
    const h = Math.min(dL, dR) <= w ? (dL <= dR ? 'w' : 'e') : '';
    const v = Math.min(dT, dB) <= w ? (dT <= dB ? 'n' : 's') : '';
    if (!h && !v) return null;
    return v + h; // 'n'+'w' -> 'nw', 's'+'e' -> 'se', ''+'e' -> 'e', ...
}

// CSS cursor for a resize zone (hover feedback, UAT-7).
function resizeCursor(zone) {
    if (!zone) return '';
    if (zone === 'n' || zone === 's') return 'ns-resize';
    if (zone === 'e' || zone === 'w') return 'ew-resize';
    if (zone === 'ne' || zone === 'sw') return 'nesw-resize';
    return 'nwse-resize'; // nw / se
}

// Apply a resize-drag delta (world units) to a node rect. dir ∈
// n/s/e/w/ne/nw/se/sw: e/w change width, n/s change height, corners both;
// n/w also move x/y so the opposite edge stays fixed. The dragged edge
// clamps at the min size (the fixed edge never moves). Integer output.
function applyResize(rect, dir, dx, dy, min) {
    const minW = min && Number.isFinite(min.width) ? min.width : MIN_NODE_WIDTH;
    const minH = min && Number.isFinite(min.height) ? min.height : MIN_NODE_HEIGHT;
    let x = rect.x;
    let y = rect.y;
    let width = rect.width;
    let height = rect.height;
    if (dir.includes('e')) width = Math.max(minW, rect.width + dx);
    if (dir.includes('s')) height = Math.max(minH, rect.height + dy);
    if (dir.includes('w')) {
        width = Math.max(minW, rect.width - dx);
        x = rect.x + (rect.width - width);
    }
    if (dir.includes('n')) {
        height = Math.max(minH, rect.height - dy);
        y = rect.y + (rect.height - height);
    }
    return {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
    };
}

module.exports = {
    MIN_SCALE,
    MAX_SCALE,
    ZOOM_STEP,
    DEFAULT_NODE_WIDTH,
    FIT_PADDING,
    GRID_SPACING,
    MIN_NODE_WIDTH,
    MIN_NODE_HEIGHT,
    RESIZE_BORDER,
    RESIZE_OUTER_SLACK,
    SIDE_ORDER,
    clampScale,
    worldToScreen,
    screenToWorld,
    zoomAtPoint,
    resolveNodeSize,
    estimateNodeHeight,
    sideNormal,
    portAnchor,
    portFraction,
    sideHandles,
    oppositeSide,
    nearestSide,
    applyResize,
    resizeZoneAt,
    resizeCursor,
    gridBackground,
    edgePath,
    nodeBounds,
    fitView,
    isValidStoredView,
    normalizeRect,
    nodeRect,
    rectsIntersect,
    nodesInRect
};

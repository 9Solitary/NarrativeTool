// renderer.js — DOM building for the narrative-graph canvas (Phase 11,
// NG-08/NG-09; M1a rendering + M1b editing affordances)
//
// Renders the saved-state model into:
//   contentEl
//     div.ng-canvas            (clip frame, position: relative)
//       div.ng-canvas__warning (only when parse errors exist)
//       div.ng-world           (transformed by viewport.js)
//         svg.ng-edges         (edge layer, UNDER the nodes)
//         div.ng-node ...      (one per node, data-node-id set)
//
// Editing affordances (M1b): port elements — UAT-6 #1 four-side handles
// (`.ng-port--side` with data-side, one per edge midpoint, native .canvas
// semantics: invisible until node hover / link drag; a side occupied by a
// stored port keeps its handle at the stored t; UAT-8 #3: Choice suppresses
// the RIGHT handle — its outputs are the per-option dots), plus per-option
// Choice output dots (`.ng-port--out` with data-option-id; UAT-8 #2: ROOT
// children of the node, pinned to measured row offsets by measureNode, so
// the scrolling body of a fixed-size node never clips them), a fat
// invisible `.ng-edge__hit` path per edge for click selection, and
// layoutEdge()/applyEdgeLayout() so the view can live-update edge geometry
// during node drags without a full re-render.
// UAT-5/UAT-6 contract: every edge endpoint sits exactly on a rendered
// handle — layoutEdge() anchors at the stored/default port side/t and
// buildSideHandles() renders a handle at that same position.
// UAT-6 #5: nodes carrying the `manualSize` marker (written by a resize
// drag, model/ops.js resizeNode) render fixed-size with `ng-node--fixed`
// (stored height honored, content scrolls inside the body — UAT-8 #2/#4:
// the node container stays overflow: visible so dots/corner decorations
// are never clipped and no spurious horizontal scrollbar appears); all
// other nodes stay auto-height and ignore the file's stored height.
//
// Uses plain DOM APIs (createElement/classList) instead of Obsidian's
// HTMLElement extensions so the module also runs in a bare browser smoke
// harness. All geometry comes from view/geometry.js — this file only maps
// model data onto DOM.

const { NODE_TYPES, DEFAULT_PORTS } = require('../model/constants');
const { deriveTurns } = require('../model/turns');
const {
    DEFAULT_NODE_WIDTH,
    resolveNodeSize,
    portAnchor,
    portFraction,
    sideHandles,
    edgePath,
    nodeBounds
} = require('./geometry');

const SVG_NS = 'http://www.w3.org/2000/svg';
// World-space padding around the node bounding box for the SVG edge layer.
const SVG_PAD = 400;

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

function svgEl(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
            node.setAttribute(key, String(value));
        }
    }
    return node;
}

// ---------------------------------------------------------------------------
// Node element
// ---------------------------------------------------------------------------

// Type-specific CSS modifier. Unknown (engine-only) types get --unsupported.
function typeModifier(type) {
    const known = { Entry: 'entry', Content: 'content', Dialog: 'dialog', Choice: 'choice', End: 'end' };
    return known[type] || 'unsupported';
}

// Per-option Choice output dot. UAT-8 #2: dots are direct children of the
// node ROOT (not the option row) so a fixed-size node's scrolling body can
// never clip their outer half; measureNode() pins each dot's `top` to its
// row's measured offset, and layoutEdge anchors at the same optionT
// fraction — dot and edge agree by construction.
function buildPortDot(kind, nodeId, optionId) {
    const dot = el('span', `ng-port ng-port--${kind}`);
    dot.dataset.nodeId = nodeId;
    if (optionId) dot.dataset.optionId = optionId;
    return dot;
}

// UAT-6 #1 (native .canvas): four edge-center side handles per node.
// geometry.sideHandles() resolves positions — a side occupied by a stored
// port renders at the stored t so edge endpoints keep a dot exactly on them;
// other sides sit at t=0.5. Handles are invisible until node hover or an
// in-progress link drag (CSS); gesture direction decides the role (drag-from
// = output side, drop-on = input side), so one element serves both.
// UAT-8 #3: Choice nodes suppress the RIGHT-side handle entirely — their
// outputs are the per-option dots, so a generic right handle is clutter.
// In-handles stay on left/top/bottom. Hit logic agrees by construction:
// canvas-view _portHandleAt() hit-tests the rendered dots, and an absent
// element has no hitbox.
function buildSideHandles(nodeId, ports, nodeType) {
    const out = [];
    for (const h of sideHandles(ports)) {
        if (nodeType === 'Choice' && h.side === 'right') continue;
        const dot = el('span', 'ng-port ng-port--side');
        dot.dataset.nodeId = nodeId;
        dot.dataset.side = h.side;
        const f = portFraction(h.side, h.t);
        dot.style.left = `${f.x * 100}%`;
        dot.style.top = `${f.y * 100}%`;
        out.push(dot);
    }
    return out;
}

// UAT-6 #5 / UAT-7: resize affordance. Only the 4 corner squares remain,
// and they are pure decoration (CSS pointer-events: none) — actual hit
// testing is coordinate-based over the whole border band (geometry
// resizeZoneAt), wired in canvas-view.js.
const RESIZE_DIRS = ['ne', 'nw', 'se', 'sw'];

function buildResizeHandles() {
    return RESIZE_DIRS.map(dir => {
        const h = el('span', `ng-resize ng-resize--${dir}`);
        h.dataset.dir = dir;
        return h;
    });
}

function buildNodeElement(node) {
    const root = el('div', `ng-node ng-node--${typeModifier(node.type)}`);
    root.dataset.nodeId = node.id;

    const width = Number.isFinite(node.width) && node.width > 0 ? node.width : DEFAULT_NODE_WIDTH;
    root.style.width = `${width}px`;
    root.style.left = `${node.x || 0}px`;
    root.style.top = `${node.y || 0}px`;
    // Height is set ONLY for nodes manually resized in narrative-graph
    // (UAT-6 #5 `manualSize` marker — fixed-size, content scrolls via CSS);
    // every other node flows to natural height and the file's stored height
    // is ignored (NG-08 auto height).
    if (node.manualSize && Number.isFinite(node.height) && node.height > 0) {
        root.style.height = `${node.height}px`;
        root.classList.add('ng-node--fixed');
    }

    // UAT-6 #1: four side handles on every node (native .canvas). Gesture
    // direction decides the role — the view enforces Entry=source-only,
    // End/Choice=drop-target-only. UAT-8 #3: Choice suppresses the RIGHT
    // handle (its outputs are the per-option dots, appended below).
    const ports = node.ports || DEFAULT_PORTS;
    for (const handle of buildSideHandles(node.id, ports, node.type)) root.appendChild(handle);

    // Header: type marker + title
    const header = el('div', 'ng-node__header');
    if (node.type === 'Entry') header.appendChild(el('span', 'ng-node__marker', '▶'));
    if (node.type === 'End') header.appendChild(el('span', 'ng-node__marker', '■'));
    header.appendChild(el('span', 'ng-node__title', node.title || node.type));
    if (!NODE_TYPES.includes(node.type)) {
        header.appendChild(el('span', 'ng-node__badge', `${node.type} (unsupported)`));
    }
    root.appendChild(header);

    // Body: per-type content
    const body = el('div', 'ng-node__body');
    if (node.type === 'Dialog') {
        const turns = Array.isArray(node.turns) && node.turns.length > 0 ? node.turns : deriveTurns(node);
        if (turns.length > 0) {
            for (const turn of turns) {
                const row = el('div', 'ng-node__turn');
                row.appendChild(el('span', 'ng-node__speaker', `${turn.speaker}:`));
                row.appendChild(el('span', 'ng-node__line', turn.line));
                body.appendChild(row);
            }
        } else if (node.body) {
            body.appendChild(el('div', 'ng-node__text', node.body));
        }
    } else {
        if (node.body) body.appendChild(el('div', 'ng-node__text', node.body));
        if (node.type === 'Choice') {
            const hasOptions = Array.isArray(node.choiceOptions) && node.choiceOptions.length > 0;
            const options = hasOptions
                ? node.choiceOptions
                : (Array.isArray(node.choices) ? node.choices.map(label => ({ label })) : []);
            for (const option of options) {
                const row = el('div', 'ng-node__option', (option && option.label) || '(empty option)');
                if (option && option.id) row.dataset.optionId = option.id;
                body.appendChild(row);
            }
            // UAT-8 #2: option output dots are ROOT children (outside the
            // scrollable body of fixed-size nodes, whose horizontal clip
            // edge would cut their outer half). measureNode() pins each
            // dot's top to its row's measured offset after layout.
            for (const option of options) {
                if (option && option.id) {
                    root.appendChild(buildPortDot('out', node.id, option.id));
                }
            }
        }
    }
    root.appendChild(body);

    // Resize corner squares (UAT-7): pure decoration, pointer-events none,
    // visible only while the node is selected (CSS) — the whole border band
    // is the live resize hit zone, hit-tested by coordinates in the view.
    for (const handle of buildResizeHandles()) root.appendChild(handle);
    return root;
}

// ---------------------------------------------------------------------------
// Edge layout (shared by render + live drag updates)
// ---------------------------------------------------------------------------

// Resolve the display label for a link. Choice links label with the option
// label (choiceOptionId -> source node choiceOptions[].label, NG edge-label
// decision); fall back to link.label. A requirements string renders as a
// second small line below the label.
function resolveEdgeLabels(link, nodeById) {
    let label = typeof link.label === 'string' ? link.label : '';
    const source = nodeById.get(link.from);
    if (source && typeof link.choiceOptionId === 'string' && Array.isArray(source.choiceOptions)) {
        const option = source.choiceOptions.find(o => o && o.id === link.choiceOptionId);
        if (option && typeof option.label === 'string' && option.label.length > 0) {
            label = option.label;
        }
    }
    const requirements = typeof link.requirements === 'string' && link.requirements.trim().length > 0
        ? link.requirements.trim()
        : '';
    return { label, requirements };
}

/**
 * Compute the geometry + labels of one link.
 *
 * @param {Object} link - The link model object
 * @param {Map<string, Object>} nodeById - id -> node
 * @param {Map<string, {width: number, height: number}>} sizes - rendered sizes
 * @returns {{ d: string, mid: {x:number,y:number},
 *            from: {x:number,y:number,side:string},
 *            to: {x:number,y:number,side:string},
 *            label: string, requirements: string } | null}
 *   null for dangling endpoints
 */
function layoutEdge(link, nodeById, sizes) {
    const from = nodeById.get(link.from);
    const to = nodeById.get(link.to);
    if (!from || !to) return null; // dangling id — parse errors banner reports it

    const fromSize = resolveNodeSize(from, sizes.get(from.id) && sizes.get(from.id).height);
    const toSize = resolveNodeSize(to, sizes.get(to.id) && sizes.get(to.id).height);
    const fromPorts = from.ports || DEFAULT_PORTS;
    const toPorts = to.ports || DEFAULT_PORTS;
    // Choice links anchor at their option row's measured height fraction
    // when available (optionT), falling back to the file/default port t.
    const fromSizeEntry = sizes.get(from.id);
    let outT = fromPorts.output && fromPorts.output.t;
    if (link.choiceOptionId && fromSizeEntry && fromSizeEntry.optionT
        && Number.isFinite(fromSizeEntry.optionT[link.choiceOptionId])) {
        outT = fromSizeEntry.optionT[link.choiceOptionId];
    }
    const p0 = portAnchor(from, fromSize, fromPorts.output && fromPorts.output.side, outT);
    const p1 = portAnchor(to, toSize, toPorts.input && toPorts.input.side, toPorts.input && toPorts.input.t);
    const { d, mid } = edgePath(p0, p1);
    const { label, requirements } = resolveEdgeLabels(link, nodeById);
    return { d, mid, from: p0, to: p1, label, requirements };
}

// Push a computed layout into an existing edge group (live drag updates).
function applyEdgeLayout(group, layout) {
    const path = group.querySelector('.ng-edge__path');
    const hit = group.querySelector('.ng-edge__hit');
    if (path) path.setAttribute('d', layout.d);
    if (hit) hit.setAttribute('d', layout.d);
    const label = group.querySelector('.ng-edge__label');
    if (label) {
        label.setAttribute('x', String(layout.mid.x));
        label.setAttribute('y', String(layout.mid.y - 6));
        label.textContent = layout.label;
        label.style.display = layout.label ? '' : 'none';
    }
    const cond = group.querySelector('.ng-edge__condition');
    if (cond) {
        cond.setAttribute('x', String(layout.mid.x));
        cond.setAttribute('y', String(layout.mid.y + (layout.label ? 12 : -6)));
        cond.textContent = layout.requirements;
        cond.style.display = layout.requirements ? '' : 'none';
    }
}

// Build one edge group: fat invisible hit path (click selection) under the
// visible 2px path, plus label/condition texts.
function buildEdgeGroup(link, layout) {
    const group = svgEl('g', { class: 'ng-edge', 'data-link-id': link.id });
    group.appendChild(svgEl('path', { class: 'ng-edge__hit', d: layout.d }));
    group.appendChild(svgEl('path', { class: 'ng-edge__path', d: layout.d }));

    const label = svgEl('text', { class: 'ng-edge__label', x: layout.mid.x, y: layout.mid.y - 6, 'text-anchor': 'middle' });
    label.textContent = layout.label;
    if (!layout.label) label.style.display = 'none';
    group.appendChild(label);

    const cond = svgEl('text', {
        class: 'ng-edge__condition',
        x: layout.mid.x,
        y: layout.mid.y + (layout.label ? 12 : -6),
        'text-anchor': 'middle'
    });
    cond.textContent = layout.requirements;
    if (!layout.requirements) cond.style.display = 'none';
    group.appendChild(cond);
    return group;
}

function buildEdgeLayer(nodes, links, sizes) {
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const bounds = nodeBounds(nodes, sizes);
    const edgeEls = new Map();
    if (!bounds) return { svg: svgEl('svg', { class: 'ng-edges' }), edgeEls };

    const x = bounds.minX - SVG_PAD;
    const y = bounds.minY - SVG_PAD;
    const w = (bounds.maxX - bounds.minX) + SVG_PAD * 2;
    const h = (bounds.maxY - bounds.minY) + SVG_PAD * 2;
    const svg = svgEl('svg', { class: 'ng-edges', viewBox: `${x} ${y} ${w} ${h}` });
    svg.style.left = `${x}px`;
    svg.style.top = `${y}px`;
    svg.style.width = `${w}px`;
    svg.style.height = `${h}px`;

    for (const link of links) {
        const layout = layoutEdge(link, nodeById, sizes);
        if (!layout) continue;
        const group = buildEdgeGroup(link, layout);
        edgeEls.set(link.id, group);
        svg.appendChild(group);
    }

    // Debug overlay (M1b UAT aid): window.__ngDebug = true draws dots at the
    // computed port anchors (green = output/from, orange = input/to) and a
    // cross at each edge midpoint, so alignment issues are visible instantly.
    if (typeof window !== 'undefined' && window.__ngDebug) {
        const debugLayer = svgEl('g', { class: 'ng-debug' });
        for (const link of links) {
            const layout = layoutEdge(link, nodeById, sizes);
            if (!layout) continue;
            debugLayer.appendChild(svgEl('circle', { class: 'ng-debug__from', cx: layout.from.x, cy: layout.from.y, r: 5 }));
            debugLayer.appendChild(svgEl('circle', { class: 'ng-debug__to', cx: layout.to.x, cy: layout.to.y, r: 5 }));
            const cross = svgEl('path', {
                class: 'ng-debug__mid',
                d: `M ${layout.mid.x - 6} ${layout.mid.y} L ${layout.mid.x + 6} ${layout.mid.y} M ${layout.mid.x} ${layout.mid.y - 6} L ${layout.mid.x} ${layout.mid.y + 6}`
            });
            debugLayer.appendChild(cross);
        }
        svg.appendChild(debugLayer);
    }
    return { svg, edgeEls };
}

// ---------------------------------------------------------------------------
// Public render entry
// ---------------------------------------------------------------------------

// Measure a rendered node element: size + per-option vertical fraction
// (optionT) for Choice nodes so edges anchor at their option row.
// Falls back to estimates when the element is detached/zero-height.
// UAT-8 #2 side effect: Choice option dots are ROOT children (outside the
// scrollable body), so this also pins each dot's `top` to its row's
// measured mid-offset — the dots and the optionT edge anchors derive from
// the same numbers and can't drift apart. Row offsetTop is relative to the
// node root (the rows' only positioned ancestor), the same coordinate space
// as the dots' containing block.
function measureNode(node, nodeEl) {
    const measured = nodeEl.offsetHeight > 0 ? nodeEl.offsetHeight : undefined;
    const size = resolveNodeSize(node, measured);
    const result = { width: size.width, height: size.height };
    if (node.type === 'Choice' && measured) {
        const optionT = {};
        // UAT-5: only the ROWS carry meaningful offsets — the port dots
        // also have data-option-id and would overwrite the row's fraction
        // with a row-relative one (latent since M1b).
        for (const row of nodeEl.querySelectorAll('.ng-node__option[data-option-id]')) {
            const mid = row.offsetTop + row.offsetHeight / 2;
            if (Number.isFinite(mid)) {
                optionT[row.dataset.optionId] = mid / measured;
                const dot = nodeEl.querySelector(
                    `:scope > .ng-port--out[data-option-id="${row.dataset.optionId}"]`);
                if (dot) dot.style.top = `${mid}px`;
            }
        }
        result.optionT = optionT;
    }
    return result;
}

/**
 * Render the parsed saved-state into `contentEl`, replacing prior content.
 *
 * @param {HTMLElement} contentEl - View content element (owned by the view)
 * @param {Object} state - Parsed saved-state object
 * @param {Array<string>} errors - Validation errors from parseSavedState
 * @returns {{ worldEl: HTMLElement, frameEl: HTMLElement, svgEl: Element,
 *            nodeEls: Map<string, HTMLElement>,
 *            edgeEls: Map<string, Element>,
 *            sizes: Map<string, {width: number, height: number}>,
 *            bounds: Object|null }}
 */
function renderCanvas(contentEl, state, errors) {
    contentEl.textContent = '';
    const frame = el('div', 'ng-canvas');
    contentEl.appendChild(frame);

    if (errors && errors.length > 0) {
        const banner = el('div', 'ng-canvas__warning',
            `File has ${errors.length} parse problem(s) — rendering valid parts only.`);
        banner.title = errors.join('\n');
        frame.appendChild(banner);
    }

    const project = state.project || {};
    const nodes = Array.isArray(project.nodes) ? project.nodes : [];
    const links = Array.isArray(project.links) ? project.links : [];

    const world = el('div', 'ng-world');
    frame.appendChild(world);

    // Nodes in one DocumentFragment (NG perf guard: hundreds of nodes, no
    // virtualization, single insert).
    const fragment = document.createDocumentFragment();
    const nodeEls = new Map();
    for (const node of nodes) {
        const nodeEl = buildNodeElement(node);
        nodeEls.set(node.id, nodeEl);
        fragment.appendChild(nodeEl);
    }
    world.appendChild(fragment);

    // Measure natural (auto) heights now that nodes are in the DOM; falls back
    // to the estimate when detached/zero (headless harness).
    const sizes = new Map();
    for (const node of nodes) {
        sizes.set(node.id, measureNode(node, nodeEls.get(node.id)));
    }

    // Edge layer goes UNDER the node layer (inserted as first world child).
    const { svg, edgeEls } = buildEdgeLayer(nodes, links, sizes);
    world.insertBefore(svg, world.firstChild);

    return { worldEl: world, frameEl: frame, svgEl: svg, nodeEls, edgeEls, sizes, bounds: nodeBounds(nodes, sizes) };
}

module.exports = { renderCanvas, layoutEdge, applyEdgeLayout, resolveEdgeLabels, measureNode };

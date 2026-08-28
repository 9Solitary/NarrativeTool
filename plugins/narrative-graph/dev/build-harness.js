// build-harness.js — generate dev/canvas-harness.html: a self-contained
// browser page that loads the BUILT narrative-graph plugin with an Obsidian
// mock and renders a real fixture (Phase 11 M1b UAT verification aid).
//
//   node plugins/narrative-graph/dev/build-harness.js
//
// Then open dev/canvas-harness.html in a browser and use the buttons or
// window.__ng hooks. Append #autotest to the URL to run a scripted
// interaction pass whose results land in <pre id="ng-results">:
//   chrome --headless=new --dump-dom "file:///.../canvas-harness.html#autotest"
//
// UAT-2 fidelity notes (why M1b's harness missed real-Obsidian bugs):
//   - The view sits inside a TRANSFORMED ancestor (mimics workspace leaf
//     CSS transforms, which change fixed/absolute coordinate resolution).
//   - Pointer events go through a POINTER CAPTURE emulation: Chromium
//     retargets pointermove/up and the compatibility click/dblclick to the
//     capture element. Synthetic events never trigger real capture, so the
//     old harness silently bypassed the retargeting that killed dblclick.
//   - The Delete check focuses the container first — the view uses the
//     standard container-level keydown contract (simplified post-UAT-3).

const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const bundle = readFileSync(join(ROOT, 'main.js'), 'utf-8');
// Fixture override: `node build-harness.js <path-to.ncanvas>` renders a
// different file (e.g. the 51-node sample for #portcheck verification).
const fixture = readFileSync(
    process.argv[2] || join(ROOT, '..', '..', 'tests', 'fixtures', 'med-nested-choice.ncanvas'),
    'utf-8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>narrative-graph canvas harness</title>
<style>
/* Minimal Obsidian theme-var stand-ins so the plugin CSS renders sanely */
:root {
    --background-primary: #0d1117;
    --background-secondary: #161b22;
    --background-modifier-border: #30363d;
    --background-modifier-hover: #21262d;
    --background-modifier-error: #6e2020;
    --text-normal: #c9d1d9;
    --text-muted: #8b949e;
    --text-faint: #6e7681;
    --text-accent: #58a6ff;
    --text-error: #f85149;
    --text-on-accent: #ffffff;
    --interactive-accent: #58a6ff;
    --color-green: #3fb950;
    --color-red: #f85149;
    --color-yellow: #d29922;
    --color-blue: #58a6ff;
    --color-orange: #d97618;
    --color-purple: #bc8cff;
    --font-ui-small: 13px;
    --font-ui-smaller: 12px;
    --font-monospace: monospace;
}
html, body { margin: 0; height: 100%; background: var(--background-primary); }
/* Mimic the Obsidian workspace leaf chain: transformed ancestor changes
   fixed/absolute coordinate resolution for descendants. */
.ws-sim { transform: translate(30px, 20px); width: calc(100% - 30px); height: calc(100% - 20px); }
#host { position: relative; width: 100%; height: 100%; overflow: hidden; }
#ng-harness-ui { position: fixed; bottom: 8px; left: 8px; z-index: 100; display: flex; gap: 6px; }
#ng-harness-ui button { font: 12px sans-serif; padding: 3px 10px; }
#ng-results { position: fixed; bottom: 40px; left: 8px; z-index: 100; color: #3fb950; font: 12px monospace; white-space: pre; }
</style>
</head>
<body>
<div class="ws-sim"><div id="host"></div></div>
<div id="ng-harness-ui">
    <button onclick="__ng.addNode('Content')">+Content</button>
    <button onclick="__ng.addNode('Dialog')">+Dialog</button>
    <button onclick="__ng.openEditor('n1')">edit n1</button>
    <button onclick="__ng.toggleDebug()">debug overlay</button>
    <button onclick="__ng.autotest()">run autotest</button>
</div>
<pre id="ng-results"></pre>
<script>
// --- Obsidian mock ---------------------------------------------------------
const __host = document.getElementById('host');
HTMLElement.prototype.empty = function () { this.textContent = ''; };
HTMLElement.prototype.addClass = function (cls) { this.classList.add(cls); return this; };
HTMLElement.prototype.removeClass = function (cls) { this.classList.remove(cls); return this; };
HTMLElement.prototype.createEl = function (tag, opts) {
    const el = document.createElement(tag);
    if (opts && opts.cls) el.className = opts.cls;
    if (opts && opts.text) el.textContent = opts.text;
    this.appendChild(el);
    return el;
};

class TextFileView {
    constructor(leaf) {
        this.leaf = leaf;
        this.app = leaf && leaf.app;
        this.file = null;
        this.contentEl = document.createElement('div');
        this.contentEl.style.height = '100%';
    }
    requestSave() { window.__ngSaves = (window.__ngSaves || 0) + 1; }
}
class Plugin {
    constructor(app, manifest) { this.app = app; this.manifest = manifest || { version: 'dev' }; }
    register(fn) { this._cleanup = fn; }
    registerView(type, factory) { window.__ngViewFactory = factory; }
    registerExtensions() {}
    addCommand() {}
    addSettingTab() {}
    async loadData() { return {}; }
    async saveData() {}
}
class Notice {
    constructor(msg) { (window.__ngNotices = window.__ngNotices || []).push(String(msg)); }
}
class PluginSettingTab {
    constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = document.createElement('div'); }
    display() {}
}
class Setting {
    constructor() {}
    setName() { return this; }
    setDesc() { return this; }
    addText() { return this; }
    addButton() { return this; }
    addToggle() { return this; }
}
const obsidianMock = { Plugin, TextFileView, Notice, PluginSettingTab, Setting };

// --- pointer capture emulation ---------------------------------------------
// Chromium retargets pointermove/up/cancel AND the compatibility
// click/dblclick to the capture element. Synthetic events have no active
// pointer, so real setPointerCapture would throw — record + retarget
// manually instead. This is what the old harness missed.
const __captures = {};
const __origSetCapture = HTMLElement.prototype.setPointerCapture;
const __origRelCapture = HTMLElement.prototype.releasePointerCapture;
HTMLElement.prototype.setPointerCapture = function (id) { __captures[id] = this; };
HTMLElement.prototype.releasePointerCapture = function (id) { delete __captures[id]; };
HTMLElement.prototype.hasPointerCapture = function (id) { return !!__captures[id]; };

function __dispatch(target, evt) { target.dispatchEvent(evt); }
function pd(target, props) {
    __dispatch(target, new PointerEvent('pointerdown',
        Object.assign({ bubbles: true, cancelable: true, pointerId: 7, button: 0 }, props)));
}
function pm(target, props) {
    const real = __captures[7] || target; // retarget while captured
    __dispatch(real, new PointerEvent('pointermove',
        Object.assign({ bubbles: true, cancelable: true, pointerId: 7, button: 0 }, props)));
}
function pu(target, props) {
    const captured = __captures[7] || null;
    __dispatch(captured || target, new PointerEvent('pointerup',
        Object.assign({ bubbles: true, cancelable: true, pointerId: 7, button: 0 }, props)));
    delete __captures[7]; // implicit release
    // Compatibility click: fires at the capture element when captured.
    __dispatch(captured || target, new MouseEvent('click',
        Object.assign({ bubbles: true, cancelable: true }, props)));
}
function dblclickSeq(target, props) {
    // Two full click sequences; with capture, both clicks and the dblclick
    // land on the capture element (Chromium behavior).
    pd(target, props); pu(target, props);
    const captured = __captures[7] || target;
    pd(target, props);
    const captured2 = __captures[7] || target;
    __dispatch(captured2, new PointerEvent('pointerup',
        Object.assign({ bubbles: true, cancelable: true, pointerId: 7, button: 0 }, props)));
    delete __captures[7];
    __dispatch(captured2, new MouseEvent('click', Object.assign({ bubbles: true, cancelable: true }, props)));
    __dispatch(captured2, new MouseEvent('dblclick', Object.assign({ bubbles: true, cancelable: true }, props)));
}
function key(target, keyName) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true }));
}
function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// --- UAT-5 #4 / UAT-6 #1 regression guard: every edge endpoint sits on a ---
// rendered handle. UAT-6 generalizes dots to four-side handles (data-side,
// hidden-but-measurable via opacity), so the check passes when ANY handle of
// the endpoint node coincides with the path endpoint — the renderer always
// draws one at the stored anchor position (occupied sides keep stored t).
// Path endpoints are SVG viewBox coords = world coords (svg is 1:1 world);
// dot centers come from DOM rects. Compared in SCREEN px so the tolerance is
// zoom-independent (dot % positioning uses the padding box vs the anchor's
// border-box math — the 1px node border is why TOL is not 0).
async function runPortCheck(out, check) {
    const view = window.__ngView;
    await new Promise(r => setTimeout(r, 400)); // rAF 二次布局稳定
    const cam = view._viewport.getView();
    const fr = view._frameEl.getBoundingClientRect();
    const TOL = 3; // screen px
    let checked = 0;
    const bad = [];
    const groups = view.contentEl.querySelectorAll('.ng-edge');
    for (const group of groups) {
        const linkId = group.getAttribute('data-link-id');
        const link = view._state.project.links.find(l => l.id === linkId);
        const path = group.querySelector('.ng-edge__path');
        const m = /M (-?[\\d.]+) (-?[\\d.]+) C .*, (-?[\\d.]+) (-?[\\d.]+)$/.exec(path.getAttribute('d'));
        if (!m || !link) { bad.push(linkId + ':unparsable'); continue; }
        const fromEl = view._nodeEls.get(link.from);
        const toEl = view._nodeEls.get(link.to);
        // Choice links anchor at the per-option dot; everything else at one
        // of the four side handles. UAT-8 #2: option dots are ROOT children
        // of the node (moved out of the row/body so the scrolling body of a
        // fixed-size node can never clip them).
        const fromDots = link.choiceOptionId
            ? [fromEl.querySelector(':scope > .ng-port--out[data-option-id="' + link.choiceOptionId + '"]')].filter(Boolean)
            : [...fromEl.querySelectorAll(':scope > .ng-port--side')];
        const toDots = [...toEl.querySelectorAll(':scope > .ng-port--side')];
        if (!fromDots.length || !toDots.length) { bad.push(linkId + ':missing-dot'); continue; }
        const pairs = [
            { tag: 'from', dots: fromDots, x: parseFloat(m[1]), y: parseFloat(m[2]) },
            { tag: 'to', dots: toDots, x: parseFloat(m[3]), y: parseFloat(m[4]) }
        ];
        for (const p of pairs) {
            const ex = p.x * cam.scale + cam.x + fr.left;
            const ey = p.y * cam.scale + cam.y + fr.top;
            let best = Infinity;
            let bestDot = null;
            for (const dot of p.dots) {
                const dr = dot.getBoundingClientRect();
                const d = Math.max(
                    Math.abs(dr.left + dr.width / 2 - ex),
                    Math.abs(dr.top + dr.height / 2 - ey));
                if (d < best) { best = d; bestDot = dot; }
            }
            checked++;
            if (best > TOL) {
                bad.push(linkId + ':' + p.tag + '(d' + Math.round(best)
                    + ' side=' + (bestDot && bestDot.dataset ? bestDot.dataset.side : '?')
                    + ' edgeY=' + Math.round(ey) + ')');
            }
        }
    }
    check('edge endpoints coincide with port handles (' + checked + ' endpoints'
        + (bad.length ? ', BAD: ' + bad.join(' ') : '') + ')',
        checked > 0 && bad.length === 0);
}

async function runPortCheckStandalone() {
    const out = [];
    const check = (name, ok) => out.push((ok ? 'PASS' : 'FAIL') + ' ' + name);
    try {
        await runPortCheck(out, check);
    } catch (err) {
        out.push('ERROR ' + (err && err.message));
    }
    document.getElementById('ng-results').textContent = out.join('\\n');
    document.title = out.some(l => l.startsWith('FAIL') || l.startsWith('ERROR')) ? 'AUTOTEST-FAIL' : 'AUTOTEST-PASS';
}

// --- load the BUILT plugin bundle through a require shim -------------------
function loadBundle() {
    const module = { exports: {} };
    const requireShim = (name) => {
        if (name === 'obsidian') return obsidianMock;
        throw new Error('harness: unexpected require ' + name);
    };
    const fn = new Function('module', 'exports', 'require', BUNDLE_SOURCE);
    fn(module, module.exports, requireShim);
    return module.exports;
}

const harnessApp = { workspace: {} };
const PluginClass = loadBundle();
const plugin = new PluginClass(harnessApp, { version: 'dev' });
plugin.onload().then(() => {
    const view = window.__ngViewFactory({ app: harnessApp });
    view.file = { basename: 'med-nested-choice' };
    __host.appendChild(view.contentEl);
    return view.onOpen().then(() => {
        view.setViewData(FIXTURE_SOURCE, true);
        window.__ngView = view;
        window.__ng = {
            addNode(type) { view._createNode(type); },
            openEditor(id) { view._openNodeEditor(id); },
            toggleDebug() { window.__ngDebug = !window.__ngDebug; view._afterMutation(); },
            autotest: runAutotest
        };
        if (location.hash === '#autotest') setTimeout(runAutotest, 300);
        if (location.hash === '#portcheck') setTimeout(runPortCheckStandalone, 300);
    });
});

// --- scripted interaction pass ----------------------------------------------
async function runAutotest() {
    const view = window.__ngView;
    const out = [];
    const check = (name, ok) => out.push((ok ? 'PASS' : 'FAIL') + ' ' + name);
    try {
        const nodesBefore = view._state.project.nodes.length;

        // 1. toolbar add
        view._createNode('Content');
        check('toolbar add node', view._state.project.nodes.length === nodesBefore + 1);

        // NOTE: check 1 re-renders — fetch frame/node handles AFTER it.
        const frame = view._frameEl;

        // 2. marquee select-all (capture-emulated drag)
        pd(frame, { clientX: 0, clientY: 0 });
        pm(view.contentEl, { clientX: innerWidth, clientY: innerHeight });
        pu(view.contentEl, { clientX: innerWidth, clientY: innerHeight });
        check('marquee selects all (' + view._selectedNodeIds.size + '/' + view._state.project.nodes.length + ')',
            view._selectedNodeIds.size === view._state.project.nodes.length);

        // 3. trailing click suppressed; next plain click clears
        check('post-marquee click suppressed', view._selectedNodeIds.size > 0);
        // Synthetic events fire synchronously — clear the 150ms trailing-drag
        // suppression window so this "later" click isn't mistaken for the
        // marquee's own trailing click.
        view._dragEndedAt = 0;
        frame.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        check('plain empty click clears selection', view._selectedNodeIds.size === 0);

        // 4. UAT-2 #3: shift+marquee ADDS to an existing selection
        view._nodeEls.get('n1').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const r3 = view._nodeEls.get('n3').getBoundingClientRect();
        const r4 = view._nodeEls.get('n4').getBoundingClientRect();
        const x0 = Math.min(r3.left, r4.left) - 12, y0 = Math.min(r3.top, r4.top) - 12;
        const x1 = Math.max(r3.right, r4.right) + 12, y1 = Math.max(r3.bottom, r4.bottom) + 12;
        pd(frame, { clientX: x0, clientY: y0, shiftKey: true });
        pm(view.contentEl, { clientX: x1, clientY: y1, shiftKey: true });
        pu(view.contentEl, { clientX: x1, clientY: y1, shiftKey: true });
        const sel = view._selectedNodeIds;
        check('shift+marquee adds (has n1,n3,n4: ' + [...sel].join(',') + ')',
            sel.has('n1') && sel.has('n3') && sel.has('n4'));
        frame.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        view._setSelection([], null);

        // 5. UAT-2 #1: Delete after pointer selection (container-focused
        // keyboard, simplified post-UAT-3 contract)
        view._dragEndedAt = 0; // synthetic immediacy: clear 150ms suppression
        view._nodeEls.get('n3').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        view.contentEl.focus({ preventScroll: true });
        key(view.contentEl, 'Delete');
        check('Delete removes selected node (container focused)',
            !view._state.project.nodes.some(n => n.id === 'n3'));

        // 6. UAT-2 #2: dblclick opens editor ON-SCREEN (capture-emulated)
        view._dragEndedAt = 0; // synthetic immediacy: clear 150ms suppression
        const n1pos = centerOf(view._nodeEls.get('n1'));
        dblclickSeq(view._nodeEls.get('n1'), { clientX: n1pos.x, clientY: n1pos.y });
        const panel = view.contentEl.querySelector('.ng-editor');
        check('dblclick opens editor (capture retargeting active)', !!panel);
        if (panel) {
            const pr = panel.getBoundingClientRect();
            // Re-fetch: check 5's Delete re-rendered, the old frame is detached.
            const fr = view._frameEl.getBoundingClientRect();
            const fmt = (r) => [r.left, r.top, r.right, r.bottom].map(v => Math.round(v)).join(',');
            check('editor panel within frame bounds [panel ' + fmt(pr) + ' | frame ' + fmt(fr) + ']',
                pr.left >= fr.left - 1 && pr.top >= fr.top - 1
                && pr.left < fr.right && pr.top < fr.bottom && pr.width > 0 && pr.height > 0);
        }
        if (panel) key(panel.querySelector('input'), 'Escape');

        // 7. dblclick edge opens condition editor
        view._dragEndedAt = 0; // synthetic immediacy: clear 150ms suppression
        const hit = view.contentEl.querySelector('.ng-edge[data-link-id="l1"] .ng-edge__hit');
        const mid = centerOf(hit);
        dblclickSeq(hit, { clientX: mid.x, clientY: mid.y });
        check('dblclick edge opens condition editor', !!view.contentEl.querySelector('.ng-editor--link'));
        const linkPanel = view.contentEl.querySelector('.ng-editor--link');
        if (linkPanel) {
            // M2b (NG-07): an unparseable expression falls back to raw-only
            const condField = linkPanel.querySelector('.ng-editor__requires');
            condField.value = 'flag_honest == true';
            condField.dispatchEvent(new Event('change', { bubbles: true }));
            check('condition builder raw fallback (==)',
                linkPanel.querySelector('.ng-cond__note')
                && linkPanel.querySelector('.ng-cond__note').style.display !== 'none');
            // A parseable text edit is picked up and visualized on change
            condField.value = 'res_coins >= 5';
            condField.dispatchEvent(new Event('change', { bubbles: true }));
            check('condition builder visualizes parseable edit',
                linkPanel.querySelectorAll('.ng-cond__row').length === 1);
            key(condField, 'Escape');
        }

        // 8. port-drag link creation with real elementFromPoint hit-testing
        // (UAT-8 #2: option dots are root children of the node)
        const outDot = view._nodeEls.get('n2').querySelector(':scope > .ng-port--out[data-option-id="opt_yes"]');
        const targetPos = centerOf(view._nodeEls.get('n5'));
        const linksBefore = view._state.project.links.length;
        const dotPos = centerOf(outDot);
        pd(outDot, { clientX: dotPos.x, clientY: dotPos.y });
        pm(view.contentEl, { clientX: targetPos.x, clientY: targetPos.y });
        pu(view.contentEl, { clientX: targetPos.x, clientY: targetPos.y });
        check('port drag creates link', view._state.project.links.length === linksBefore + 1);

        // 9. no NaN in any edge path
        const paths = [...view.contentEl.querySelectorAll('.ng-edge__path')];
        check('no NaN edge paths', paths.every(p => !/NaN/.test(p.getAttribute('d'))));

        // 10. M3: system-clipboard copy/paste with full id remap
        let clipText = '';
        Object.defineProperty(window.navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: (t) => { clipText = t; return Promise.resolve(); },
                readText: () => Promise.resolve(clipText)
            }
        });
        view._setSelection(['n2'], null);
        view._copySelection();
        await Promise.resolve(); // writeText flush
        const pasteOk = clipText.indexOf('narrativeGraphClipboard') !== -1;
        const beforePaste = view._state.project.nodes.length;
        await view._pasteClipboard();
        check('copy writes envelope; paste creates remapped copy',
            pasteOk && view._state.project.nodes.length === beforePaste + 1);

        // 11. M3: undo restores the pre-paste state
        view._undo();
        check('undo restores pre-paste state',
            view._state.project.nodes.length === beforePaste);

        // 12. UAT-7: border-band resize — pointerdown on the SELECTED node's
        // right edge band (away from the midpoint port dot) starts a resize,
        // not a node drag; commit writes width + manualSize. Undone again so
        // the portcheck anchors below are unaffected.
        view._setSelection(['n1'], null);
        const n1el = view._nodeEls.get('n1');
        const r1 = n1el.getBoundingClientRect();
        const scale1 = view._viewport.getView().scale;
        const w1 = view._sizes.get('n1').width;
        const bx = r1.right - 3, by = r1.top + 12;
        pd(n1el, { clientX: bx, clientY: by });
        const resizing = !!view._resize && view._resize.dir === 'e';
        pm(view.contentEl, { clientX: bx + 30 * scale1, clientY: by });
        pu(view.contentEl, { clientX: bx + 30 * scale1, clientY: by });
        const n1node = view._state.project.nodes.find(n => n.id === 'n1');
        check('border band resize (UAT-7, dir=e, +' + (n1node.width - w1) + 'w)',
            resizing && n1node.width === w1 + 30 && n1node.manualSize === true);
        view._undo();

        // 12b. UAT-8 #1: border resize works on an UNSELECTED node — the
        // pointerdown starts a resize immediately and single-selects the
        // node. No move -> no commit -> nothing to undo. (n2 = Choice: tall
        // enough that top+12 is clear of the right handle's 10px hit box,
        // unlike the ~41px-short Content nodes.)
        view._dragEndedAt = 0; // synthetic immediacy: clear 150ms suppression
        view._setSelection([], null);
        const n2el = view._nodeEls.get('n2');
        const r2b = n2el.getBoundingClientRect();
        pd(n2el, { clientX: r2b.right - 3, clientY: r2b.top + 12 });
        const unselResize = !!view._resize && view._resize.dir === 'e';
        pu(n2el, { clientX: r2b.right - 3, clientY: r2b.top + 12 }); // click lands on the node (no drag)
        check('unselected node border resize selects + resizes (UAT-8)',
            unselResize && view._selectedNodeIds.size === 1 && view._selectedNodeIds.has('n2'));

        // 12c. UAT-8 #2/#4: fixed-size overflow contract. Shrink n1 (Choice)
        // to the minimum height via the bottom band; the body must scroll
        // VERTICALLY with NO horizontal scrollbar, and the option dot's
        // outer half must stay hit-testable (root child — the scrolling
        // body can't clip it). The node is then relocated to empty space
        // (direct mutation, no history) so the dot probe can't land on a
        // neighboring node, and the undo restores everything.
        view._setSelection(['n1'], null);
        const c1el = view._nodeEls.get('n1');
        const rc1 = c1el.getBoundingClientRect();
        const sc1 = view._viewport.getView().scale;
        const bx2 = rc1.left + 40, by2 = rc1.bottom - 3;
        pd(c1el, { clientX: bx2, clientY: by2 });
        const shrinkStarted = !!view._resize && view._resize.dir === 's';
        pm(view.contentEl, { clientX: bx2, clientY: by2 - 500 * sc1 });
        pu(view.contentEl, { clientX: bx2, clientY: by2 - 500 * sc1 });
        const c1node = view._state.project.nodes.find(n => n.id === 'n1');
        check('fixed small Choice via bottom band (height=' + (c1node && c1node.height) + ')',
            shrinkStarted && c1node.manualSize === true && c1node.height === 60);
        c1node.x = 1500; c1node.y = 800; // clear of all neighbors
        view._rerenderPreservingCamera();
        const fr2 = view._frameEl.getBoundingClientRect();
        view._viewport.setView({ x: 250 - fr2.left - 1500, y: 250 - fr2.top - 800, scale: 1 });
        const n1el2 = view._nodeEls.get('n1');
        const body2 = n1el2.querySelector('.ng-node__body');
        const dot2 = n1el2.querySelector(':scope > .ng-port--out[data-option-id="opt_pay"]');
        const dr2 = dot2.getBoundingClientRect();
        const dcx = dr2.left + dr2.width / 2, dcy = dr2.top + dr2.height / 2;
        const dotOuterHit = document.elementsFromPoint(dcx + 5, dcy).includes(dot2);
        check('fixed Choice: vertical scroll, no h-scrollbar, dot outer half visible'
            + ' (scrollH ' + body2.scrollHeight + '>' + body2.clientHeight
            + ', scrollW ' + body2.scrollWidth + '<=' + body2.clientWidth + ')',
            body2.scrollHeight > body2.clientHeight
            && body2.scrollWidth <= body2.clientWidth + 1
            && dotOuterHit);
        view._undo(); // restores height/manualSize AND the pre-resize position

        // 13. UAT-5 #4 / UAT-6 #1: edge endpoints coincide with rendered handles
        await runPortCheck(out, check);
    } catch (err) {
        out.push('ERROR ' + (err && err.message));
    }
    document.getElementById('ng-results').textContent = out.join('\\n');
    document.title = out.some(l => l.startsWith('FAIL') || l.startsWith('ERROR')) ? 'AUTOTEST-FAIL' : 'AUTOTEST-PASS';
}
</script>
</body>
</html>`;

const filled = html
    .replace('BUNDLE_SOURCE', JSON.stringify(bundle))
    .replace('FIXTURE_SOURCE', JSON.stringify(fixture));

const outPath = join(__dirname, 'canvas-harness.html');
writeFileSync(outPath, filled, 'utf-8');
console.log('[build-harness] wrote', outPath, `(${Math.round(filled.length / 1024)} KB)`);

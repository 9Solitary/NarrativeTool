// canvas-view.js — TextFileView subclass for .ncanvas files (Phase 11 M1b,
// NG-01/NG-02/NG-08; UAT fix pass 2026-08-27; M2a 变量表面板 NG-06; M2b
// 条件构建器 + 说话人自动补全 NG-07; M3 跨文件复制粘贴 + 快照 undo/redo)
//
// Editing closed loop: node drag (live edge updates, multi-select aware,
// 8px grid snap on release), double-click inline editors, toolbar node
// creation, port-drag link creation with ghost bezier, marquee box
// selection, edge selection/condition editing, Delete key handling.
// UAT-6 #1: four-side connection handles per node (native .canvas — visible
// on node hover / during link drag; drag-from = output side, drop-on =
// input side, body drop = nearest side; chosen sides persist into
// node.ports t=0.5; UAT-8 #3: Choice suppresses the RIGHT handle — its
// outputs are the per-option dots). UAT-6 #5: free resize of the selected
// node (live edge updates; commit writes width+height+manualSize and
// funnels through history/save). UAT-7: the handles became the whole border
// band — hit testing is coordinate-based (geometry.resizeZoneAt, port dot >
// resize zone > node drag) with a live hover cursor; only 4 decorative
// corner squares remain (pointer-events: none). UAT-8 #1: the border band
// and hover cursor apply to ANY node (selected or not — native .canvas);
// starting a resize on an unselected node selects it, corner squares show
// on hover, and the outside slack tightened to 2px (geometry
// RESIZE_OUTER_SLACK) so casual grabs near the border stay node drags.
// M2a: toolbar "变量表" toggle opens the global variables panel
// (Variables.md, see model/variables.js for the file contract). M2b:
// read-only caches of variable entries + shared characters (Characters/*.md)
// feed the condition builder and speaker autocomplete in editor.js.
// M3: Ctrl/Cmd+C/V copies the selected subgraph to the system clipboard as
// a JSON envelope and pastes it into ANY .ncanvas view with full id remap
// (Entry pasted as Content); Ctrl/Cmd+Z / Ctrl+Shift+Z / Ctrl+Y drive a
// snapshot history (model/history.js, cap 50, committed mutations only —
// navigation/selection/variables-panel edits create no entries).
//
// UAT ROOT-CAUSE NOTES (the class of bug this file now guards with jsdom
// tests in tests/narrative-graph-view.test.js):
//   1. NEVER preventDefault a left-button pointerdown: in Chromium, canceling
//      pointerdown suppresses ALL compatibility mouse events (click/dblclick)
//      — that killed node selection, editors, and (with pointer capture
//      retargeting) toolbar clicks. Pan/wheel survived because they are
//      pointermove/wheel based. preventDefault is allowed only for
//      middle-button (autoscroll) and wheel (page scroll).
//   2. All gesture listeners delegate on the persistent contentEl (never on
//      per-render node elements), so re-renders can't orphan handlers.
//   3. Edges must anchor to MEASURED node rects: the first render can run
//      before the view is visible (offsetHeight = 0 -> estimates), so a
//      second relayout pass runs on rAF after every render.
//   4. UAT-2: NEVER setPointerCapture for node/marquee/link drags — with a
//      real pointer, Chromium retargets the compatibility click/dblclick to
//      the capture element, so dblclick landed on contentEl instead of the
//      node (dead editors). Synthetic events (jsdom/harness) have no active
//      pointer and silently skip capture, hiding this. Drags track pointers
//      via document-level listeners instead.
//   5. UAT-2 (simplified after UAT-3): keyboard uses the standard Obsidian
//      pattern — the container is focusable (tabIndex), pointerdown focuses
//      it (preventScroll; never steal focus from an editor input), and
//      keydown/keyup bind on the CONTAINER with a typing guard only. (An
//      earlier document-level listener with an activeLeaf/hover fallback
//      chain was over-engineered; real UAT confirmed container focus works.)
//   6. Click suppression after drags is timestamp-based (_dragEndedAt), not
//      a one-shot flag, so capture/click-targeting variants can't leak or
//      clear a fresh marquee selection.
//
// Input mapping (UAT decision): wheel = zoom; left-drag empty = marquee;
// middle-drag / Space+left-drag = pan; see view/gestures.js.
//
// Every committed mutation goes through model/ops.js (pure, in place, NG-01
// round-trip safe) and ends with the debounced requestSave() pattern.

const { TextFileView, Notice } = require('obsidian');
const { parseSavedState, serializeSavedState } = require('../model/io');
const ops = require('../model/ops');
const clipboardModel = require('../model/clipboard');
const historyModel = require('../model/history');
const { renderCanvas, layoutEdge, applyEdgeLayout, measureNode } = require('./renderer');
const { buildNodeEditor, buildLinkEditor } = require('./editor');
const { VariablesPanel } = require('./variables-panel');
const varsModel = require('../model/variables');
const { loadSpeakers } = require('../speakers');
const { Viewport } = require('./viewport');
const { decidePointerDown, mergeMarqueeSelection, pointerDownSelection } = require('./gestures');
const {
    fitView,
    isValidStoredView,
    worldToScreen,
    screenToWorld,
    edgePath,
    normalizeRect,
    nodesInRect,
    resolveNodeSize,
    nearestSide,
    oppositeSide,
    applyResize,
    resizeZoneAt,
    resizeCursor
} = require('./geometry');

const VIEW_TYPE_NARRATIVE_GRAPH = 'narrative-graph-view';

// Debounce before a settled mutation/camera change is flushed to disk (ms).
const SAVE_DEBOUNCE = 2000;

class NarrativeGraphView extends TextFileView {
    constructor(leaf) {
        super(leaf);
        this.data = '';
        this._state = null;
        this._errors = [];
        this._parseFailure = null;
        this._viewport = null;
        this._saveTimer = null;

        // Render handles from the last renderCanvas() call
        this._frameEl = null;
        this._worldEl = null;
        this._svgEl = null;
        this._nodeEls = new Map();
        this._edgeEls = new Map();
        this._sizes = new Map();

        // Selection state (marquee multi-select; ui.selectedNodeId holds the
        // primary = first selected id for NC format compat)
        this._selectedNodeIds = new Set();
        this._selectedLinkId = null;

        // Transient interaction state
        this._editorEl = null;
        this._nodeDrag = null;
        this._linkDrag = null;
        this._marquee = null;
        this._resize = null;
        this._spaceHeld = false;
        this._dragEndedAt = 0;       // timestamp-based trailing-click suppression
        this._cursorEl = null;       // UAT-7: node el currently carrying a resize hover cursor

        // M2a variables panel state (NG-06)
        this._varsPanel = null;      // VariablesPanel instance (lazily created)
        this._varsVisible = false;
        this._varsSaveTimer = null;  // write-through debounce
        this._varsLastWrite = null;  // self-write loop guard (content compare)
        this._varsModifyRef = null;  // vault 'modify' event ref

        // M2b caches (NG-07): variables entries for the condition builder,
        // shared characters for speaker autocomplete. null = not fetched yet;
        // [] = fetched but unavailable/empty. Read-only (never creates files).
        this._varsEntries = null;
        this._speakers = null;

        // M3 (NG-08): snapshot undo/redo. _historyBaseline = 上一次已提交
        // 状态的快照；每次提交变更时先把它压入 undo 栈再刷新。
        this._history = null;
        this._historyBaseline = null;

        this._onClick = this._handleClick.bind(this);
        this._onDblClick = this._handleDblClick.bind(this);
        this._onPointerDown = this._handlePointerDown.bind(this);
        this._onPointerMove = this._handlePointerMove.bind(this);
        this._onPointerUp = this._handlePointerUp.bind(this);
        this._onKeyDown = this._handleKeyDown.bind(this);
        this._onKeyUp = this._handleKeyUp.bind(this);
        this._onHoverMove = this._handleHoverMove.bind(this);
    }

    getViewType() {
        return VIEW_TYPE_NARRATIVE_GRAPH;
    }

    getDisplayText() {
        return this.file ? this.file.basename : 'Narrative Graph';
    }

    // TextFileView dirty/save path: serialize the live model. Falls back to
    // the raw text when the file could not be parsed (never destroy data the
    // user did not edit).
    getViewData() {
        if (this._state) return serializeSavedState(this._state);
        return this.data;
    }

    setViewData(data, clear) {
        this.data = data;
        this._parseFailure = null;
        try {
            const { state, errors } = parseSavedState(data);
            this._state = state;
            this._errors = errors;
        } catch (err) {
            this._state = null;
            this._errors = [];
            this._parseFailure = err;
        }
        this._selectedNodeIds.clear();
        this._selectedLinkId = null;
        this._render();
        // M3: 新文件内容 = 新历史（快照基线 = 刚解析的状态）
        this._history = this._state ? historyModel.createHistory() : null;
        this._historyBaseline = this._state ? historyModel.takeSnapshot(this._state) : null;
        // M2b (NG-07): prefetch condition-builder/speaker caches (fire-and-
        // forget; editors read them synchronously via _getVarEntries etc.)
        if (this._state) {
            this._ensureVarsEntries();
            this._ensureSpeakers();
        }
    }

    clear() {
        this.data = '';
        this._state = null;
        this._errors = [];
        this._parseFailure = null;
        this._selectedNodeIds.clear();
        this._selectedLinkId = null;
        this._history = null;
        this._historyBaseline = null;
        this._render();
    }

    async onOpen() {
        this.contentEl.tabIndex = -1; // focusable container (see note #5)
        this.contentEl.addEventListener('click', this._onClick);
        this.contentEl.addEventListener('dblclick', this._onDblClick);
        this.contentEl.addEventListener('pointerdown', this._onPointerDown);
        // UAT-7: hover cursor feedback for the border resize zone (no drag
        // active — a separate listener from the document-level drag tracking).
        this.contentEl.addEventListener('pointermove', this._onHoverMove);
        // Keyboard binds on the CONTAINER (UAT-2 note #5): pointerdown
        // focuses it; a typing guard keeps editors/inputs unaffected.
        this.contentEl.addEventListener('keydown', this._onKeyDown);
        this.contentEl.addEventListener('keyup', this._onKeyUp);
        // M2a: watch the global variables file for external edits (NG-06).
        if (this.app && this.app.vault && typeof this.app.vault.on === 'function') {
            this._varsModifyRef = this.app.vault.on('modify', (file) => this._onVaultModify(file));
        }
    }

    async onClose() {
        this.contentEl.removeEventListener('click', this._onClick);
        this.contentEl.removeEventListener('dblclick', this._onDblClick);
        this.contentEl.removeEventListener('pointerdown', this._onPointerDown);
        this.contentEl.removeEventListener('pointermove', this._onHoverMove);
        this.contentEl.removeEventListener('keydown', this._onKeyDown);
        this.contentEl.removeEventListener('keyup', this._onKeyUp);
        this._cancelDrags();
        if (this._varsModifyRef && this.app && this.app.vault
            && typeof this.app.vault.offref === 'function') {
            this.app.vault.offref(this._varsModifyRef);
            this._varsModifyRef = null;
        }
        if (this._varsSaveTimer !== null) {
            clearTimeout(this._varsSaveTimer);
            this._varsSaveTimer = null;
        }
        if (this._saveTimer !== null) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        if (this._viewport) {
            this._viewport.detach();
            this._viewport = null;
        }
    }

    // -----------------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------------

    _render() {
        if (this._viewport) {
            this._viewport.detach();
            this._viewport = null;
        }
        this._editorEl = null;
        this._cursorEl = null; // node els are rebuilt; any hover cursor dies with them
        this.contentEl.empty();
        this.contentEl.addClass('narrative-graph-view');

        if (this._parseFailure) {
            this.contentEl.createEl('p', {
                cls: 'narrative-graph-error',
                text: String(this._parseFailure.message || this._parseFailure)
            });
            return;
        }
        if (!this._state) return;

        const handles = renderCanvas(this.contentEl, this._state, this._errors);
        this._frameEl = handles.frameEl;
        this._worldEl = handles.worldEl;
        this._svgEl = handles.svgEl;
        this._nodeEls = handles.nodeEls;
        this._edgeEls = handles.edgeEls;
        this._sizes = handles.sizes;

        this._viewport = new Viewport(
            this._frameEl,
            this._worldEl,
            (view, kind) => this._persistView(view, kind),
            (evt) => this._shouldPan(evt)
        );
        this._viewport.attach();

        // Camera: restore stored ui.view when usable, else fit to content.
        const stored = this._state.ui && this._state.ui.view;
        if (isValidStoredView(stored)) {
            this._viewport.setView(stored);
        } else if (handles.bounds) {
            const view = fitView(handles.bounds, this.contentEl.clientWidth, this.contentEl.clientHeight);
            this._viewport.setView(view);
        }

        this._buildToolbar();
        // The variables panel element persists across re-renders (its DOM is
        // torn down with the frame); re-attach it if it exists.
        if (this._varsPanel && this._varsPanel.el) {
            this._frameEl.appendChild(this._varsPanel.el);
        }
        this._restoreSelection();
        // Second layout pass: the first render can run before the view is
        // visible (offsetHeight = 0 -> estimated heights -> misaligned
        // edges). Re-measure + re-layout edges once styles/fonts settle.
        this._scheduleRelayout();
    }

    // Full re-render after a committed mutation, preserving the camera
    // (≤ few hundred nodes — simplicity beats incremental DOM surgery).
    _rerenderPreservingCamera() {
        const camera = this._viewport ? this._viewport.getView() : null;
        this._render();
        if (camera && this._viewport) this._viewport.setView(camera);
    }

    // Every committed mutation funnels here: re-render + debounced save.
    _afterMutation() {
        this._recordHistory();
        this._rerenderPreservingCamera();
        this._scheduleSave();
    }

    // M3 (NG-08): 把上一次已提交状态的快照压入 undo 栈（push 会清空
    // redo 栈），然后基线刷新为当前状态。选择/导航/变量面板编辑不经过
    // 这里，所以不产生 undo 条目。
    _recordHistory() {
        if (!this._history || !this._historyBaseline || !this._state) return;
        historyModel.push(this._history, this._historyBaseline);
        this._historyBaseline = historyModel.takeSnapshot(this._state);
    }

    // Re-measure node heights and re-layout edges if anything changed.
    _scheduleRelayout() {
        const raf = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (fn) => setTimeout(fn, 0);
        raf(() => this._relayoutEdges());
    }

    _relayoutEdges() {
        if (!this._state || !this._svgEl || !this._svgEl.isConnected) return;
        const nodes = (this._state.project && this._state.project.nodes) || [];
        let changed = false;
        for (const node of nodes) {
            const nodeEl = this._nodeEls.get(node.id);
            if (!nodeEl) continue;
            const prev = this._sizes.get(node.id);
            const next = measureNode(node, nodeEl);
            // Only trust real measurements; jsdom/hidden views report 0.
            if (nodeEl.offsetHeight > 0 && prev
                && (prev.height !== next.height
                    || JSON.stringify(prev.optionT || null) !== JSON.stringify(next.optionT || null))) {
                this._sizes.set(node.id, next);
                changed = true;
            }
        }
        if (!changed) return;
        const nodeById = new Map(nodes.map(n => [n.id, n]));
        for (const link of this._state.project.links || []) {
            const group = this._edgeEls.get(link.id);
            const layout = layoutEdge(link, nodeById, this._sizes);
            if (group && layout) applyEdgeLayout(group, layout);
        }
    }

    // -----------------------------------------------------------------------
    // Toolbar (node creation)
    // -----------------------------------------------------------------------

    _buildToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'ng-toolbar';
        // UAT-6 #3: 中文标签 + 创建按钮成组（accent 着色），与工具按钮分隔
        const LABELS = { Entry: '+起点', Content: '+内容', Dialog: '+对话', Choice: '+选择', End: '+结局' };
        const types = ['Content', 'Dialog', 'Choice', 'End'];
        if (ops.entryNodes(this._state).length === 0) types.unshift('Entry');
        for (const type of types) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ng-toolbar__btn ng-toolbar__btn--add';
            btn.dataset.addType = type;
            btn.textContent = LABELS[type] || `+${type}`;
            btn.addEventListener('click', () => this._createNode(type));
            toolbar.appendChild(btn);
        }
        // M2a (NG-06): global variables panel toggle
        const divider = document.createElement('span');
        divider.className = 'ng-toolbar__divider';
        toolbar.appendChild(divider);
        const varsBtn = document.createElement('button');
        varsBtn.type = 'button';
        varsBtn.className = 'ng-toolbar__btn ng-toolbar__btn--vars';
        varsBtn.textContent = '变量表';
        varsBtn.addEventListener('click', () => this._toggleVarsPanel());
        toolbar.appendChild(varsBtn);
        this._frameEl.appendChild(toolbar);
    }

    _createNode(type) {
        // New node appears at the current viewport center (UAT-6 #6: center
        // offset uses the per-type default width, e.g. Dialog 200px).
        const rect = this._frameEl.getBoundingClientRect();
        const center = screenToWorld(
            { x: rect.width / 2, y: rect.height / 2 },
            this._viewport.getView()
        );
        try {
            const node = ops.addNode(this._state, type,
                center.x - ops.defaultWidthFor(type) / 2, center.y - 40);
            this._afterMutation();
            this._setSelection([node.id], null);
        } catch (err) {
            console.warn('[Narrative Graph] addNode rejected:', err.message);
        }
    }

    // -----------------------------------------------------------------------
    // Variables panel (M2a, NG-06) — global Variables.md editable grid.
    // Parse/serialize/validate live in model/variables.js (pure); this layer
    // only does vault IO, debounce, and self-write loop guarding.
    // -----------------------------------------------------------------------

    _varsPath() {
        const s = this.plugin && this.plugin.settings;
        return (s && s.variablesPath && s.variablesPath.trim())
            || varsModel.DEFAULT_VARIABLES_PATH;
    }

    _toggleVarsPanel() {
        if (!this._varsPanel) {
            this._varsPanel = new VariablesPanel({
                onCommit: (entries) => this._commitVarsEntries(entries),
                onClose: () => this._toggleVarsPanel()
            });
            if (this._frameEl) this._frameEl.appendChild(this._varsPanel.el);
        }
        this._varsVisible = !this._varsVisible;
        this._varsPanel.el.classList.toggle('ng-vars-panel--hidden', !this._varsVisible);
        if (this._varsVisible) this._refreshVarsPanel();
    }

    // Read the variables file (creating it from the template when missing)
    // and refresh the grid.
    async _refreshVarsPanel() {
        const vault = this.app && this.app.vault;
        if (!vault || typeof vault.getAbstractFileByPath !== 'function') return;
        try {
            const path = this._varsPath();
            let file = vault.getAbstractFileByPath(path);
            let content;
            if (file) {
                content = await vault.read(file);
            } else {
                content = varsModel.EMPTY_VARIABLES_FILE;
                await vault.create(path, content);
            }
            const { entries, warnings } = varsModel.parseVariablesTable(content);
            this._varsEntries = entries; // M2b: builder cache shares this read
            if (this._varsPanel) this._varsPanel.setEntries(entries, warnings);
        } catch (err) {
            console.warn('[Narrative Graph] 读取变量表失败:', err.message);
        }
    }

    // Panel edit → validate (warnings shown immediately) → debounced write.
    _commitVarsEntries(entries) {
        if (this._varsPanel) {
            this._varsPanel.setWarnings(varsModel.validateEntries(entries));
        }
        if (this._varsSaveTimer !== null) clearTimeout(this._varsSaveTimer);
        this._varsSaveTimer = setTimeout(() => {
            this._varsSaveTimer = null;
            this._writeVariables(entries);
        }, 800);
    }

    async _writeVariables(entries) {
        const vault = this.app && this.app.vault;
        if (!vault || typeof vault.getAbstractFileByPath !== 'function') return;
        try {
            const path = this._varsPath();
            const file = vault.getAbstractFileByPath(path);
            // Read fresh content so surrounding markdown is preserved as-is.
            const current = file ? await vault.read(file) : varsModel.EMPTY_VARIABLES_FILE;
            const next = varsModel.serializeVariablesTable(current, entries);
            this._varsLastWrite = next; // self-write guard for the modify watcher
            this._varsEntries = entries; // M2b: keep the builder cache fresh
            if (file) await vault.modify(file, next);
            else await vault.create(path, next);
        } catch (err) {
            console.warn('[Narrative Graph] 写入变量表失败:', err.message);
        }
    }

    // External edit watcher: refresh the grid when Variables.md changes on
    // disk; skip our own writes (content-identical).
    async _onVariablesFileModified(file) {
        if (!file || file.path !== this._varsPath()) return;
        const vault = this.app && this.app.vault;
        if (!vault || typeof vault.read !== 'function') return;
        try {
            const content = await vault.read(file);
            if (content === this._varsLastWrite) return; // our own write
            const { entries, warnings } = varsModel.parseVariablesTable(content);
            this._varsEntries = entries; // M2b: keep the builder cache fresh
            if (this._varsPanel && this._varsVisible) {
                this._varsPanel.setEntries(entries, warnings);
            }
        } catch (err) {
            console.warn('[Narrative Graph] 刷新变量表失败:', err.message);
        }
    }

    // -----------------------------------------------------------------------
    // M2b caches (NG-07) — variables entries + shared characters for the
    // condition builder and speaker autocomplete. Read-only: unlike the
    // variables PANEL, the builder cache never creates Variables.md.
    // -----------------------------------------------------------------------

    async _ensureVarsEntries() {
        if (this._varsEntries !== null) return;
        const vault = this.app && this.app.vault;
        if (!vault || typeof vault.getAbstractFileByPath !== 'function'
            || typeof vault.read !== 'function') {
            this._varsEntries = [];
            return;
        }
        try {
            const file = vault.getAbstractFileByPath(this._varsPath());
            if (!file) {
                this._varsEntries = [];
                return;
            }
            const { entries } = varsModel.parseVariablesTable(await vault.read(file));
            this._varsEntries = entries;
        } catch (err) {
            console.warn('[Narrative Graph] 读取变量缓存失败:', err.message);
            this._varsEntries = [];
        }
    }

    async _ensureSpeakers() {
        if (this._speakers !== null) return;
        this._speakers = loadSpeakers(this.app);
    }

    // Synchronous accessors for the editor builders ([] until prefetched).
    _getVarEntries() {
        return this._varsEntries || [];
    }

    _getSpeakers() {
        return this._speakers || [];
    }

    // Vault 'modify' dispatch: Variables.md -> grid + builder cache;
    // Characters/*.md -> speaker cache (only once it has been fetched).
    _onVaultModify(file) {
        if (file && file.path === this._varsPath()) {
            this._onVariablesFileModified(file);
        } else if (file && this._speakers !== null && file.extension === 'md'
            && typeof file.path === 'string' && file.path.startsWith('Characters/')) {
            this._speakers = null;
            this._ensureSpeakers();
        }
    }

    // -----------------------------------------------------------------------
    // Selection (marquee multi-select + ui.selectedNodeId/selectedLinkId)
    // -----------------------------------------------------------------------

    _setSelection(nodeIds, linkId) {
        this._selectedNodeIds = new Set(nodeIds || []);
        this._selectedLinkId = linkId || null;
        this._applySelectionClasses();
        this._setUiSelection();
    }

    _applySelectionClasses() {
        this._clearResizeCursor(); // hover cursor is recomputed on the next pointermove
        for (const el of this.contentEl.querySelectorAll('.is-selected')) {
            el.classList.remove('is-selected');
        }
        for (const id of this._selectedNodeIds) {
            const nodeEl = this._nodeEls.get(id);
            if (nodeEl) nodeEl.classList.add('is-selected');
        }
        if (this._selectedLinkId) {
            const edgeEl = this._edgeEls.get(this._selectedLinkId);
            if (edgeEl) edgeEl.classList.add('is-selected');
        }
    }

    // Keep ui.selectedNodeId/selectedLinkId current (NC format compat).
    _setUiSelection() {
        if (!this._state) return;
        if (!this._state.ui || typeof this._state.ui !== 'object') this._state.ui = {};
        this._state.ui.selectedNodeId = this._selectedNodeIds.size > 0
            ? this._selectedNodeIds.values().next().value
            : null;
        this._state.ui.selectedLinkId = this._selectedLinkId;
        this._scheduleSave();
    }

    _restoreSelection() {
        // Seed from ui on fresh loads; session selection wins otherwise.
        if (this._selectedNodeIds.size === 0 && !this._selectedLinkId) {
            const ui = this._state && this._state.ui;
            if (ui && ui.selectedNodeId && this._nodeEls.has(ui.selectedNodeId)) {
                this._selectedNodeIds = new Set([ui.selectedNodeId]);
            } else if (ui && ui.selectedLinkId && this._edgeEls.has(ui.selectedLinkId)) {
                this._selectedLinkId = ui.selectedLinkId;
            }
        }
        this._applySelectionClasses();
    }

    // -----------------------------------------------------------------------
    // Pointer handling — all gestures classified through gestures.js
    // -----------------------------------------------------------------------

    // Map an event target to a gestures.js targetKind via DOM hit-testing.
    _classifyTarget(target) {
        if (!target || typeof target.closest !== 'function') return 'empty';
        if (this._editorEl && this._editorEl.contains(target)) return 'ui';
        if (target.closest('.ng-toolbar')) return 'ui';
        if (target.closest('.ng-vars-panel')) return 'ui';
        if (target.closest('.ng-port--out')) return 'out-port';
        // UAT-6 #1: four-side handles start link drags EXCEPT on nodes with
        // no free output (End: no output at all; Choice: outputs are the
        // per-option row dots only) — theirs are drop targets only.
        const sideHandle = target.closest('.ng-port--side');
        if (sideHandle) {
            const node = ops.findNode(this._state, sideHandle.dataset.nodeId);
            if (node && node.type !== 'End' && node.type !== 'Choice') return 'port-handle';
            return 'in-port';
        }
        const nodeEl = target.closest('[data-node-id]');
        if (nodeEl && this._nodeEls.get(nodeEl.dataset.nodeId) === nodeEl) return 'node';
        if (target.closest('.ng-edge')) return 'edge';
        return 'empty';
    }

    _shouldPan(evt) {
        const kind = this._classifyTarget(evt.target);
        return decidePointerDown({
            button: evt.button,
            spaceHeld: this._spaceHeld,
            targetKind: kind
        }).type === 'pan';
    }

    // UAT-7: hit-test the node's side port dots by coordinates (their 16px
    // boxes exist in the DOM — with a real rect — even while invisible), so
    // a link drag still wins over the border resize zone at edge midpoints.
    // Returns the matching dot element or null. Output option dots keep
    // their own target kind (out-port) and never reach this path. UAT-8 #3:
    // Choice nodes have no right-side handle in the DOM, so no invisible
    // right-side hitbox exists here either.
    _portHandleAt(nodeEl, clientX, clientY) {
        for (const dot of nodeEl.querySelectorAll('.ng-port--side')) {
            const r = dot.getBoundingClientRect();
            const dx = clientX - (r.left + r.width / 2);
            const dy = clientY - (r.top + r.height / 2);
            if (Math.max(Math.abs(dx), Math.abs(dy)) <= 10) return dot;
        }
        return null;
    }

    // UAT-7/UAT-8 #1 hover feedback: while no drag is running, pointermove
    // over ANY node (selected or not) shows the resize cursor for the
    // border zone under the pointer. Visible port dots override it via
    // their own CSS cursor (child element wins), no special-casing needed.
    _handleHoverMove(evt) {
        if (this._nodeDrag || this._linkDrag || this._marquee || this._resize
            || !this._state || typeof evt.target.closest !== 'function') {
            this._clearResizeCursor();
            return;
        }
        const nodeEl = evt.target.closest('[data-node-id]');
        const live = nodeEl && this._nodeEls.get(nodeEl.dataset.nodeId) === nodeEl
            ? nodeEl : null;
        if (!live) {
            this._clearResizeCursor();
            return;
        }
        if (this._cursorEl && this._cursorEl !== live) this._clearResizeCursor();
        live.style.cursor = resizeCursor(
            resizeZoneAt(live.getBoundingClientRect(), evt.clientX, evt.clientY));
        this._cursorEl = live;
    }

    _clearResizeCursor() {
        if (this._cursorEl) this._cursorEl.style.cursor = '';
        this._cursorEl = null;
    }

    _handlePointerDown(evt) {
        const target = evt.target;
        if (typeof target.closest !== 'function') return;

        // Clicking canvas focuses the container so Delete/Space reach
        // keydown (note #5). Never steal focus from an open editor's input
        // or from the variables panel.
        const editorHasFocus = this._editorEl
            && this._editorEl.contains(document.activeElement);
        if (!editorHasFocus && !target.closest('input, textarea, select, button, .ng-vars-panel')) {
            this.contentEl.focus({ preventScroll: true });
        }

        const kind = this._classifyTarget(target);

        // UAT-7/UAT-8 #1: on ANY node (selected or not — native .canvas),
        // coordinate hit-testing decides between link drag (port dot's 16px
        // box, even when invisible) / border resize zone / plain body drag,
        // in that priority. _startResize selects an unselected node.
        let portHit = false;
        let resizeZone = null;
        let resizeNodeId = null;
        let portHandleEl = null;
        if (kind === 'node' && evt.button === 0) {
            const nodeEl = target.closest('[data-node-id]');
            if (nodeEl && this._nodeEls.get(nodeEl.dataset.nodeId) === nodeEl) {
                resizeNodeId = nodeEl.dataset.nodeId;
                portHandleEl = this._portHandleAt(nodeEl, evt.clientX, evt.clientY);
                portHit = !!portHandleEl;
                if (!portHit) {
                    resizeZone = resizeZoneAt(
                        nodeEl.getBoundingClientRect(), evt.clientX, evt.clientY);
                }
            }
        }

        const gesture = decidePointerDown({
            button: evt.button,
            spaceHeld: this._spaceHeld,
            targetKind: kind,
            portHit,
            resizeZone
        });

        // NOTE: no preventDefault here — see UAT root-cause note #1 in the
        // file header. Text selection during drags is suppressed by CSS
        // (user-select: none on frame/nodes).
        switch (gesture.type) {
            case 'node-drag': {
                const nodeEl = target.closest('[data-node-id]');
                this._startNodeDrag(evt, nodeEl.dataset.nodeId);
                break;
            }
            case 'link-drag': {
                this._startLinkDrag(evt, portHandleEl || target.closest('.ng-port'));
                break;
            }
            case 'resize-drag': {
                this._startResize(evt, resizeNodeId, resizeZone);
                break;
            }
            case 'marquee':
                this._startMarquee(evt);
                break;
            case 'pan':
            case 'none':
            default:
                break; // viewport.js runs the pan; UI elements handle themselves
        }
    }

    _handlePointerMove(evt) {
        if (this._nodeDrag) this._moveNodeDrag(evt);
        else if (this._linkDrag) this._moveLinkDrag(evt);
        else if (this._marquee) this._moveMarquee(evt);
        else if (this._resize) this._moveResize(evt);
    }

    _handlePointerUp(evt) {
        if (this._nodeDrag) this._endNodeDrag(evt);
        else if (this._linkDrag) this._endLinkDrag(evt);
        else if (this._marquee) this._endMarquee(evt);
        else if (this._resize) this._endResize(evt);
    }

    _cancelDrags() {
        this._untrackDrag();
        this._nodeDrag = null;
        if (this._linkDrag) {
            this._linkDrag.ghost.remove();
            this._linkDrag = null;
            if (this._frameEl) this._frameEl.classList.remove('ng-canvas--link-drag');
        }
        if (this._marquee) {
            this._marquee.rectEl.remove();
            this._marquee = null;
        }
        if (this._resize) {
            // Escape mid-resize: restore the pre-drag model fields (the live
            // move mutates them) and re-render to undo the DOM/size changes.
            const drag = this._resize;
            this._resize = null;
            const node = ops.findNode(this._state, drag.nodeId);
            if (node && drag.moved) {
                const orig = drag.origFields;
                node.x = orig.x;
                node.y = orig.y;
                if (orig.width === undefined) delete node.width; else node.width = orig.width;
                if (orig.height === undefined) delete node.height; else node.height = orig.height;
                if (orig.manualSize === undefined) delete node.manualSize;
                else node.manualSize = orig.manualSize;
                this._rerenderPreservingCamera();
            }
        }
    }

    // --- node drag (moves the whole selection set) ---------------------------

    _startNodeDrag(evt, nodeId) {
        // UAT-5: Shift+pointerdown starts NO drag and must not clobber the
        // selection — Shift is reserved for selection toggling; the trailing
        // click toggles membership (see _handleClick).
        if (evt.shiftKey) return;
        // Dragging an unselected node selects it (replacing the set);
        // dragging a selected node moves the whole selection.
        const nextIds = pointerDownSelection(this._selectedNodeIds, nodeId, false);
        if (nextIds.length !== this._selectedNodeIds.size
            || nextIds.some(id => !this._selectedNodeIds.has(id))) {
            this._setSelection(nextIds, null);
        }
        const dragIds = [...this._selectedNodeIds].filter(id => ops.findNode(this._state, id));
        const starts = new Map();
        for (const id of dragIds) {
            const node = ops.findNode(this._state, id);
            starts.set(id, { x: node.x, y: node.y });
        }
        // Links touched by any dragged node, computed once.
        const linkIds = (this._state.project.links || [])
            .filter(l => l && (this._selectedNodeIds.has(l.from) || this._selectedNodeIds.has(l.to)))
            .map(l => l.id);

        this._nodeDrag = {
            pointerId: evt.pointerId,
            dragIds,
            starts,
            linkIds,
            startClientX: evt.clientX,
            startClientY: evt.clientY,
            scale: this._viewport.getView().scale,
            moved: false
        };
        this._trackDrag();
    }

    _moveNodeDrag(evt) {
        const drag = this._nodeDrag;
        if (evt.pointerId !== drag.pointerId) return;
        const dx = (evt.clientX - drag.startClientX) / drag.scale;
        const dy = (evt.clientY - drag.startClientY) / drag.scale;
        if (Math.abs(dx) + Math.abs(dy) > 1) drag.moved = true;

        // Mutate the model live for every dragged node; persist on pointer-up.
        for (const id of drag.dragIds) {
            const node = ops.findNode(this._state, id);
            const start = drag.starts.get(id);
            node.x = Math.round(start.x + dx);
            node.y = Math.round(start.y + dy);
            const nodeEl = this._nodeEls.get(id);
            if (nodeEl) {
                nodeEl.style.left = `${node.x}px`;
                nodeEl.style.top = `${node.y}px`;
            }
        }

        // Live-update connected edges (no full re-render during drags).
        const nodeById = new Map(this._state.project.nodes.map(n => [n.id, n]));
        for (const linkId of drag.linkIds) {
            const link = ops.findLink(this._state, linkId);
            const group = this._edgeEls.get(linkId);
            const layout = link && layoutEdge(link, nodeById, this._sizes);
            if (group && layout) applyEdgeLayout(group, layout);
        }
    }

    _endNodeDrag(evt) {
        const drag = this._nodeDrag;
        this._nodeDrag = null;
        this._untrackDrag();
        if (drag && drag.moved) {
            // The trailing click must not collapse the selection (timestamp-
            // based; see header note #6).
            this._dragEndedAt = Date.now();
            // M3 polish: snap the final position to an 8px grid.
            for (const id of drag.dragIds) {
                const node = ops.findNode(this._state, id);
                if (!node) continue;
                node.x = Math.round(node.x / 8) * 8;
                node.y = Math.round(node.y / 8) * 8;
                const nodeEl = this._nodeEls.get(id);
                if (nodeEl) {
                    nodeEl.style.left = `${node.x}px`;
                    nodeEl.style.top = `${node.y}px`;
                }
            }
            this._recordHistory();
            this._scheduleSave();
        }
    }

    // --- marquee (box multi-select, left-drag on empty canvas) ---------------

    _startMarquee(evt) {
        const rectEl = document.createElement('div');
        rectEl.className = 'ng-marquee';
        this._frameEl.appendChild(rectEl);
        this._marquee = {
            pointerId: evt.pointerId,
            startX: evt.clientX,
            startY: evt.clientY,
            additive: !!evt.shiftKey,
            rectEl,
            moved: false
        };
        this._trackDrag();
    }

    _moveMarquee(evt) {
        const drag = this._marquee;
        if (evt.pointerId !== drag.pointerId) return;
        const frameRect = this._frameEl.getBoundingClientRect();
        const a = { x: drag.startX - frameRect.left, y: drag.startY - frameRect.top };
        const b = { x: evt.clientX - frameRect.left, y: evt.clientY - frameRect.top };
        if (Math.abs(b.x - a.x) + Math.abs(b.y - a.y) > 3) drag.moved = true;
        const rect = normalizeRect(a, b);
        drag.rectEl.style.left = `${rect.x0}px`;
        drag.rectEl.style.top = `${rect.y0}px`;
        drag.rectEl.style.width = `${rect.x1 - rect.x0}px`;
        drag.rectEl.style.height = `${rect.y1 - rect.y0}px`;
    }

    _endMarquee(evt) {
        const drag = this._marquee;
        this._marquee = null;
        this._untrackDrag();
        if (!drag) return;
        drag.rectEl.remove();
        if (!drag.moved) return; // plain click — the click handler clears selection

        this._dragEndedAt = Date.now();
        // Shift read at pointer-down AND at release: users often press Shift
        // mid-drag (UAT-2 #3).
        const additive = drag.additive || !!evt.shiftKey;
        const frameRect = this._frameEl.getBoundingClientRect();
        const camera = this._viewport.getView();
        const a = screenToWorld(
            { x: drag.startX - frameRect.left, y: drag.startY - frameRect.top }, camera);
        const b = screenToWorld(
            { x: evt.clientX - frameRect.left, y: evt.clientY - frameRect.top }, camera);
        const hit = nodesInRect(this._state.project.nodes || [], normalizeRect(a, b), this._sizes);
        const next = mergeMarqueeSelection(this._selectedNodeIds, hit, additive);
        this._setSelection(next, null);
    }

    // --- link drag (ghost bezier from a side handle / option dot) -----------

    _startLinkDrag(evt, portDot) {
        const fromId = portDot.dataset.nodeId;
        const optionId = portDot.dataset.optionId || null;
        // UAT-6 #1: the grabbed side handle's side is the drag's output side
        // (option dots carry no side — Choice anchors stay row-based).
        const fromSide = portDot.dataset.side || null;
        // Anchor at the port dot's actual screen center -> world coords.
        const dotRect = portDot.getBoundingClientRect();
        const frameRect = this._frameEl.getBoundingClientRect();
        const camera = this._viewport.getView();
        const start = screenToWorld({
            x: dotRect.left + dotRect.width / 2 - frameRect.left,
            y: dotRect.top + dotRect.height / 2 - frameRect.top
        }, camera);

        const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        ghost.setAttribute('class', 'ng-edge__ghost');
        this._svgEl.appendChild(ghost);

        // Show every node's side handles as drop targets while dragging.
        this._frameEl.classList.add('ng-canvas--link-drag');

        this._linkDrag = { pointerId: evt.pointerId, fromId, optionId, fromSide, start, ghost };
        this._trackDrag();
    }

    _moveLinkDrag(evt) {
        const drag = this._linkDrag;
        if (evt.pointerId !== drag.pointerId) return;
        const frameRect = this._frameEl.getBoundingClientRect();
        const pointer = screenToWorld({
            x: evt.clientX - frameRect.left,
            y: evt.clientY - frameRect.top
        }, this._viewport.getView());
        const fromSide = drag.fromSide || 'right';
        const { d } = edgePath(
            { x: drag.start.x, y: drag.start.y, side: fromSide },
            { x: pointer.x, y: pointer.y, side: oppositeSide(fromSide) }
        );
        drag.ghost.setAttribute('d', d);
    }

    // Drop hit-test; extracted so jsdom tests can stub it (elementFromPoint
    // is not implemented everywhere). Returns { nodeId, side } — the dropped
    // handle's side, or the side of the node BODY nearest the drop point
    // (native .canvas forgiving drop). Entry nodes are not valid targets.
    _hitTestLinkTarget(clientX, clientY) {
        const under = typeof document.elementFromPoint === 'function'
            ? document.elementFromPoint(clientX, clientY)
            : null;
        if (!under || typeof under.closest !== 'function') return null;
        const handle = under.closest('.ng-port--side');
        if (handle && this._nodeEls.has(handle.dataset.nodeId)) {
            const node = ops.findNode(this._state, handle.dataset.nodeId);
            if (node && node.type !== 'Entry') {
                return { nodeId: handle.dataset.nodeId, side: handle.dataset.side };
            }
            return null;
        }
        const nodeEl = under.closest('[data-node-id]');
        if (nodeEl && this._nodeEls.get(nodeEl.dataset.nodeId) === nodeEl) {
            const node = ops.findNode(this._state, nodeEl.dataset.nodeId);
            if (!node || node.type === 'Entry') return null;
            const frameRect = this._frameEl.getBoundingClientRect();
            const world = screenToWorld({
                x: clientX - frameRect.left,
                y: clientY - frameRect.top
            }, this._viewport.getView());
            const measured = this._sizes.get(node.id);
            const size = resolveNodeSize(node, measured && measured.height);
            return { nodeId: node.id, side: nearestSide(node, size, world) };
        }
        return null;
    }

    _endLinkDrag(evt) {
        const drag = this._linkDrag;
        this._linkDrag = null;
        this._untrackDrag();
        if (this._frameEl) this._frameEl.classList.remove('ng-canvas--link-drag');
        if (!drag) return;
        drag.ghost.remove();

        const target = this._hitTestLinkTarget(evt.clientX, evt.clientY);
        if (!target) return;

        try {
            // UAT-6 #1: persist the dragged handle sides into node.ports
            // (output on source / input on target, t=0.5) so edges render
            // WYSIWYG and stay NC-compatible. Option-dot drags (Choice)
            // carry no fromSide — row anchors stay.
            ops.addLink(this._state, drag.fromId, target.nodeId, drag.optionId,
                { fromSide: drag.fromSide, toSide: target.side });
            this._afterMutation();
        } catch (err) {
            // Self-link / duplicate / port-rule violation: reject quietly.
            console.warn('[Narrative Graph] addLink rejected:', err.message);
        }
    }

    // --- resize drag (UAT-6 #5, revised UAT-7, extended UAT-8 #1: the whole
    // border band of ANY node is the hit zone; dir comes from
    // geometry.resizeZoneAt) ---

    _startResize(evt, nodeId, dir) {
        if (!nodeId || !dir) return;
        const nodeEl = this._nodeEls.get(nodeId);
        if (!nodeEl) return;
        const node = ops.findNode(this._state, nodeId);
        if (!node) return;
        // UAT-8 #1: resize works on unselected nodes (native .canvas) —
        // starting the resize single-selects the node.
        if (!this._selectedNodeIds.has(nodeId)) this._setSelection([nodeId], null);
        const measured = this._sizes.get(nodeId);
        const size = resolveNodeSize(node, measured && measured.height);
        this._resize = {
            pointerId: evt.pointerId,
            nodeId,
            dir,
            // Drag math runs on the CURRENT rendered rect (auto-height nodes
            // use their measured height as the drag start).
            startRect: { x: node.x, y: node.y, width: size.width, height: size.height },
            // Pre-drag model fields, for Escape cancel restore.
            origFields: {
                x: node.x, y: node.y, width: node.width,
                height: node.height, manualSize: node.manualSize
            },
            startClientX: evt.clientX,
            startClientY: evt.clientY,
            scale: this._viewport.getView().scale,
            moved: false
        };
        this._trackDrag();
    }

    _moveResize(evt) {
        const drag = this._resize;
        if (evt.pointerId !== drag.pointerId) return;
        const dx = (evt.clientX - drag.startClientX) / drag.scale;
        const dy = (evt.clientY - drag.startClientY) / drag.scale;
        if (Math.abs(dx) + Math.abs(dy) > 1) drag.moved = true;

        const next = applyResize(drag.startRect, drag.dir, dx, dy);
        const node = ops.findNode(this._state, drag.nodeId);
        if (!node) return;
        node.x = next.x;
        node.y = next.y;
        node.width = next.width;
        node.height = next.height;

        // Live DOM: fixed-size class so the height applies and the body
        // scrolls instead of regrowing.
        const nodeEl = this._nodeEls.get(drag.nodeId);
        if (nodeEl) {
            nodeEl.classList.add('ng-node--fixed');
            nodeEl.style.left = `${node.x}px`;
            nodeEl.style.top = `${node.y}px`;
            nodeEl.style.width = `${node.width}px`;
            nodeEl.style.height = `${node.height}px`;
        }
        // Keep the sizes map current so connected edges anchor at the live
        // rect (optionT fractions stay stale until the commit re-render —
        // same approximation node drags already make).
        const prev = this._sizes.get(drag.nodeId) || {};
        this._sizes.set(drag.nodeId, {
            width: next.width,
            height: next.height,
            optionT: prev.optionT
        });
        const nodeById = new Map(this._state.project.nodes.map(n => [n.id, n]));
        for (const link of this._state.project.links || []) {
            if (!link || (link.from !== drag.nodeId && link.to !== drag.nodeId)) continue;
            const group = this._edgeEls.get(link.id);
            const layout = layoutEdge(link, nodeById, this._sizes);
            if (group && layout) applyEdgeLayout(group, layout);
        }
    }

    _endResize(evt) {
        const drag = this._resize;
        this._resize = null;
        this._untrackDrag();
        if (!drag || !drag.moved) return;
        // The trailing click must not touch the selection (timestamp-based).
        this._dragEndedAt = Date.now();
        const node = ops.findNode(this._state, drag.nodeId);
        if (!node) return;
        // Commit: writes width+height and the `manualSize` marker (the live
        // move already set the values — resizeNode rounds + marks).
        ops.resizeNode(this._state, drag.nodeId, {
            x: node.x, y: node.y, width: node.width, height: node.height
        });
        // Funnels through history (baseline = pre-resize state) + re-render
        // + debounced save.
        this._afterMutation();
    }

    // Document-level drag tracking. Deliberately NO setPointerCapture —
    // with a real pointer, capture retargets the compatibility
    // click/dblclick to the capture element and killed double-click editing
    // in real Obsidian (UAT-2 note #4). Document listeners keep receiving
    // moves anywhere in the window without retargeting side effects.
    _trackDrag() {
        document.addEventListener('pointermove', this._onPointerMove);
        document.addEventListener('pointerup', this._onPointerUp);
        document.addEventListener('pointercancel', this._onPointerUp);
    }

    _untrackDrag() {
        document.removeEventListener('pointermove', this._onPointerMove);
        document.removeEventListener('pointerup', this._onPointerUp);
        document.removeEventListener('pointercancel', this._onPointerUp);
    }

    // -----------------------------------------------------------------------
    // Click / double-click: selection + inline editors
    // -----------------------------------------------------------------------

    _handleClick(evt) {
        // Timestamp-based trailing-drag-click suppression (header note #6):
        // robust no matter where capture/click targeting delivers the event.
        if (Date.now() - this._dragEndedAt < 150) return;
        const target = evt.target;
        if (typeof target.closest !== 'function') return;
        if (this._editorEl && this._editorEl.contains(target)) return;
        if (target.closest('.ng-toolbar') || target.closest('.ng-port')
            || target.closest('.ng-resize') || target.closest('.ng-vars-panel')) return;

        const nodeEl = target.closest('[data-node-id]');
        if (nodeEl && this._nodeEls.get(nodeEl.dataset.nodeId) === nodeEl) {
            if (evt.shiftKey) {
                // Shift-click toggles membership in the selection set.
                const next = new Set(this._selectedNodeIds);
                if (next.has(nodeEl.dataset.nodeId)) next.delete(nodeEl.dataset.nodeId);
                else next.add(nodeEl.dataset.nodeId);
                this._setSelection([...next], null);
            } else {
                this._setSelection([nodeEl.dataset.nodeId], null);
            }
            return;
        }
        const edgeEl = target.closest('.ng-edge');
        if (edgeEl) {
            this._setSelection([], edgeEl.getAttribute('data-link-id'));
            return;
        }
        this._setSelection([], null);
    }

    _handleDblClick(evt) {
        if (Date.now() - this._dragEndedAt < 150) return;
        const target = evt.target;
        if (typeof target.closest !== 'function') return;
        if (this._editorEl && this._editorEl.contains(target)) return;
        if (target.closest('.ng-resize')) return; // resize handles don't edit

        const nodeEl = target.closest('[data-node-id]');
        if (nodeEl && this._nodeEls.get(nodeEl.dataset.nodeId) === nodeEl) {
            this._openNodeEditor(nodeEl.dataset.nodeId);
            return;
        }
        const edgeEl = target.closest('.ng-edge');
        if (edgeEl) {
            this._openLinkEditor(edgeEl.getAttribute('data-link-id'), evt);
        }
    }

    // -----------------------------------------------------------------------
    // Inline editors
    // -----------------------------------------------------------------------

    _closeEditor() {
        if (this._editorEl) {
            this._editorEl.remove();
            this._editorEl = null;
        }
    }

    _placeEditor(panel, screenX, screenY) {
        this._closeEditor();
        const rect = this._frameEl.getBoundingClientRect();
        const maxX = Math.max(0, rect.width - 340);
        const maxY = Math.max(0, rect.height - 120);
        panel.style.left = `${Math.min(Math.max(0, screenX), maxX)}px`;
        panel.style.top = `${Math.min(Math.max(0, screenY), maxY)}px`;
        this._frameEl.appendChild(panel);
        this._editorEl = panel;
        const first = panel.querySelector('input, textarea');
        if (first) first.focus();
    }

    _openNodeEditor(nodeId) {
        const node = ops.findNode(this._state, nodeId);
        if (!node) return;
        const panel = buildNodeEditor(node, {
            onCommit: (result) => {
                this._closeEditor();
                try {
                    ops.setNodeTitle(this._state, nodeId, result.title);
                    if (result.turns) ops.setTurns(node, result.turns);
                    if (result.body !== undefined) ops.setNodeBody(this._state, nodeId, result.body);
                    if (result.options) ops.setChoiceOptions(node, result.options, this._state.project.nodes);
                } catch (err) {
                    console.warn('[Narrative Graph] edit rejected:', err.message);
                }
                this._afterMutation();
                this._setSelection([nodeId], null);
            },
            onCancel: () => this._closeEditor(),
            getVariables: () => this._getVarEntries(),
            getSpeakers: () => this._getSpeakers()
        });
        // Anchor at the node's top-left, in screen coordinates.
        const screen = worldToScreen({ x: node.x, y: node.y }, this._viewport.getView());
        this._placeEditor(panel, screen.x, screen.y);
    }

    _openLinkEditor(linkId, evt) {
        const link = ops.findLink(this._state, linkId);
        if (!link) return;
        const panel = buildLinkEditor(link, {
            onCommit: (text) => {
                this._closeEditor();
                try {
                    ops.setLinkRequirements(this._state, linkId, text);
                } catch (err) {
                    console.warn('[Narrative Graph] edit rejected:', err.message);
                }
                this._afterMutation();
                this._setSelection([], linkId);
            },
            onCancel: () => this._closeEditor(),
            getVariables: () => this._getVarEntries()
        });
        const frameRect = this._frameEl.getBoundingClientRect();
        this._placeEditor(panel, evt.clientX - frameRect.left, evt.clientY - frameRect.top);
    }

    // -----------------------------------------------------------------------
    // Keyboard: Delete/Backspace removes the selection; Space held = pan
    // modifier. Editors handle their own Escape.
    // -----------------------------------------------------------------------

    _isTypingTarget(target) {
        return !!(target && typeof target.closest === 'function'
            && target.closest('input, textarea, select, [contenteditable]'));
    }

    _handleKeyDown(evt) {
        // Container-level listener (note #5): only a typing guard is needed.
        if (evt.key === ' ' && !this._isTypingTarget(evt.target)) {
            this._spaceHeld = true;
            evt.preventDefault(); // avoid page scroll on Space
            // UAT-5: grab cursor only while Space is held (pan affordance)
            if (this._frameEl) this._frameEl.classList.add('ng-canvas--space');
            return;
        }
        if (this._isTypingTarget(evt.target)) return;
        // M3 (NG-08): clipboard + undo/redo shortcuts. Editor panel open ->
        // let the event through (text fields keep their own paste/undo).
        if (evt.ctrlKey || evt.metaKey) {
            if (this._editorEl) return;
            const key = evt.key.toLowerCase();
            if (key === 'z' && !evt.shiftKey) {
                evt.preventDefault();
                this._undo();
            } else if ((key === 'z' && evt.shiftKey) || key === 'y') {
                evt.preventDefault();
                this._redo();
            } else if (key === 'c') {
                if (this._copySelection()) evt.preventDefault();
            } else if (key === 'v') {
                evt.preventDefault();
                this._pasteClipboard();
            }
            return; // 其余 mod 组合（Ctrl+S 等）不在画布消费
        }
        if (evt.key === 'Escape') {
            this._cancelDrags();
            return;
        }
        if (evt.key !== 'Delete' && evt.key !== 'Backspace') return;
        if (this._editorEl) return; // don't delete nodes mid-edit
        if (!this._state) return;

        if (this._selectedNodeIds.size > 0) {
            // Group delete with last-Entry protection: Entry nodes are
            // skipped when they'd remove the file's last Entry.
            const entryCount = ops.entryNodes(this._state).length;
            let entriesSkipped = 0;
            let deleted = 0;
            let entryBudget = entryCount; // Entries that may be deleted
            for (const id of [...this._selectedNodeIds]) {
                const node = ops.findNode(this._state, id);
                if (!node) continue;
                if (node.type === 'Entry' && entryBudget <= 1) {
                    entriesSkipped++;
                    continue;
                }
                if (node.type === 'Entry') entryBudget--;
                try {
                    ops.deleteNode(this._state, id);
                    this._selectedNodeIds.delete(id);
                    deleted++;
                } catch (err) {
                    console.warn('[Narrative Graph] deleteNode rejected:', err.message);
                }
            }
            if (entriesSkipped > 0) {
                console.warn(`[Narrative Graph] skipped ${entriesSkipped} Entry node(s) — file must keep one Entry`);
            }
            if (deleted > 0) {
                this._setUiSelection();
                this._afterMutation();
            }
        } else if (this._selectedLinkId) {
            try {
                ops.deleteLink(this._state, this._selectedLinkId);
                this._setSelection([], null);
                this._afterMutation();
            } catch (err) {
                console.warn('[Narrative Graph] deleteLink rejected:', err.message);
            }
        }
        evt.preventDefault();
    }

    _handleKeyUp(evt) {
        if (evt.key === ' ') {
            this._spaceHeld = false;
            if (this._frameEl) this._frameEl.classList.remove('ng-canvas--space');
        }
    }

    // -----------------------------------------------------------------------
    // M3 (NG-08): cross-file copy/paste + snapshot undo/redo
    //
    // 剪贴板访问：优先 navigator.clipboard（Obsidian = Electron 渲染进程，
    // 键盘手势上下文可用）；不可用/抛错时回退 require('electron').clipboard
    // （esbuild external，惰性 require + try/catch，纯 Node 测试环境安全）。
    // -----------------------------------------------------------------------

    async _clipboardWrite(text) {
        try {
            const nav = typeof window !== 'undefined' ? window.navigator : null;
            if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
                await nav.clipboard.writeText(text);
                return true;
            }
        } catch (_err) { /* 无权限/不可用 —— 回退 Electron clipboard */ }
        try {
            const electron = require('electron');
            if (electron && electron.clipboard) {
                electron.clipboard.writeText(text);
                return true;
            }
        } catch (_err) { /* 非 Electron 环境 */ }
        console.warn('[Narrative Graph] 写入系统剪贴板失败');
        return false;
    }

    async _clipboardRead() {
        try {
            const nav = typeof window !== 'undefined' ? window.navigator : null;
            if (nav && nav.clipboard && typeof nav.clipboard.readText === 'function') {
                return await nav.clipboard.readText();
            }
        } catch (_err) { /* 回退 Electron clipboard */ }
        try {
            const electron = require('electron');
            if (electron && electron.clipboard) return electron.clipboard.readText();
        } catch (_err) { /* 非 Electron 环境 */ }
        return null;
    }

    // Ctrl/Cmd+C：选中子图 → 系统剪贴板（JSON 信封）。返回是否已处理
    // （无选择时不消费事件，让默认复制行为放行）。
    _copySelection() {
        if (!this._state || this._selectedNodeIds.size === 0) return false;
        const envelope = clipboardModel.encodeSelection(this._state, [...this._selectedNodeIds]);
        if (!envelope) return false;
        this._clipboardWrite(JSON.stringify(envelope));
        return true;
    }

    // Ctrl/Cmd+V：任意 narrative-graph 视图（可跨文件）。粘贴到视口中心、
    // 选中粘贴集；Entry 降级与未登记变量各弹一条 Notice。
    async _pasteClipboard() {
        if (!this._state) return;
        const text = await this._clipboardRead();
        const envelope = text ? clipboardModel.parseEnvelopeText(text) : null;
        if (!envelope) {
            new Notice('剪贴板中没有可粘贴的节点');
            return;
        }
        const rect = this._frameEl.getBoundingClientRect();
        const center = screenToWorld(
            { x: rect.width / 2, y: rect.height / 2 },
            this._viewport.getView()
        );
        try {
            const result = clipboardModel.applyPaste(this._state, envelope, {
                center,
                knownVariables: this._getVarEntries().map(e => e && e.name)
            });
            if (result.addedNodeIds.length === 0) return;
            this._afterMutation();
            this._setSelection(result.addedNodeIds, null);
            if (result.downgradedEntry > 0) {
                new Notice('粘贴的 Entry 节点已降级为 Content（每个文件只能有一个 Entry）');
            }
            if (result.missingVariables.length > 0) {
                new Notice(`粘贴的内容引用了 ${result.missingVariables.length} 个未登记的全局变量：`
                    + result.missingVariables.join('、'));
            }
        } catch (err) {
            console.warn('[Narrative Graph] paste rejected:', err.message);
        }
    }

    _undo() {
        if (!this._history || !this._historyBaseline || !this._state) return;
        const result = historyModel.undo(this._history, this._historyBaseline);
        if (result) this._applyHistorySnapshot(result.snapshot);
    }

    _redo() {
        if (!this._history || !this._historyBaseline || !this._state) return;
        const result = historyModel.redo(this._history, this._historyBaseline);
        if (result) this._applyHistorySnapshot(result.snapshot);
    }

    // 应用历史快照：整体换 project（深拷贝，不与历史栈共享引用）、恢复
    // 选择（id 仍存在才恢复）、相机不动、基线刷新、重渲染 + 保存。
    _applyHistorySnapshot(snapshot) {
        const fresh = historyModel.takeSnapshot({
            project: snapshot.project,
            ui: snapshot.ui
        });
        this._state.project = fresh.project;
        if (!this._state.ui || typeof this._state.ui !== 'object') this._state.ui = {};
        const uiSel = fresh.ui || {};
        this._state.ui.selectedNodeId = uiSel.selectedNodeId != null ? uiSel.selectedNodeId : null;
        this._state.ui.selectedLinkId = uiSel.selectedLinkId != null ? uiSel.selectedLinkId : null;

        const nodes = this._state.project.nodes || [];
        const links = this._state.project.links || [];
        this._selectedNodeIds = new Set(
            this._state.ui.selectedNodeId && nodes.some(n => n && n.id === this._state.ui.selectedNodeId)
                ? [this._state.ui.selectedNodeId]
                : []
        );
        this._selectedLinkId =
            this._state.ui.selectedLinkId && links.some(l => l && l.id === this._state.ui.selectedLinkId)
                ? this._state.ui.selectedLinkId
                : null;

        this._historyBaseline = historyModel.takeSnapshot(this._state);
        this._rerenderPreservingCamera();
        this._scheduleSave();
    }

    // -----------------------------------------------------------------------
    // Persistence (mutate model, debounced requestSave)
    // -----------------------------------------------------------------------

    _persistView(view, kind) {
        if (!this._state) return;
        if (!this._state.ui || typeof this._state.ui !== 'object') this._state.ui = {};
        this._state.ui.view = { x: view.x, y: view.y, scale: view.scale };
        // Timestamp-based trailing-click suppression (UAT-2 note #6): a pan
        // ends with a pointerup whose compatibility click must not clear a
        // fresh selection.
        if (kind === 'pan') this._dragEndedAt = Date.now();
        this._scheduleSave();
    }

    _scheduleSave() {
        if (this._saveTimer !== null) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            // TextFileView.requestSave() serializes via getViewData().
            this.requestSave();
        }, SAVE_DEBOUNCE);
    }
}

module.exports = { NarrativeGraphView, VIEW_TYPE_NARRATIVE_GRAPH, SAVE_DEBOUNCE };

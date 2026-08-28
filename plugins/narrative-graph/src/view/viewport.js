// viewport.js — pan/zoom interaction for the narrative-graph canvas
// (Phase 11 M1a, NG-08)
//
// Owns the camera state ({x, y, scale}) and applies it to the world element
// as `translate(x px, y px) scale(s)`. Pan start is gated by the view via
// gestures.js (M1b UAT input remap: left-drag = marquee, middle-drag or
// Space+left-drag = pan); wheel zoom stays here. All math delegates to
// view/geometry.js.

const { ZOOM_STEP, zoomAtPoint, isValidStoredView, gridBackground, GRID_SPACING } = require('./geometry');

// Wheel zoom commits the view this long after the last notch (ms).
const ZOOM_COMMIT_DELAY = 300;

class Viewport {
    /**
     * @param {HTMLElement} frameEl - Clip frame receiving pointer/wheel events
     * @param {HTMLElement} worldEl - Transformed world container
     * @param {(view: {x:number,y:number,scale:number}, kind: string) => void} onNavigate
     *   Called once a gesture settles (pan end / zoom debounce) so the view
     *   can persist ui.view into the model. kind is 'pan' or 'zoom'.
     * @param {(evt: PointerEvent) => boolean} [shouldPan]
     *   Gesture gate from gestures.js (M1b UAT: left-drag is marquee, so the
     *   view decides when a pointerdown may start a pan). Defaults to
     *   middle-button only.
     */
    constructor(frameEl, worldEl, onNavigate, shouldPan) {
        this._frameEl = frameEl;
        this._worldEl = worldEl;
        this._onNavigate = typeof onNavigate === 'function' ? onNavigate : () => {};
        this._shouldPan = typeof shouldPan === 'function' ? shouldPan : (evt) => evt.button === 1;
        this._view = { x: 0, y: 0, scale: 1 };
        this._pan = null;
        this._zoomTimer = null;

        this._onWheel = this._handleWheel.bind(this);
        this._onPointerDown = this._handlePointerDown.bind(this);
        this._onPointerMove = this._handlePointerMove.bind(this);
        this._onPointerUp = this._handlePointerUp.bind(this);
    }

    attach() {
        // { passive: false } is required so preventDefault() stops page scroll.
        this._frameEl.addEventListener('wheel', this._onWheel, { passive: false });
        this._frameEl.addEventListener('pointerdown', this._onPointerDown);
    }

    detach() {
        this._frameEl.removeEventListener('wheel', this._onWheel);
        this._frameEl.removeEventListener('pointerdown', this._onPointerDown);
        this._endPan();
        if (this._zoomTimer !== null) {
            clearTimeout(this._zoomTimer);
            this._zoomTimer = null;
        }
    }

    getView() {
        return { ...this._view };
    }

    setView(view) {
        if (!isValidStoredView(view)) return;
        this._view = { x: view.x, y: view.y, scale: view.scale };
        this._apply();
    }

    // -----------------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------------

    _apply() {
        const { x, y, scale } = this._view;
        this._worldEl.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        // UAT-6 #2: dot grid on the frame background tracks the world —
        // position/size derived from the same translate/scale so dots keep
        // constant screen size while their spacing pans/zooms with content.
        const grid = gridBackground(this._view, GRID_SPACING);
        this._frameEl.style.backgroundPosition = grid.backgroundPosition;
        this._frameEl.style.backgroundSize = grid.backgroundSize;
    }

    _commit(kind) {
        this._onNavigate(this.getView(), kind);
    }

    // Wheel = pointer-centered zoom. deltaY sign decides direction; the
    // per-notch factor keeps the step smooth across mouse wheels and
    // trackpads (NG-08).
    _handleWheel(evt) {
        evt.preventDefault();
        const rect = this._frameEl.getBoundingClientRect();
        const pointer = { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
        const factor = evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        this._view = zoomAtPoint(this._view, pointer, factor);
        this._apply();

        if (this._zoomTimer !== null) clearTimeout(this._zoomTimer);
        this._zoomTimer = setTimeout(() => {
            this._zoomTimer = null;
            this._commit('zoom');
        }, ZOOM_COMMIT_DELAY);
    }

    // Pan start is gated by gestures.js via the shouldPan predicate
    // (middle-drag anywhere, or Space+left-drag on empty canvas). Never
    // preventDefault left-button pointerdown here: canceling pointerdown
    // suppresses compatibility mouse events (click/dblclick) in Chromium,
    // which is what killed selection/editors/toolbar in the M1b UAT.
    _handlePointerDown(evt) {
        if (!this._shouldPan(evt)) return;
        this._pan = {
            pointerId: evt.pointerId,
            startX: evt.clientX,
            startY: evt.clientY,
            viewX: this._view.x,
            viewY: this._view.y,
            moved: false
        };
        // UAT-5: grabbing cursor only during an active pan gesture.
        this._frameEl.classList.add('ng-canvas--panning');
        if (typeof this._frameEl.setPointerCapture === 'function') {
            try { this._frameEl.setPointerCapture(evt.pointerId); } catch (_e) { /* detached */ }
        }
        this._frameEl.addEventListener('pointermove', this._onPointerMove);
        this._frameEl.addEventListener('pointerup', this._onPointerUp);
        this._frameEl.addEventListener('pointercancel', this._onPointerUp);
        // Middle-button only: preventDefault suppresses autoscroll. Left-button
        // pans (Space held) must NOT preventDefault — see header note above.
        if (evt.button === 1) evt.preventDefault();
    }

    _handlePointerMove(evt) {
        if (!this._pan || evt.pointerId !== this._pan.pointerId) return;
        const dx = evt.clientX - this._pan.startX;
        const dy = evt.clientY - this._pan.startY;
        if (Math.abs(dx) + Math.abs(dy) > 2) this._pan.moved = true;
        this._view.x = this._pan.viewX + dx;
        this._view.y = this._pan.viewY + dy;
        this._apply();
    }

    _handlePointerUp(evt) {
        if (!this._pan || evt.pointerId !== this._pan.pointerId) return;
        const moved = this._pan.moved;
        this._endPan();
        if (moved) this._commit('pan');
    }

    _endPan() {
        this._pan = null;
        this._frameEl.classList.remove('ng-canvas--panning');
        this._frameEl.removeEventListener('pointermove', this._onPointerMove);
        this._frameEl.removeEventListener('pointerup', this._onPointerUp);
        this._frameEl.removeEventListener('pointercancel', this._onPointerUp);
    }
}

module.exports = { Viewport, ZOOM_COMMIT_DELAY };

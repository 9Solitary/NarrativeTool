// ports.js — port anchor shape helpers for narrative-graph (toPort feature)
//
// A port anchor is { side, t }: side ∈ left/right/top/bottom, t ∈ 0..1 the
// fractional position along that side. Node-level defaults live on
// node.ports.input/.output (constants.js DEFAULT_PORTS); a link may carry an
// OPTIONAL per-link `toPort` anchor so several links into the same node can
// end at distinct border points instead of sharing node.ports.input.
//
// Pure module: no obsidian imports, no DOM access (purity guard).

// Valid port sides (UAT-6 #1: four-side handles).
const PORT_SIDES = Object.freeze(['left', 'right', 'top', 'bottom']);

function isPortSide(side) {
    return PORT_SIDES.includes(side);
}

/**
 * Normalize a candidate port anchor to { side, t } with t clamped to 0..1.
 * Returns null when the value is not a usable anchor (absent, non-object, or
 * an unknown side); a missing/non-finite t defaults to 0.5.
 *
 * @param {*} value - Candidate { side, t }
 * @returns {{ side: string, t: number } | null}
 */
function normalizePort(value) {
    if (!value || typeof value !== 'object') return null;
    if (!isPortSide(value.side)) return null;
    const t = Number.isFinite(value.t) ? Math.min(1, Math.max(0, value.t)) : 0.5;
    return { side: value.side, t };
}

module.exports = { PORT_SIDES, isPortSide, normalizePort };

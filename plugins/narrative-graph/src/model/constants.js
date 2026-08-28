// constants.js — Narrative Graph saved-state v1 constants (Phase 11, NG-01/NG-03)
//
// The model layer is pure data transformation: no obsidian imports, no DOM
// access (guarded by tests/narrative-graph-purity.test.js).

// Saved-state format version written by NarrativeCanvas (NG-01).
const SAVED_STATE_VERSION = 1;

// Node types the narrative-graph editor exposes in v1 (NG-03).
// Marker/Event stay engine-supported but get no editor UI in v1.
const NODE_TYPES = Object.freeze(['Entry', 'Content', 'Dialog', 'Choice', 'End']);

// Engine-supported types beyond the editor v1 set (NG-03).
const ENGINE_ONLY_NODE_TYPES = Object.freeze(['Marker', 'Event']);

// End node type id (NG-04): explicit terminal, exports zero output lines.
const END_NODE_TYPE = 'End';

// Effect ops for choice option effects (NG-07).
const EFFECT_OPS = Object.freeze(['set', 'add', 'subtract', 'toggle']);

// Default node port layout as written by NarrativeCanvas
// (verified against real .ncanvas files).
const DEFAULT_PORTS = Object.freeze({
    input: Object.freeze({ side: 'left', t: 0.5 }),
    output: Object.freeze({ side: 'right', t: 0.5 })
});

// Return a fresh (mutable) copy of the default port layout.
function defaultPorts() {
    return {
        input: { side: 'left', t: 0.5 },
        output: { side: 'right', t: 0.5 }
    };
}

module.exports = {
    SAVED_STATE_VERSION,
    NODE_TYPES,
    ENGINE_ONLY_NODE_TYPES,
    END_NODE_TYPE,
    EFFECT_OPS,
    DEFAULT_PORTS,
    defaultPorts
};

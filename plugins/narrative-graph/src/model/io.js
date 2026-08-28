// io.js — saved-state v1 parse/serialize for narrative-graph (Phase 11, NG-01)
//
// Round-trip contract (NG-01): parse keeps the parsed object verbatim —
// unknown top-level/project/node/link fields written by NarrativeCanvas are
// preserved. serialize deep-clones and touches only known fields, then emits
// 2-space-indented JSON matching NC's on-disk style (no trailing newline).
//
// The model IS the parsed JSON object plus derived helpers — no parallel
// class hierarchy.
//
// Pure module: no obsidian imports, no DOM access (purity guard).

const { SAVED_STATE_VERSION } = require('./constants');

// Fields narrative-graph itself writes when saving (NG-01 "known subset").
// Anything else on a state/project/node/link object is passed through
// untouched during serialize.
const KNOWN_NODE_FIELDS = Object.freeze([
    'id', 'type', 'title', 'body', 'x', 'y',
    'choices', 'choiceOptions', 'choiceRevealMode', 'cast', 'turns',
    'customFields', 'ports', 'frameId', 'width', 'height'
]);
const KNOWN_LINK_FIELDS = Object.freeze([
    'id', 'from', 'to', 'choiceIndex', 'choiceOptionId', 'label', 'requirements'
]);

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepClone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

// -------------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------------

/**
 * Validate a parsed saved-state object, collecting human-readable errors
 * that name the offending node/link id. Validation never mutates the state.
 *
 * @param {Object} state - Parsed saved-state object
 * @returns {Array<string>} Validation errors (empty = valid)
 */
function validateSavedState(state) {
    const errors = [];

    if (!isPlainObject(state)) {
        return ['saved-state root must be an object'];
    }
    if (state.version !== SAVED_STATE_VERSION) {
        errors.push(`saved-state version must be ${SAVED_STATE_VERSION}, got ${JSON.stringify(state.version)}`);
    }
    if (!isPlainObject(state.project)) {
        errors.push('missing project object');
        return errors;
    }
    const project = state.project;

    if (!Array.isArray(project.nodes)) {
        errors.push('missing project.nodes array');
        return errors;
    }
    const links = project.links || [];
    if (!Array.isArray(links)) {
        errors.push('project.links must be an array');
        return errors;
    }

    // Nodes: id presence + uniqueness
    const nodeIds = new Set();
    for (const node of project.nodes) {
        if (!isPlainObject(node)) {
            errors.push('project.nodes contains a non-object entry');
            continue;
        }
        const label = node.id !== undefined ? `'${node.id}'` : '(missing id)';
        if (typeof node.id !== 'string' || node.id.length === 0) {
            errors.push(`node ${label}: missing or invalid id`);
            continue;
        }
        if (nodeIds.has(node.id)) {
            errors.push(`node '${node.id}': duplicate node id`);
        }
        nodeIds.add(node.id);
        if (typeof node.type !== 'string' || node.type.length === 0) {
            errors.push(`node '${node.id}': missing or invalid type`);
        }
    }

    // Links: endpoint references must resolve
    for (const link of links) {
        if (!isPlainObject(link)) {
            errors.push('project.links contains a non-object entry');
            continue;
        }
        const label = link.id !== undefined ? `'${link.id}'` : '(missing id)';
        if (typeof link.id !== 'string' || link.id.length === 0) {
            errors.push(`link ${label}: missing or invalid id`);
        }
        if (!nodeIds.has(link.from)) {
            errors.push(`link ${label}: 'from' references unknown node '${link.from}'`);
        }
        if (!nodeIds.has(link.to)) {
            errors.push(`link ${label}: 'to' references unknown node '${link.to}'`);
        }
    }

    return errors;
}

// -------------------------------------------------------------------------
// Parse
// -------------------------------------------------------------------------

/**
 * Parse a .ncanvas saved-state v1 file.
 *
 * @param {string|Object} input - Raw JSON text or an already-parsed object
 * @returns {{ state: Object, errors: Array<string> }}
 *   state: the parsed object (kept verbatim — unknown fields preserved)
 *   errors: validation errors naming the offending node/link id
 * @throws {SyntaxError} When input text is not valid JSON
 */
function parseSavedState(input) {
    let state;
    if (typeof input === 'string') {
        try {
            state = JSON.parse(input);
        } catch (err) {
            throw new SyntaxError(`Invalid .ncanvas JSON: ${err.message}`);
        }
    } else if (isPlainObject(input)) {
        state = input;
    } else {
        throw new SyntaxError('Invalid .ncanvas: input must be JSON text or an object');
    }
    return { state, errors: validateSavedState(state) };
}

// -------------------------------------------------------------------------
// Serialize
// -------------------------------------------------------------------------

/**
 * Serialize a saved-state model back to on-disk JSON text.
 *
 * Accepts either the raw state object or the `{ state, errors }` wrapper
 * returned by parseSavedState. Operates on a deep clone: only the known
 * field subset is re-touched, every unknown field from an NC-written file
 * is carried through verbatim (NG-01).
 *
 * Output style matches NarrativeCanvas on-disk: JSON.stringify with 2-space
 * indent, no trailing newline.
 *
 * @param {Object} model - Raw state object or parseSavedState() result
 * @returns {string} Pretty-printed JSON text
 */
function serializeSavedState(model) {
    const state = isPlainObject(model) && isPlainObject(model.state) ? model.state : model;
    if (!isPlainObject(state) || !isPlainObject(state.project)) {
        throw new Error('Cannot serialize: not a saved-state object');
    }
    // Deep clone so the caller's in-memory model is never mutated here;
    // editors mutate only known fields on their working copy (NG-01).
    const out = deepClone(state);
    return JSON.stringify(out, null, 2);
}

module.exports = {
    parseSavedState,
    serializeSavedState,
    validateSavedState,
    KNOWN_NODE_FIELDS,
    KNOWN_LINK_FIELDS
};

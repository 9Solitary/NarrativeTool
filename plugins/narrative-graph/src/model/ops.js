// ops.js — model mutations for the narrative-graph editor (Phase 11 M1b,
// NG-01/NG-03/NG-05)
//
// Every editing gesture ends here: these functions mutate the parsed
// saved-state model IN PLACE (node/link objects keep their identity and their
// unknown NC-written fields — NG-01 round-trip contract), and the view then
// schedules a debounced requestSave().
//
// Port rules are enforced at this level so UI and headless callers get the
// same guarantees:
//   - Entry has no input port  -> addLink rejects targeting an Entry node
//   - End has no output port   -> addLink rejects sourcing from an End node
//   - Choice sources REQUIRE a choiceOptionId naming an existing option;
//     non-Choice sources must NOT carry one
//   - self-links and duplicate links (same from/to/choiceOptionId) rejected
//   - UAT-6 #1: addLink optionally persists the dragged handle sides into
//     node.ports (output on source / input on target, t=0.5)
//   - UAT-6 #5: resizeNode writes width+height+manualSize (fixed-size node)
// Exactly one Entry per file: addNode rejects a second Entry, deleteNode
// rejects deleting the last one.
//
// Invalid operations throw Error with a human-readable message; callers
// (view) catch and ignore/flash.
//
// Pure module: no obsidian imports, no DOM access (purity guard).

const { NODE_TYPES, END_NODE_TYPE, defaultPorts } = require('./constants');
const { nextNodeId, nextLinkId, nextOptionId } = require('./ids');
const { flattenTurns } = require('./turns');

// Valid port sides (UAT-6 #1: four-side handles persist into node.ports).
const PORT_SIDES = Object.freeze(['left', 'right', 'top', 'bottom']);

// Type-default titles for new nodes (Dialog's default is treated as
// "speakerless" by the exporter — see export-engine resolveSpeaker).
const DEFAULT_TITLES = Object.freeze({
    Entry: 'Start',
    Content: 'Content',
    Dialog: 'Dialog',
    Choice: 'Choice',
    End: 'End'
});

// Per-type explicit default widths for NEW nodes (UAT-6 #6: Dialog lines are
// short — 200px instead of the implicit 260 standard). Types absent here get
// no width field (the renderer's DEFAULT_NODE_WIDTH applies).
const DEFAULT_NODE_WIDTHS = Object.freeze({
    Dialog: 200
});

// Width a newly created node of `type` will render at (explicit default or
// the 260 standard) — the view uses it to center creation on the viewport.
function defaultWidthFor(type) {
    return DEFAULT_NODE_WIDTHS[type] || 260;
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

function projectOf(state) {
    if (!state || typeof state !== 'object' || !state.project) {
        throw new Error('ops: not a saved-state object');
    }
    return state.project;
}

function nodesOf(state) {
    const project = projectOf(state);
    if (!Array.isArray(project.nodes)) project.nodes = [];
    return project.nodes;
}

function linksOf(state) {
    const project = projectOf(state);
    if (!Array.isArray(project.links)) project.links = [];
    return project.links;
}

function findNode(state, id) {
    return nodesOf(state).find(n => n && n.id === id);
}

function findLink(state, id) {
    return linksOf(state).find(l => l && l.id === id);
}

function entryNodes(state) {
    return nodesOf(state).filter(n => n && n.type === 'Entry');
}

// ---------------------------------------------------------------------------
// Node mutations
// ---------------------------------------------------------------------------

/**
 * Append a new node of `type` at (x, y) with sensible per-type defaults
 * (NG-03 set; Content: empty body, Dialog: one empty turn, Choice: two
 * empty options, End: terminal). Entry is unique per file.
 *
 * @returns {Object} The created node (already appended to project.nodes)
 */
function addNode(state, type, x, y) {
    if (!NODE_TYPES.includes(type)) {
        throw new Error(`addNode: unsupported node type '${type}'`);
    }
    const nodes = nodesOf(state);
    if (type === 'Entry' && entryNodes(state).length > 0) {
        throw new Error('addNode: file already has an Entry node');
    }

    const node = {
        id: nextNodeId(nodes),
        type,
        title: DEFAULT_TITLES[type],
        body: '',
        x: Number.isFinite(x) ? Math.round(x) : 0,
        y: Number.isFinite(y) ? Math.round(y) : 0
    };
    // UAT-6 #6: types with a non-standard default width get it written
    // explicitly (Dialog 200px); others stay implicit.
    if (DEFAULT_NODE_WIDTHS[type]) node.width = DEFAULT_NODE_WIDTHS[type];
    nodes.push(node);

    if (type === 'Dialog') {
        node.turns = [{ speaker: '', line: '' }];
    } else if (type === 'Choice') {
        node.choices = [];
        node.choiceOptions = [];
        // Two empty options; nextOptionId scans node.choiceOptions too, so
        // sequential calls stay unique.
        for (let i = 0; i < 2; i++) {
            node.choiceOptions.push({ id: nextOptionId(nodes), label: '', requires: '', effects: [] });
            node.choices.push('');
        }
    }
    return node;
}

/**
 * Remove a node and every link connected to it. The last Entry node of a
 * file cannot be deleted.
 */
function deleteNode(state, id) {
    const nodes = nodesOf(state);
    const index = nodes.findIndex(n => n && n.id === id);
    if (index < 0) throw new Error(`deleteNode: unknown node '${id}'`);
    const node = nodes[index];
    if (node.type === 'Entry' && entryNodes(state).length <= 1) {
        throw new Error('deleteNode: cannot delete the last Entry node');
    }
    nodes.splice(index, 1);
    const links = linksOf(state);
    const kept = links.filter(l => l && l.from !== id && l.to !== id);
    links.length = 0;
    links.push(...kept);
}

function moveNode(state, id, x, y) {
    const node = findNode(state, id);
    if (!node) throw new Error(`moveNode: unknown node '${id}'`);
    node.x = Number.isFinite(x) ? Math.round(x) : node.x;
    node.y = Number.isFinite(y) ? Math.round(y) : node.y;
}

/**
 * UAT-6 #5: commit a free-resize result — explicit width AND height plus the
 * `manualSize` marker. The marker flips the node from auto-height to
 * fixed-size (renderer/geometry respect the stored height, content scrolls);
 * NC-imported stored heights without the marker stay informational.
 * `rect` is the clamped result of geometry.applyResize.
 */
function resizeNode(state, id, rect) {
    const node = findNode(state, id);
    if (!node) throw new Error(`resizeNode: unknown node '${id}'`);
    node.x = Math.round(rect.x);
    node.y = Math.round(rect.y);
    node.width = Math.round(rect.width);
    node.height = Math.round(rect.height);
    node.manualSize = true;
}

function setNodeTitle(state, id, title) {
    const node = findNode(state, id);
    if (!node) throw new Error(`setNodeTitle: unknown node '${id}'`);
    node.title = String(title == null ? '' : title);
}

function setNodeBody(state, id, body) {
    const node = findNode(state, id);
    if (!node) throw new Error(`setNodeBody: unknown node '${id}'`);
    node.body = String(body == null ? '' : body);
}

/**
 * Replace a Dialog node's turns and regenerate its body from them
 * (`speaker: line` joined with '\n', NG-05). Rows where speaker AND line
 * are both blank are dropped.
 */
function setTurns(node, turns) {
    if (!node || typeof node !== 'object') throw new Error('setTurns: not a node object');
    const cleaned = (Array.isArray(turns) ? turns : [])
        .map(t => ({
            speaker: String(t && t.speaker != null ? t.speaker : '').trim(),
            line: String(t && t.line != null ? t.line : '').trim()
        }))
        .filter(t => t.speaker.length > 0 || t.line.length > 0);
    node.turns = cleaned;
    node.body = flattenTurns(cleaned);
}

/**
 * Replace a Choice node's options. Existing options (matched by id) are
 * mutated in place so unknown NC-written option fields survive (NG-01);
 * options without an id get a fresh nextOptionId. The legacy `choices`
 * string array is kept in sync with the labels.
 *
 * @param {Object} node - The Choice node
 * @param {Array<{id?: string, label?: string, requires?: string, effects?: Array}>} options
 * @param {Array<Object>} [allNodes] - project.nodes for file-global option
 *   id allocation (defaults to scanning just this node)
 */
function setChoiceOptions(node, options, allNodes) {
    if (!node || typeof node !== 'object') throw new Error('setChoiceOptions: not a node object');
    const scanPool = Array.isArray(allNodes) ? allNodes : [node];
    const existing = new Map(
        (Array.isArray(node.choiceOptions) ? node.choiceOptions : [])
            .filter(o => o && typeof o.id === 'string')
            .map(o => [o.id, o])
    );

    const next = [];
    for (const input of Array.isArray(options) ? options : []) {
        // Mutate the existing option object in place to preserve unknown fields.
        const target = input && typeof input.id === 'string' && existing.has(input.id)
            ? existing.get(input.id)
            : { id: nextOptionId([...scanPool, { choiceOptions: next }]) };
        target.label = String(input && input.label != null ? input.label : '');
        target.requires = String(input && input.requires != null ? input.requires : '');
        target.effects = (Array.isArray(input && input.effects) ? input.effects : [])
            .filter(e => e && typeof e === 'object')
            .map(e => ({
                trigger: String(e.trigger || 'onChoose'),
                op: String(e.op || 'set'),
                key: String(e.key != null ? e.key : ''),
                value: String(e.value != null ? e.value : '')
            }));
        next.push(target);
    }
    node.choiceOptions = next;
    node.choices = next.map(o => o.label);
}

// ---------------------------------------------------------------------------
// Link mutations
// ---------------------------------------------------------------------------

/**
 * Create a link from -> to, enforcing the port rules documented in the
 * header (Entry input / End output / Choice option requirement / no
 * self-links / no duplicates). Choice links mirror the option label and
 * choiceIndex for NC compat.
 *
 * UAT-6 #1 (native .canvas semantics): `sides` optionally persists the
 * handle sides the user dragged between — fromSide writes the SOURCE node's
 * ports.output, toSide the TARGET's ports.input (t=0.5; ports objects are
 * created from defaults when absent, mutated in place otherwise so unknown
 * fields survive). Choice sources keep their per-option row anchors, so
 * fromSide is ignored for them. Invalid side strings are ignored.
 *
 * @returns {Object} The created link
 */
function addLink(state, from, to, choiceOptionId, sides) {
    const fromNode = findNode(state, from);
    const toNode = findNode(state, to);
    if (!fromNode) throw new Error(`addLink: unknown source node '${from}'`);
    if (!toNode) throw new Error(`addLink: unknown target node '${to}'`);
    if (from === to) throw new Error('addLink: self-links are not allowed');
    if (fromNode.type === END_NODE_TYPE) throw new Error('addLink: End nodes have no output port');
    if (toNode.type === 'Entry') throw new Error('addLink: Entry nodes have no input port');

    const links = linksOf(state);
    const optionId = choiceOptionId != null ? String(choiceOptionId) : null;
    const duplicate = links.some(l => l && l.from === from && l.to === to
        && (l.choiceOptionId != null ? String(l.choiceOptionId) : null) === optionId);
    if (duplicate) throw new Error('addLink: duplicate link (same from/to/choiceOptionId)');

    const link = { id: nextLinkId(links), from, to };
    if (fromNode.type === 'Choice') {
        if (!optionId) throw new Error('addLink: Choice sources require a choiceOptionId');
        const options = Array.isArray(fromNode.choiceOptions) ? fromNode.choiceOptions : [];
        const index = options.findIndex(o => o && o.id === optionId);
        if (index < 0) throw new Error(`addLink: node '${from}' has no option '${optionId}'`);
        link.choiceOptionId = optionId;
        link.choiceIndex = index;
        link.label = options[index].label || '';
    } else if (optionId) {
        throw new Error('addLink: only Choice sources may carry a choiceOptionId');
    }

    // Persist the chosen handle sides (t=0.5 — handles live at edge centers
    // unless a pre-existing NC file says otherwise).
    if (sides && fromNode.type !== 'Choice'
        && PORT_SIDES.includes(sides.fromSide)) {
        if (!fromNode.ports || typeof fromNode.ports !== 'object') fromNode.ports = defaultPorts();
        fromNode.ports.output = { side: sides.fromSide, t: 0.5 };
    }
    if (sides && PORT_SIDES.includes(sides.toSide)) {
        if (!toNode.ports || typeof toNode.ports !== 'object') toNode.ports = defaultPorts();
        toNode.ports.input = { side: sides.toSide, t: 0.5 };
    }

    links.push(link);
    return link;
}

function deleteLink(state, id) {
    const links = linksOf(state);
    const index = links.findIndex(l => l && l.id === id);
    if (index < 0) throw new Error(`deleteLink: unknown link '${id}'`);
    links.splice(index, 1);
}

/** Set or clear (empty text) a link's requirements condition string. */
function setLinkRequirements(state, id, text) {
    const link = findLink(state, id);
    if (!link) throw new Error(`setLinkRequirements: unknown link '${id}'`);
    const trimmed = String(text == null ? '' : text).trim();
    if (trimmed.length > 0) link.requirements = trimmed;
    else delete link.requirements;
}

module.exports = {
    DEFAULT_TITLES,
    DEFAULT_NODE_WIDTHS,
    PORT_SIDES,
    defaultWidthFor,
    findNode,
    findLink,
    entryNodes,
    addNode,
    deleteNode,
    moveNode,
    resizeNode,
    setNodeTitle,
    setNodeBody,
    setTurns,
    setChoiceOptions,
    addLink,
    deleteLink,
    setLinkRequirements
};

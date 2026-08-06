// canvas-templates.js — Flow Canvas & Flow Fragment .canvas JSON templates
//
// Implements FLW-01 (3 Flow Canvas templates) and FLW-02 (2 Flow Fragment templates).
// Generates .canvas JSON with pre-configured starter nodes that designers can
// then edit in Obsidian's native Canvas view.
//
// Exports:
//   FLOW_TEMPLATES      — constants: 'chapter', 'quest', 'world-event'
//   FRAGMENT_TEMPLATES  — constants: 'quest-detail', 'scene-breakdown'
//   createFlowCanvas(templateType, params, options)
//   createFlowFragment(templateType, params, options)
//
// options.idGenerator replaces the default ID generator (for test fixed-seed mode).
// options.edgeIdGenerator replaces the edge ID generator similarly.

const { generateNodeId } = require('./canvas-utils');

// Template type constants
const FLOW_TEMPLATES = {
    CHAPTER: 'chapter',
    QUEST: 'quest',
    WORLD_EVENT: 'world-event',
};

const FRAGMENT_TEMPLATES = {
    QUEST_DETAIL: 'quest-detail',
    SCENE_BREAKDOWN: 'scene-breakdown',
};

// ---- Edge ID helpers ----

function defaultEdgeIdGenerator() {
    let count = 0;
    return function generateEdgeId() {
        count++;
        return `edge-${count.toString().padStart(12, '0')}`;
    };
}

// ---- Node helpers ----

function textNode(id, text, x, y, width, height, color) {
    const node = { id, type: 'text', x, y, width, height, text };
    if (color) node.color = color;
    return node;
}

function fileNode(id, file, x, y, width, height) {
    return { id, type: 'file', file, x, y, width, height };
}

function edge(id, fromNode, toNode, fromSide, toSide) {
    return { id, fromNode, toNode, fromSide, toSide };
}

// ---- Serialization ----

function toCanvasJSON(nodes, edges) {
    return JSON.stringify({ nodes, edges }, null, '\t');
}

// ---- Flow Canvas: Chapter ----
// Nodes: Title (text), Entry scene (file→.ncanvas), Key NPCs section + each NPC as file, Key Locations section + each location as file
// Edges: none (user connects manually)

function createChapterCanvas(params, idGen, edgeIdGen) {
    const { title, entryScene, npcs = [], locations = [] } = params;
    const nodes = [];
    const edges = [];

    // Title node
    nodes.push(textNode(idGen(), `**Chapter: ${title}**`, 0, 0, 350, 100, '1'));

    // Entry scene file node (below title)
    nodes.push(fileNode(idGen(), entryScene, 0, 150, 300, 200));

    // Key NPCs section header
    nodes.push(textNode(idGen(), '**Key NPCs**', 400, 0, 250, 60, '6'));

    // Each NPC as a file node, stacked vertically under the NPC header
    const npcStartX = 400;
    const npcStartY = 100;
    const npcYStep = 180;
    for (let i = 0; i < npcs.length; i++) {
        nodes.push(fileNode(idGen(), npcs[i], npcStartX, npcStartY + i * npcYStep, 250, 150));
    }

    // Key Locations section header
    nodes.push(textNode(idGen(), '**Key Locations**', -400, 0, 250, 60, '6'));

    // Each location as a file node, stacked vertically under the location header
    const locStartX = -400;
    const locStartY = 100;
    const locYStep = 180;
    for (let i = 0; i < locations.length; i++) {
        nodes.push(fileNode(idGen(), locations[i], locStartX, locStartY + i * locYStep, 250, 150));
    }

    return toCanvasJSON(nodes, edges);
}

// ---- Flow Canvas: Quest ----
// Nodes: Quest name (text), Quest giver (file), stages (text nodes), reward (text)
// Edges: giver → stage[0] → stage[1] → stage[2] → ...

function createQuestCanvas(params, idGen, edgeIdGen) {
    const { questName, giverChar, stages = [], reward } = params;
    const nodes = [];
    const edges = [];

    // Title node
    nodes.push(textNode(idGen(), `**Quest: ${questName}**`, 0, 0, 300, 80, '1'));

    // Quest giver file node
    const giverId = idGen();
    nodes.push(fileNode(giverId, giverChar, 0, 130, 250, 150));

    // Stage nodes in a column to the right
    const stageIds = [];
    const stageStartX = 350;
    const stageStartY = 0;
    const stageYStep = 100;
    for (let i = 0; i < stages.length; i++) {
        const sid = idGen();
        stageIds.push(sid);
        nodes.push(textNode(sid, `**Stage ${i + 1}**\n${stages[i]}`,
            stageStartX, stageStartY + i * stageYStep, 250, 60, '5'));
    }

    // Reward node below giver
    nodes.push(textNode(idGen(), `**Reward**\n${reward}`, 0, 330, 250, 60, '4'));

    // Edges: giver → stage[0] → stage[1] → ...
    let prevId = giverId;
    for (let i = 0; i < stageIds.length; i++) {
        edges.push(edge(edgeIdGen(), prevId, stageIds[i], 'right', 'left'));
        prevId = stageIds[i];
    }

    return toCanvasJSON(nodes, edges);
}

// ---- Flow Canvas: World Event ----
// Nodes: Event name (text), Trigger condition (text), Affected locations (file), Outcome (text)
// Edges: trigger → each location → outcome

function createWorldEventCanvas(params, idGen, edgeIdGen) {
    const { eventName, trigger, affectedLocs = [], outcome } = params;
    const nodes = [];
    const edges = [];

    // Event title node
    nodes.push(textNode(idGen(), `**Event: ${eventName}**`, 0, 0, 300, 80, '1'));

    // Trigger condition node
    const triggerId = idGen();
    nodes.push(textNode(triggerId, `**Trigger**\n${trigger}`, 0, 120, 280, 60, '2'));

    // Affected locations as file nodes (left and right of title)
    const locIds = [];
    for (let i = 0; i < affectedLocs.length; i++) {
        const lid = idGen();
        locIds.push(lid);
        const xOffset = i === 0 ? -350 : 350;
        nodes.push(fileNode(lid, affectedLocs[i], xOffset, 0, 250, 150));
    }

    // Outcome node below trigger
    const outcomeId = idGen();
    nodes.push(textNode(outcomeId, `**Outcome**\n${outcome}`, 0, 220, 300, 60, '4'));

    // Edges: trigger → each location
    for (let i = 0; i < locIds.length; i++) {
        edges.push(edge(edgeIdGen(), triggerId, locIds[i], 'right', 'left'));
    }

    // Edges: each location → outcome
    for (let i = 0; i < locIds.length; i++) {
        const fromSide = 'bottom';
        const toSide = i === 0 ? 'left' : 'right';
        edges.push(edge(edgeIdGen(), locIds[i], outcomeId, fromSide, toSide));
    }

    return toCanvasJSON(nodes, edges);
}

// ---- Flow Fragment: Quest Detail ----
// Nodes: Quest step (text), Dialogue ref (file .ncanvas), Branch A (text), Branch B (text), Condition (text)
// Edges: step → dialogue, dialogue → branchA + branchB, condition → dialogue

function createQuestDetailFragment(params, idGen, edgeIdGen) {
    const { stepName, dialogueRef, branch1, branch2, condition } = params;
    const nodes = [];
    const edges = [];

    // Quest step title node
    const stepId = idGen();
    nodes.push(textNode(stepId, `**Quest Step**\n${stepName}`, 0, 0, 280, 80, '1'));

    // Dialogue reference file node
    const dialogueId = idGen();
    nodes.push(fileNode(dialogueId, dialogueRef, 0, 130, 300, 200));

    // Branch A node (right, upper)
    const branchAId = idGen();
    nodes.push(textNode(branchAId, `**Branch A**\n${branch1}`, 350, 50, 230, 60, '5'));

    // Branch B node (right, lower)
    const branchBId = idGen();
    nodes.push(textNode(branchBId, `**Branch B**\n${branch2}`, 350, 200, 230, 60, '5'));

    // Condition node (left)
    const conditionId = idGen();
    nodes.push(textNode(conditionId, `**Condition**\n${condition}`, -350, 130, 260, 60, '6'));

    // Edges
    edges.push(edge(edgeIdGen(), stepId, dialogueId, 'bottom', 'top'));
    edges.push(edge(edgeIdGen(), dialogueId, branchAId, 'right', 'left'));
    edges.push(edge(edgeIdGen(), dialogueId, branchBId, 'right', 'left'));
    edges.push(edge(edgeIdGen(), conditionId, dialogueId, 'right', 'left'));

    return toCanvasJSON(nodes, edges);
}

// ---- Flow Fragment: Scene Breakdown ----
// Nodes: Scene name (text), Characters present (file .md), Beats (text nodes)
// Edges: scene → beat[0] → beat[1] → beat[2] → ...

function createSceneBreakdownFragment(params, idGen, edgeIdGen) {
    const { sceneName, characters = [], beats = [] } = params;
    const nodes = [];
    const edges = [];

    // Scene title node
    const sceneId = idGen();
    nodes.push(textNode(sceneId, `**Scene: ${sceneName}**`, 0, 0, 300, 80, '1'));

    // Character file nodes (left and right of title)
    for (let i = 0; i < characters.length; i++) {
        const xOffset = i === 0 ? -400 : 400;
        nodes.push(fileNode(idGen(), characters[i], xOffset, -50, 220, 150));
    }

    // Beat text nodes in a vertical column
    const beatIds = [];
    const beatStartY = 120;
    const beatYStep = 90;
    for (let i = 0; i < beats.length; i++) {
        const bid = idGen();
        beatIds.push(bid);
        nodes.push(textNode(bid, `**Beat ${i + 1}**\n${beats[i]}`,
            0, beatStartY + i * beatYStep, 280, 50, '5'));
    }

    // Edges: scene → beat[0] → beat[1] → ...
    let prevId = sceneId;
    for (let i = 0; i < beatIds.length; i++) {
        edges.push(edge(edgeIdGen(), prevId, beatIds[i], 'bottom', 'top'));
        prevId = beatIds[i];
    }

    return toCanvasJSON(nodes, edges);
}

// ---- Public API ----

/**
 * Create a Flow Canvas from template.
 * @param {'chapter'|'quest'|'world-event'} templateType
 * @param {Object} params — template-specific parameters
 * @param {Object} [options] — optional options
 * @param {Function} [options.generateNodeId] — alternative node ID generator (for testing)
 * @param {Function} [options.generateEdgeId] — alternative edge ID generator (for testing)
 * @returns {string} JSON string (tab-indented) of .canvas content
 * @throws {Error} if templateType is unknown
 */
function createFlowCanvas(templateType, params, options) {
    const opts = options || {};
    const idGen = opts.generateNodeId || generateNodeId;
    const edgeIdGen = opts.generateEdgeId || defaultEdgeIdGenerator();

    switch (templateType) {
    case FLOW_TEMPLATES.CHAPTER:
        return createChapterCanvas(params, idGen, edgeIdGen);
    case FLOW_TEMPLATES.QUEST:
        return createQuestCanvas(params, idGen, edgeIdGen);
    case FLOW_TEMPLATES.WORLD_EVENT:
        return createWorldEventCanvas(params, idGen, edgeIdGen);
    default:
        throw new Error(`Unknown flow template: ${templateType}`);
    }
}

/**
 * Create a Flow Fragment Canvas from template.
 * @param {'quest-detail'|'scene-breakdown'} templateType
 * @param {Object} params — template-specific parameters
 * @param {Object} [options] — optional options
 * @param {Function} [options.generateNodeId] — alternative node ID generator (for testing)
 * @param {Function} [options.generateEdgeId] — alternative edge ID generator (for testing)
 * @returns {string} JSON string (tab-indented) of .canvas content
 * @throws {Error} if templateType is unknown
 */
function createFlowFragment(templateType, params, options) {
    const opts = options || {};
    const idGen = opts.generateNodeId || generateNodeId;
    const edgeIdGen = opts.generateEdgeId || defaultEdgeIdGenerator();

    switch (templateType) {
    case FRAGMENT_TEMPLATES.QUEST_DETAIL:
        return createQuestDetailFragment(params, idGen, edgeIdGen);
    case FRAGMENT_TEMPLATES.SCENE_BREAKDOWN:
        return createSceneBreakdownFragment(params, idGen, edgeIdGen);
    default:
        throw new Error(`Unknown fragment template: ${templateType}`);
    }
}

module.exports = {
    FLOW_TEMPLATES,
    FRAGMENT_TEMPLATES,
    createFlowCanvas,
    createFlowFragment,
};

// canvas-templates.test.js
// RED phase: Tests for canvas-templates.js and canvas-utils.js
// All 11 tests currently expected to FAIL — modules not yet implemented.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const path = require('node:path');

// ---- Normalize JSON for comparison ----
// Obsidian Canvas uses tabs; normalize to tabs for golden comparison.
function normalizeJSON(jsonString) {
    const obj = JSON.parse(jsonString);
    return JSON.stringify(obj, null, '\t');
}

// Read golden file and normalize
function readGolden(filename) {
    const filePath = path.join(__dirname, 'fixtures', filename);
    const raw = readFileSync(filePath, 'utf8');
    return normalizeJSON(raw);
}

// ---- Test helpers ----

// Fixed-seed ID generator for golden file match tests
function createFixedIdGenerator() {
    // node ID counter: produces 16-char hex IDs "0000000000000001", "0000000000000002", ...
    let nodeCount = 0;
    // edge ID counter: produces "edge-NNNNNNNNNNNN"
    let edgeCount = 0;

    function generateNodeId() {
        nodeCount++;
        return nodeCount.toString(16).padStart(16, '0');
    }

    function generateEdgeId() {
        edgeCount++;
        return `edge-${edgeCount.toString().padStart(12, '0')}`;
    }

    return { generateNodeId, generateEdgeId };
}

// ---- Try to require modules (will fail in RED phase) ----
let canvasUtils, canvasTemplates;
let modulesAvailable = false;

try {
    canvasUtils = require('../plugins/flow-tools/src/canvas-utils');
    modulesAvailable = true;
} catch (e) {
    canvasUtils = null;
}

try {
    canvasTemplates = require('../plugins/flow-tools/src/canvas-templates');
    modulesAvailable = true;
} catch (e) {
    canvasTemplates = null;
}

// ---- Test Suite ----

// Test 1: Chapter Flow Canvas JSON structure
describe('createFlowCanvas — chapter', () => {
    it('should produce parseable JSON with nodes[] and edges[]', () => {
        if (!canvasTemplates || !canvasTemplates.createFlowCanvas) {
            assert.fail('canvas-templates module not available');
        }

        const { generateNodeId, generateEdgeId } = createFixedIdGenerator();
        const result = canvasTemplates.createFlowCanvas('chapter', {
            title: 'Test Chapter',
            entryScene: 'Dialogues/test.ncanvas',
            npcs: ['Characters/bob.md'],
            locations: ['Locations/village.md']
        }, { generateNodeId, generateEdgeId });

        assert.ok(typeof result === 'string', 'should return a string');
        const parsed = JSON.parse(result);
        assert.ok(Array.isArray(parsed.nodes), 'nodes should be an array');
        assert.ok(Array.isArray(parsed.edges), 'edges should be an array');
        assert.ok(parsed.nodes.length > 0, 'should have at least one node');
    });
});

// Test 2: Chapter Flow Canvas golden match
describe('createFlowCanvas — chapter golden match', () => {
    it('should match expected-flow-chapter.canvas', () => {
        if (!canvasTemplates || !canvasTemplates.createFlowCanvas) {
            assert.fail('canvas-templates module not available');
        }

        const { generateNodeId, generateEdgeId } = createFixedIdGenerator();
        const result = canvasTemplates.createFlowCanvas('chapter', {
            title: 'Test Chapter',
            entryScene: 'Dialogues/test.ncanvas',
            npcs: ['Characters/bob.md'],
            locations: ['Locations/village.md']
        }, { generateNodeId, generateEdgeId });

        const actual = normalizeJSON(result);
        const expected = readGolden('expected-flow-chapter.canvas');
        assert.strictEqual(actual, expected, 'chapter canvas should match golden file');
    });
});

// Test 3: Quest Flow Canvas golden match
describe('createFlowCanvas — quest golden match', () => {
    it('should match expected-flow-quest.canvas', () => {
        if (!canvasTemplates || !canvasTemplates.createFlowCanvas) {
            assert.fail('canvas-templates module not available');
        }

        const { generateNodeId, generateEdgeId } = createFixedIdGenerator();
        const result = canvasTemplates.createFlowCanvas('quest', {
            questName: 'Find Key',
            giverChar: 'Characters/elder.md',
            stages: ['Talk to elder', 'Search cave', 'Return key'],
            reward: 'Gold + XP'
        }, { generateNodeId, generateEdgeId });

        const actual = normalizeJSON(result);
        const expected = readGolden('expected-flow-quest.canvas');
        assert.strictEqual(actual, expected, 'quest canvas should match golden file');
    });
});

// Test 4: World Event Flow Canvas golden match
describe('createFlowCanvas — world-event golden match', () => {
    it('should match expected-flow-world-event.canvas', () => {
        if (!canvasTemplates || !canvasTemplates.createFlowCanvas) {
            assert.fail('canvas-templates module not available');
        }

        const { generateNodeId, generateEdgeId } = createFixedIdGenerator();
        const result = canvasTemplates.createFlowCanvas('world-event', {
            eventName: 'Storm',
            trigger: 'Player enters zone',
            affectedLocs: ['Locations/village.md', 'Locations/cave.md'],
            outcome: 'Village flooded'
        }, { generateNodeId, generateEdgeId });

        const actual = normalizeJSON(result);
        const expected = readGolden('expected-flow-world-event.canvas');
        assert.strictEqual(actual, expected, 'world-event canvas should match golden file');
    });
});

// Test 5: Quest Detail Flow Fragment golden match
describe('createFlowFragment — quest-detail golden match', () => {
    it('should match expected-fragment-quest-detail.canvas', () => {
        if (!canvasTemplates || !canvasTemplates.createFlowFragment) {
            assert.fail('canvas-templates module not available');
        }

        const { generateNodeId, generateEdgeId } = createFixedIdGenerator();
        const result = canvasTemplates.createFlowFragment('quest-detail', {
            stepName: 'Search cave',
            dialogueRef: 'Dialogues/cave-search.ncanvas',
            branch1: 'Found key',
            branch2: 'Key not here',
            condition: 'Perception >= 10'
        }, { generateNodeId, generateEdgeId });

        const actual = normalizeJSON(result);
        const expected = readGolden('expected-fragment-quest-detail.canvas');
        assert.strictEqual(actual, expected, 'quest-detail fragment should match golden file');
    });
});

// Test 6: Scene Breakdown Flow Fragment golden match
describe('createFlowFragment — scene-breakdown golden match', () => {
    it('should match expected-fragment-scene.canvas', () => {
        if (!canvasTemplates || !canvasTemplates.createFlowFragment) {
            assert.fail('canvas-templates module not available');
        }

        const { generateNodeId, generateEdgeId } = createFixedIdGenerator();
        const result = canvasTemplates.createFlowFragment('scene-breakdown', {
            sceneName: 'Tavern Brawl',
            characters: ['Characters/guard.md', 'Characters/drunk.md'],
            beats: ['Enter tavern', 'Talk to barkeep', 'Guard intervenes']
        }, { generateNodeId, generateEdgeId });

        const actual = normalizeJSON(result);
        const expected = readGolden('expected-fragment-scene.canvas');
        assert.strictEqual(actual, expected, 'scene-breakdown fragment should match golden file');
    });
});

// Test 7: generateNodeId() returns 16-char hex lowercase
describe('generateNodeId', () => {
    it('should return 16-char hex lowercase string', () => {
        if (!canvasUtils || !canvasUtils.generateNodeId) {
            assert.fail('canvas-utils module not available');
        }

        const id = canvasUtils.generateNodeId();
        assert.ok(/^[0-9a-f]{16}$/.test(id),
            `generateNodeId() should return 16-char hex lowercase, got: "${id}"`);
    });

    it('should not collide over 1000 consecutive calls', () => {
        if (!canvasUtils || !canvasUtils.generateNodeId) {
            assert.fail('canvas-utils module not available');
        }

        const ids = new Set();
        for (let i = 0; i < 1000; i++) {
            const id = canvasUtils.generateNodeId();
            ids.add(id);
        }
        assert.strictEqual(ids.size, 1000,
            `generateNodeId() should produce 1000 unique IDs, got ${ids.size}`);
    });
});

// Test 8: addNodeToCanvas() correctly appends a node
describe('addNodeToCanvas', () => {
    it('should append a node and not modify edges[]', () => {
        if (!canvasUtils || !canvasUtils.addNodeToCanvas) {
            assert.fail('canvas-utils module not available');
        }

        const canvas = { nodes: [], edges: [{ id: 'edge1', fromNode: 'a', toNode: 'b' }] };
        const node = { id: 'test-node', type: 'text', x: 0, y: 0, width: 100, height: 50 };
        const updated = canvasUtils.addNodeToCanvas(canvas, node);

        assert.strictEqual(updated.nodes.length, 1, 'should have one node');
        assert.strictEqual(updated.nodes[0].id, 'test-node');
        assert.strictEqual(updated.edges.length, 1, 'edges should be unchanged');
        // Original canvas should NOT be mutated
        assert.strictEqual(canvas.nodes.length, 0, 'original canvas must not be mutated');
    });
});

// Test 9: addDialogueNodeToCanvas() creates type: "file" node with correct file path
describe('addDialogueNodeToCanvas', () => {
    it('should create a file node with correct file path', () => {
        if (!canvasUtils || !canvasUtils.addDialogueNodeToCanvas) {
            assert.fail('canvas-utils module not available');
        }

        const canvas = { nodes: [], edges: [] };
        const dialoguePath = 'Dialogues/test.ncanvas';
        const updated = canvasUtils.addDialogueNodeToCanvas(canvas, dialoguePath, { x: 100, y: 200 });

        assert.strictEqual(updated.nodes.length, 1);
        const node = updated.nodes[0];
        assert.strictEqual(node.type, 'file');
        assert.strictEqual(node.file, dialoguePath);
        assert.strictEqual(node.x, 100);
        assert.strictEqual(node.y, 200);
        assert.ok(/^[0-9a-f]{16}$/.test(node.id), 'node id should be 16-char hex');
    });
});

// Test 10: Canvas JSON preserves unknown fields
describe('addNodeToCanvas — preserve unknown fields', () => {
    it('should preserve extraField in canvas JSON', () => {
        if (!canvasUtils || !canvasUtils.addNodeToCanvas) {
            assert.fail('canvas-utils module not available');
        }

        const canvas = { nodes: [], edges: [], extraField: 'keep-me' };
        const node = { id: 'test-node', type: 'file', x: 0, y: 0, width: 100, height: 50 };
        const updated = canvasUtils.addNodeToCanvas(canvas, node);

        assert.strictEqual(updated.extraField, 'keep-me',
            'extraField should be preserved in updated canvas');
        assert.ok(Array.isArray(updated.nodes));
        assert.strictEqual(updated.nodes.length, 1);
    });
});

// Test 11: Canvas JSON uses tabs indentation
describe('Canvas JSON indentation', () => {
    it('createFlowCanvas should use tab indentation', () => {
        if (!canvasTemplates || !canvasTemplates.createFlowCanvas) {
            assert.fail('canvas-templates module not available');
        }

        const { generateNodeId, generateEdgeId } = createFixedIdGenerator();
        const result = canvasTemplates.createFlowCanvas('chapter', {
            title: 'Tabs Test',
            entryScene: 'Dialogues/tabs.ncanvas',
            npcs: [],
            locations: []
        }, { generateNodeId, generateEdgeId });

        // Verify the JSON string uses tabs, not spaces
        const indentedLine = result.split('\n').find(line => line.trim().length < line.length);
        if (indentedLine) {
            const indent = indentedLine.match(/^(\s*)/)[1];
            assert.ok(
                indent.includes('\t') || indent.length === 0,
                `Indentation should use tabs, got: ${JSON.stringify(indent)}`
            );
            assert.ok(
                !indent.includes('  '),
                `Indentation should not use spaces, got: ${JSON.stringify(indent)}`
            );
        }
    });
});

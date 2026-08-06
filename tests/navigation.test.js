// navigation.test.js -- findFlowCanvasForDialogue reverse navigation tests (05-04)
//
// Proves BUG-05: from a Dialogue (.ncanvas) file the plugin can find all Flow
// canvases (.canvas) that reference it as a file node.
//
// Cases: found / multiple / none / unparseable-canvas-skipped.
//
// NOTE: flow/navigation.js has `const { Notice } = require('obsidian')` at
// module top — the 'obsidian' require interception MUST be installed before
// importing the module under test (same pattern as merge-smoke.test.js).

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

// ---------------------------------------------------------------------------
// Intercept 'obsidian' require — install BEFORE requiring navigation.js
// ---------------------------------------------------------------------------

const originalResolveFilename = Module._resolveFilename;
const MOCK_OBSIDIAN_PATH = path.join(__dirname, 'mocks', 'obsidian.js');

Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'obsidian' || request === 'obsidian/') {
        return MOCK_OBSIDIAN_PATH;
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { findFlowCanvasForDialogue } = require('../plugins/narrative-tool/src/flow/navigation');

// ---------------------------------------------------------------------------
// Mock Vault: in-memory file system (shape from batch-export.test.js)
// ---------------------------------------------------------------------------

class MockVault {
    constructor() {
        this._files = new Map();
        this._folders = new Set();
    }

    addFile(filePath, content) {
        const normalizedPath = filePath.replace(/\\/g, '/');
        this._files.set(normalizedPath, {
            path: normalizedPath,
            name: normalizedPath.split('/').pop(),
            basename: normalizedPath.split('/').pop().replace(/\.[^.]+$/, ''),
            extension: normalizedPath.split('.').pop()
        });
        this._files.get(normalizedPath)._content = content;
        const parts = normalizedPath.split('/');
        for (let i = 1; i < parts.length; i++) {
            this._folders.add(parts.slice(0, i).join('/'));
        }
    }

    getFiles() {
        return Array.from(this._files.values()).map(f => ({
            path: f.path,
            name: f.name,
            basename: f.basename,
            extension: f.extension
        }));
    }

    async read(tfile) {
        const entry = this._files.get(tfile.path);
        if (!entry) throw new Error(`File not found: ${tfile.path}`);
        return entry._content;
    }

    // Helper: store a canvas whose JSON content references the given ncanvas files
    addCanvas(canvasPath, ncanvasRefs) {
        const nodes = ncanvasRefs.map(file => ({ type: 'file', file }));
        this.addFile(canvasPath, JSON.stringify({ nodes, edges: [] }));
    }
}

function makeMockApp(vault) {
    return { vault };
}

// ===========================================================================
// Test Suite: findFlowCanvasForDialogue
// ===========================================================================

describe('findFlowCanvasForDialogue (BUG-05 reverse navigation)', () => {
    // -----------------------------------------------------------------------
    // Test 1: finds the flow canvas that references the dialogue
    // -----------------------------------------------------------------------

    it('finds the canvas whose file node references the dialogue', async () => {
        const vault = new MockVault();
        vault.addCanvas('Flows/ch1.canvas', ['Dialogues/Innkeeper.ncanvas']);
        vault.addCanvas('Flows/ch2.canvas', ['Dialogues/TownGate.ncanvas']);
        const app = makeMockApp(vault);

        const found = await findFlowCanvasForDialogue(app, 'Dialogues/Innkeeper.ncanvas');

        assert.strictEqual(found.length, 1);
        assert.strictEqual(found[0].path, 'Flows/ch1.canvas');
    });

    // -----------------------------------------------------------------------
    // Test 2: multiple canvases referencing the same dialogue
    // -----------------------------------------------------------------------

    it('returns all canvases when several reference the dialogue', async () => {
        const vault = new MockVault();
        vault.addCanvas('Flows/ch1.canvas', ['Dialogues/Innkeeper.ncanvas']);
        vault.addCanvas('Flows/ch2.canvas', ['Dialogues/Innkeeper.ncanvas']);
        const app = makeMockApp(vault);

        const found = await findFlowCanvasForDialogue(app, 'Dialogues/Innkeeper.ncanvas');

        assert.strictEqual(found.length, 2);
        const paths = found.map(f => f.path).sort();
        assert.deepStrictEqual(paths, ['Flows/ch1.canvas', 'Flows/ch2.canvas']);
    });

    // -----------------------------------------------------------------------
    // Test 3: no canvas references the dialogue
    // -----------------------------------------------------------------------

    it('returns an empty array when nothing references the dialogue', async () => {
        const vault = new MockVault();
        vault.addCanvas('Flows/ch1.canvas', ['Dialogues/Other.ncanvas']);
        const app = makeMockApp(vault);

        const found = await findFlowCanvasForDialogue(app, 'Dialogues/Missing.ncanvas');

        assert.strictEqual(found.length, 0);
        assert.deepStrictEqual(found, []);
    });

    // -----------------------------------------------------------------------
    // Test 4: unparseable canvases are skipped without throwing
    // -----------------------------------------------------------------------

    it('skips unparseable canvases and does not throw', async () => {
        const vault = new MockVault();
        vault.addCanvas('Flows/ch1.canvas', ['Dialogues/Innkeeper.ncanvas']);
        vault.addFile('Flows/broken.canvas', '{ not valid json !!! ');
        const app = makeMockApp(vault);

        const found = await findFlowCanvasForDialogue(app, 'Dialogues/Innkeeper.ncanvas');

        assert.strictEqual(found.length, 1);
        assert.strictEqual(found[0].path, 'Flows/ch1.canvas');
    });
});

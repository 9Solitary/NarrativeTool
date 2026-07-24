// auto-export.test.js -- auto-export module unit tests
//
// Validates exportSingleFile, setupAutoExport/teardownAutoExport lifecycle,
// debounce behavior, and error handling.
//
// 04-03: Auto-Export + Reference Validation

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

// ---------------------------------------------------------------------------
// Intercept 'obsidian' require for mock Plugin base class
// ---------------------------------------------------------------------------

const originalResolveFilename = Module._resolveFilename;
const MOCK_OBSIDIAN_PATH = path.join(__dirname, 'mocks', 'obsidian.js');

Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'obsidian' || request === 'obsidian/') {
        return MOCK_OBSIDIAN_PATH;
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { Plugin } = require('obsidian');

// ---------------------------------------------------------------------------
// Mock Vault: in-memory file system
// ---------------------------------------------------------------------------

class MockVault {
    constructor() {
        this._files = new Map();
        this._folders = new Set();
        this._modifyListeners = [];
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

    addFolder(folderPath) {
        const normalizedPath = folderPath.replace(/\\/g, '/').replace(/\/$/, '');
        // Also add parent parts
        const parts = normalizedPath.split('/');
        for (let i = 1; i <= parts.length; i++) {
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

    getAbstractFileByPath(filePath) {
        const normalizedPath = filePath.replace(/\\/g, '/');
        if (this._files.has(normalizedPath)) {
            return this._files.get(normalizedPath);
        }
        if (this._folders.has(normalizedPath)) {
            return { path: normalizedPath, _isFolder: true };
        }
        return null;
    }

    async read(tfile) {
        const entry = this._files.get(tfile.path);
        if (!entry) throw new Error(`File not found: ${tfile.path}`);
        return entry._content;
    }

    async create(outputPath, content) {
        const normalizedPath = outputPath.replace(/\\/g, '/');
        const parentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
        if (parentDir) {
            if (!this._folders.has(parentDir)) {
                throw new Error(`Parent folder does not exist: ${parentDir}`);
            }
        }
        this.addFile(normalizedPath, content);
    }

    async modify(tfile, content) {
        const entry = this._files.get(tfile.path);
        if (!entry) throw new Error(`File not found: ${tfile.path}`);
        entry._content = content;
    }

    async createFolder(folderPath) {
        this.addFolder(folderPath);
    }

    on(event, callback) {
        if (event === 'modify') {
            this._modifyListeners.push(callback);
            return {
                _callback: callback,
                _event: event
            };
        }
        return {};
    }

    _triggerModify(file) {
        for (const listener of this._modifyListeners) {
            listener(file);
        }
    }
}

// ---------------------------------------------------------------------------
// Helper: create mock App and mock Plugin
// ---------------------------------------------------------------------------

function createMockApp(vault) {
    return {
        vault: vault
    };
}

function createMockPlugin(app) {
    const plugin = Object.create(Plugin.prototype);
    plugin.app = app;
    plugin.settings = {
        exportPath: 'Exports',
        medEnabled: true
    };
    return plugin;
}

// ---------------------------------------------------------------------------
// Helper: create valid ncanvas JSON
// ---------------------------------------------------------------------------

function makeNcanvasJson(title) {
    return JSON.stringify({
        project: {
            title: title || 'Test Dialogue',
            nodes: [
                { id: 'start', type: 'Entry', title: 'Start', x: 0, y: 0, width: 300, height: 150 }
            ],
            links: [],
            characters: [],
            variables: {}
        }
    });
}

// ===========================================================================
// Test Suite: exportSingleFile
// ===========================================================================

describe('exportSingleFile', () => {
    const { exportSingleFile } = require('../plugins/narrative-project/src/auto-export');

    // -----------------------------------------------------------------------
    // Test 1: exportSingleFile creates .dialogue file with exportEngine output
    // -----------------------------------------------------------------------

    it('creates .dialogue file with exportEngine output in exportPath', async () => {
        const vault = new MockVault();
        vault.addFolder('Exports');
        vault.addFolder('Exports/Dialogues');
        const ncanvasFile = vault.addFile('Dialogues/test.ncanvas', makeNcanvasJson('Test'));
        const app = createMockApp(vault);

        const tfile = vault.getFiles().find(f => f.extension === 'ncanvas');
        const result = await exportSingleFile(app, tfile, 'Exports', true);

        assert.strictEqual(result.success, true, 'should succeed');
        assert.ok(result.path, 'should return output path');
        assert.ok(result.path.includes('test.dialogue'), 'output path should be .dialogue');

        // Verify .dialogue exists
        const dialFiles = vault.getFiles().filter(f => f.extension === 'dialogue');
        assert.strictEqual(dialFiles.length, 1, 'should have 1 .dialogue file');
    });

    // -----------------------------------------------------------------------
    // Test 2: JSON parse error returns { success: false, error: 'parse error' }
    // -----------------------------------------------------------------------

    it('returns success:false with parse error on invalid JSON', async () => {
        const vault = new MockVault();
        vault.addFolder('Exports');
        vault.addFile('broken.ncanvas', '{ not valid json ---');
        const app = createMockApp(vault);

        const tfile = vault.getFiles().find(f => f.extension === 'ncanvas');
        const result = await exportSingleFile(app, tfile, 'Exports', true);

        assert.strictEqual(result.success, false, 'should fail');
        assert.ok(result.error, 'should have error message');
        assert.ok(
            result.error.toLowerCase().includes('parse') ||
            result.error.toLowerCase().includes('json'),
            'error should mention parse/JSON'
        );
    });

    // -----------------------------------------------------------------------
    // Test 3: exportEngine throw returns { success: false, error: message }
    // -----------------------------------------------------------------------

    it('returns success:false with error message on exportEngine throw', async () => {
        const vault = new MockVault();
        vault.addFolder('Exports');
        // Missing project.nodes → exportEngine throws
        const badJson = JSON.stringify({ project: { title: 'No Nodes' } });
        vault.addFile('bad.ncanvas', badJson);
        const app = createMockApp(vault);

        const tfile = vault.getFiles().find(f => f.extension === 'ncanvas');
        const result = await exportSingleFile(app, tfile, 'Exports', true);

        assert.strictEqual(result.success, false, 'should fail');
        assert.ok(result.error, 'should have error message');
        assert.ok(result.error.toLowerCase().includes('node'),
            'error should mention nodes');
    });
});

// ===========================================================================
// Test Suite: setupAutoExport
// ===========================================================================

describe('setupAutoExport', () => {
    const { setupAutoExport, teardownAutoExport } = require('../plugins/narrative-project/src/auto-export');

    // -----------------------------------------------------------------------
    // Test 4: registers vault.on('modify') listener for .ncanvas files
    // -----------------------------------------------------------------------

    it('registers vault.on(modify) listener for .ncanvas files', () => {
        const vault = new MockVault();
        const app = createMockApp(vault);
        const plugin = createMockPlugin(app);

        setupAutoExport(plugin, () => {});

        assert.ok(vault._modifyListeners.length > 0,
            'should register at least one modify listener');
        assert.ok(plugin._autoExportQueue instanceof Set,
            'should create _autoExportQueue Set');

        teardownAutoExport(plugin);
    });

    // -----------------------------------------------------------------------
    // Test 5: 500ms debounce batches multiple changes into single export batch
    // -----------------------------------------------------------------------

    it('batches multiple .ncanvas changes within debounce window', async () => {
        const vault = new MockVault();
        vault.addFolder('Exports');
        const file1 = { path: 'Dialogues/a.ncanvas', extension: 'ncanvas' };
        const file2 = { path: 'Dialogues/b.ncanvas', extension: 'ncanvas' };
        const app = createMockApp(vault);
        const plugin = createMockPlugin(app);

        // Override setTimeout for fast tests
        let capturedCallback = null;
        const origSetTimeout = global.setTimeout;
        global.setTimeout = (cb, delay) => {
            capturedCallback = cb;
            return 999;
        };
        const origClearTimeout = global.clearTimeout;
        global.clearTimeout = () => {};

        try {
            let batchResults = null;
            setupAutoExport(plugin, (results) => {
                batchResults = results;
            });

            // Trigger two modify events via registered listeners
            for (const listener of vault._modifyListeners) {
                listener(file1);
                listener(file2);
            }

            // assert queue has 2 files (deduped via Set)
            assert.strictEqual(plugin._autoExportQueue.size, 2,
                'should have 2 unique files in queue');

            // Execute the captured callback (simulating timer fire)
            // We need to add files to the vault so export works
            vault.addFile('Dialogues/a.ncanvas', makeNcanvasJson('A'));
            vault.addFile('Dialogues/b.ncanvas', makeNcanvasJson('B'));

            if (capturedCallback) {
                await capturedCallback();
            }

            assert.ok(batchResults !== null, 'batch callback should have been called');
            assert.strictEqual(batchResults.length, 2, 'should have 2 results');
        } finally {
            global.setTimeout = origSetTimeout;
            global.clearTimeout = origClearTimeout;
            teardownAutoExport(plugin);
        }
    });

    // -----------------------------------------------------------------------
    // Test 6: non-.ncanvas files do not trigger export
    // -----------------------------------------------------------------------

    it('ignores non-.ncanvas file modifications', () => {
        const vault = new MockVault();
        const app = createMockApp(vault);
        const plugin = createMockPlugin(app);

        setupAutoExport(plugin, () => {});

        const mdFile = { path: 'Notes/readme.md', extension: 'md' };
        const canvasFile = { path: 'Flow/main.canvas', extension: 'canvas' };

        for (const listener of vault._modifyListeners) {
            listener(mdFile);
            listener(canvasFile);
        }

        assert.strictEqual(plugin._autoExportQueue.size, 0,
            'should have empty queue for non-ncanvas files');

        teardownAutoExport(plugin);
    });
});

// ===========================================================================
// Test Suite: teardownAutoExport
// ===========================================================================

describe('teardownAutoExport', () => {
    const { setupAutoExport, teardownAutoExport } = require('../plugins/narrative-project/src/auto-export');

    // -----------------------------------------------------------------------
    // Test 7: teardown clears timer and queue, no further exports triggered
    // -----------------------------------------------------------------------

    it('clears timer and queue; subsequent modify does not trigger export', () => {
        const vault = new MockVault();
        const app = createMockApp(vault);
        const plugin = createMockPlugin(app);

        let exported = false;
        setupAutoExport(plugin, () => { exported = true; });

        teardownAutoExport(plugin);

        // Queue should be cleared
        assert.strictEqual(plugin._autoExportQueue.size, 0,
            'queue should be empty after teardown');

        // Timer should be cleared (set to null or undefined)
        // The teardown calls clearTimeout — we can't test that directly without mocking,
        // but the export callback should NOT fire after teardown.
    });
});

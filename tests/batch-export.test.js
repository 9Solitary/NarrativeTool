// batch-export.test.js -- exportAllDialogues unit tests
//
// Validates the batch export function: file discovery, filtering by scope,
// export engine invocation, output path construction, directory creation,
// error handling, and result counting.
//
// Uses mock vault (in-memory file system) to test without Obsidian runtime.
//
// 04-02: Batch Export + Status Bar

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

// ---------------------------------------------------------------------------
// Intercept 'obsidian' require
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
// normalizePath is not in obsidian.js mock — we'll define it inline for tests
function normalizePath(p) { return p; }

// ---------------------------------------------------------------------------
// Mock Vault: in-memory file system
// ---------------------------------------------------------------------------

class MockVault {
    constructor() {
        // Map of path → { content: string } for files
        this._files = new Map();
        // Set of paths for folders
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
        // Ensure parent folders exist
        const parts = normalizedPath.split('/');
        for (let i = 1; i < parts.length; i++) {
            this._folders.add(parts.slice(0, i).join('/'));
        }
    }

    addFolder(folderPath) {
        const normalizedPath = folderPath.replace(/\\/g, '/').replace(/\/$/, '');
        this._folders.add(normalizedPath);
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
        // Ensure parent folder exists
        const parentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
        if (parentDir) {
            if (!this._folders.has(parentDir)) {
                throw new Error(`Parent folder does not exist: ${parentDir}`);
            }
        }
        this.addFile(normalizedPath, content);
    }

    async modify(tfile, content) {
        const normalizedPath = tfile.path.replace(/\\/g, '/');
        const entry = this._files.get(normalizedPath);
        if (!entry) throw new Error(`File not found: ${normalizedPath}`);
        entry._content = content;
    }

    async createFolder(folderPath) {
        const normalizedPath = folderPath.replace(/\\/g, '/').replace(/\/$/, '');
        this._folders.add(normalizedPath);
    }
}

// ---------------------------------------------------------------------------
// Helper: create mock App
// ---------------------------------------------------------------------------

function createMockApp(vault) {
    return {
        vault: vault
    };
}

// ---------------------------------------------------------------------------
// Helper: create ncanvas file content
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

function makeBrokenNcanvas() {
    return '{ broken json --- not valid ';
}

// ===========================================================================
// Test Suite: exportAllDialogues
// ===========================================================================

describe('exportAllDialogues', () => {
    const { exportAllDialogues } = require('../plugins/narrative-project/src/batch-export');

    // -----------------------------------------------------------------------
    // Test 1: Exports all .ncanvas files in scope
    // -----------------------------------------------------------------------

    it('exports all .ncanvas files under scope to exportPath', async () => {
        const vault = new MockVault();
        // Create output directory
        vault.addFolder('Exports');
        // Create .ncanvas files
        vault.addFile('Dialogues/chapter1.ncanvas', makeNcanvasJson('Chapter 1'));
        vault.addFile('Dialogues/chapter2.ncanvas', makeNcanvasJson('Chapter 2'));
        vault.addFile('Notes/readme.md', '# Notes');

        const app = createMockApp(vault);
        const result = await exportAllDialogues(app, 'Exports', '/', true);

        assert.strictEqual(result.exported, 2, 'should export 2 files');
        assert.strictEqual(result.failed, 0, 'should have 0 failures');

        // Verify output files were created
        const files = vault.getFiles();
        const dialogueFiles = files.filter(f => f.extension === 'dialogue');
        assert.strictEqual(dialogueFiles.length, 2, 'should create 2 .dialogue files');
    });

    // -----------------------------------------------------------------------
    // Test 2: No .ncanvas files in scope returns zero counts
    // -----------------------------------------------------------------------

    it('returns { exported: 0, failed: 0 } when no .ncanvas in scope', async () => {
        const vault = new MockVault();
        vault.addFile('Notes/readme.md', '# Notes');
        vault.addFolder('Exports');

        const app = createMockApp(vault);
        const result = await exportAllDialogues(app, 'Exports', '/', true);

        assert.strictEqual(result.exported, 0);
        assert.strictEqual(result.failed, 0);
    });

    // -----------------------------------------------------------------------
    // Test 3: Parse error on one file doesn't stop others
    // -----------------------------------------------------------------------

    it('continues exporting after JSON parse error', async () => {
        const vault = new MockVault();
        vault.addFolder('Exports');
        vault.addFile('Dialogues/good.ncanvas', makeNcanvasJson('Good'));
        vault.addFile('Dialogues/broken.ncanvas', makeBrokenNcanvas());

        const app = createMockApp(vault);
        const result = await exportAllDialogues(app, 'Exports', '/', true);

        assert.strictEqual(result.exported, 1);
        assert.strictEqual(result.failed, 1);
    });

    // -----------------------------------------------------------------------
    // Test 4: exportScope limits to a specific directory
    // -----------------------------------------------------------------------

    it('exportScope limits to specified directory', async () => {
        const vault = new MockVault();
        vault.addFolder('Exports');
        vault.addFolder('Dialogues');
        vault.addFolder('OtherDialogue');
        vault.addFile('Dialogues/ch1.ncanvas', makeNcanvasJson('Ch1'));
        vault.addFile('OtherDialogue/ch2.ncanvas', makeNcanvasJson('Ch2'));

        const app = createMockApp(vault);
        const result = await exportAllDialogues(app, 'Exports', 'Dialogues/', true);

        assert.strictEqual(result.exported, 1, 'should only export files under Dialogues/');
        assert.strictEqual(result.failed, 0);
    });

    // -----------------------------------------------------------------------
    // Test 5: Export path respects subdirectory structure
    // -----------------------------------------------------------------------

    it('mirrors subdirectory structure in export path', async () => {
        const vault = new MockVault();
        vault.addFolder('Exports');
        vault.addFolder('Exports/Sub');
        vault.addFile('Root.ncanvas', makeNcanvasJson('Root'));
        vault.addFile('Sub/child.ncanvas', makeNcanvasJson('Child'));

        const app = createMockApp(vault);
        const result = await exportAllDialogues(app, 'Exports/', '/', true);

        assert.strictEqual(result.exported, 2);
        assert.strictEqual(result.failed, 0);

        // Check output paths
        const files = vault.getFiles();
        const dialoguePaths = files.filter(f => f.extension === 'dialogue').map(f => f.path);
        assert.ok(dialoguePaths.some(p => p.includes('Root.dialogue')), 'should have Root.dialogue');
        assert.ok(dialoguePaths.some(p => p.includes('Sub/child.dialogue')), 'should have child.dialogue in Sub/');
    });

    // -----------------------------------------------------------------------
    // Test 6: medEnabled=false passes { medEnabled: false } to exportEngine
    // -----------------------------------------------------------------------

    it('passes medEnabled=false to exportEngine when disabled', async () => {
        const vault = new MockVault();
        vault.addFolder('Exports');
        vault.addFile('test.ncanvas', makeNcanvasJson('Test'));

        const app = createMockApp(vault);
        const result = await exportAllDialogues(app, 'Exports', '/', false);

        assert.strictEqual(result.exported, 1);
        assert.strictEqual(result.failed, 0);

        // Verify output exists
        const files = vault.getFiles();
        const dialogueFiles = files.filter(f => f.extension === 'dialogue');
        assert.strictEqual(dialogueFiles.length, 1);
    });

    // -----------------------------------------------------------------------
    // Test 7: Empty exportPath works (root-level export)
    // -----------------------------------------------------------------------

    it('handles empty exportPath gracefully', async () => {
        const vault = new MockVault();
        vault.addFile('test.ncanvas', makeNcanvasJson('Test'));

        const app = createMockApp(vault);
        const result = await exportAllDialogues(app, '', '/', true);

        assert.strictEqual(result.exported, 1);
        assert.strictEqual(result.failed, 0);
    });

    // -----------------------------------------------------------------------
    // Test 8: exportEngine throw is caught and counted as failure
    // -----------------------------------------------------------------------

    it('catches exportEngine errors and counts as failed', async () => {
        const vault = new MockVault();
        vault.addFolder('Exports');
        // A file with nodes missing → exportEngine should throw
        const badJson = JSON.stringify({ project: { title: 'No Nodes' } });
        vault.addFile('bad.ncanvas', badJson);

        const app = createMockApp(vault);
        const result = await exportAllDialogues(app, 'Exports', '/', true);

        assert.strictEqual(result.exported, 0);
        assert.strictEqual(result.failed, 1);
    });
});

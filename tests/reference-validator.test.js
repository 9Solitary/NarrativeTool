// reference-validator.test.js -- validateReferences unit tests
//
// Validates Flow→Dialogue cross-file reference integrity checking:
// scans .canvas files for file-type nodes pointing to .ncanvas files,
// checks that referenced files exist in the vault, and reports broken refs.
//
// 04-03: Auto-Export + Reference Validation

const { describe, it } = require('node:test');
const assert = require('node:assert');

// ---------------------------------------------------------------------------
// Mock Vault: in-memory file system
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

    addFolder(folderPath) {
        const normalizedPath = folderPath.replace(/\\/g, '/').replace(/\/$/, '');
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
        this.addFile(normalizedPath, content);
    }

    async modify(tfile, content) {
        const entry = this._files.get(tfile.path);
        if (!entry) throw new Error(`File not found: ${tfile.path}`);
        entry._content = content;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockApp(vault) {
    return { vault: vault };
}

/**
 * Create .canvas JSON content with given nodes array.
 */
function makeCanvasJson(nodes) {
    return JSON.stringify({ nodes: nodes || [], edges: [] });
}

/**
 * Create a file-type node referencing a .ncanvas file.
 */
function makeFileNode(id, filePath) {
    return {
        id: id || 'a1b2c3d4e5f6a7b8',
        type: 'file',
        file: filePath,
        x: 0,
        y: 0,
        width: 400,
        height: 200
    };
}

/**
 * Create a text-type node (should be ignored by validator).
 */
function makeTextNode(id) {
    return {
        id: id || 'text1234567890ab',
        type: 'text',
        text: 'Some text',
        x: 0,
        y: 0,
        width: 400,
        height: 200
    };
}

/**
 * Create a group-type node (should be ignored by validator).
 */
function makeGroupNode(id) {
    return {
        id: id || 'group123456789ab',
        type: 'group',
        x: 0,
        y: 0,
        width: 400,
        height: 200
    };
}

// ===========================================================================
// Test Suite: validateReferences
// ===========================================================================

describe('validateReferences', () => {
    const { validateReferences } = require('../plugins/narrative-tool/src/commands/reference-validator');

    // -----------------------------------------------------------------------
    // Test 1: Scans .canvas files, extracts file nodes → .ncanvas refs
    // -----------------------------------------------------------------------

    it('scans .canvas files and extracts file node .ncanvas references', async () => {
        const vault = new MockVault();
        // Create .ncanvas files that are referenced
        vault.addFile('Dialogues/chapter1.ncanvas', '{}');
        vault.addFile('Dialogues/chapter2.ncanvas', '{}');
        // Create a .canvas file with file nodes referencing them
        vault.addFile('Flow/main.canvas', makeCanvasJson([
            makeFileNode('node1', 'Dialogues/chapter1.ncanvas'),
            makeFileNode('node2', 'Dialogues/chapter2.ncanvas')
        ]));

        const app = createMockApp(vault);
        const result = await validateReferences(app);

        assert.strictEqual(result.totalRefs, 2, 'should have 2 total refs');
        assert.strictEqual(result.brokenRefs, 0, 'should have 0 broken refs');
        assert.strictEqual(result.details.length, 0, 'details should be empty');
    });

    // -----------------------------------------------------------------------
    // Test 2: Valid .ncanvas reference → brokenRefs = 0
    // -----------------------------------------------------------------------

    it('reports brokenRefs: 0 when all .ncanvas references are valid', async () => {
        const vault = new MockVault();
        vault.addFile('Dialogues/quest1.ncanvas', '{}');
        vault.addFile('Flow/story.canvas', makeCanvasJson([
            makeFileNode('n1', 'Dialogues/quest1.ncanvas')
        ]));

        const app = createMockApp(vault);
        const result = await validateReferences(app);

        assert.strictEqual(result.totalRefs, 1);
        assert.strictEqual(result.brokenRefs, 0);
    });

    // -----------------------------------------------------------------------
    // Test 3: Missing .ncanvas → brokenRefs > 0 with details
    // -----------------------------------------------------------------------

    it('reports brokenRefs with details for missing .ncanvas files', async () => {
        const vault = new MockVault();
        vault.addFile('Flow/story.canvas', makeCanvasJson([
            makeFileNode('badRef', 'Dialogues/deleted.ncanvas'),
            makeFileNode('goodRef', 'Dialogues/exists.ncanvas')
        ]));
        vault.addFile('Dialogues/exists.ncanvas', '{}');

        const app = createMockApp(vault);
        const result = await validateReferences(app);

        assert.strictEqual(result.totalRefs, 2, 'should count both refs');
        assert.strictEqual(result.brokenRefs, 1, 'should have 1 broken ref');
        assert.strictEqual(result.details.length, 1, 'should have 1 detail entry');

        const broken = result.details[0];
        assert.strictEqual(broken.canvasPath, 'Flow/story.canvas');
        assert.strictEqual(broken.nodeId, 'badRef');
        assert.strictEqual(broken.referencedFile, 'Dialogues/deleted.ncanvas');
        assert.ok(broken.reason, 'should have a reason');
    });

    // -----------------------------------------------------------------------
    // Test 4: Non-file type nodes (text, group) are ignored
    // -----------------------------------------------------------------------

    it('ignores text and group type nodes', async () => {
        const vault = new MockVault();
        vault.addFile('Flow/mixed.canvas', makeCanvasJson([
            makeTextNode('text1'),
            makeGroupNode('grp1'),
            makeFileNode('fil1', 'Dialogues/real.ncanvas')
        ]));
        vault.addFile('Dialogues/real.ncanvas', '{}');

        const app = createMockApp(vault);
        const result = await validateReferences(app);

        assert.strictEqual(result.totalRefs, 1, 'should only count file nodes');
        assert.strictEqual(result.brokenRefs, 0);
    });

    // -----------------------------------------------------------------------
    // Test 5: File nodes pointing to non-.ncanvas extensions skipped
    // -----------------------------------------------------------------------

    it('skips file nodes pointing to .md or .canvas files', async () => {
        const vault = new MockVault();
        vault.addFile('Flow/links.canvas', makeCanvasJson([
            makeFileNode('mdRef', 'Notes/readme.md'),
            makeFileNode('canvasRef', 'Flow/other.canvas'),
            makeFileNode('ncanvasRef', 'Dialogues/game.ncanvas')
        ]));
        vault.addFile('Dialogues/game.ncanvas', '{}');

        const app = createMockApp(vault);
        const result = await validateReferences(app);

        assert.strictEqual(result.totalRefs, 1, 'should only count .ncanvas refs');
        assert.strictEqual(result.brokenRefs, 0);
    });

    // -----------------------------------------------------------------------
    // Test 6: Vault with no .canvas files returns zeros
    // -----------------------------------------------------------------------

    it('returns zero counts when vault has no .canvas files', async () => {
        const vault = new MockVault();
        vault.addFile('Dialogues/test.ncanvas', '{}');
        vault.addFile('Notes/readme.md', '# Notes');

        const app = createMockApp(vault);
        const result = await validateReferences(app);

        assert.strictEqual(result.totalRefs, 0);
        assert.strictEqual(result.brokenRefs, 0);
        assert.strictEqual(result.details.length, 0);
    });

    // -----------------------------------------------------------------------
    // Test 7: Invalid .canvas JSON → continues processing other files
    // -----------------------------------------------------------------------

    it('handles invalid .canvas JSON and continues processing others', async () => {
        const vault = new MockVault();
        vault.addFile('Flow/broken.canvas', '{ not valid json ---');
        vault.addFile('Flow/valid.canvas', makeCanvasJson([
            makeFileNode('n1', 'Dialogues/exists.ncanvas')
        ]));
        vault.addFile('Dialogues/exists.ncanvas', '{}');

        const app = createMockApp(vault);
        const result = await validateReferences(app);

        // The broken canvas should not crash — it's noted but processing continues
        assert.ok(result.totalRefs >= 1, 'should count refs from valid canvas');
        // broken.canvas should be reported in details
        const brokenEntry = result.details.find(d =>
            d.canvasPath === 'Flow/broken.canvas' || d.reason.includes('JSON') || d.reason.includes('parse')
        );
        assert.ok(brokenEntry, 'should report broken canvas JSON in details');
    });
});

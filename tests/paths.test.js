// paths.test.js -- Shared export-path decision + write module tests
//
// Proves the BUG-02/BUG-03 fix behavior at the module level:
//   - Group A/E: isAbsoluteExportPath detection (incl. Windows drive forms)
//   - Group B:   vault-relative export path → vault API, folders created
//   - Group C:   absolute export path → node fs, file exists ON DISK
//   - Group D:   empty export path → alongside source (vault mode)
//
// paths.js imports node:fs and node:path only — no obsidian mock needed.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { isAbsoluteExportPath, writeDialogueFile } = require('../plugins/narrative-tool/src/commands/paths');

// ---------------------------------------------------------------------------
// Mock Vault: in-memory file system (same shape as batch-export.test.js)
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

function createMockApp(vault) {
    return { vault };
}

// ===========================================================================
// Group A: isAbsoluteExportPath detection
// ===========================================================================

describe('isAbsoluteExportPath', () => {
    it('detects Windows drive paths with backslashes as absolute', () => {
        assert.strictEqual(isAbsoluteExportPath('D:\\Godot\\dialogues\\'), true);
    });

    it('detects Windows drive paths with forward slashes as absolute', () => {
        assert.strictEqual(isAbsoluteExportPath('D:/Godot/dialogues'), true);
    });

    it('detects POSIX absolute paths as absolute', () => {
        assert.strictEqual(isAbsoluteExportPath('/abs/dialogue'), true);
    });

    it('treats vault-relative paths as NOT absolute', () => {
        assert.strictEqual(isAbsoluteExportPath('Exports'), false);
        assert.strictEqual(isAbsoluteExportPath('Exports/Sub'), false);
    });

    it('treats drive-relative D:foo as NOT absolute (documented decision)', () => {
        assert.strictEqual(isAbsoluteExportPath('D:foo'), false);
    });

    it('treats empty string as NOT absolute', () => {
        assert.strictEqual(isAbsoluteExportPath(''), false);
    });
});

// ===========================================================================
// Group B: vault-relative export path
// ===========================================================================

describe('writeDialogueFile (vault-relative)', () => {
    it('writes into the export path via vault API and creates the folder', async () => {
        const vault = new MockVault();
        vault.addFile('Dialogues/test.ncanvas', '{}');
        const app = createMockApp(vault);
        const sourceFile = vault.getFiles().find(f => f.extension === 'ncanvas');

        const result = await writeDialogueFile(app, 'Exports', 'test.dialogue', sourceFile, 'content');

        assert.deepStrictEqual(result, { mode: 'vault', path: 'Exports/test.dialogue' });
        const written = vault.getAbstractFileByPath('Exports/test.dialogue');
        assert.ok(written, 'file should exist in mock vault under Exports/');
        assert.strictEqual(written._content, 'content');
    });

    it('creates nested folders for a multi-segment export path', async () => {
        const vault = new MockVault();
        vault.addFile('Dialogues/test.ncanvas', '{}');
        const app = createMockApp(vault);
        const sourceFile = vault.getFiles().find(f => f.extension === 'ncanvas');

        const result = await writeDialogueFile(app, 'Exports/Sub', 'test.dialogue', sourceFile, 'content');

        assert.deepStrictEqual(result, { mode: 'vault', path: 'Exports/Sub/test.dialogue' });
        assert.ok(vault.getAbstractFileByPath('Exports/Sub'), 'Exports/Sub folder should exist');
        assert.ok(vault.getAbstractFileByPath('Exports/Sub/test.dialogue'), 'file should exist in Exports/Sub/');
    });

    it('modifies an existing file instead of creating a duplicate', async () => {
        const vault = new MockVault();
        vault.addFolder('Exports');
        vault.addFile('Exports/test.dialogue', 'old content');
        vault.addFile('Dialogues/test.ncanvas', '{}');
        const app = createMockApp(vault);
        const sourceFile = vault.getFiles().find(f => f.extension === 'ncanvas');

        await writeDialogueFile(app, 'Exports', 'test.dialogue', sourceFile, 'new content');

        const files = vault.getFiles().filter(f => f.extension === 'dialogue');
        assert.strictEqual(files.length, 1, 'should still be exactly 1 dialogue file');
        assert.strictEqual(vault.getAbstractFileByPath('Exports/test.dialogue')._content, 'new content');
    });
});

// ===========================================================================
// Group C: absolute export path → node fs, file ON DISK
// ===========================================================================

describe('writeDialogueFile (absolute)', () => {
    it('writes to disk via fs and creates the directory recursively', async () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nt-paths-'));
        try {
            const nested = path.join(tmp, 'deep', 'nested');
            const vault = new MockVault();
            const app = createMockApp(vault);
            const sourceFile = { path: 'Dialogues/test.ncanvas', basename: 'test' };

            const result = await writeDialogueFile(app, nested, 'test.dialogue', sourceFile, 'disk content');

            assert.strictEqual(result.mode, 'absolute');
            assert.strictEqual(result.path, path.join(nested, 'test.dialogue'));
            assert.ok(fs.existsSync(result.path), 'file should exist on disk');
            assert.strictEqual(fs.readFileSync(result.path, 'utf-8'), 'disk content');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

// ===========================================================================
// Group D: empty export path → alongside source (vault mode)
// ===========================================================================

describe('writeDialogueFile (empty export path)', () => {
    it('writes alongside the source file via vault API', async () => {
        const vault = new MockVault();
        vault.addFile('Dialogues/Innkeeper.ncanvas', '{}');
        const app = createMockApp(vault);
        const sourceFile = vault.getFiles().find(f => f.extension === 'ncanvas');

        const result = await writeDialogueFile(app, '', 'Innkeeper.dialogue', sourceFile, 'content');

        assert.deepStrictEqual(result, { mode: 'vault', path: 'Dialogues/Innkeeper.dialogue' });
        assert.ok(vault.getAbstractFileByPath('Dialogues/Innkeeper.dialogue'),
            'file should exist alongside the source');
    });

    it('honors a disambiguated outFilename in the source directory (CR-01)', async () => {
        const vault = new MockVault();
        vault.addFile('Dialogues/Sub/Innkeeper.ncanvas', '{}');
        const app = createMockApp(vault);
        const sourceFile = vault.getFiles().find(f => f.extension === 'ncanvas');

        const result = await writeDialogueFile(app, '', 'Sub-Innkeeper.dialogue', sourceFile, 'content');

        assert.deepStrictEqual(result, { mode: 'vault', path: 'Dialogues/Sub/Sub-Innkeeper.dialogue' });
        assert.ok(vault.getAbstractFileByPath('Dialogues/Sub/Sub-Innkeeper.dialogue'),
            'disambiguated file should exist alongside the source');
    });
});

// ===========================================================================
// Group E: Windows path variants
// ===========================================================================

describe('Windows path variants', () => {
    it('detects trailing-backslash drive paths as absolute', () => {
        assert.strictEqual(isAbsoluteExportPath('D:\\Godot\\dialogues\\'), true);
    });

    it('detects lowercase drive letters as absolute', () => {
        assert.strictEqual(isAbsoluteExportPath('d:/godot/dialogues'), true);
    });
});

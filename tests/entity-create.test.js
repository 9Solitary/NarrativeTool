// entity-create.test.js -- Entity creation workflow tests (WR-03)
//
// Verifies that _createEntityFromCommand writes the SLUGIFIED id into the
// entity frontmatter (matching the slugified filename), and notifies when
// the user's raw id was normalized. Raw ids like "Bob Smith" previously
// produced `id: "Bob Smith"` in bob-smith.md, silently breaking quest
// references that resolve against filenames.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

// ---------------------------------------------------------------------------
// Intercept 'obsidian' + main.js's './ui/modals' (promptForInput scripted)
// ---------------------------------------------------------------------------

const originalResolveFilename = Module._resolveFilename;
const MOCK_OBSIDIAN_PATH = path.join(__dirname, 'mocks', 'obsidian.js');
const MOCK_MODALS_PATH = path.join(__dirname, 'mocks', 'modals-prompt-queue.js');

Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'obsidian' || request === 'obsidian/') {
        return MOCK_OBSIDIAN_PATH;
    }
    // main.js (src/main.js) requires './ui/modals' — route it through the
    // scripted promptForInput test double. Other callers keep the real module.
    if (request === './ui/modals'
        && parent && parent.filename && parent.filename.endsWith('main.js')) {
        return MOCK_MODALS_PATH;
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
};

// main.js does require('./styles.css') (BUG-06 runtime injection)
Module._extensions['.css'] = function (mod, filename) {
    mod._compile('module.exports = /* css */ "";', filename);
};

const { Notice } = require('obsidian');
const { createCharacterMd } = require('../plugins/narrative-tool/src/flow/entity-templates');

// ---------------------------------------------------------------------------
// Minimal mock vault (shape from batch-export.test.js)
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

    getAbstractFileByPath(filePath) {
        const normalizedPath = filePath.replace(/\\/g, '/');
        if (this._files.has(normalizedPath)) return this._files.get(normalizedPath);
        if (this._folders.has(normalizedPath)) return { path: normalizedPath, _isFolder: true };
        return null;
    }

    async create(outputPath, content) {
        const normalizedPath = outputPath.replace(/\\/g, '/');
        const parentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
        if (parentDir && !this._folders.has(parentDir)) {
            throw new Error(`Parent folder does not exist: ${parentDir}`);
        }
        this.addFile(normalizedPath, content);
    }

    async createFolder(folderPath) {
        const normalizedPath = folderPath.replace(/\\/g, '/').replace(/\/$/, '');
        this._folders.add(normalizedPath);
    }
}

const CHARACTER_CMD = {
    modalTitle: 'Create Character',
    templateFn: createCharacterMd,
    defaultFolder: 'Characters',
    entityType: 'character',
};

// ===========================================================================
// Test Suite
// ===========================================================================

describe('NarrativeToolPlugin - _createEntityFromCommand (WR-03)', () => {
    let plugin;
    let vault;

    beforeEach(() => {
        Notice._all = [];
        Notice._last = null;
        vault = new MockVault();
        const app = {
            vault,
            workspace: {
                openLinkText: async () => {}
            }
        };
        // Loaded lazily per test so the Module interception applies at require time
        const NarrativeToolPlugin = require('../plugins/narrative-tool/src/main.js');
        plugin = new NarrativeToolPlugin(app, { version: '1.0.0' });
        plugin.saveData = async () => {};
        require('../plugins/narrative-tool/src/ui/modals'); // no-op warm
    });

    afterEach(() => {
        const modals = require('./mocks/modals-prompt-queue');
        modals.__setPromptQueue([]);
    });

    it('writes the slugified id into the frontmatter when the raw id has spaces (WR-03)', async () => {
        const modals = require('./mocks/modals-prompt-queue');
        modals.__setPromptQueue(['Bob Smith', 'Bob Smith']);

        await plugin._createEntityFromCommand(CHARACTER_CMD);

        const file = vault.getAbstractFileByPath('Characters/bob-smith.md');
        assert.ok(file, 'entity file should be named from the slug: Characters/bob-smith.md');
        assert.ok(file._content.includes('id: "bob-smith"'),
            `frontmatter id must be the slug, got:\n${file._content}`);
        assert.ok(!file._content.includes('id: "Bob Smith"'),
            'raw unslugified id must not be written to frontmatter');
    });

    it('notifies when the id was normalized to a filename-safe slug', async () => {
        const modals = require('./mocks/modals-prompt-queue');
        modals.__setPromptQueue(['Bob Smith', 'Bob Smith']);

        await plugin._createEntityFromCommand(CHARACTER_CMD);

        const normalized = (Notice._all || []).find(m => m.includes('ID normalized to "bob-smith"'));
        assert.ok(normalized, `expected a normalization notice, got: ${JSON.stringify(Notice._all)}`);
    });

    it('keeps a slug-safe id unchanged and emits no normalization notice', async () => {
        const modals = require('./mocks/modals-prompt-queue');
        modals.__setPromptQueue(['bob', 'Bob']);

        await plugin._createEntityFromCommand(CHARACTER_CMD);

        const file = vault.getAbstractFileByPath('Characters/bob.md');
        assert.ok(file, 'entity file should exist at Characters/bob.md');
        assert.ok(file._content.includes('id: "bob"'), 'slug-safe id should be written verbatim');

        const normalized = (Notice._all || []).find(m => m.includes('ID normalized'));
        assert.strictEqual(normalized, undefined,
            'no normalization notice expected for a slug-safe id');
    });
});

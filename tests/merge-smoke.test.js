// merge-smoke.test.js -- Smoke test for the merged narrative-tool plugin (05-04)
//
// Proves (ENG-01 / Plan 05-04):
//   - All 10 commands are registered with the narrative-tool: prefix (D-08)
//   - First-load settings migration from legacy plugin data.json (D-06)
//   - Migration skipped when the plugin's own data.json exists (guard)
//   - Settings tab + status bar are wired on load
//
// Uses the obsidian mock + a MockVault (shape copied from batch-export.test.js).
// NOTE: onload() calls _injectCanvasStyles() and _setupCanvasNodeTypeObserver()
// which touch `document` and a 1s setInterval poll — the test stubs a minimal
// global document and calls plugin.onunload() after each test to clear the
// interval so the node:test process can exit.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

// ---------------------------------------------------------------------------
// Intercept 'obsidian' require + register a CSS loader
// ---------------------------------------------------------------------------

const originalResolveFilename = Module._resolveFilename;
const MOCK_OBSIDIAN_PATH = path.join(__dirname, 'mocks', 'obsidian.js');

Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'obsidian' || request === 'obsidian/') {
        return MOCK_OBSIDIAN_PATH;
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
};

// main.js does require('./styles.css') (BUG-06 runtime injection) — make the
// text import loadable outside esbuild
Module._extensions['.css'] = function (mod, filename) {
    mod._compile('module.exports = /* css */ "";', filename);
};

const { Notice } = require('obsidian');

// Minimal global document for _injectCanvasStyles / _setupCanvasNodeTypeObserver
global.document = {
    getElementById: () => null,
    createElement: () => ({}),
    head: { appendChild() {} },
    querySelectorAll: () => []
};

// ---------------------------------------------------------------------------
// Mock Vault: in-memory file system (shape from batch-export.test.js)
// ---------------------------------------------------------------------------

class MockVault {
    constructor(adapter) {
        this._files = new Map();
        this._folders = new Set();
        this.adapter = adapter || {
            read: async () => { throw new Error('ENOENT'); }
        };
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
        if (parentDir && !this._folders.has(parentDir)) {
            throw new Error(`Parent folder does not exist: ${parentDir}`);
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

    on(event, cb) {
        // for setupAutoExport's vault.on('modify')
        return { event, cb };
    }
}

// Adapter with call tracking (migration tests)
function makeTrackingAdapter() {
    const calls = { reads: [] };
    return {
        calls,
        read: async (p) => {
            calls.reads.push(p);
            if (p === '.obsidian/plugins/narrative-project/data.json') {
                return JSON.stringify({ exportPath: 'Legacy/Path', medEnabled: false });
            }
            throw new Error('ENOENT');
        }
    };
}

function makeMockApp(vault) {
    return {
        vault,
        workspace: {
            getActiveFile: () => null,
            activeLeaf: null,
            on: () => ({})
        },
        plugins: {}
    };
}

// ===========================================================================
// Test Suite
// ===========================================================================

describe('NarrativeToolPlugin merge smoke test (05-04)', () => {
    const NarrativeToolPlugin = require('../plugins/narrative-tool/src/main.js');
    const { NarrativeToolSettingTab } = require('../plugins/narrative-tool/src/ui/settings');

    let plugin;
    let adapter;
    let vault;
    let app;
    let savedData;

    beforeEach(() => {
        Notice._all = [];
        Notice._last = null;
        adapter = makeTrackingAdapter();
        vault = new MockVault(adapter);
        app = makeMockApp(vault);
        savedData = null;
        plugin = new NarrativeToolPlugin(app, { version: '1.0.0' });
        plugin.saveData = async (data) => { savedData = data; };
    });

    afterEach(async () => {
        // Clear the 1s observer interval + timers so the process can exit
        await plugin.onunload();
    });

    // -----------------------------------------------------------------------
    // Test 1: command inventory — 10 commands, all with narrative-tool: prefix
    // -----------------------------------------------------------------------

    it('registers exactly 10 commands with the narrative-tool: prefix (D-08)', async () => {
        await plugin.onload();

        assert.strictEqual(plugin._commands.length, 10);

        const ids = plugin._commands.map(c => c.id);
        for (const id of ids) {
            assert.ok(id.startsWith('narrative-tool:'), `command id ${id} must start with narrative-tool:`);
        }

        const expected = [
            'narrative-tool:export-current-dialogue',
            'narrative-tool:batch-export-all-dialogues',
            'narrative-tool:validate-references',
            'narrative-tool:create-character',
            'narrative-tool:create-location',
            'narrative-tool:create-item',
            'narrative-tool:create-quest',
            'narrative-tool:create-flow-canvas',
            'narrative-tool:create-flow-fragment',
            'narrative-tool:open-flow-canvas',
        ].sort();

        assert.deepStrictEqual([...ids].sort(), expected);
    });

    // -----------------------------------------------------------------------
    // Test 2: first-load migration (D-06)
    // -----------------------------------------------------------------------

    it('migrates legacy plugin settings on first load and notifies (D-06)', async () => {
        plugin.loadData = async () => null; // no own data.json yet
        await plugin.onload();

        // Merged over DEFAULT_SETTINGS from the mock adapter data
        assert.strictEqual(plugin.settings.exportPath, 'Legacy/Path');
        assert.strictEqual(plugin.settings.medEnabled, false);
        // exportScope untouched (only known keys win)
        assert.strictEqual(plugin.settings.exportScope, '/');

        // saveData was called with the migrated settings
        assert.ok(savedData, 'saveData must have been called after migration');
        assert.strictEqual(savedData.exportPath, 'Legacy/Path');
        assert.strictEqual(savedData.medEnabled, false);

        // Migration Notice was shown (D-14 Chinese message)
        assert.ok(
            Notice._all.includes('已迁移旧插件设置'),
            `expected migration notice in ${JSON.stringify(Notice._all)}`
        );
    });

    // -----------------------------------------------------------------------
    // Test 3: migration skipped when own data.json exists (guard)
    // -----------------------------------------------------------------------

    it('skips migration when the plugin own data.json exists (D-06 guard)', async () => {
        plugin.loadData = async () => ({ exportPath: 'Own/Path' });
        adapter.read = async (p) => {
            adapter.calls.reads.push(p);
            throw new Error('ENOENT');
        };

        await plugin.onload();

        assert.strictEqual(plugin.settings.exportPath, 'Own/Path');
        assert.strictEqual(adapter.calls.reads.length, 0, 'adapter.read must never be invoked');
        assert.strictEqual(Notice._all.length, 0, 'no migration notice on skip');
    });

    // -----------------------------------------------------------------------
    // Test 4: settings tab + status bar wired
    // -----------------------------------------------------------------------

    it('wires the settings tab and status bar on load', async () => {
        await plugin.onload();

        assert.ok(plugin._settingTab instanceof NarrativeToolSettingTab);
        assert.ok(plugin.statusBar, 'statusBar must exist');
        // StatusBarManager adds narrative-tool-status + initial pending state
        assert.ok(plugin.statusBar.element.className.includes('narrative-tool-status'));
        assert.ok(plugin.statusBar.element.className.includes('nt-status-pending'));
    });
});

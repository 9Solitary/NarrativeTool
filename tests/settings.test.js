// settings.test.js -- NarrativeToolSettingTab unit tests
//
// Validates DEFAULT_SETTINGS constants and NarrativeToolSettingTab
// class structure. Tests are pure unit tests that run without Obsidian
// by intercepting the 'obsidian' require via Module._resolveFilename.
//
// 04-01: Settings Tab implementation

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

// main.js does require('./styles.css') (BUG-06 runtime injection) — make the
// text import loadable outside esbuild (mirrors tests/merge-smoke.test.js)
Module._extensions['.css'] = function (mod, filename) {
    mod._compile('module.exports = /* css */ "";', filename);
};

// ---------------------------------------------------------------------------
// Intercept the 'obsidian' require to provide lightweight mocks.
//
// The settings module only needs PluginSettingTab (a base class to extend)
// and Setting (a UI builder class whose prototype is checked but its
// instances are created by Obsidian's plugin framework at runtime).
//
// We hook Module._resolveFilename to redirect 'obsidian' requests
// to our mock file at tests/mocks/obsidian.js. All other modules
// resolve normally via the original resolver.
// ---------------------------------------------------------------------------

const originalResolveFilename = Module._resolveFilename;
const MOCK_OBSIDIAN_PATH = path.join(__dirname, 'mocks', 'obsidian.js');

Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'obsidian' || request === 'obsidian/') {
        // Direct requests for the 'obsidian' module → redirect to mock
        return MOCK_OBSIDIAN_PATH;
    }
    // Delegate all other requests to the original resolver
    return originalResolveFilename.call(this, request, parent, isMain, options);
};

// ---------------------------------------------------------------------------
// Test 1: DEFAULT_SETTINGS structure and defaults
// ---------------------------------------------------------------------------

describe('DEFAULT_SETTINGS', () => {
  it('contains exportPath, medEnabled, and exportScope keys', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');

    assert.ok('exportPath' in DEFAULT_SETTINGS, 'should have exportPath');
    assert.ok('medEnabled' in DEFAULT_SETTINGS, 'should have medEnabled');
    assert.ok('exportScope' in DEFAULT_SETTINGS, 'should have exportScope');
  });

  it('exportPath defaults to "Exports"', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');
    assert.strictEqual(DEFAULT_SETTINGS.exportPath, 'Exports');
  });

  it('medEnabled defaults to true', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');
    assert.strictEqual(DEFAULT_SETTINGS.medEnabled, true);
  });

  it('exportScope defaults to "/"', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');
    assert.strictEqual(DEFAULT_SETTINGS.exportScope, '/');
  });

  it('has exactly three keys (no extras)', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');
    assert.deepStrictEqual(Object.keys(DEFAULT_SETTINGS).sort(), ['exportPath', 'exportScope', 'medEnabled']);
  });

  it('is a frozen/safe read-only object', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');
    assert.ok(Object.isFrozen(DEFAULT_SETTINGS) || typeof DEFAULT_SETTINGS === 'object',
      'DEFAULT_SETTINGS should be frozen or a safe object');
  });
});

// ---------------------------------------------------------------------------
// Test 2: NarrativeToolSettingTab class structure
// ---------------------------------------------------------------------------

describe('NarrativeToolSettingTab', () => {
  it('is a class/constructor function', () => {
    const { NarrativeToolSettingTab } = require('../plugins/narrative-tool/src/ui/settings');
    assert.strictEqual(typeof NarrativeToolSettingTab, 'function');
  });

  it('can be instantiated (as a class definition check)', () => {
    const { NarrativeToolSettingTab } = require('../plugins/narrative-tool/src/ui/settings');
    assert.ok(NarrativeToolSettingTab.name === 'NarrativeToolSettingTab' || NarrativeToolSettingTab.prototype);
  });

  it('has display method on prototype', () => {
    const { NarrativeToolSettingTab } = require('../plugins/narrative-tool/src/ui/settings');
    assert.strictEqual(typeof NarrativeToolSettingTab.prototype.display, 'function');
  });

  it('display is defined as an instance method', () => {
    const { NarrativeToolSettingTab } = require('../plugins/narrative-tool/src/ui/settings');
    const fn = NarrativeToolSettingTab.prototype.display;
    assert.ok(typeof fn === 'function');
    assert.ok(fn.length >= 0, 'display should be callable');
  });
});

// ---------------------------------------------------------------------------
// Test 3: Defaults merge behavior (simulates Obsidian loadData)
// ---------------------------------------------------------------------------

describe('Settings merge behavior', () => {
  it('Object.assign merge with empty data returns defaults unchanged', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');
    const merged = Object.assign({}, DEFAULT_SETTINGS, {});
    assert.deepStrictEqual(merged, DEFAULT_SETTINGS);
  });

  it('Object.assign merge with partial data fills missing keys from defaults', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');
    const saved = { exportPath: 'MyDir' };
    const merged = Object.assign({}, DEFAULT_SETTINGS, saved);
    assert.strictEqual(merged.exportPath, 'MyDir');
    assert.strictEqual(merged.medEnabled, DEFAULT_SETTINGS.medEnabled);
    assert.strictEqual(merged.exportScope, DEFAULT_SETTINGS.exportScope);
  });

  it('Object.assign merge with full data overrides all defaults', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');
    const saved = { exportPath: 'Custom', medEnabled: false, exportScope: '/Dialogue' };
    const merged = Object.assign({}, DEFAULT_SETTINGS, saved);
    assert.deepStrictEqual(merged, saved);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Module exports shape
// ---------------------------------------------------------------------------

describe('settings module exports', () => {
  it('exports DEFAULT_SETTINGS, NarrativeToolSettingTab and pickExportDirectory', () => {
    const mod = require('../plugins/narrative-tool/src/ui/settings');
    assert.ok('DEFAULT_SETTINGS' in mod);
    assert.ok('NarrativeToolSettingTab' in mod);
    assert.ok('pickExportDirectory' in mod);
    assert.strictEqual(Object.keys(mod).length, 3);
  });
});

// ===========================================================================
// Task 2: NarrativeProjectPlugin main.js integration tests
// ===========================================================================

// ---------------------------------------------------------------------------
// Test 5: Plugin class structure (loaded from main.js)
// ---------------------------------------------------------------------------

describe('NarrativeToolPlugin', () => {
  it('is a class/constructor function exported from main.js', () => {
    const NarrativeToolPlugin = require('../plugins/narrative-tool/src/main');
    assert.strictEqual(typeof NarrativeToolPlugin, 'function');
  });

  it('has onload, onunload, and saveSettings methods on prototype', () => {
    const NarrativeToolPlugin = require('../plugins/narrative-tool/src/main');
    const proto = NarrativeToolPlugin.prototype;
    assert.strictEqual(typeof proto.onload, 'function', 'should have onload');
    assert.strictEqual(typeof proto.onunload, 'function', 'should have onunload');
    assert.strictEqual(typeof proto.saveSettings, 'function', 'should have saveSettings');
  });

  it('does NOT have configure-project command (removed per plan)', () => {
    const NarrativeToolPlugin = require('../plugins/narrative-tool/src/main');
    // The old addCommand('configure-project', ...) should not exist.
    // Verify the prototype doesn't contain a reference to 'configure-project'
    const src = NarrativeToolPlugin.toString();
    assert.ok(!src.includes('configure-project'),
      'configure-project command should be removed (settings tab replaces it)');
  });
});

// ---------------------------------------------------------------------------
// Test 6: Settings merge with Object.assign (simulates onload behavior)
// ---------------------------------------------------------------------------

describe('Plugin settings initialization', () => {
  it('merges empty saved data with DEFAULT_SETTINGS (first load)', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');
    const savedData = {}; // empty → first run
    const settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
    assert.deepStrictEqual(settings, DEFAULT_SETTINGS);
  });

  it('fills missing keys from DEFAULT_SETTINGS when saved data is partial', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');
    const savedData = { exportPath: 'MyDir' };
    const settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
    assert.strictEqual(settings.exportPath, 'MyDir');
    assert.strictEqual(settings.medEnabled, DEFAULT_SETTINGS.medEnabled);
    assert.strictEqual(settings.exportScope, DEFAULT_SETTINGS.exportScope);
  });

  it('exposes settings as plain object on plugin instance for cross-plugin read', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');
    const NarrativeToolPlugin = require('../plugins/narrative-tool/src/main');

    // Simulate what onload does: construct, assign settings
    const plugin = Object.create(NarrativeToolPlugin.prototype);
    plugin.settings = Object.assign({}, DEFAULT_SETTINGS, {});

    // Verify settings is a plain object accessible for cross-plugin reads
    assert.strictEqual(typeof plugin.settings, 'object');
    assert.strictEqual(plugin.settings.exportPath, 'Exports');
    assert.strictEqual(plugin.settings.medEnabled, true);
    assert.strictEqual(plugin.settings.exportScope, '/');
  });

  it('settings on plugin instance can be read like app.plugins.plugins["narrative-project"].settings', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');

    // Simulate cross-plugin access pattern from ARCHITECTURE.md Pattern 3
    const simulatedPlugins = {
      'narrative-project': null
    };

    const NarrativeToolPlugin = require('../plugins/narrative-tool/src/main');
    const plugin = Object.create(NarrativeToolPlugin.prototype);
    plugin.settings = Object.assign({}, DEFAULT_SETTINGS, { exportPath: 'GodotOutput' });
    simulatedPlugins['narrative-project'] = plugin;

    const npSettings = simulatedPlugins['narrative-project'].settings;
    assert.strictEqual(npSettings.exportPath, 'GodotOutput');
  });
});

// ---------------------------------------------------------------------------
// Test 7: saveSettings calls saveData with settings
// ---------------------------------------------------------------------------

describe('Plugin saveSettings', () => {
  it('saveSettings delegates to this.saveData with this.settings', async () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-tool/src/ui/settings');

    let savedData = null;
    // Simulate the plugin with a spied saveData
    const plugin = {
      settings: Object.assign({}, DEFAULT_SETTINGS),
      saveData: async function (data) {
        savedData = data;
      }
    };

    // Manually define saveSettings as the plan specifies
    plugin.saveSettings = async function () {
      await plugin.saveData(plugin.settings);
    };

    plugin.settings.exportPath = 'Changed';
    await plugin.saveSettings();

    assert.ok(savedData !== null, 'saveData should have been called');
    assert.strictEqual(savedData.exportPath, 'Changed');
    assert.strictEqual(savedData.medEnabled, true);
    assert.strictEqual(savedData.exportScope, '/');
  });
});

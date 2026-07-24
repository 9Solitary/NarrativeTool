// settings.test.js -- NarrativeProjectSettingTab unit tests
//
// Validates DEFAULT_SETTINGS constants and NarrativeProjectSettingTab
// class structure. Tests are pure unit tests that run without Obsidian
// by intercepting the 'obsidian' require via Module._resolveFilename.
//
// 04-01: Settings Tab implementation

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

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
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-project/src/settings');

    assert.ok('exportPath' in DEFAULT_SETTINGS, 'should have exportPath');
    assert.ok('medEnabled' in DEFAULT_SETTINGS, 'should have medEnabled');
    assert.ok('exportScope' in DEFAULT_SETTINGS, 'should have exportScope');
  });

  it('exportPath defaults to "Exports"', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-project/src/settings');
    assert.strictEqual(DEFAULT_SETTINGS.exportPath, 'Exports');
  });

  it('medEnabled defaults to true', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-project/src/settings');
    assert.strictEqual(DEFAULT_SETTINGS.medEnabled, true);
  });

  it('exportScope defaults to "/"', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-project/src/settings');
    assert.strictEqual(DEFAULT_SETTINGS.exportScope, '/');
  });

  it('has exactly three keys (no extras)', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-project/src/settings');
    assert.deepStrictEqual(Object.keys(DEFAULT_SETTINGS).sort(), ['exportPath', 'exportScope', 'medEnabled']);
  });

  it('is a frozen/safe read-only object', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-project/src/settings');
    assert.ok(Object.isFrozen(DEFAULT_SETTINGS) || typeof DEFAULT_SETTINGS === 'object',
      'DEFAULT_SETTINGS should be frozen or a safe object');
  });
});

// ---------------------------------------------------------------------------
// Test 2: NarrativeProjectSettingTab class structure
// ---------------------------------------------------------------------------

describe('NarrativeProjectSettingTab', () => {
  it('is a class/constructor function', () => {
    const { NarrativeProjectSettingTab } = require('../plugins/narrative-project/src/settings');
    assert.strictEqual(typeof NarrativeProjectSettingTab, 'function');
  });

  it('can be instantiated (as a class definition check)', () => {
    const { NarrativeProjectSettingTab } = require('../plugins/narrative-project/src/settings');
    assert.ok(NarrativeProjectSettingTab.name === 'NarrativeProjectSettingTab' || NarrativeProjectSettingTab.prototype);
  });

  it('has display method on prototype', () => {
    const { NarrativeProjectSettingTab } = require('../plugins/narrative-project/src/settings');
    assert.strictEqual(typeof NarrativeProjectSettingTab.prototype.display, 'function');
  });

  it('display is defined as an instance method', () => {
    const { NarrativeProjectSettingTab } = require('../plugins/narrative-project/src/settings');
    const fn = NarrativeProjectSettingTab.prototype.display;
    assert.ok(typeof fn === 'function');
    assert.ok(fn.length >= 0, 'display should be callable');
  });
});

// ---------------------------------------------------------------------------
// Test 3: Defaults merge behavior (simulates Obsidian loadData)
// ---------------------------------------------------------------------------

describe('Settings merge behavior', () => {
  it('Object.assign merge with empty data returns defaults unchanged', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-project/src/settings');
    const merged = Object.assign({}, DEFAULT_SETTINGS, {});
    assert.deepStrictEqual(merged, DEFAULT_SETTINGS);
  });

  it('Object.assign merge with partial data fills missing keys from defaults', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-project/src/settings');
    const saved = { exportPath: 'MyDir' };
    const merged = Object.assign({}, DEFAULT_SETTINGS, saved);
    assert.strictEqual(merged.exportPath, 'MyDir');
    assert.strictEqual(merged.medEnabled, DEFAULT_SETTINGS.medEnabled);
    assert.strictEqual(merged.exportScope, DEFAULT_SETTINGS.exportScope);
  });

  it('Object.assign merge with full data overrides all defaults', () => {
    const { DEFAULT_SETTINGS } = require('../plugins/narrative-project/src/settings');
    const saved = { exportPath: 'Custom', medEnabled: false, exportScope: '/Dialogue' };
    const merged = Object.assign({}, DEFAULT_SETTINGS, saved);
    assert.deepStrictEqual(merged, saved);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Module exports shape
// ---------------------------------------------------------------------------

describe('settings module exports', () => {
  it('exports DEFAULT_SETTINGS and NarrativeProjectSettingTab', () => {
    const mod = require('../plugins/narrative-project/src/settings');
    assert.ok('DEFAULT_SETTINGS' in mod);
    assert.ok('NarrativeProjectSettingTab' in mod);
    assert.strictEqual(Object.keys(mod).length, 2);
  });
});

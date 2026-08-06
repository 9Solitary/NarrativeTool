// status-bar.test.js -- StatusBarManager unit tests
//
// Validates the StatusBarManager class: DOM element creation, state
// transitions (pending/exporting/success/failure), element replacement,
// and destroy cleanup. Uses the obsidian mock intercepted via
// Module._resolveFilename for addStatusBarItem.
//
// 04-02: Batch Export + Status Bar

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

// ---------------------------------------------------------------------------
// Intercept the 'obsidian' require to provide mock Plugin with addStatusBarItem
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
// Helper: create a mock Plugin instance with addStatusBarItem
// ---------------------------------------------------------------------------

function createMockPlugin() {
    const plugin = Object.create(Plugin.prototype);
    plugin.app = {};
    return plugin;
}

// ===========================================================================
// Test Suite: StatusBarManager
// ===========================================================================

describe('StatusBarManager', () => {
    const { StatusBarManager } = require('../plugins/narrative-tool/src/ui/status-bar');

    // -----------------------------------------------------------------------
    // Test 1: Construction creates status bar DOM element
    // -----------------------------------------------------------------------

    it('creates a status bar DOM element on construction', () => {
        const plugin = createMockPlugin();
        const manager = new StatusBarManager(plugin);

        assert.ok(manager.element, 'should have an element property');
        assert.strictEqual(typeof manager.element.innerHTML, 'string', 'element should support innerHTML');
        assert.ok(manager.element.className.includes('narrative-tool-status'),
            'should have narrative-tool-status class');

        manager.destroy();
    });

    // -----------------------------------------------------------------------
    // Test 2: setState('pending') shows muted text
    // -----------------------------------------------------------------------

    it('setState(pending) displays pending text with muted color', () => {
        const plugin = createMockPlugin();
        const manager = new StatusBarManager(plugin);
        manager.setState('pending');

        assert.ok(manager.element.innerHTML.includes('Narrative Toolchain'),
            'should contain "Narrative Toolchain" text');
        assert.ok(manager.element.className.includes('nt-status-pending'),
            'should have nt-status-pending class');

        manager.destroy();
    });

    // -----------------------------------------------------------------------
    // Test 3: setState('exporting') shows "Exporting..." with loading state
    // -----------------------------------------------------------------------

    it('setState(exporting) displays Exporting... with loading state', () => {
        const plugin = createMockPlugin();
        const manager = new StatusBarManager(plugin);
        manager.setState('exporting');

        assert.ok(manager.element.innerHTML.includes('Exporting'),
            'should contain "Exporting" text');
        assert.ok(manager.element.className.includes('nt-status-exporting'),
            'should have nt-status-exporting class');

        manager.destroy();
    });

    // -----------------------------------------------------------------------
    // Test 4: setState('success') shows green check + count
    // -----------------------------------------------------------------------

    it('setState(success) displays green check with exported count', () => {
        const plugin = createMockPlugin();
        const manager = new StatusBarManager(plugin);
        manager.setState('success', { exported: 12, failed: 0 });

        const html = manager.element.innerHTML;
        assert.ok(html.includes('12'), 'should show exported count 12');
        assert.ok(html.includes('exported') || html.includes('0 failed'),
            'should mention exported or failed');
        assert.ok(manager.element.className.includes('nt-status-success'),
            'should have nt-status-success class');

        manager.destroy();
    });

    // -----------------------------------------------------------------------
    // Test 5: setState('failure') shows red X + error message
    // -----------------------------------------------------------------------

    it('setState(failure) displays red X with error message', () => {
        const plugin = createMockPlugin();
        const manager = new StatusBarManager(plugin);
        manager.setState('failure', { message: 'Parse error' });

        const html = manager.element.innerHTML;
        assert.ok(html.includes('Parse error'), 'should contain error message');
        assert.ok(manager.element.className.includes('nt-status-failure'),
            'should have nt-status-failure class');

        manager.destroy();
    });

    // -----------------------------------------------------------------------
    // Test 6: Consecutive setState calls replace content (no accumulation)
    // -----------------------------------------------------------------------

    it('consecutive setState calls replace content, not accumulate', () => {
        const plugin = createMockPlugin();
        const manager = new StatusBarManager(plugin);

        manager.setState('exporting', { count: 3, total: 10 });
        const exportingHTML = manager.element.innerHTML;
        assert.ok(exportingHTML.includes('Exporting'), 'first state: should show Exporting');

        manager.setState('success', { exported: 10, failed: 0 });
        const successHTML = manager.element.innerHTML;
        assert.ok(!successHTML.includes('Exporting'), 'second state: should NOT contain Exporting');
        assert.ok(successHTML.includes('exported'), 'second state: should contain exported');

        manager.destroy();
    });

    // -----------------------------------------------------------------------
    // Test 7: destroy() removes element from DOM (sets _removed)
    // -----------------------------------------------------------------------

    it('destroy() removes the status bar element', () => {
        const plugin = createMockPlugin();
        const manager = new StatusBarManager(plugin);
        const el = manager.element;

        assert.ok(!el._removed, 'element should not be removed before destroy');

        manager.destroy();
        assert.ok(el._removed, 'element should be marked removed after destroy');
    });

    // -----------------------------------------------------------------------
    // Test 8: exporting with count/total data
    // -----------------------------------------------------------------------

    it('setState(exporting) with count/total shows progress', () => {
        const plugin = createMockPlugin();
        const manager = new StatusBarManager(plugin);
        manager.setState('exporting', { count: 3, total: 10 });

        const html = manager.element.innerHTML;
        assert.ok(html.includes('3') && html.includes('10'),
            'should show count and total when provided');

        manager.destroy();
    });

    // -----------------------------------------------------------------------
    // Test 9: success with failures shown
    // -----------------------------------------------------------------------

    it('setState(success) with failures shows both exported and failed counts', () => {
        const plugin = createMockPlugin();
        const manager = new StatusBarManager(plugin);
        manager.setState('success', { exported: 10, failed: 2 });

        const html = manager.element.innerHTML;
        assert.ok(html.includes('10'), 'should show exported count');
        assert.ok(html.includes('2'), 'should show failed count');
        assert.ok(manager.element.className.includes('nt-status-success'),
            'should have nt-status-success class');

        manager.destroy();
    });
});

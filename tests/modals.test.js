// modals.test.js -- Suggester promise-resolution tests (WR-02)
//
// Verifies that the suggesters invoke their onChoose callback with null
// when the modal is dismissed without a choice, so awaiting command flows
// (file/entity pickers) no longer hang forever on cancel.

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

const { FileSuggesterModal, StringSuggesterModal, FolderSuggestModal, promptForInput } = require('../plugins/narrative-tool/src/ui/modals');

const app = { vault: {} };
const fileStub = { path: 'Dialogues/inn.ncanvas', basename: 'inn', extension: 'ncanvas' };

// ===========================================================================
// FileSuggesterModal
// ===========================================================================

describe('FileSuggesterModal', () => {
    it('invokes onChoose with the chosen file on selection', () => {
        let chosen = 'unset';
        const modal = new FileSuggesterModal(app, [fileStub], (f) => { chosen = f; });
        modal.open();
        modal.onChooseSuggestion(fileStub);
        assert.strictEqual(chosen, fileStub);
    });

    it('invokes onChoose with null when dismissed without a choice (WR-02)', () => {
        let chosen = 'unset';
        const modal = new FileSuggesterModal(app, [fileStub], (f) => { chosen = f; });
        modal.open();
        modal.close();
        assert.strictEqual(chosen, null, 'cancel must resolve the callback with null');
    });

    it('does not double-fire onClose after a choice was made', () => {
        const calls = [];
        const modal = new FileSuggesterModal(app, [fileStub], (f) => { calls.push(f); });
        modal.open();
        modal.onChooseSuggestion(fileStub);
        modal.close();
        assert.deepStrictEqual(calls, [fileStub], 'callback fires exactly once with the chosen file');
    });
});

// ===========================================================================
// StringSuggesterModal
// ===========================================================================

describe('StringSuggesterModal', () => {
    it('invokes onChoose with the chosen string on selection', () => {
        let chosen = 'unset';
        const modal = new StringSuggesterModal(app, ['Chapter'], (s) => { chosen = s; });
        modal.open();
        modal.onChooseSuggestion('Chapter');
        assert.strictEqual(chosen, 'Chapter');
    });

    it('invokes onChoose with null when dismissed without a choice (WR-02)', () => {
        let chosen = 'unset';
        const modal = new StringSuggesterModal(app, ['Chapter'], (s) => { chosen = s; });
        modal.open();
        modal.close();
        assert.strictEqual(chosen, null, 'cancel must resolve the callback with null');
    });
});

// ===========================================================================
// FolderSuggestModal
// ===========================================================================

describe('FolderSuggestModal', () => {
    it('invokes onChoose with null when dismissed without a choice (WR-02)', () => {
        let chosen = 'unset';
        const modal = new FolderSuggestModal(app, ['Flows'], (f) => { chosen = f; });
        modal.open();
        modal.close();
        assert.strictEqual(chosen, null, 'cancel must resolve the callback with null');
    });
});

// ===========================================================================
// promptForInput — already resolves on close (pre-existing onClose override);
// WR-02 is scoped to the suggesters above.
// ===========================================================================

describe('promptForInput', () => {
    it('registers an onClose handler that resolves the promise', () => {
        const { Modal } = require('obsidian');
        const originalOpen = Modal.prototype.open;
        let captured = null;
        Modal.prototype.open = function () {
            captured = this;
            return originalOpen.call(this);
        };
        try {
            let resolved = false;
            const promise = promptForInput(app, 'Title', 'placeholder');
            promise.then(() => { resolved = true; });
            assert.ok(captured, 'modal should open');
            assert.strictEqual(typeof captured.onClose, 'function',
                'onClose must resolve the promise so close() never hangs');
            captured.close();
            return promise.then(() => { assert.strictEqual(resolved, true); });
        } finally {
            Modal.prototype.open = originalOpen;
        }
    });
});

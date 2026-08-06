// modals.js -- Deduped suggesters and input prompt for the merged plugin
//
// Canonical copies (verbatim) of the suggesters that previously lived in
// flow-tools/src/main.js, plus FolderSuggestModal. FileSuggesterModal is
// the CANONICAL suggester — the old dialogue-export-specific file
// suggester (functionally identical) is intentionally NOT recreated; its
// call sites use FileSuggesterModal.
//
// T-05-07: all four classes copied verbatim from existing tested code.

const { Modal, SuggestModal } = require('obsidian');

// =============================================================================
// StringSuggesterModal -- generic SuggestModal for selecting string values
// Used for template type selection (Chapter / Quest / World Event, etc.)
// =============================================================================

class StringSuggesterModal extends SuggestModal {
    /**
     * @param {import('obsidian').App} app
     * @param {string[]} items - list of strings to choose from
     * @param {Function} onChoose - callback receiving the chosen string
     */
    constructor(app, items, onChoose) {
        super(app);
        this._items = items;
        this._onChoose = onChoose;
    }

    getSuggestions(query) {
        if (!query) return this._items;
        const lower = query.toLowerCase();
        return this._items.filter(item => item.toLowerCase().includes(lower));
    }

    renderSuggestion(item, el) {
        el.createEl('div', { text: item });
    }

    onChooseSuggestion(item, evt) {
        this._onChoose(item);
    }
}

// =============================================================================
// FileSuggesterModal -- SuggestModal for selecting TFile objects
// Used for .ncanvas file selection, entity .md file selection, etc.
// =============================================================================

class FileSuggesterModal extends SuggestModal {
    /**
     * @param {import('obsidian').App} app
     * @param {import('obsidian').TFile[]} files - list of files to choose from
     * @param {Function} onChoose - callback receiving the chosen TFile
     */
    constructor(app, files, onChoose) {
        super(app);
        this._files = files;
        this._onChoose = onChoose;
    }

    getSuggestions(query) {
        if (!query) return this._files;
        const lower = query.toLowerCase();
        return this._files.filter(f => f.path.toLowerCase().includes(lower));
    }

    renderSuggestion(file, el) {
        el.createEl('div', { text: file.path });
    }

    onChooseSuggestion(file, evt) {
        this._onChoose(file);
    }
}

// =============================================================================
// FolderSuggestModal -- SuggestModal for selecting vault-relative folders
// '/' renders as '(vault root)'.
// =============================================================================

class FolderSuggestModal extends SuggestModal {
    /**
     * @param {import('obsidian').App} app
     * @param {string[]} folders - list of vault-relative folder paths ('/' = vault root)
     * @param {Function} onChoose - callback receiving the chosen folder path
     */
    constructor(app, folders, onChoose) {
        super(app);
        this._folders = folders;
        this._onChoose = onChoose;
    }

    getSuggestions(query) {
        if (!query) return this._folders;
        const lower = query.toLowerCase();
        return this._folders.filter(f => f.toLowerCase().includes(lower));
    }

    renderSuggestion(folder, el) {
        el.createEl('div', { text: folder === '/' ? '(vault root)' : folder });
    }

    onChooseSuggestion(folder, evt) {
        this._onChoose(folder);
    }
}

// =============================================================================
// promptForInput -- simple modal-based text input
// Returns a Promise that resolves to the entered string (empty string if closed)
// =============================================================================

function promptForInput(app, title, placeholder) {
    return new Promise((resolve) => {
        const modal = new Modal(app);
        modal.titleEl.setText(title);
        const input = modal.contentEl.createEl('input', {
            type: 'text',
            placeholder: placeholder || '',
        });
        input.style.width = '100%';
        input.style.marginTop = '8px';
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                modal.close();
            }
        });
        // Focus the input after the modal opens
        const onOpen = modal.open.bind(modal);
        modal.open = () => {
            onOpen();
            input.focus();
        };
        modal.onClose = () => resolve(input.value || '');
        modal.open();
    });
}

module.exports = {
    FileSuggesterModal,
    StringSuggesterModal,
    FolderSuggestModal,
    promptForInput
};

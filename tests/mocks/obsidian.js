// Mock obsidian module for unit testing outside Obsidian runtime.
//
// Provides minimal stubs for PluginSettingTab (base class) and Setting
// (UI builder). The settings module only uses:
//   - PluginSettingTab: constructor(app, plugin) — sets this.app, this.plugin
//   - PluginSettingTab.display(): abstract — overridden by NarrativeProjectSettingTab
//   - Setting: new Setting(containerEl).setName(...).setDesc(...).addText(...).addToggle(...)
//     Returns the same chainable Setting instance for every method call.

class PluginSettingTab {
    constructor(app, plugin) {
        this.app = app;
        this.plugin = plugin;
        this.containerEl = { empty() {} };
    }

    display() {
        // Abstract — subclasses override this
    }
}

// Minimal Setting stub: chainable builder
class Setting {
    constructor(containerEl) {
        this._containerEl = containerEl;
        this._name = '';
        this._desc = '';
    }

    setName(name) {
        this._name = name;
        return this;
    }

    setDesc(desc) {
        this._desc = desc;
        return this;
    }

    addText(cb) {
        // cb receives a text component stub that the caller can chain .setPlaceholder/.setValue/.onChange on
        const textComponent = {
            _value: '',
            _placeholder: '',
            _onChangeFn: null,
            setPlaceholder(val) { this._placeholder = val; return this; },
            setValue(val) { this._value = val; return this; },
            onChange(fn) { this._onChangeFn = fn; return this; }
        };
        if (typeof cb === 'function') cb(textComponent);
        return this;
    }

    addToggle(cb) {
        const toggleComponent = {
            _value: false,
            _onChangeFn: null,
            setValue(val) { this._value = val; return this; },
            onChange(fn) { this._onChangeFn = fn; return this; }
        };
        if (typeof cb === 'function') cb(toggleComponent);
        return this;
    }
}

// Minimal Plugin stub: base class for Obsidian plugins
class Plugin {
    constructor(app, manifest) {
        this.app = app;
        this.manifest = manifest;
    }

    async loadData() {
        return {};
    }

    async saveData(data) {
        // no-op stub
    }

    addSettingTab(tab) {
        this._settingTab = tab;
    }

    addCommand(command) {
        this._commands = this._commands || [];
        this._commands.push(command);
    }

    registerEvent(eventRef) {
        // no-op stub
    }

    addStatusBarItem() {
        // Returns a mock HTMLElement with in-memory state for testing StatusBarManager.
        // Supports: innerHTML, addClass, removeClass (via classList Set), remove, className.
        const el = {
            _classSet: new Set(),
            innerHTML: '',
            className: '',

            addClass(cls) {
                this._classSet.add(cls);
                this._syncClassName();
                return this;
            },

            removeClass(cls) {
                this._classSet.delete(cls);
                this._syncClassName();
                return this;
            },

            _syncClassName() {
                this.className = Array.from(this._classSet).join(' ');
            },

            remove() {
                this._removed = true;
            },

            setCssProps(_props) {},
            setText(_text) {},

            // DOM query support (for tests that check child content)
            createEl(tag, opts) {
                const child = {
                    tag: tag,
                    innerHTML: '',
                    className: '',
                    _classSet: new Set(),
                    addClass(cls) { this._classSet.add(cls); this._syncClassName(); return this; },
                    removeClass(cls) { this._classSet.delete(cls); this._syncClassName(); return this; },
                    _syncClassName() { this.className = Array.from(this._classSet).join(' '); },
                    setText(text) { this.textContent = text; return this; },
                    textContent: '',
                    querySelector(sel) { return null; },
                    remove() { this._removed = true; }
                };
                if (opts && opts.text) child.textContent = opts.text;
                return child;
            }
        };
        return el;
    }
}

// ---------------------------------------------------------------------------
// Modal / SuggestModal / Notice stubs (added 05-03: ui/modals.js and
// ui/notify.js load under the mock)
// ---------------------------------------------------------------------------

class Modal {
    constructor(app) {
        this.app = app;
        this.titleEl = { setText(_t) {} };
        this.contentEl = {
            createEl(tag, opts) {
                return {
                    tag: tag,
                    style: {},
                    _value: '',
                    addEventListener() {},
                    setText(text) { this.textContent = text; },
                    textContent: (opts && opts.text) || '',
                    placeholder: (opts && opts.placeholder) || '',
                    focus() {}
                };
            }
        };
        this._closed = false;
    }

    open() {
        this._open = true;
        return this;
    }

    close() {
        this._closed = true;
        this._open = false;
        if (typeof this.onClose === 'function') this.onClose();
        return this;
    }
}

class SuggestModal extends Modal {
    constructor(app) {
        super(app);
    }

    getSuggestions(query) {
        return [];
    }

    renderSuggestion(_item, _el) {}

    onChooseSuggestion(_item, _evt) {}
}

class Notice {
    constructor(message) {
        this.message = message;
        this.noticeEl = {
            _classSet: new Set(),
            className: '',
            addClass(cls) { this._classSet.add(cls); this.className = Array.from(this._classSet).join(' '); return this; },
            removeClass(cls) { this._classSet.delete(cls); this.className = Array.from(this._classSet).join(' '); return this; }
        };
    }
}

module.exports = { Plugin, PluginSettingTab, Setting, Modal, SuggestModal, Notice };

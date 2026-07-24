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
}

module.exports = { Plugin, PluginSettingTab, Setting };

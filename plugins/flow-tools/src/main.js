// Flow Tools Plugin -- main entry point
//
// Phase 3 Plan 03-03: Full plugin integration.
// Registers 7+ Obsidian commands (4 entity creation + 2 flow creation + 1 fragment creation),
// file-menu right-click hooks, CSS injection for Canvas node type visual distinction,
// and DOM augmentation via MutationObserver.
//
// Imports wave-1 modules:
//   entity-templates.js  -- createCharacterMd, createLocationMd, createQuestMd, createItemMd
//   canvas-templates.js   -- FLOW_TEMPLATES, FRAGMENT_TEMPLATES, createFlowCanvas, createFlowFragment
//   canvas-utils.js       -- generateNodeId, createCanvas, addNodeToCanvas, addDialogueNodeToCanvas
//   navigation.js         -- openDialogueFile, openFileInSplit

const { Plugin, TFile, TFolder, Notice, normalizePath, Modal, SuggestModal } = require('obsidian');
const { createCharacterMd, createLocationMd, createQuestMd, createItemMd } = require('./entity-templates');
const { FLOW_TEMPLATES, FRAGMENT_TEMPLATES, createFlowCanvas, createFlowFragment } = require('./canvas-templates');
const { generateNodeId, addNodeToCanvas, addDialogueNodeToCanvas } = require('./canvas-utils');
const { openDialogueFile, openFileInSplit } = require('./navigation');

// =============================================================================
// Slug helper -- converts a name to a safe filename slug
// =============================================================================

function slugify(name) {
    if (!name) return 'untitled';
    return name
        .toLowerCase()
        .replace(/[^a-z0-9一-鿿\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || 'untitled';
}

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

// =============================================================================
// Main Plugin Class
// =============================================================================

module.exports = class FlowToolsPlugin extends Plugin {

    // ================================================================
    // Lifecycle
    // ================================================================

    async onload() {
        console.log('[Flow Tools] loaded v' + this.manifest.version);

        // 1. Register all Obsidian commands
        this._registerEntityCommands();   // 4 commands: ENT-01~04
        this._registerFlowCommands();      // 3 commands: FLW-01, FLW-02

        // 2. Register file-menu right-click hooks (FLW-06)
        this._registerFileMenuHooks();

        // 3. Inject Canvas CSS (FLW-03)
        this._injectCanvasStyles();

        // 4. Register Canvas node type observer (FLW-03 DOM augmentation)
        this._setupCanvasNodeTypeObserver();
    }

    async onunload() {
        // Clean up injected CSS
        document.getElementById('nt-flow-tools-styles')?.remove();
        console.log('[Flow Tools] unloaded');
    }

    // ================================================================
    // Command Registration
    // ================================================================

    _registerEntityCommands() {
        // 4 commands, one per entity type
        const entities = [
            {
                id: 'create-character',
                name: 'Create Character',
                modalTitle: 'Create Character',
                templateFn: createCharacterMd,
                defaultFolder: 'Characters',
                entityType: 'character',
            },
            {
                id: 'create-location',
                name: 'Create Location',
                modalTitle: 'Create Location',
                templateFn: createLocationMd,
                defaultFolder: 'Locations',
                entityType: 'location',
            },
            {
                id: 'create-quest',
                name: 'Create Quest',
                modalTitle: 'Create Quest',
                templateFn: createQuestMd,
                defaultFolder: 'Quests',
                entityType: 'quest',
            },
            {
                id: 'create-item',
                name: 'Create Item',
                modalTitle: 'Create Item',
                templateFn: createItemMd,
                defaultFolder: 'Items',
                entityType: 'item',
            },
        ];

        for (const cmd of entities) {
            this.addCommand({
                id: cmd.id,
                name: cmd.name,
                callback: () => this._createEntityFromCommand(cmd),
            });
        }
    }

    _registerFlowCommands() {
        // "Create Flow Canvas" (FLW-01) -- 3 template types
        this.addCommand({
            id: 'create-flow-canvas',
            name: 'Create Flow Canvas',
            callback: () => this._createFlowCanvasFromCommand(),
        });

        // "Create Flow Fragment" (FLW-02) -- 2 template types
        this.addCommand({
            id: 'create-flow-fragment',
            name: 'Create Flow Fragment',
            callback: () => this._createFlowFragmentFromCommand(),
        });
    }

    // ================================================================
    // Entity Creation Workflow (ENT-01~04)
    // ================================================================

    async _createEntityFromCommand(cmd) {
        // Step 1: Collect required fields via input prompts
        new Notice(`${cmd.modalTitle} — enter ID (slug)`);
        const id = await promptForInput(this.app, `${cmd.modalTitle}: ID`, 'e.g., bob, village, main-quest');
        if (!id || !id.trim()) {
            new Notice(`${cmd.modalTitle} cancelled (no ID provided)`);
            return;
        }

        new Notice(`${cmd.modalTitle} — enter Display Name`);
        const name = await promptForInput(this.app, `${cmd.modalTitle}: Name`, 'Display name');
        if (!name || !name.trim()) {
            new Notice(`${cmd.modalTitle} cancelled (no name provided)`);
            return;
        }

        // Step 2: Build template params with defaults
        const slug = slugify(id.trim());
        const params = { id: id.trim(), name: name.trim() };

        // Add entity-specific defaults based on type
        switch (cmd.entityType) {
        case 'character':
            params.role = '';
            params.voice = '';
            params.notes = '';
            params.appearanceScenes = [];
            break;
        case 'location':
            params.description = '';
            params.region = '';
            params.connectedLocations = [];
            params.notes = '';
            break;
        case 'quest':
            params.description = '';
            params.questType = '';
            params.prerequisites = [];
            params.stages = [];
            params.giverCharacterId = '';
            params.involvedLocationIds = [];
            params.notes = '';
            break;
        case 'item':
            params.description = '';
            params.itemType = '';
            params.relatedQuestId = '';
            params.ownerCharacterId = '';
            params.notes = '';
            break;
        }

        // Step 3: Generate Markdown
        const content = cmd.templateFn(params);

        // Step 4: Ensure target directory exists (T-03-07: path traversal mitigation)
        const folder = cmd.defaultFolder;
        const safeSlug = slug.replace(/\.\./g, '').replace(/[\/\\]/g, '-');
        const filePath = normalizePath(folder + '/' + safeSlug + '.md');

        // Security: ensure the resolved path is still under the target folder
        if (!filePath.startsWith(folder + '/')) {
            new Notice('Invalid filename: path traversal not allowed');
            return;
        }

        // Ensure folder exists
        const folderObj = this.app.vault.getAbstractFileByPath(folder);
        if (!folderObj) {
            await this.app.vault.createFolder(folder);
        }

        // Step 5: Check for duplicate
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            new Notice('File already exists: ' + filePath);
            return;
        }

        // Step 6: Write file
        await this.app.vault.create(filePath, content);
        new Notice('Created: ' + filePath);

        // Step 7: Optionally open the new file
        await this.app.workspace.openLinkText(filePath, '', true);
    }

    // ================================================================
    // Flow Canvas Creation Workflow (FLW-01)
    // ================================================================

    async _createFlowCanvasFromCommand() {
        // Step 1: Template type selection
        const types = [FLOW_TEMPLATES.CHAPTER, FLOW_TEMPLATES.QUEST, FLOW_TEMPLATES.WORLD_EVENT];
        const typeLabels = {
            [FLOW_TEMPLATES.CHAPTER]: 'Chapter',
            [FLOW_TEMPLATES.QUEST]: 'Quest',
            [FLOW_TEMPLATES.WORLD_EVENT]: 'World Event',
        };

        const templateType = await new Promise((resolve) => {
            const displayItems = types.map(t => typeLabels[t]);
            new StringSuggesterModal(this.app, displayItems, (chosen) => {
                const idx = displayItems.indexOf(chosen);
                resolve(idx >= 0 ? types[idx] : null);
            }).open();
        });

        if (!templateType) {
            new Notice('Create Flow Canvas cancelled');
            return;
        }

        // Step 2: Collect template-specific parameters
        const params = await this._collectFlowCanvasParams(templateType);

        // Step 3: Prompt for filename
        let defaultName = '';
        if (templateType === FLOW_TEMPLATES.CHAPTER) defaultName = params.title || '';
        else if (templateType === FLOW_TEMPLATES.QUEST) defaultName = params.questName || '';
        else if (templateType === FLOW_TEMPLATES.WORLD_EVENT) defaultName = params.eventName || '';

        const filename = await promptForInput(this.app, 'Flow Canvas Filename',
            'e.g., ' + slugify(defaultName || 'my-flow'));
        if (!filename || !filename.trim()) {
            new Notice('Create Flow Canvas cancelled (no filename)');
            return;
        }

        // Step 4: Generate canvas JSON
        const canvasJson = createFlowCanvas(templateType, params);

        // Step 5: Ensure Flows/ directory exists
        const folder = 'Flows';
        const folderObj = this.app.vault.getAbstractFileByPath(folder);
        if (!folderObj) {
            await this.app.vault.createFolder(folder);
        }

        // Step 6: Build file path (T-03-07: path traversal mitigation)
        const safeName = slugify(filename.trim()).replace(/\.\./g, '').replace(/[\/\\]/g, '-');
        const filePath = normalizePath(folder + '/' + safeName + '.canvas');

        if (!filePath.startsWith(folder + '/')) {
            new Notice('Invalid filename: path traversal not allowed');
            return;
        }

        // Step 7: Check for duplicate
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            new Notice('File already exists: ' + filePath);
            return;
        }

        // Step 8: Write file
        await this.app.vault.create(filePath, canvasJson);
        new Notice('Created: ' + filePath);

        // Step 9: Open the new Flow Canvas
        await this.app.workspace.openLinkText(filePath, '', true);
    }

    async _collectFlowCanvasParams(templateType) {
        switch (templateType) {
        case FLOW_TEMPLATES.CHAPTER: {
            const title = await promptForInput(this.app, 'Chapter Title', 'e.g., Chapter 1: The Village');
            if (!title) return null;
            const entryScene = await this._pickNcanvasFile('Select Entry Scene (.ncanvas)');
            // NPCs (comma-separated, semicolon-separated file paths)
            const npcsInput = await promptForInput(this.app, 'Key NPCs (comma-separated file paths)',
                'e.g., Characters/bob.md, Characters/alice.md');
            const npcs = npcsInput ? npcsInput.split(',').map(s => s.trim()).filter(Boolean) : [];
            // Locations (comma-separated file paths)
            const locsInput = await promptForInput(this.app, 'Key Locations (comma-separated file paths)',
                'e.g., Locations/village.md, Locations/inn.md');
            const locations = locsInput ? locsInput.split(',').map(s => s.trim()).filter(Boolean) : [];
            return { title, entryScene, npcs, locations };
        }
        case FLOW_TEMPLATES.QUEST: {
            const questName = await promptForInput(this.app, 'Quest Name', 'e.g., Rescue the Villager');
            if (!questName) return null;
            const giverChar = await this._pickEntityFile('character', 'Select Quest Giver (Character .md)');
            const stagesInput = await promptForInput(this.app, 'Quest Stages (comma-separated)',
                'e.g., Accept quest, Find the key, Rescue the villager');
            const stages = stagesInput ? stagesInput.split(',').map(s => s.trim()).filter(Boolean) : [];
            const reward = await promptForInput(this.app, 'Reward', 'e.g., 500 gold, Sword of Valor');
            return { questName, giverChar, stages, reward };
        }
        case FLOW_TEMPLATES.WORLD_EVENT: {
            const eventName = await promptForInput(this.app, 'Event Name', 'e.g., Festival of Stars');
            if (!eventName) return null;
            const trigger = await promptForInput(this.app, 'Trigger Condition', 'e.g., Player enters the plaza after sunset');
            const affectedLocs = [];
            // Prompt for up to 2 affected locations
            const loc1 = await this._pickEntityFile('location', 'Select Affected Location 1 (optional, press Esc to skip)');
            if (loc1) affectedLocs.push(loc1);
            if (loc1) {
                const loc2 = await this._pickEntityFile('location', 'Select Affected Location 2 (optional, press Esc to skip)');
                if (loc2) affectedLocs.push(loc2);
            }
            const outcome = await promptForInput(this.app, 'Outcome', 'e.g., All NPCs become friendly for 24 hours');
            return { eventName, trigger, affectedLocs, outcome };
        }
        default:
            return null;
        }
    }

    // ================================================================
    // Flow Fragment Creation Workflow (FLW-02)
    // ================================================================

    async _createFlowFragmentFromCommand() {
        // Step 1: Template type selection
        const types = [FRAGMENT_TEMPLATES.QUEST_DETAIL, FRAGMENT_TEMPLATES.SCENE_BREAKDOWN];
        const typeLabels = {
            [FRAGMENT_TEMPLATES.QUEST_DETAIL]: 'Quest Detail',
            [FRAGMENT_TEMPLATES.SCENE_BREAKDOWN]: 'Scene Breakdown',
        };

        const templateType = await new Promise((resolve) => {
            const displayItems = types.map(t => typeLabels[t]);
            new StringSuggesterModal(this.app, displayItems, (chosen) => {
                const idx = displayItems.indexOf(chosen);
                resolve(idx >= 0 ? types[idx] : null);
            }).open();
        });

        if (!templateType) {
            new Notice('Create Flow Fragment cancelled');
            return;
        }

        // Step 2: Collect params
        const params = await this._collectFlowFragmentParams(templateType);
        if (!params) return;

        // Step 3: Filename
        let defaultName = '';
        if (templateType === FRAGMENT_TEMPLATES.QUEST_DETAIL) defaultName = params.stepName || '';
        else if (templateType === FRAGMENT_TEMPLATES.SCENE_BREAKDOWN) defaultName = params.sceneName || '';

        const filename = await promptForInput(this.app, 'Flow Fragment Filename',
            'e.g., ' + slugify(defaultName || 'fragment'));
        if (!filename || !filename.trim()) {
            new Notice('Create Flow Fragment cancelled (no filename)');
            return;
        }

        // Step 4: Generate canvas JSON
        const canvasJson = createFlowFragment(templateType, params);

        // Step 5: Ensure Flows/ directory exists
        const folder = 'Flows';
        const folderObj = this.app.vault.getAbstractFileByPath(folder);
        if (!folderObj) {
            await this.app.vault.createFolder(folder);
        }

        // Step 6: Build file path (T-03-07: path traversal mitigation)
        const safeName = slugify(filename.trim()).replace(/\.\./g, '').replace(/[\/\\]/g, '-');
        const filePath = normalizePath(folder + '/' + safeName + '.canvas');

        if (!filePath.startsWith(folder + '/')) {
            new Notice('Invalid filename: path traversal not allowed');
            return;
        }

        // Check for duplicate
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            new Notice('File already exists: ' + filePath);
            return;
        }

        // Write + open
        await this.app.vault.create(filePath, canvasJson);
        new Notice('Created: ' + filePath);
        await this.app.workspace.openLinkText(filePath, '', true);
    }

    async _collectFlowFragmentParams(templateType) {
        switch (templateType) {
        case FRAGMENT_TEMPLATES.QUEST_DETAIL: {
            const stepName = await promptForInput(this.app, 'Quest Step Name', 'e.g., Talk to the innkeeper');
            if (!stepName) return null;
            const dialogueRef = await this._pickNcanvasFile('Select Dialogue Reference (.ncanvas)');
            const branch1 = await promptForInput(this.app, 'Branch A', 'e.g., Accept the quest');
            const branch2 = await promptForInput(this.app, 'Branch B', 'e.g., Decline');
            const condition = await promptForInput(this.app, 'Condition', 'e.g., Player reputation >= 10');
            return { stepName, dialogueRef, branch1: branch1 || '', branch2: branch2 || '', condition: condition || '' };
        }
        case FRAGMENT_TEMPLATES.SCENE_BREAKDOWN: {
            const sceneName = await promptForInput(this.app, 'Scene Name', 'e.g., Inn - First Encounter');
            if (!sceneName) return null;
            // Characters (comma-separated file paths)
            const charsInput = await promptForInput(this.app, 'Characters Present (comma-separated file paths)',
                'e.g., Characters/innkeeper.md, Characters/guard.md');
            const characters = charsInput ? charsInput.split(',').map(s => s.trim()).filter(Boolean) : [];
            // Beats
            const beatsInput = await promptForInput(this.app, 'Scene Beats (comma-separated)',
                'e.g., Enter inn, Greet innkeeper, Receive quest info');
            const beats = beatsInput ? beatsInput.split(',').map(s => s.trim()).filter(Boolean) : [];
            return { sceneName, characters, beats };
        }
        default:
            return null;
        }
    }

    // ================================================================
    // File Pickers (SuggesterModal-based)
    // ================================================================

    /**
     * Show a file picker for .ncanvas files.
     * Returns the chosen file's vault-relative path, or empty string if cancelled.
     */
    async _pickNcanvasFile(title) {
        const ncanvasFiles = this.app.vault.getFiles()
            .filter(f => f.extension === 'ncanvas');
        if (ncanvasFiles.length === 0) {
            new Notice('No .ncanvas files found in vault');
            return '';
        }
        return new Promise((resolve) => {
            new FileSuggesterModal(this.app, ncanvasFiles, (file) => {
                resolve(file.path);
            }).open();
        });
    }

    /**
     * Show a file picker for entity .md files of a specific type.
     * Returns the chosen file's vault-relative path, or empty string if cancelled.
     */
    async _pickEntityFile(entityType, title) {
        const files = this._getEntityFiles(entityType);
        if (files.length === 0) {
            new Notice(`No ${entityType} .md files found in vault`);
            return '';
        }
        return new Promise((resolve) => {
            new FileSuggesterModal(this.app, files, (file) => {
                resolve(file.path);
            }).open();
        });
    }

    // ================================================================
    // File Menu Hooks (FLW-06)
    // ================================================================

    _registerFileMenuHooks() {
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file, source) => {
                // Only show on .canvas files
                if (!(file instanceof TFile) || file.extension !== 'canvas') return;

                // --- Menu Item 1: Add dialogue node ---
                menu.addItem((item) => {
                    item
                        .setTitle('Add dialogue node')
                        .setIcon('message-square')
                        .onClick(async () => {
                            const ncanvasFiles = this.app.vault.getFiles()
                                .filter(f => f.extension === 'ncanvas');
                            if (ncanvasFiles.length === 0) {
                                new Notice('No .ncanvas files found in vault');
                                return;
                            }
                            await this._addDialogueNodeToCanvasFile(file, ncanvasFiles);
                        });
                });

                // --- Menu Item 2: Add character node ---
                menu.addItem((item) => {
                    item
                        .setTitle('Add character node')
                        .setIcon('user')
                        .onClick(async () => {
                            const charFiles = this._getEntityFiles('character');
                            if (charFiles.length === 0) {
                                new Notice('No Character .md files found in vault');
                                return;
                            }
                            await this._addFileNodeToCanvasFile(file, charFiles, 'character');
                        });
                });

                // --- Menu Item 3: Add location node ---
                menu.addItem((item) => {
                    item
                        .setTitle('Add location node')
                        .setIcon('map-pin')
                        .onClick(async () => {
                            const locFiles = this._getEntityFiles('location');
                            if (locFiles.length === 0) {
                                new Notice('No Location .md files found in vault');
                                return;
                            }
                            await this._addFileNodeToCanvasFile(file, locFiles, 'location');
                        });
                });

                // --- Menu Item 4: Add quest node ---
                menu.addItem((item) => {
                    item
                        .setTitle('Add quest node')
                        .setIcon('scroll')
                        .onClick(async () => {
                            const questFiles = this._getEntityFiles('quest');
                            if (questFiles.length === 0) {
                                new Notice('No Quest .md files found in vault');
                                return;
                            }
                            await this._addFileNodeToCanvasFile(file, questFiles, 'quest');
                        });
                });

                menu.addSeparator();

                // --- Menu Item 5: Open linked dialogue (FLW-04) ---
                menu.addItem((item) => {
                    item
                        .setTitle('Open linked dialogue')
                        .setIcon('external-link')
                        .onClick(async () => {
                            await this._openLinkedDialogueFromCanvas(file);
                        });
                });
            })
        );
    }

    // ================================================================
    // Canvas File Manipulation Helpers
    // ================================================================

    async _addDialogueNodeToCanvasFile(canvasFile, ncanvasFiles) {
        // Show file picker for .ncanvas files
        const chosen = await new Promise((resolve) => {
            new FileSuggesterModal(this.app, ncanvasFiles, (f) => resolve(f)).open();
        });
        if (!chosen) return;

        // Read canvas JSON
        const content = await this.app.vault.read(canvasFile);
        let canvas;
        try {
            canvas = JSON.parse(content);
        } catch (e) {
            new Notice('Failed to parse .canvas JSON: ' + e.message);
            return;
        }

        // Add dialogue node
        const updated = addDialogueNodeToCanvas(canvas, chosen.path);

        // Write back (tab-indented to match Obsidian Canvas format)
        await this.app.vault.modify(canvasFile, JSON.stringify(updated, null, '\t'));
        new Notice('Added dialogue node: ' + chosen.path);
    }

    async _addFileNodeToCanvasFile(canvasFile, entityFiles, entityType) {
        // Show file picker
        const chosen = await new Promise((resolve) => {
            new FileSuggesterModal(this.app, entityFiles, (f) => resolve(f)).open();
        });
        if (!chosen) return;

        // Read canvas JSON
        const content = await this.app.vault.read(canvasFile);
        let canvas;
        try {
            canvas = JSON.parse(content);
        } catch (e) {
            new Notice('Failed to parse .canvas JSON: ' + e.message);
            return;
        }

        // Add file node as entity node
        const fileNode = {
            id: generateNodeId(),
            type: 'file',
            file: chosen.path,
            x: 0,
            y: 0,
            width: 300,
            height: 200,
        };
        const updated = addNodeToCanvas(canvas, fileNode);

        await this.app.vault.modify(canvasFile, JSON.stringify(updated, null, '\t'));
        new Notice('Added ' + entityType + ' node: ' + chosen.path);
    }

    async _openLinkedDialogueFromCanvas(canvasFile) {
        // Parse .canvas JSON to find all file nodes pointing to .ncanvas files
        const content = await this.app.vault.read(canvasFile);
        let canvas;
        try {
            canvas = JSON.parse(content);
        } catch (e) {
            new Notice('Failed to parse .canvas JSON: ' + e.message);
            return;
        }

        const dialogueNodes = (canvas.nodes || [])
            .filter(n => n.type === 'file' && n.file && n.file.endsWith('.ncanvas'));

        if (dialogueNodes.length === 0) {
            new Notice('No dialogue nodes found in this canvas');
            return;
        }

        // If single dialogue, open directly
        if (dialogueNodes.length === 1) {
            await openDialogueFile(this.app, dialogueNodes[0].file);
            return;
        }

        // Multiple: show picker
        const dialogueFiles = dialogueNodes
            .map(n => this.app.vault.getAbstractFileByPath(n.file))
            .filter(Boolean);

        if (dialogueFiles.length === 0) {
            new Notice('Dialogue files referenced in canvas not found in vault');
            return;
        }

        const chosen = await new Promise((resolve) => {
            new FileSuggesterModal(this.app, dialogueFiles, (f) => resolve(f)).open();
        });
        if (!chosen) return;

        await openDialogueFile(this.app, chosen.path);
    }

    /**
     * Get entity .md files by type from their default directory.
     * @param {'character'|'location'|'quest'|'item'} entityType
     * @returns {import('obsidian').TFile[]}
     */
    _getEntityFiles(entityType) {
        const folderMap = {
            character: 'Characters',
            location: 'Locations',
            quest: 'Quests',
            item: 'Items',
        };
        const folder = folderMap[entityType];
        return this.app.vault.getFiles()
            .filter(f => f.extension === 'md' && f.path.startsWith(folder + '/'));
    }

    // ================================================================
    // CSS Injection (FLW-03)
    // ================================================================

    _injectCanvasStyles() {
        // Remove any existing injected stylesheet (idempotent on reload)
        const existing = document.getElementById('nt-flow-tools-styles');
        if (existing) existing.remove();

        const styleEl = document.createElement('style');
        styleEl.id = 'nt-flow-tools-styles';
        styleEl.textContent = `
/* Flow Tools -- Canvas node type visual distinction (FLW-03) */

/* Dialogue nodes (.ncanvas files) -- blue left border */
.canvas-node[data-nt-type="dialogue"] > .canvas-node-container {
    border-left: 4px solid var(--color-blue);
}

/* Entity nodes (.md files: Character/Location/Quest/Item) -- cyan left border */
.canvas-node[data-nt-type="entity"] > .canvas-node-container {
    border-left: 4px solid var(--color-cyan);
}

/* Future: Character nodes -- green left border (Phase 4) */
.canvas-node[data-nt-type="character"] > .canvas-node-container {
    border-left: 4px solid var(--color-green);
}

/* Future: Location nodes -- orange left border (Phase 4) */
.canvas-node[data-nt-type="location"] > .canvas-node-container {
    border-left: 4px solid var(--color-orange);
}

/* Future: Quest nodes -- purple left border (Phase 4) */
.canvas-node[data-nt-type="quest"] > .canvas-node-container {
    border-left: 4px solid var(--color-purple);
}

/* Future: Item nodes -- gray left border (Phase 4) */
.canvas-node[data-nt-type="item"] > .canvas-node-container {
    border-left: 4px solid var(--text-muted);
}
`;
        document.head.appendChild(styleEl);
    }

    // ================================================================
    // Canvas DOM Augmentation -- Node Type Observer (FLW-03)
    // ================================================================

    _setupCanvasNodeTypeObserver() {
        // Use layout-change event to detect active Canvas views
        // T-03-09 mitigation: debounce to avoid CPU spikes

        this._debounceTimer = null;
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                // Debounce: only annotate after 200ms of inactivity
                if (this._debounceTimer) clearTimeout(this._debounceTimer);
                this._debounceTimer = setTimeout(() => {
                    this._annotateAllCanvasViews();
                }, 200);
            })
        );

        // Initial scan (with delay for Canvas DOM to render)
        setTimeout(() => {
            this._annotateAllCanvasViews();
        }, 300);
    }

    _annotateAllCanvasViews() {
        // Find all .canvas-node elements in the DOM
        const canvasNodes = document.querySelectorAll('.canvas-node');
        if (!canvasNodes || canvasNodes.length === 0) return;

        canvasNodes.forEach(nodeEl => {
            // Skip if already annotated
            if (nodeEl.hasAttribute('data-nt-type')) return;

            // Find the label element to determine file type
            const labelEl = nodeEl.querySelector('.canvas-node-label');
            if (!labelEl) return;

            const label = (labelEl.textContent || '').trim();
            if (label.endsWith('.ncanvas')) {
                nodeEl.setAttribute('data-nt-type', 'dialogue');
            } else if (label.endsWith('.md')) {
                nodeEl.setAttribute('data-nt-type', 'entity');
            }
            // text/group nodes get no attribute -- default Obsidian styling
        });
    }
};

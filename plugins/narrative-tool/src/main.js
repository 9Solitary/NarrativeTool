// Narrative Tool Plugin -- merged plugin main entry point (ENG-01 / Plan 05-04)
//
// The single plugin that replaces the three legacy plugins:
//   narrative-project  -> settings, status bar, batch export, auto-export, validation
//   dialogue-export    -> export engine (moved to engine/ in Plans 05-01/03)
//   flow-tools         -> entity creation, flow canvases, file-menu hooks, CSS, observer
//
// Wiring carried by this plan:
//   D-08  All 10 commands unified under the narrative-tool: prefix
//   D-06  Settings migration from legacy plugin data.json files on first load
//   (2026-08-07) Flow creation redesigned articy-style: name-only prompts,
//   Flows/<name>.canvas + Flows/<name>/ folder, fragments live under the
//   parent flow's folder and are linked back into the parent canvas
//   BUG-05  open-flow-canvas command + .ncanvas file-menu entry via findFlowCanvasForDialogue
//   BUG-06  styles.css injected at runtime (id narrative-tool-styles) + entity .md annotation
//   BUG-07  file menu on .canvas files offers all 4 entity node types incl. Add quest node
//   D-14  Every user-facing message goes through notify() (Chinese-ready wrapper)

const { Plugin, TFile, normalizePath } = require('obsidian');
const { DEFAULT_SETTINGS, NarrativeToolSettingTab } = require('./ui/settings');
const { StatusBarManager } = require('./ui/status-bar');
const { notify } = require('./ui/notify');
const { FileSuggesterModal, promptForInput } = require('./ui/modals');
const { exportAllDialogues } = require('./commands/batch-export');
const { setupAutoExport, teardownAutoExport } = require('./commands/auto-export');
const { validateReferences } = require('./commands/reference-validator');
const { exportCurrentDialogue } = require('./commands/export-current');
const { createCharacterMd, createLocationMd, createQuestMd, createItemMd } = require('./flow/entity-templates');
const { generateNodeId, createCanvas, addNodeToCanvas, addDialogueNodeToCanvas } = require('./flow/canvas-utils');
const { openDialogueFile, openFlowCanvas, openFileInSplit, findFlowCanvasForDialogue } = require('./flow/navigation');
const styles = require('./styles.css');

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

// Canvas color palette for entity file nodes (Obsidian Canvas colors 1-8).
// character green '4', location orange '2', item red '1',
// quest purple '3' (purple chosen for quest by executor discretion — plan
// documents "quest purple — Claude's discretion").
const ENTITY_COLORS = { character: '4', location: '2', item: '1', quest: '3' };

// =============================================================================
// Main Plugin Class
// =============================================================================

module.exports = class NarrativeToolPlugin extends Plugin {

    // ================================================================
    // Lifecycle
    // ================================================================

    async onload() {
        console.log('[Narrative Tool] loaded v' + this.manifest.version);

        // 1. Load saved settings, then migrate legacy plugin settings (D-06)
        const saved = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);

        // D-06 migration: only on first load (own data.json absent).
        // Guard: own data.json exists -> skip, never re-runs over user edits.
        if (!saved) {
            let migrated = false;
            for (const id of ['narrative-project', 'dialogue-export', 'flow-tools']) {
                try {
                    const raw = await this.app.vault.adapter.read('.obsidian/plugins/' + id + '/data.json');
                    const json = JSON.parse(raw);
                    // Object.assign over DEFAULT_SETTINGS — only known keys win
                    Object.assign(this.settings, json);
                    migrated = true;
                } catch (e) {
                    // File absent or unreadable — skip
                }
            }
            await this.saveData(this.settings);
            // Only notify when legacy settings were actually migrated —
            // a fresh install with no legacy plugins stays silent (UAT A8).
            if (migrated) {
                notify('已迁移旧插件设置', 'info');
            }
        }

        // 2. Register the settings tab so it appears in Obsidian Settings
        this.addSettingTab(new NarrativeToolSettingTab(this.app, this));

        // 3. Initialize the status bar for export progress feedback
        this.statusBar = new StatusBarManager(this);

        // 4. Install auto-export listener: debounced .ncanvas → .dialogue on save
        setupAutoExport(this, (results) => {
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;
            if (successCount > 0 && failCount === 0) {
                this.statusBar.setState('success', { exported: successCount, failed: 0 });
                // Auto-revert to pending after 5 seconds
                if (this._autoExportTimeout) clearTimeout(this._autoExportTimeout);
                this._autoExportTimeout = setTimeout(() => {
                    this.statusBar.setState('pending');
                }, 5000);
            } else if (failCount > 0) {
                this.statusBar.setState('failure', { message: `${failCount} auto-export failed` });
            }
        });

        // 5. Register all commands (D-08 — all under the narrative-tool: prefix)
        this._registerCommands();

        // 6. Register file-menu right-click hooks (BUG-05 / BUG-07)
        this._registerFileMenuHooks();

        // 7. Inject Canvas CSS (BUG-06)
        this._injectCanvasStyles();

        // 8. Register Canvas node type observer (BUG-06 DOM annotation)
        this._setupCanvasNodeTypeObserver();
    }

    async onunload() {
        teardownAutoExport(this);
        if (this._autoExportTimeout) clearTimeout(this._autoExportTimeout);
        if (this.statusBar) {
            this.statusBar.destroy();
        }
        clearInterval(this._observerInterval);
        document.getElementById('narrative-tool-styles')?.remove();
        console.log('[Narrative Tool] unloaded');
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // ================================================================
    // Command Registration (D-08)
    // ================================================================

    _registerCommands() {
        // 1. Export current dialogue (deduped single-file export, Plan 05-03)
        this.addCommand({
            id: 'narrative-tool:export-current-dialogue',
            name: 'Export current dialogue',
            callback: () => exportCurrentDialogue(this)
        });

        // 2. Batch export all dialogues
        this.addCommand({
            id: 'narrative-tool:batch-export-all-dialogues',
            name: 'Batch Export All Dialogues',
            callback: () => this.batchExportAllDialogues()
        });

        // 3. Validate Flow→Dialogue references
        this.addCommand({
            id: 'narrative-tool:validate-references',
            name: 'Validate Flow→Dialogue references',
            callback: () => this.runReferenceValidation()
        });

        // 4-7. Entity creation commands (one per entity type; IDs carry the
        // full narrative-tool: prefix per D-08)
        const entities = [
            {
                id: 'narrative-tool:create-character',
                name: 'Create Character',
                modalTitle: 'Create Character',
                templateFn: createCharacterMd,
                defaultFolder: 'Characters',
                entityType: 'character',
            },
            {
                id: 'narrative-tool:create-location',
                name: 'Create Location',
                modalTitle: 'Create Location',
                templateFn: createLocationMd,
                defaultFolder: 'Locations',
                entityType: 'location',
            },
            {
                id: 'narrative-tool:create-item',
                name: 'Create Item',
                modalTitle: 'Create Item',
                templateFn: createItemMd,
                defaultFolder: 'Items',
                entityType: 'item',
            },
            {
                id: 'narrative-tool:create-quest',
                name: 'Create Quest',
                modalTitle: 'Create Quest',
                templateFn: createQuestMd,
                defaultFolder: 'Quests',
                entityType: 'quest',
            },
        ];

        for (const cmd of entities) {
            this.addCommand({
                id: cmd.id,
                name: cmd.name,
                callback: () => this._createEntityFromCommand(cmd),
            });
        }

        // 8. Create Flow (name only → canvas + fragment folder)
        this.addCommand({
            id: 'narrative-tool:create-flow-canvas',
            name: 'Create Flow',
            callback: () => this._createFlowCanvasFromCommand(),
        });

        // 9. Create Flow Fragment (parent flow picker → linked into parent)
        this.addCommand({
            id: 'narrative-tool:create-flow-fragment',
            name: 'Create Flow Fragment',
            callback: () => this._createFlowFragmentFromCommand(),
        });

        // 10. Open Flow Canvas for the active dialogue (BUG-05 — reverse navigation)
        this.addCommand({
            id: 'narrative-tool:open-flow-canvas',
            name: 'Open Flow Canvas',
            callback: () => this._openFlowCanvasFromCommand(),
        });
    }

    // ================================================================
    // Batch Export / Reference Validation (from narrative-project main.js)
    // ================================================================

    /**
     * Execute a batch export of all .ncanvas files in the configured scope.
     * Updates the status bar through exporting -> success/failure -> pending (5s).
     */
    async batchExportAllDialogues() {
        const { exportPath, exportScope, medEnabled } = this.settings;

        // Show exporting state on the status bar
        this.statusBar.setState('exporting');

        try {
            const result = await exportAllDialogues(
                this.app, exportPath, exportScope, medEnabled
            );

            // Update status bar with result
            this.statusBar.setState('success', result);

            // Auto-revert to pending after 5 seconds
            setTimeout(() => this.statusBar.setState('pending'), 5000);

            // Show ephemeral notification for summary
            notify(`[NP] ${result.exported} exported, ${result.failed} failed`);
        } catch (err) {
            // Show failure state on status bar
            this.statusBar.setState('failure', { message: err.message });

            // Show ephemeral notification for error
            notify(`[NP] Batch export failed: ${err.message}`);
        }
    }

    /**
     * Run the Flow→Dialogue reference integrity check.
     * Scans all .canvas files for .ncanvas file references and reports
     * broken links via status bar, notification, and console.warn.
     */
    async runReferenceValidation() {
        this.statusBar.setState('exporting');
        try {
            const result = await validateReferences(this.app);
            if (result.brokenRefs === 0) {
                this.statusBar.setState('success', { exported: result.totalRefs, failed: 0 });
                notify(`[NP] All ${result.totalRefs} references valid`);
                // Auto-revert to pending after 5 seconds
                setTimeout(() => this.statusBar.setState('pending'), 5000);
            } else {
                this.statusBar.setState('failure', { message: `${result.brokenRefs} broken refs` });
                notify(`[NP] ${result.brokenRefs} broken references found. See console for details.`);
                console.warn('[NP] Broken Flow→Dialogue references:', result.details);
            }
        } catch (err) {
            this.statusBar.setState('failure', { message: 'Reference check failed' });
            notify(`[NP] Reference validation failed: ${err.message}`);
        }
    }

    // ================================================================
    // Entity Creation Workflow (ENT-01~04)
    // ================================================================

    async _createEntityFromCommand(cmd) {
        // Step 1: Collect required fields via input prompts
        notify(`${cmd.modalTitle} — enter ID (slug)`);
        const id = await promptForInput(this.app, `${cmd.modalTitle}: ID`, 'e.g., bob, village, main-quest');
        if (!id || !id.trim()) {
            notify(`${cmd.modalTitle} cancelled (no ID provided)`);
            return;
        }

        notify(`${cmd.modalTitle} — enter Display Name`);
        const name = await promptForInput(this.app, `${cmd.modalTitle}: Name`, 'Display name');
        if (!name || !name.trim()) {
            notify(`${cmd.modalTitle} cancelled (no name provided)`);
            return;
        }

        // Step 2: Build template params with defaults.
        // The file is named from the slug, so the frontmatter id must use
        // the same slug — a raw unslugified id ("Bob Smith") would produce
        // quest references (giver_character_id, [[Bob Smith]] links) that
        // resolve against filenames and silently break (WR-03).
        const slug = slugify(id.trim());
        const params = { id: slug, name: name.trim() };
        if (slug !== id.trim()) {
            notify(`ID normalized to "${slug}" (filename-safe)`);
        }

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

        // Step 4: Ensure target directory exists (T-03-07 / T-05-10: path traversal mitigation)
        const folder = cmd.defaultFolder;
        const safeSlug = slug.replace(/\.\./g, '').replace(/[\/\\]/g, '-');
        const filePath = normalizePath(folder + '/' + safeSlug + '.md');

        // Security: ensure the resolved path is still under the target folder
        if (!filePath.startsWith(folder + '/')) {
            notify('Invalid filename: path traversal not allowed');
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
            notify('File already exists: ' + filePath);
            return;
        }

        // Step 6: Write file
        await this.app.vault.create(filePath, content);
        notify('Created: ' + filePath);

        // Step 7: Optionally open the new file
        await this.app.workspace.openLinkText(filePath, '', true);
    }

    // ================================================================
    // Flow Canvas / Fragment Creation Workflow (articy-style hierarchy)
    //
    // Create Flow Canvas:   asks for a name only → Flows/<name>.canvas
    //                       (single title node) + Flows/<name>/ folder that
    //                       collects its fragments and dialogues.
    // Create Flow Fragment: pick parent Flow canvas → name → created under
    //                       <parent dir>/<parent basename>/, and a file node
    //                       linking the fragment is appended to the parent.
    // ================================================================

    async _createFlowCanvasFromCommand() {
        // Step 1: The name is all we ask for
        const name = await promptForInput(this.app, 'Create Flow', 'e.g., Chapter 1');
        if (!name || !name.trim()) {
            notify('Create Flow cancelled (no name)');
            return;
        }

        // Step 2: Paths (T-05-10: path traversal mitigation)
        const folder = 'Flows';
        const safeName = slugify(name.trim()).replace(/\.\./g, '').replace(/[\/\\]/g, '-');
        const filePath = normalizePath(folder + '/' + safeName + '.canvas');
        const fragFolder = normalizePath(folder + '/' + safeName);

        if (!filePath.startsWith(folder + '/')) {
            notify('Invalid filename: path traversal not allowed');
            return;
        }
        if (this.app.vault.getAbstractFileByPath(filePath)) {
            notify('File already exists: ' + filePath);
            return;
        }

        // Step 3: Minimal canvas — a single title node
        const canvas = addNodeToCanvas(createCanvas(), {
            id: generateNodeId(),
            type: 'text',
            text: '# ' + name.trim(),
            x: 0, y: 0, width: 400, height: 120,
        });

        // Step 4: Create Flows/, the canvas file, and its fragment folder
        if (!this.app.vault.getAbstractFileByPath(folder)) {
            await this.app.vault.createFolder(folder);
        }
        await this.app.vault.create(filePath, JSON.stringify(canvas, null, '\t'));
        if (!this.app.vault.getAbstractFileByPath(fragFolder)) {
            await this.app.vault.createFolder(fragFolder);
        }
        notify('Created: ' + filePath);
        await this.app.workspace.openLinkText(filePath, '', true);
    }

    // ================================================================
    // Flow Fragment Creation Workflow (must belong to a parent Flow)
    // ================================================================

    async _createFlowFragmentFromCommand() {
        // Step 1: Pick the parent Flow canvas — a fragment always belongs to one
        const canvasFiles = this.app.vault.getFiles()
            .filter(f => f.extension === 'canvas');
        if (canvasFiles.length === 0) {
            notify('No Flow canvas found — create one first');
            return;
        }
        const parent = await new Promise((resolve) => {
            new FileSuggesterModal(this.app, canvasFiles, (f) => resolve(f)).open();
        });
        if (!parent) {
            notify('Create Flow Fragment cancelled');
            return;
        }

        // Step 2: The name is all we ask for
        const name = await promptForInput(this.app, 'Create Flow Fragment', 'e.g., Village Encounter');
        if (!name || !name.trim()) {
            notify('Create Flow Fragment cancelled (no name)');
            return;
        }

        // Step 3: Fragment lives under <parent dir>/<parent basename>/
        // (T-05-10: path traversal mitigation)
        const parentDir = parent.parent && parent.parent.path !== '/' ? parent.parent.path : '';
        const safeName = slugify(name.trim()).replace(/\.\./g, '').replace(/[\/\\]/g, '-');
        const fragFolder = normalizePath((parentDir ? parentDir + '/' : '') + parent.basename);
        const filePath = normalizePath(fragFolder + '/' + safeName + '.canvas');

        if (!filePath.startsWith(fragFolder + '/')) {
            notify('Invalid filename: path traversal not allowed');
            return;
        }
        if (this.app.vault.getAbstractFileByPath(filePath)) {
            notify('File already exists: ' + filePath);
            return;
        }

        // Step 4: Create the fragment canvas (single title node)
        const canvas = addNodeToCanvas(createCanvas(), {
            id: generateNodeId(),
            type: 'text',
            text: '# ' + name.trim(),
            x: 0, y: 0, width: 400, height: 120,
        });
        if (!this.app.vault.getAbstractFileByPath(fragFolder)) {
            await this.app.vault.createFolder(fragFolder);
        }
        await this.app.vault.create(filePath, JSON.stringify(canvas, null, '\t'));

        // Step 5: Link back — append a file node for the fragment to the parent canvas
        try {
            const content = await this.app.vault.read(parent);
            const parentCanvas = JSON.parse(content);
            const updated = addNodeToCanvas(parentCanvas, {
                id: generateNodeId(),
                type: 'file',
                file: filePath,
                x: 0, y: 0, width: 300, height: 200,
            });
            await this.app.vault.modify(parent, JSON.stringify(updated, null, '\t'));
        } catch (e) {
            notify('Fragment created, but failed to link into parent canvas: ' + e.message);
        }

        notify('Created: ' + filePath);
        await this.app.workspace.openLinkText(filePath, '', true);
    }

    // ================================================================
    // File Menu Hooks (BUG-05 right-click nav + BUG-07 all 4 entity types)
    // ================================================================

    _registerFileMenuHooks() {
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                // --- .canvas files: node-adding menu (BUG-07) + open linked dialogue ---
                if (file instanceof TFile && file.extension === 'canvas') {
                    // Menu Item 1: Add dialogue node
                    menu.addItem((item) => {
                        item
                            .setTitle('Add dialogue node')
                            .setIcon('message-square')
                            .onClick(async () => {
                                await this._createDialogueNodeOnCanvas(file);
                            });
                    });

                    // Menu Item 2: Add character node
                    menu.addItem((item) => {
                        item
                            .setTitle('Add character node')
                            .setIcon('user')
                            .onClick(async () => {
                                const charFiles = this._getEntityFiles('character');
                                if (charFiles.length === 0) {
                                    notify('No Character .md files found in vault');
                                    return;
                                }
                                await this._addFileNodeToCanvasFile(file, charFiles, 'character');
                            });
                    });

                    // Menu Item 3: Add location node
                    menu.addItem((item) => {
                        item
                            .setTitle('Add location node')
                            .setIcon('map-pin')
                            .onClick(async () => {
                                const locFiles = this._getEntityFiles('location');
                                if (locFiles.length === 0) {
                                    notify('No Location .md files found in vault');
                                    return;
                                }
                                await this._addFileNodeToCanvasFile(file, locFiles, 'location');
                            });
                    });

                    // Menu Item 4: Add item node
                    menu.addItem((item) => {
                        item
                            .setTitle('Add item node')
                            .setIcon('package')
                            .onClick(async () => {
                                const itemFiles = this._getEntityFiles('item');
                                if (itemFiles.length === 0) {
                                    notify('No Item .md files found in vault');
                                    return;
                                }
                                await this._addFileNodeToCanvasFile(file, itemFiles, 'item');
                            });
                    });

                    // Menu Item 5: Add quest node (BUG-07 completes the 4 entity types)
                    menu.addItem((item) => {
                        item
                            .setTitle('Add quest node')
                            .setIcon('target')
                            .onClick(async () => {
                                const questFiles = this._getEntityFiles('quest');
                                if (questFiles.length === 0) {
                                    notify('No Quest .md files found in vault');
                                    return;
                                }
                                await this._addFileNodeToCanvasFile(file, questFiles, 'quest');
                            });
                    });

                    menu.addSeparator();

                    // Menu Item 6: Open linked dialogue (FLW-04)
                    menu.addItem((item) => {
                        item
                            .setTitle('Open linked dialogue')
                            .setIcon('external-link')
                            .onClick(async () => {
                                await this._openLinkedDialogueFromCanvas(file);
                            });
                    });
                    return;
                }

                // --- .ncanvas files: reverse navigation to the Flow canvas (BUG-05) ---
                if (file instanceof TFile && file.extension === 'ncanvas') {
                    menu.addItem((item) => {
                        item
                            .setTitle('Open flow canvas')
                            .setIcon('external-link')
                            .onClick(async () => {
                                await this._openFlowCanvasForFile(file);
                            });
                    });
                }
            })
        );
    }

    // ================================================================
    // Canvas File Manipulation Helpers
    // ================================================================

    async _createDialogueNodeOnCanvas(canvasFile) {
        // Pick a .ncanvas file to add as a file node on the canvas
        const ncanvasFiles = this.app.vault.getFiles()
            .filter(f => f.extension === 'ncanvas');
        if (ncanvasFiles.length === 0) {
            notify('No .ncanvas files found in vault');
            return;
        }

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
            notify('Failed to parse .canvas JSON: ' + e.message);
            return;
        }

        // Add dialogue node
        const updated = addDialogueNodeToCanvas(canvas, chosen.path);

        // Write back (tab-indented to match Obsidian Canvas format)
        await this.app.vault.modify(canvasFile, JSON.stringify(updated, null, '\t'));
        notify('Added dialogue node: ' + chosen.path);
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
            notify('Failed to parse .canvas JSON: ' + e.message);
            return;
        }

        // Add file node as entity node (colored per entity type)
        const fileNode = {
            id: generateNodeId(),
            type: 'file',
            file: chosen.path,
            x: 0,
            y: 0,
            width: 300,
            height: 200,
            color: ENTITY_COLORS[entityType],
        };
        const updated = addNodeToCanvas(canvas, fileNode);

        await this.app.vault.modify(canvasFile, JSON.stringify(updated, null, '\t'));
        notify('Added ' + entityType + ' node: ' + chosen.path);
    }

    async _openLinkedDialogueFromCanvas(canvasFile) {
        // Parse .canvas JSON to find all file nodes pointing to .ncanvas files
        const content = await this.app.vault.read(canvasFile);
        let canvas;
        try {
            canvas = JSON.parse(content);
        } catch (e) {
            notify('Failed to parse .canvas JSON: ' + e.message);
            return;
        }

        const dialogueNodes = (canvas.nodes || [])
            .filter(n => n.type === 'file' && n.file && n.file.endsWith('.ncanvas'));

        if (dialogueNodes.length === 0) {
            notify('No dialogue nodes found in this canvas');
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
            notify('Dialogue files referenced in canvas not found in vault');
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
    // Reverse Navigation (BUG-05)
    // ================================================================

    async _openFlowCanvasFromCommand() {
        let activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'ncanvas') {
            // Narrative Canvas opens .ncanvas in a custom ItemView, so
            // getActiveFile() returns null. Its view exposes the file as a
            // path STRING on view.file — resolve it through the active leaf.
            const leaf = this.app.workspace.activeLeaf;
            const viewFile = leaf && leaf.view ? leaf.view.file : null;
            const path = typeof viewFile === 'string' ? viewFile : (viewFile && viewFile.path);
            if (path && path.endsWith('.ncanvas')) {
                const resolved = this.app.vault.getAbstractFileByPath(path);
                if (resolved) activeFile = resolved;
            }
        }
        if (!activeFile || activeFile.extension !== 'ncanvas') {
            notify('Open a .ncanvas file first');
            return;
        }
        await this._openFlowCanvasForFile(activeFile);
    }

    async _openFlowCanvasForFile(file) {
        const canvases = await findFlowCanvasForDialogue(this.app, file.path);
        if (canvases.length === 0) {
            notify('No Flow canvas references this dialogue');
        } else if (canvases.length === 1) {
            await openFlowCanvas(this.app, canvases[0].path);
        } else {
            new FileSuggesterModal(this.app, canvases, async (chosen) => {
                if (chosen) await openFlowCanvas(this.app, chosen.path);
            }).open();
        }
    }

    // ================================================================
    // CSS Injection (BUG-06)
    // ================================================================

    _injectCanvasStyles() {
        // Remove any existing injected stylesheet (idempotent on reload)
        const existing = document.getElementById('narrative-tool-styles');
        if (existing) existing.remove();

        const styleEl = document.createElement('style');
        styleEl.id = 'narrative-tool-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    // ================================================================
    // Canvas DOM Augmentation -- Node Type Observer (BUG-06)
    // ================================================================

    _setupCanvasNodeTypeObserver() {
        // Hybrid polling: periodic 1s scan catches canvases opened without a
        // layout-change event; the layout-change handler (debounced 200ms)
        // reacts immediately to view switches; initial scans at 500/1500/3000ms
        // cover slow Canvas DOM rendering.
        this._debounceTimer = null;
        this._observerInterval = setInterval(() => {
            this._annotateAllCanvasViews();
        }, 1000);

        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                // Debounce: only annotate after 200ms of inactivity
                if (this._debounceTimer) clearTimeout(this._debounceTimer);
                this._debounceTimer = setTimeout(() => {
                    this._annotateAllCanvasViews();
                }, 200);
            })
        );

        // Initial scans (with delay for Canvas DOM to render)
        setTimeout(() => {
            this._annotateAllCanvasViews();
        }, 500);
        setTimeout(() => {
            this._annotateAllCanvasViews();
        }, 1500);
        setTimeout(() => {
            this._annotateAllCanvasViews();
        }, 3000);
    }

    _annotateAllCanvasViews() {
        // Find all .canvas-node elements in the DOM
        const canvasNodes = document.querySelectorAll('.canvas-node');
        if (!canvasNodes || canvasNodes.length === 0) return;

        canvasNodes.forEach(nodeEl => {
            // Skip if already annotated
            if (nodeEl.hasAttribute('data-nt-type')) return;

            // Primary: label element text — .ncanvas → dialogue, .md → entity
            const labelEl = nodeEl.querySelector('.canvas-node-label');
            if (labelEl) {
                const label = (labelEl.textContent || '').trim();
                if (label.endsWith('.ncanvas')) {
                    nodeEl.setAttribute('data-nt-type', 'dialogue');
                    return;
                }
                if (label.endsWith('.md')) {
                    nodeEl.setAttribute('data-nt-type', 'entity');
                    return;
                }
            }

            // Fallback: attribute/child-element .ncanvas references
            // (data-path attribute, file link anchor, or iframe src)
            const fallbackEl = nodeEl.querySelector(
                '[data-path$=".ncanvas"], a[href$=".ncanvas"], iframe[src$=".ncanvas"]'
            );
            if (fallbackEl) {
                nodeEl.setAttribute('data-nt-type', 'dialogue');
            }
            // text/group nodes get no attribute -- default Obsidian styling
        });
    }
};

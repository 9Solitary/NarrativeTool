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
//   (2026-08-10) .canvas file-menu "Add dialogue node" replaced by
//   "新建对话节点": creates a new blank .ncanvas (NarrativeCanvas
//   saved-state v1) in the canvas's collection folder and links it in,
//   instead of picking an existing .ncanvas

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

// Blank .ncanvas saved-state template — mirrors NarrativeCanvas's own
// createBlankSavedState (SAVED_STATE_VERSION 1): a single Entry start node.
function createBlankNcanvas(title) {
    const projectTitle = String(title || '').trim() || 'Untitled';
    return {
        version: 1,
        savedAt: new Date().toISOString(),
        project: {
            title: projectTitle,
            notes: '',
            variables: {},
            characters: [],
            nodes: [
                { id: 'n0', type: 'Entry', title: 'Start', body: 'Adventure Begins', x: 120, y: 120 }
            ],
            links: []
        },
        ui: {
            selectedNodeId: 'n0',
            selectedLinkId: null,
            panel: 'project',
            activeFileId: 'adventure',
            view: { x: 0, y: 0, scale: 0.5 },
            search: '',
            characterSearch: '',
            eventSearch: '',
            playbookJsonOpen: false
        }
    };
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
                // UX-03: surface the first concrete error message
                const firstError = results.find(r => !r.success);
                const detail = firstError && firstError.error ? `：${firstError.error}` : '';
                this.statusBar.setState('failure', { message: `${failCount} 个文件自动导出失败${detail}` });
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
            name: '导出当前对话',
            callback: () => exportCurrentDialogue(this)
        });

        // 2. Batch export all dialogues
        this.addCommand({
            id: 'narrative-tool:batch-export-all-dialogues',
            name: '批量导出所有对话',
            callback: () => this.batchExportAllDialogues()
        });

        // 3. Validate Flow→Dialogue references
        this.addCommand({
            id: 'narrative-tool:validate-references',
            name: '验证 Flow→对话引用',
            callback: () => this.runReferenceValidation()
        });

        // 4-7. Entity creation commands (one per entity type; IDs carry the
        // full narrative-tool: prefix per D-08)
        const entities = [
            {
                id: 'narrative-tool:create-character',
                name: '创建角色',
                modalTitle: '创建角色',
                templateFn: createCharacterMd,
                defaultFolder: 'Characters',
                entityType: 'character',
            },
            {
                id: 'narrative-tool:create-location',
                name: '创建地点',
                modalTitle: '创建地点',
                templateFn: createLocationMd,
                defaultFolder: 'Locations',
                entityType: 'location',
            },
            {
                id: 'narrative-tool:create-item',
                name: '创建物品',
                modalTitle: '创建物品',
                templateFn: createItemMd,
                defaultFolder: 'Items',
                entityType: 'item',
            },
            {
                id: 'narrative-tool:create-quest',
                name: '创建任务',
                modalTitle: '创建任务',
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
            name: '创建 Flow',
            callback: () => this._createFlowCanvasFromCommand(),
        });

        // 9. Create Flow Fragment (parent flow picker → linked into parent)
        this.addCommand({
            id: 'narrative-tool:create-flow-fragment',
            name: '创建 Flow 片段',
            callback: () => this._createFlowFragmentFromCommand(),
        });

        // 10. Open Flow Canvas for the active dialogue (BUG-05 — reverse navigation)
        this.addCommand({
            id: 'narrative-tool:open-flow-canvas',
            name: '打开 Flow 画布',
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
        const { exportPath, exportScope, medEnabled, variablesPath } = this.settings;

        // Show exporting state on the status bar
        this.statusBar.setState('exporting');

        try {
            const result = await exportAllDialogues(
                this.app, exportPath, exportScope, medEnabled,
                // UX-03: per-file progress on the status bar
                (count, total) => this.statusBar.setState('exporting', { count, total }),
                variablesPath
            );

            if (result.failed > 0) {
                // UX-03: surface the first concrete error
                const first = result.errors && result.errors[0];
                const detail = first ? `${first.file}：${first.message}` : '';
                this.statusBar.setState('failure', {
                    message: `${result.failed} 个失败${detail ? ' — ' + detail : ''}`
                });
                notify(`批量导出完成：${result.exported} 个成功，${result.failed} 个失败${detail ? '（' + detail + '）' : ''}`, 'error');
            } else {
                this.statusBar.setState('success', result);
                notify(`批量导出完成：${result.exported} 个成功`);
            }
            if (result.warnings > 0) {
                notify(`批量导出产生 ${result.warnings} 条警告（详见控制台）`);
            }

            // Auto-revert to pending after 5 seconds
            setTimeout(() => this.statusBar.setState('pending'), 5000);
        } catch (err) {
            // Show failure state on status bar
            this.statusBar.setState('failure', { message: err.message });

            // Show ephemeral notification for error
            notify(`批量导出失败：${err.message}`, 'error');
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
                notify(`引用验证通过：${result.totalRefs} 个引用全部有效`);
                // Auto-revert to pending after 5 seconds
                setTimeout(() => this.statusBar.setState('pending'), 5000);
            } else {
                this.statusBar.setState('failure', { message: `${result.brokenRefs} 个引用失效` });
                notify(`发现 ${result.brokenRefs} 个失效引用，详见控制台`, 'error');
                console.warn('[Narrative Tool] Broken Flow→Dialogue references:', result.details);
            }
        } catch (err) {
            this.statusBar.setState('failure', { message: '引用验证失败' });
            notify(`引用验证失败：${err.message}`, 'error');
        }
    }

    // ================================================================
    // Entity Creation Workflow (ENT-01~04)
    // ================================================================

    async _createEntityFromCommand(cmd) {
        // Step 1: Collect required fields via input prompts
        notify(`${cmd.modalTitle} — 请输入 ID（英文小写 slug）`);
        const id = await promptForInput(this.app, `${cmd.modalTitle}：ID`, '例如 bob、village、main-quest');
        if (!id || !id.trim()) {
            notify(`已取消${cmd.modalTitle}（未输入 ID）`);
            return;
        }

        notify(`${cmd.modalTitle} — 请输入显示名称`);
        const name = await promptForInput(this.app, `${cmd.modalTitle}：名称`, '显示名称');
        if (!name || !name.trim()) {
            notify(`已取消${cmd.modalTitle}（未输入名称）`);
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
            notify(`ID 已规范化为 "${slug}"（文件名安全）`);
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
            notify('文件名无效：不允许路径穿越', 'error');
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
            notify('文件已存在：' + filePath, 'error');
            return;
        }

        // Step 6: Write file
        await this.app.vault.create(filePath, content);
        notify('已创建：' + filePath);

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
        const name = await promptForInput(this.app, '创建 Flow', '例如 第一章');
        if (!name || !name.trim()) {
            notify('已取消创建 Flow（未输入名称）');
            return;
        }

        // Step 2: Paths (T-05-10: path traversal mitigation)
        const folder = 'Flows';
        const safeName = slugify(name.trim()).replace(/\.\./g, '').replace(/[\/\\]/g, '-');
        const filePath = normalizePath(folder + '/' + safeName + '.canvas');
        const fragFolder = normalizePath(folder + '/' + safeName);

        if (!filePath.startsWith(folder + '/')) {
            notify('文件名无效：不允许路径穿越', 'error');
            return;
        }
        if (this.app.vault.getAbstractFileByPath(filePath)) {
            notify('文件已存在：' + filePath, 'error');
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
        notify('已创建：' + filePath);
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
            notify('没有找到 Flow 画布 — 请先创建一个 Flow', 'error');
            return;
        }
        const parent = await new Promise((resolve) => {
            new FileSuggesterModal(this.app, canvasFiles, (f) => resolve(f)).open();
        });
        if (!parent) {
            notify('已取消创建 Flow 片段');
            return;
        }

        // Step 2: The name is all we ask for
        const name = await promptForInput(this.app, '创建 Flow 片段', '例如 村口遭遇战');
        if (!name || !name.trim()) {
            notify('已取消创建 Flow 片段（未输入名称）');
            return;
        }

        // Step 3: Fragment lives under <parent dir>/<parent basename>/
        // (T-05-10: path traversal mitigation)
        const parentDir = parent.parent && parent.parent.path !== '/' ? parent.parent.path : '';
        const safeName = slugify(name.trim()).replace(/\.\./g, '').replace(/[\/\\]/g, '-');
        const fragFolder = normalizePath((parentDir ? parentDir + '/' : '') + parent.basename);
        const filePath = normalizePath(fragFolder + '/' + safeName + '.canvas');

        if (!filePath.startsWith(fragFolder + '/')) {
            notify('文件名无效：不允许路径穿越', 'error');
            return;
        }
        if (this.app.vault.getAbstractFileByPath(filePath)) {
            notify('文件已存在：' + filePath, 'error');
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
            notify('片段已创建，但回写到父 Flow 画布失败：' + e.message, 'error');
        }

        notify('已创建：' + filePath);
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
                    // Menu Item 1: Create dialogue node (new .ncanvas + node)
                    menu.addItem((item) => {
                        item
                            .setTitle('新建对话节点')
                            .setIcon('message-square')
                            .onClick(async () => {
                                await this._createDialogueNodeOnCanvas(file);
                            });
                    });

                    // Menu Item 2: Add character node
                    menu.addItem((item) => {
                        item
                            .setTitle('添加角色节点')
                            .setIcon('user')
                            .onClick(async () => {
                                const charFiles = this._getEntityFiles('character');
                                if (charFiles.length === 0) {
                                    notify('库中没有角色 .md 文件（Characters/ 目录为空）');
                                    return;
                                }
                                await this._addFileNodeToCanvasFile(file, charFiles, 'character');
                            });
                    });

                    // Menu Item 3: Add location node
                    menu.addItem((item) => {
                        item
                            .setTitle('添加地点节点')
                            .setIcon('map-pin')
                            .onClick(async () => {
                                const locFiles = this._getEntityFiles('location');
                                if (locFiles.length === 0) {
                                    notify('库中没有地点 .md 文件（Locations/ 目录为空）');
                                    return;
                                }
                                await this._addFileNodeToCanvasFile(file, locFiles, 'location');
                            });
                    });

                    // Menu Item 4: Add item node
                    menu.addItem((item) => {
                        item
                            .setTitle('添加物品节点')
                            .setIcon('package')
                            .onClick(async () => {
                                const itemFiles = this._getEntityFiles('item');
                                if (itemFiles.length === 0) {
                                    notify('库中没有物品 .md 文件（Items/ 目录为空）');
                                    return;
                                }
                                await this._addFileNodeToCanvasFile(file, itemFiles, 'item');
                            });
                    });

                    // Menu Item 5: Add quest node (BUG-07 completes the 4 entity types)
                    menu.addItem((item) => {
                        item
                            .setTitle('添加任务节点')
                            .setIcon('target')
                            .onClick(async () => {
                                const questFiles = this._getEntityFiles('quest');
                                if (questFiles.length === 0) {
                                    notify('库中没有任务 .md 文件（Quests/ 目录为空）');
                                    return;
                                }
                                await this._addFileNodeToCanvasFile(file, questFiles, 'quest');
                            });
                    });

                    menu.addSeparator();

                    // Menu Item 6: Open linked dialogue (FLW-04)
                    menu.addItem((item) => {
                        item
                            .setTitle('打开关联对话')
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
                            .setTitle('打开 Flow 画布')
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
        // Step 1: The name is all we ask for
        const name = await promptForInput(this.app, '新建对话', '例如 与掌柜交谈');
        if (!name || !name.trim()) {
            notify('已取消新建对话（未输入名称）');
            return;
        }

        // Step 2: Target folder — when the canvas has a collection folder
        // (<canvas dir>/<canvas basename>, created alongside a Flow), the
        // dialogue lives inside it; otherwise it sits next to the canvas.
        const canvasDir = canvasFile.parent && canvasFile.parent.path !== '/' ? canvasFile.parent.path : '';
        const collectionFolder = normalizePath((canvasDir ? canvasDir + '/' : '') + canvasFile.basename);
        const targetFolder = this.app.vault.getAbstractFileByPath(collectionFolder)
            ? collectionFolder
            : canvasDir;

        // Step 3: Paths (T-05-10: path traversal mitigation)
        const safeName = slugify(name.trim()).replace(/\.\./g, '').replace(/[\/\\]/g, '-');
        const filePath = normalizePath((targetFolder ? targetFolder + '/' : '') + safeName + '.ncanvas');

        if (targetFolder && !filePath.startsWith(targetFolder + '/')) {
            notify('文件名无效：不允许路径穿越', 'error');
            return;
        }
        if (this.app.vault.getAbstractFileByPath(filePath)) {
            notify('文件已存在：' + filePath, 'error');
            return;
        }

        // Step 4: Create the blank .ncanvas (single Entry start node)
        await this.app.vault.create(filePath, JSON.stringify(createBlankNcanvas(name.trim()), null, 2));

        // Step 5: Add a file node for the new dialogue to the canvas
        const content = await this.app.vault.read(canvasFile);
        let canvas;
        try {
            canvas = JSON.parse(content);
        } catch (e) {
            notify('对话已创建，但解析 .canvas JSON 失败：' + e.message, 'error');
            return;
        }
        const updated = addDialogueNodeToCanvas(canvas, filePath);
        await this.app.vault.modify(canvasFile, JSON.stringify(updated, null, '\t'));

        notify('已创建对话：' + filePath);
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
            notify('解析 .canvas JSON 失败：' + e.message, 'error');
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
        notify('已添加节点：' + chosen.path);
    }

    async _openLinkedDialogueFromCanvas(canvasFile) {
        // Parse .canvas JSON to find all file nodes pointing to .ncanvas files
        const content = await this.app.vault.read(canvasFile);
        let canvas;
        try {
            canvas = JSON.parse(content);
        } catch (e) {
            notify('解析 .canvas JSON 失败：' + e.message, 'error');
            return;
        }

        const dialogueNodes = (canvas.nodes || [])
            .filter(n => n.type === 'file' && n.file && n.file.endsWith('.ncanvas'));

        if (dialogueNodes.length === 0) {
            notify('此画布中没有对话节点');
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
            notify('画布引用的对话文件在库中不存在', 'error');
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
            notify('请先打开一个 .ncanvas 文件');
            return;
        }
        await this._openFlowCanvasForFile(activeFile);
    }

    async _openFlowCanvasForFile(file) {
        const canvases = await findFlowCanvasForDialogue(this.app, file.path);
        if (canvases.length === 0) {
            notify('没有 Flow 画布引用此对话');
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

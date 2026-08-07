// auto-export.js -- File watcher + debounced single-file export for PRJ-03
//
// Listens to vault.on('modify') for .ncanvas file changes and automatically
// exports the corresponding .dialogue file after a 2-second debounce.
//
// Provides three exported functions:
//   - exportSingleFile(app, file, exportPath, medEnabled) → { success, error?, path? }
//   - setupAutoExport(plugin, onExported) → void
//   - teardownAutoExport(plugin) → void
//
// Output goes through the shared paths.js writeDialogueFile module, which
// honors the configured export path (vault-relative, absolute, or alongside
// the source when empty).
//
// 05-03: moved into narrative-tool/src/commands/; BUG-03 fixed — output
// honors exportPath via writeDialogueFile (previously wrote alongside the
// source).

const { exportEngine } = require('../engine/export-engine');
const { writeDialogueFile } = require('./paths');
const { loadSharedCharacters } = require('./shared-characters');

// ---------------------------------------------------------------------------
// 1. exportSingleFile — single-file .ncanvas → .dialogue export
// ---------------------------------------------------------------------------

/**
 * Export a single .ncanvas file to a .dialogue file.
 *
 * Reads the file, parses JSON, runs through exportEngine, writes output
 * via writeDialogueFile (honors exportPath).
 * Gracefully handles JSON parse errors and exportEngine exceptions.
 *
 * @param {Object} app - Obsidian App instance
 * @param {Object} file - TFile for the .ncanvas file (must have .path, .basename, .extension)
 * @param {string} exportPath - Export destination: '' (alongside source), absolute (fs), or vault-relative
 * @param {boolean} medEnabled - Passed through to exportEngine config
 * @returns {Promise<{ success: boolean, error?: string, path?: string }>}
 */
async function exportSingleFile(app, file, exportPath, medEnabled) {
    try {
        // 1. Read file content
        const content = await app.vault.read(file);

        // 2. Parse JSON
        let ncanvasJson;
        try {
            ncanvasJson = JSON.parse(content);
        } catch (parseErr) {
            return {
                success: false,
                error: '无法解析 .ncanvas 文件（JSON 格式错误）'
            };
        }

        // 3. Run through export engine (SHR-01: inject shared vault characters)
        const dialogueText = exportEngine(ncanvasJson, {
            medEnabled: !!medEnabled,
            externalCharacters: loadSharedCharacters(app)
        });

        // 4. Write through the shared path module (honors exportPath)
        const result = await writeDialogueFile(
            app,
            exportPath,
            file.basename + '.dialogue',
            file,
            dialogueText
        );

        return { success: true, path: result.path };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ---------------------------------------------------------------------------
// 2. setupAutoExport — register vault.on('modify') debounced export listener
// ---------------------------------------------------------------------------

/**
 * Register a vault 'modify' event listener that auto-exports .ncanvas files
 * on save. Uses a 2-second debounce: rapid successive saves are batched into
 * a single export callback.
 *
 * @param {Object} plugin - NarrativeProjectPlugin instance
 * @param {Function} onExported - Callback receiving results array: [{success, error?, path?}]
 */
function setupAutoExport(plugin, onExported) {
    // Initialize debounce state on the plugin instance
    plugin._autoExportQueue = new Set();
    plugin._autoExportTimer = null;

    const eventRef = plugin.app.vault.on('modify', (file) => {
        // Only process .ncanvas files
        if (!file || file.extension !== 'ncanvas') return;

        // Add file to the debounce set (Set handles dedup)
        plugin._autoExportQueue.add(file);

        // Reset debounce timer
        if (plugin._autoExportTimer) {
            clearTimeout(plugin._autoExportTimer);
        }

        plugin._autoExportTimer = setTimeout(async () => {
            const filesToExport = [...plugin._autoExportQueue];
            plugin._autoExportQueue.clear();

            const results = [];
            for (const f of filesToExport) {
                const result = await exportSingleFile(
                    plugin.app,
                    f,
                    plugin.settings.exportPath,
                    plugin.settings.medEnabled
                );
                results.push(result);
            }

            if (typeof onExported === 'function') {
                onExported(results);
            }
        }, 2000); // 2-second debounce per ROADMAP Phase 4 SC #3
    });

    // Register with Obsidian's plugin lifecycle management
    plugin.registerEvent(eventRef);
}

// ---------------------------------------------------------------------------
// 3. teardownAutoExport — clean up timer and queue
// ---------------------------------------------------------------------------

/**
 * Remove the debounce timer and clear the pending file queue.
 * Note: the vault event listener itself is unregistered automatically
 * by Obsidian when the plugin unloads (via registerEvent).
 *
 * @param {Object} plugin - NarrativeProjectPlugin instance
 */
function teardownAutoExport(plugin) {
    if (plugin._autoExportTimer) {
        clearTimeout(plugin._autoExportTimer);
        plugin._autoExportTimer = null;
    }
    if (plugin._autoExportQueue) {
        plugin._autoExportQueue.clear();
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { exportSingleFile, setupAutoExport, teardownAutoExport };

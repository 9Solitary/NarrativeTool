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
// Reuses Phase 2 dialogue-export exportEngine for format transformation.
// Path logic mirrors batch-export.js but operates on single files only.
//
// 04-03: Auto-Export + Reference Validation

const { exportEngine } = require('../../dialogue-export/src/export-engine');

// ---------------------------------------------------------------------------
// Path normalization helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a path string: backslashes to forward slashes, no trailing slash.
 * @param {string} p
 * @returns {string}
 */
function normalizePath(p) {
    if (typeof p !== 'string') return '';
    return p.replace(/\\/g, '/').replace(/\/$/, '');
}

// ---------------------------------------------------------------------------
// 1. exportSingleFile — single-file .ncanvas → .dialogue export
// ---------------------------------------------------------------------------

/**
 * Export a single .ncanvas file to a .dialogue file.
 *
 * Reads the file, parses JSON, runs through exportEngine, writes output.
 * Gracefully handles JSON parse errors and exportEngine exceptions.
 *
 * @param {Object} app - Obsidian App instance
 * @param {Object} file - TFile for the .ncanvas file (must have .path, .extension)
 * @param {string} exportPath - Vault-relative directory to write .dialogue output
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
                error: 'Failed to parse .ncanvas JSON'
            };
        }

        // 3. Run through export engine
        const dialogueText = exportEngine(ncanvasJson, { medEnabled: !!medEnabled });

        // 4. Construct output path
        // Mirror the file's vault path but replace .ncanvas with .dialogue,
        // and prepend exportPath
        const filePath = normalizePath(file.path);
        const relativePath = filePath.replace(/\.ncanvas$/, '.dialogue');
        const outDir = normalizePath(exportPath || '');
        const outputPath = outDir ? `${outDir}/${relativePath}` : relativePath;

        // 5. Ensure output directory exists (create folders recursively)
        const outputDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
        if (outputDir) {
            await ensureDirectory(app, outputDir);
        }

        // 6. Write output file (create or modify)
        const existing = app.vault.getAbstractFileByPath(outputPath);
        if (existing) {
            await app.vault.modify(existing, dialogueText);
        } else {
            await app.vault.create(outputPath, dialogueText);
        }

        return { success: true, path: outputPath };
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
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Ensure a vault-relative directory path exists, creating folders as needed.
 *
 * @param {Object} app - Obsidian App instance
 * @param {string} dirPath - Vault-relative directory path (e.g. "Exports/Sub")
 */
async function ensureDirectory(app, dirPath) {
    const parts = normalizePath(dirPath).split('/').filter(Boolean);
    let current = '';

    for (const part of parts) {
        const segment = current ? `${current}/${part}` : part;
        const existing = app.vault.getAbstractFileByPath(segment);
        if (!existing) {
            await app.vault.createFolder(segment);
        }
        current = segment;
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { exportSingleFile, setupAutoExport, teardownAutoExport };

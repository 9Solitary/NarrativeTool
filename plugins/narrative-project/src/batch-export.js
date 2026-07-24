// batch-export.js -- Batch export all .ncanvas files to .dialogue
//
// Provides exportAllDialogues() which iterates over all .ncanvas files
// within the configured exportScope, runs each through the dialogue
// exportEngine, and writes .dialogue output files to exportPath.
//
// Reuses Phase 2 dialogue-export exportEngine for the actual format
// transformation — this module handles file I/O and orchestration only.
//
// 04-02: Batch Export + Status Bar

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
    return p.replace(/\\/g, '/').replace(/\/$/, '');
}

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
// Main export function
// ---------------------------------------------------------------------------

/**
 * Export all .ncanvas files within exportScope to .dialogue files in exportPath.
 *
 * @param {Object} app - Obsidian App instance
 * @param {string} exportPath - Vault-relative directory to write .dialogue files
 * @param {string} exportScope - Vault path prefix to scope file discovery ("/" = all)
 * @param {boolean} medEnabled - Whether to include MED state extension syntax
 * @returns {Promise<{ exported: number, failed: number }>}
 */
async function exportAllDialogues(app, exportPath, exportScope, medEnabled) {
    // Normalize inputs
    const outDir = normalizePath(exportPath || '');
    const scopePrefix = normalizePath(exportScope || '/');

    // Collect all .ncanvas files in scope
    const allFiles = app.vault.getFiles();
    const ncanvasFiles = allFiles.filter(f => {
        if (f.extension !== 'ncanvas') return false;
        if (scopePrefix === '') return true; // empty scope means everything
        // A file is in scope if its path starts with scopePrefix + "/"
        // or if scopePrefix is "/" (normalized to "")
        const filePath = normalizePath(f.path);
        if (scopePrefix === '/') return true;
        const prefix = scopePrefix.endsWith('/') ? scopePrefix : scopePrefix + '/';
        return filePath.startsWith(prefix) || filePath === scopePrefix;
    });

    // If scopePrefix is "/" (root), match everything
    // (normalizePath turns "/" into "", so we handle it specially)
    const scopeIsRoot = (exportScope === '/' || scopePrefix === '' || scopePrefix === '/');

    // Re-filter using original exportScope logic
    const inScopeFiles = scopeIsRoot
        ? ncanvasFiles
        : ncanvasFiles.filter(f => {
              const fp = normalizePath(f.path);
              const sp = normalizePath(exportScope);
              return fp.startsWith(sp + '/') || fp === sp;
          });

    let exported = 0;
    let failed = 0;

    for (const file of inScopeFiles) {
        try {
            // 1. Read file content
            const content = await app.vault.read(file);

            // 2. Parse JSON
            let ncanvasJson;
            try {
                ncanvasJson = JSON.parse(content);
            } catch (parseErr) {
                console.warn(`[Narrative Project] JSON parse error in ${file.path}:`, parseErr.message);
                failed++;
                continue;
            }

            // 3. Run through export engine
            const dialogueText = exportEngine(ncanvasJson, { medEnabled: !!medEnabled });

            // 4. Construct output path
            // Remove scope prefix from file path to get relative path,
            // then prepend exportPath
            const filePath = normalizePath(file.path);
            let relativePath;
            if (scopeIsRoot) {
                relativePath = filePath;
            } else {
                const sp = normalizePath(exportScope);
                // Strip the scope prefix from the file path
                if (filePath.startsWith(sp + '/')) {
                    relativePath = filePath.substring(sp.length + 1);
                } else if (filePath === sp) {
                    relativePath = filePath.substring(filePath.lastIndexOf('/') + 1);
                } else {
                    relativePath = filePath;
                }
            }

            // Replace .ncanvas extension with .dialogue
            const dialogueRelPath = relativePath.replace(/\.ncanvas$/, '.dialogue');
            const outputPath = outDir
                ? `${outDir}/${dialogueRelPath}`
                : dialogueRelPath;

            // 5. Ensure output directory exists
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

            exported++;
        } catch (err) {
            console.warn(`[Narrative Project] Export failed for ${file.path}:`, err.message);
            failed++;
            // continue to next file
        }
    }

    return { exported, failed };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { exportAllDialogues };

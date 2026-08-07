// batch-export.js -- Batch export all .ncanvas files to .dialogue
//
// Provides exportAllDialogues() which iterates over all .ncanvas files
// within the configured exportScope, runs each through the dialogue
// exportEngine, and writes .dialogue output files into the configured
// export path (vault-relative via vault API, absolute via node fs —
// see the shared paths.js decision module).
//
// 05-03: moved into narrative-tool/src/commands/; BUG-02 fixed — output
// honors exportPath via writeDialogueFile (previously wrote at vault root).

const fs = require('node:fs');
const path = require('node:path');
const { exportEngine } = require('../engine/export-engine');
const { isAbsoluteExportPath, writeDialogueFile } = require('./paths');
const { loadSharedCharacters } = require('./shared-characters');

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

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Export all .ncanvas files within exportScope to .dialogue files in exportPath.
 *
 * @param {Object} app - Obsidian App instance
 * @param {string} exportPath - Export destination: '' (alongside source), absolute (fs), or vault-relative
 * @param {string} exportScope - Vault path prefix to scope file discovery ("/" = all)
 * @param {boolean} medEnabled - Whether to include MED state extension syntax
 * @param {Function} [onProgress] - Optional (count, total) progress callback (UX-03)
 * @returns {Promise<{ exported: number, failed: number, errors: Array<{file: string, message: string}> }>}
 */
async function exportAllDialogues(app, exportPath, exportScope, medEnabled, onProgress) {
    // Normalize inputs
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
    const errors = [];
    const total = inScopeFiles.length;
    let processed = 0;

    // SHR-01: load shared vault characters once per batch run; the engine
    // uses them as a fallback lookup for gc- cast references.
    const externalCharacters = loadSharedCharacters(app);

    for (const file of inScopeFiles) {
        processed++;
        if (typeof onProgress === 'function') {
            onProgress(processed, total);
        }
        try {
            // 1. Read file content
            const content = await app.vault.read(file);

            // 2. Parse JSON
            let ncanvasJson;
            try {
                ncanvasJson = JSON.parse(content);
            } catch (parseErr) {
                console.warn(`[Narrative Tool] JSON parse error in ${file.path}:`, parseErr.message);
                errors.push({ file: file.path, message: `JSON 解析失败：${parseErr.message}` });
                failed++;
                continue;
            }

            // 3. Run through export engine
            const dialogueText = exportEngine(ncanvasJson, {
                medEnabled: !!medEnabled,
                externalCharacters: externalCharacters
            });

            // 4. Construct output filename (flat basename layout)
            // outBasename = <basename>.dialogue; duplicate-basename prefix
            // rule: check the ACTUAL write target resolved by
            // writeDialogueFile (the export dir, or the alongside-source
            // path) — the old check against the vault root never matched
            // after BUG-02 routed output into exportPath, so same-basename
            // sources silently overwrote each other (CR-01).
            let outBasename = file.basename + '.dialogue';
            const parentDirName = normalizePath(file.path).split('/').slice(0, -1).pop();
            const outDir = normalizePath(exportPath || '');
            const targetPath = outDir
                ? outDir + '/' + outBasename
                : file.path.replace(/\.ncanvas$/, '.dialogue');
            const targetExists = (outDir && isAbsoluteExportPath(outDir))
                ? fs.existsSync(path.join(outDir, outBasename))
                : !!app.vault.getAbstractFileByPath(targetPath);
            if (parentDirName && targetExists) {
                outBasename = parentDirName + '-' + outBasename;
            }

            // 5. Write through the shared path module (honors exportPath)
            const result = await writeDialogueFile(app, exportPath, outBasename, file, dialogueText);

            exported++;
        } catch (err) {
            console.warn(`[Narrative Tool] Export failed for ${file.path}:`, err.message);
            errors.push({ file: file.path, message: err.message });
            failed++;
            // continue to next file
        }
    }

    return { exported, failed, errors };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { exportAllDialogues };

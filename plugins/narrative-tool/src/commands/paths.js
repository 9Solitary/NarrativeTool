// paths.js -- Shared export-path decision + write module
//
// The SINGLE place that decides where .dialogue output goes. Kills the
// 3-copy duplication (batch-export / auto-export / export-current) that
// caused B1 (batch wrote to vault root) and B2 (auto wrote alongside the
// source) in the v0.1 audit.
//
// Decision table (mirrors the consolidated Phase 2 behavior):
//   - empty exportPath       -> vault mode, output alongside the source file
//   - absolute exportPath    -> node fs (mkdirSync recursive + writeFileSync)
//   - vault-relative path    -> vault API create/modify, folders ensured
//
// This module is write-only: parsing and engine formatting stay in the
// callers. It imports node:fs and node:path ONLY — zero obsidian imports,
// so it runs in plain node (unit tests need no obsidian mock).

const fs = require('node:fs');
const path = require('node:path');

/**
 * Decide whether a configured export path is absolute.
 *
 * Accepts both POSIX-style ('/abs/path', 'D:/Godot/dialogues') and
 * Windows-style ('D:\\Godot\\dialogues\\') drive-letter forms.
 *
 * Documented decision: drive-relative 'D:foo' is NOT absolute — it is kept
 * out of the absolute branch (the regex requires a separator after the
 * drive letter), matching the pre-existing detection behavior.
 *
 * @param {string} p - User-configured export path
 * @returns {boolean}
 */
function isAbsoluteExportPath(p) {
    return path.isAbsolute(p) || /^[A-Z]:[/\\]/i.test(p);
}

/**
 * Ensure a vault-relative directory path exists, creating folders as needed.
 *
 * @param {Object} app - Obsidian App instance
 * @param {string} dirPath - Vault-relative directory path (e.g. "Exports/Sub")
 */
async function ensureDirectory(app, dirPath) {
    const parts = dirPath.replace(/\\/g, '/').split('/').filter(Boolean);
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

/**
 * Write a .dialogue file honoring the configured export path.
 *
 * Returns a result describing where the file actually landed:
 *   - { mode: 'vault',    path: '<vault-relative path>' }
 *   - { mode: 'absolute', path: '<absolute filesystem path>' }
 *
 * @param {Object} app - Obsidian App instance
 * @param {string} exportPath - Configured export path ('' / absolute / vault-relative)
 * @param {string} outFilename - Output file name (usually '<basename>.dialogue')
 * @param {Object} sourceFile - Source TFile (needs .path for the alongside-source branch)
 * @param {string} content - .dialogue text to write
 * @returns {Promise<{mode: 'absolute'|'vault', path: string}>}
 */
async function writeDialogueFile(app, exportPath, outFilename, sourceFile, content) {
    const dir = (exportPath || '').trim();

    // Empty export path -> output alongside the source file (vault mode)
    if (!dir) {
        const outPath = sourceFile.path.replace(/\.ncanvas$/, '.dialogue');
        const existing = app.vault.getAbstractFileByPath(outPath);
        if (existing) {
            await app.vault.modify(existing, content);
        } else {
            await app.vault.create(outPath, content);
        }
        return { mode: 'vault', path: outPath };
    }

    // Absolute export path -> node fs (desktop-only plugin, user-configured dir)
    if (isAbsoluteExportPath(dir)) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const abs = path.join(dir, outFilename);
        fs.writeFileSync(abs, content, 'utf-8');
        return { mode: 'absolute', path: abs };
    }

    // Vault-relative export path -> vault API, folders created as needed
    const outPath = dir + '/' + outFilename;
    await ensureDirectory(app, outPath.substring(0, outPath.lastIndexOf('/')));
    const existing = app.vault.getAbstractFileByPath(outPath);
    if (existing) {
        await app.vault.modify(existing, content);
    } else {
        await app.vault.create(outPath, content);
    }
    return { mode: 'vault', path: outPath };
}

module.exports = { isAbsoluteExportPath, writeDialogueFile };

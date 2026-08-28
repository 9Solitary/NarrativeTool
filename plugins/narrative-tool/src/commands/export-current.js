// export-current.js -- Deduped single-file "Export current dialogue" command
//
// Merges the two divergent single-file export implementations (the Phase 2
// plugin's main.js and narrative-project's inline command) into one, and
// writes output through the shared paths.js module so the configured
// export path is honored (absolute → fs, vault-relative → vault API,
// empty → alongside source).
//
// 05-03: single canonical implementation replacing the two divergent
// copies (Phase 2 plugin main.js and narrative-project main.js inline
// command).

const { exportEngine } = require('../engine/export-engine');
const { writeDialogueFile } = require('./paths');
const { loadSharedCharacters } = require('./shared-characters');
const { loadSharedVariables } = require('./shared-variables');
const { FileSuggesterModal } = require('../ui/modals');
const { notify } = require('../ui/notify');

/**
 * Export the currently active .ncanvas file (or a picked one) to .dialogue.
 *
 * @param {Object} plugin - Plugin instance exposing .app, .settings, .statusBar
 * @returns {Promise<void>}
 */
async function exportCurrentDialogue(plugin) {
    let activeFile = plugin.app.workspace.getActiveFile()
        || plugin.app.workspace.activeLeaf?.view?.file;

    // Not a .ncanvas file (or nothing open) → picker over vault .ncanvas files
    if (!activeFile || activeFile.extension !== 'ncanvas') {
        const ncanvasFiles = plugin.app.vault.getFiles()
            .filter(f => f.extension === 'ncanvas');
        if (ncanvasFiles.length === 0) {
            notify('库中没有 .ncanvas 文件');
            return;
        }
        new FileSuggesterModal(plugin.app, ncanvasFiles, (chosen) => {
            if (chosen) doExport(plugin, chosen);
        }).open();
        return;
    }

    await doExport(plugin, activeFile);
}

/**
 * Read, parse, format, and write a single .ncanvas file.
 *
 * @param {Object} plugin - Plugin instance exposing .app, .settings, .statusBar
 * @param {Object} file - TFile for the .ncanvas file
 * @returns {Promise<void>}
 */
async function doExport(plugin, file) {
    try {
        // 1. Read and parse .ncanvas JSON
        const rawContent = await plugin.app.vault.read(file);
        let ncanvasJson;
        try {
            ncanvasJson = JSON.parse(rawContent);
        } catch (parseErr) {
            notify('解析 .ncanvas 文件失败：JSON 格式错误', 'error');
            return;
        }

        // 2. Run export engine (SHR-01: inject shared vault characters as
        //    fallback lookup; NG-06: inject global variables table, merged
        //    under file-local project.variables)
        const title = ncanvasJson.project?.title || file.basename;
        const warnings = [];
        const dialogueOutput = exportEngine(ncanvasJson, {
            medEnabled: plugin.settings.medEnabled,
            externalCharacters: loadSharedCharacters(plugin.app),
            externalVariables: await loadSharedVariables(plugin.app, plugin.settings.variablesPath),
            warnings: warnings
        });
        if (warnings.length > 0) {
            for (const w of warnings) console.warn('[Narrative Tool] 导出警告:', w);
            notify(`导出 "${title}" 有 ${warnings.length} 条警告（详见控制台）`);
        }

        // 3. Status bar: exporting
        plugin.statusBar.setState('exporting', { count: 1 });

        // 4. Write through the shared path module (honors exportPath)
        const result = await writeDialogueFile(
            plugin.app,
            plugin.settings.exportPath,
            file.basename + '.dialogue',
            file,
            dialogueOutput
        );

        // 5. Success: status bar + notice, revert to pending after 5s
        plugin.statusBar.setState('success', { exported: 1, failed: 0 });
        notify(`已导出 "${title}" → ${result.path}`);
        setTimeout(() => plugin.statusBar.setState('pending'), 5000);
    } catch (err) {
        plugin.statusBar.setState('failure', { message: err.message });
        notify(`导出失败：${err.message}`, 'error');
    }
}

module.exports = { exportCurrentDialogue };

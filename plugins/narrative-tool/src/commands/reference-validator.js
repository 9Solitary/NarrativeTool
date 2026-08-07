// reference-validator.js -- Flow→Dialogue cross-file reference integrity validation
//
// Scans all .canvas files in the vault for file-type nodes that reference
// .ncanvas files, then checks that each referenced file actually exists.
// Reports broken references with full detail for status bar warnings.
//
// PRJ-05: Reference Validation — validate Flow→Dialogue references.
// Scope: .canvas → .ncanvas only (to validate flow-to-dialogue links).
// Reverse (Dialogue→Flow) is out of scope — .ncanvas internal references
// to .canvas are Narrative Canvas editor behavior, not this plugin.
//
// Performance: full scan of all .canvas files per invocation (v1 scope,
// acceptable for < 100 .canvas files).
//
// 04-03: Auto-Export + Reference Validation

// ---------------------------------------------------------------------------
// validateReferences — main export
// ---------------------------------------------------------------------------

/**
 * Validate all .canvas → .ncanvas file references in the vault.
 *
 * Scans every .canvas file, extracts file-type nodes that point to .ncanvas
 * files, and checks vault existence for each referenced file.
 *
 * @param {Object} app - Obsidian App instance
 * @returns {Promise<{
 *   totalRefs: number,
 *   brokenRefs: number,
 *   details: Array<{ canvasPath: string, nodeId: string, referencedFile: string, reason: string }>
 * }>}
 */
async function validateReferences(app) {
    const allFiles = app.vault.getFiles();

    // Filter to .canvas files only
    const canvasFiles = allFiles.filter(f => f.extension === 'canvas');

    let totalRefs = 0;
    const details = [];

    for (const canvasFile of canvasFiles) {
        try {
            const content = await app.vault.read(canvasFile);

            let canvasJson;
            try {
                canvasJson = JSON.parse(content);
            } catch (parseErr) {
                details.push({
                    canvasPath: canvasFile.path,
                    nodeId: '',
                    referencedFile: '',
                    reason: 'canvas JSON 格式错误'
                });
                continue;
            }

            const nodes = canvasJson.nodes || [];

            for (const node of nodes) {
                // Only process file-type nodes pointing to .ncanvas files
                if (node.type !== 'file') continue;
                if (!node.file || !node.file.endsWith('.ncanvas')) continue;

                totalRefs++;

                // Check if the referenced .ncanvas file exists
                const exists = app.vault.getAbstractFileByPath(node.file);
                if (!exists) {
                    details.push({
                        canvasPath: canvasFile.path,
                        nodeId: node.id || '',
                        referencedFile: node.file,
                        reason: '引用的文件不存在'
                    });
                }
            }
        } catch (err) {
            // vault.read failed — report and continue
            details.push({
                canvasPath: canvasFile.path,
                nodeId: '',
                referencedFile: '',
                reason: `读取失败：${err.message}`
            });
        }
    }

    return {
        totalRefs,
        brokenRefs: details.length,
        details
    };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { validateReferences };

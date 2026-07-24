// Dialogue Export Plugin — Obsidian entry point
// Wire the export engine from src/export-engine.js into an Obsidian command.
//
// Follows Pattern 1: Minimal Plugin Wrapper from RESEARCH.md.
// Uses Vault-First Data Access: all I/O through app.vault API.
//
// Phase 2: Real .ncanvas to .dialogue export with Godot DM + MED support.
const { Plugin, Notice } = require('obsidian');
const { exportEngine } = require('./export-engine');

module.exports = class DialogueExportPlugin extends Plugin {
    async onload() {
        console.log('[Dialogue Export] loaded');

        // Register command: Export current dialogue
        this.addCommand({
            id: 'export-current-dialogue',
            name: 'Export current dialogue',
            callback: () => this.exportCurrentDialogue()
        });
    }

    /**
     * Export the currently active .ncanvas file to a .dialogue file.
     *
     * Steps:
     * 1. Get active file from workspace
     * 2. Validate it is a .ncanvas file
     * 3. Read and parse the .ncanvas JSON
     * 4. Run exportEngine with medEnabled: true (default)
     * 5. Write .dialogue output alongside the source file (same directory, same basename)
     * 6. Show success notice
     */
    async exportCurrentDialogue() {
        try {
            // Step 1: Get active file
            const activeFile = this.app.workspace.getActiveFile();

            // Step 2: Validate
            if (!activeFile) {
                new Notice('[Dialogue Export] No active file. Open a .ncanvas file first.');
                return;
            }

            if (activeFile.extension !== 'ncanvas') {
                new Notice('[Dialogue Export] Active file is not a .ncanvas file.');
                return;
            }

            // Step 3: Read and parse .ncanvas
            const rawContent = await this.app.vault.read(activeFile);
            let ncanvasJson;
            try {
                ncanvasJson = JSON.parse(rawContent);
            } catch (parseErr) {
                new Notice('[Dialogue Export] Failed to parse .ncanvas file: invalid JSON.');
                console.error('[Dialogue Export] JSON parse error:', parseErr);
                return;
            }

            // Step 4: Run export engine
            const title = ncanvasJson.project?.title || activeFile.basename;
            console.log(`[Dialogue Export] Exporting "${title}"...`);

            const config = { medEnabled: true };
            const dialogueOutput = exportEngine(ncanvasJson, config);

            // Step 5: Write .dialogue file
            const outputPath = activeFile.path.replace(/\.ncanvas$/, '.dialogue');

            // Check if output file already exists
            const existingFile = this.app.vault.getAbstractFileByPath(outputPath);
            if (existingFile) {
                await this.app.vault.modify(existingFile, dialogueOutput);
            } else {
                await this.app.vault.create(outputPath, dialogueOutput);
            }

            // Step 6: Show success notice
            const lineCount = dialogueOutput.split('\n').filter(l => l.length > 0).length;
            new Notice(`[Dialogue Export] Exported "${title}" → ${outputPath} (${lineCount} lines)`);
            console.log(`[Dialogue Export] Exported "${title}" to ${outputPath} (${lineCount} lines)`);

        } catch (err) {
            console.error('[Dialogue Export] Export failed:', err);
            new Notice(`[Dialogue Export] Export failed: ${err.message}`);
        }
    }

    async onunload() {
        console.log('[Dialogue Export] unloaded');
    }
};

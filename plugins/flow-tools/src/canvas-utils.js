// canvas-utils.js — .canvas JSON file read/write/manipulation utilities
//
// Provides: generateNodeId, createCanvas, addNodeToCanvas, addDialogueNodeToCanvas
//
// Obsidian Canvas .canvas file format:
// {
//   "nodes": [{ "id": "16-char-hex", "type": "text"|"file"|"group", ... }],
//   "edges": [{ "id": "edge-...", "fromNode": "...", "toNode": "...", ... }]
// }
//
// Node ID format: 16-char hex lowercase (crypto.randomBytes(8).toString('hex'))
// Edge ID format: "edge-" prefix + 12-digit zero-padded integer (unique per template)
// JSON indentation: tabs (\t) to match Obsidian Canvas format

const crypto = require('node:crypto');

/**
 * Generate a 16-character hex lowercase node ID.
 * Uses crypto.randomBytes(8).toString('hex') — matches Obsidian Canvas ID format.
 * @returns {string} 16-char hex lowercase
 */
function generateNodeId() {
    return crypto.randomBytes(8).toString('hex');
}

/**
 * Create a new empty .canvas JSON object.
 * @returns {{ nodes: any[], edges: any[] }}
 */
function createCanvas() {
    return { nodes: [], edges: [] };
}

/**
 * Add a node to an existing canvas object.
 * Preserves all unknown fields via spread — does not mutate the original canvas.
 * @param {{ nodes: any[], edges: any[] }} canvas - parsed canvas JSON
 * @param {Object} node - node to add (must have id, type, x, y, width, height)
 * @returns {Object} new canvas object with node appended to nodes[]
 */
function addNodeToCanvas(canvas, node) {
    return {
        ...canvas,
        nodes: [...canvas.nodes, node],
    };
}

/**
 * Add a type: "file" node pointing to a dialogue .ncanvas file.
 * Convenience wrapper around addNodeToCanvas.
 * @param {{ nodes: any[], edges: any[] }} canvas - parsed canvas JSON
 * @param {string} dialoguePath - vault-relative path to .ncanvas file
 * @param {{ x?: number, y?: number }} [position] - optional position (default 0, 0)
 * @param {Function} [idGenerator] - optional ID generator (default generateNodeId)
 * @returns {Object} new canvas object with dialogue node appended
 */
function addDialogueNodeToCanvas(canvas, dialoguePath, position, idGenerator) {
    const genId = idGenerator || generateNodeId;
    const pos = position || {};
    const node = {
        id: genId(),
        type: 'file',
        file: dialoguePath,
        x: typeof pos.x === 'number' ? pos.x : 0,
        y: typeof pos.y === 'number' ? pos.y : 0,
        width: 300,
        height: 200,
    };
    return addNodeToCanvas(canvas, node);
}

module.exports = {
    generateNodeId,
    createCanvas,
    addNodeToCanvas,
    addDialogueNodeToCanvas,
};

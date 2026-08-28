// render-fixture.js — dev-only static SVG render of a .ncanvas fixture
// (Phase 11 M1a visual verification)
//
// Renders nodes (rects + title/body preview text) and edges (the same bezier
// paths the DOM view uses, via src/view/geometry.js) into a standalone SVG so
// layout can be eyeballed without Obsidian:
//
//   node dev/render-fixture.js <file.ncanvas> [more.ncanvas...]
//
// Writes dev/render-<basename>.svg next to this script. Convert to PNG with
// e.g. inkscape for quick viewing. Node heights are estimated (same estimate
// the view uses before DOM measurement), so this approximates — not pixel-
// matches — the in-Obsidian auto-height layout.

const { readFileSync, writeFileSync } = require('node:fs');
const { basename, join } = require('node:path');

const { parseSavedState } = require('../src/model/io');
const { DEFAULT_PORTS } = require('../src/model/constants');
const {
    resolveNodeSize,
    portAnchor,
    edgePath,
    nodeBounds
} = require('../src/view/geometry');

const PAD = 300;

const TYPE_COLORS = {
    Entry: '#3fb950',
    Content: '#8b949e',
    Dialog: '#58a6ff',
    Choice: '#d29922',
    End: '#f85149'
};

function esc(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function truncate(text, max) {
    const clean = String(text).replace(/\s+/g, ' ').trim();
    return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function render(filePath) {
    const { state, errors } = parseSavedState(readFileSync(filePath, 'utf-8'));
    const project = state.project;
    const nodes = project.nodes || [];
    const links = project.links || [];
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const sizes = new Map(nodes.map(n => [n.id, resolveNodeSize(n, undefined)]));
    const bounds = nodeBounds(nodes, sizes);

    const out = [];
    const x0 = bounds.minX - PAD;
    const y0 = bounds.minY - PAD;
    const w = (bounds.maxX - bounds.minX) + PAD * 2;
    const h = (bounds.maxY - bounds.minY) + PAD * 2;
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${w}" height="${h}">`);
    out.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#0d1117"/>`);

    // Edges (under nodes)
    for (const link of links) {
        const from = nodeById.get(link.from);
        const to = nodeById.get(link.to);
        if (!from || !to) continue;
        const p0 = portAnchor(from, sizes.get(from.id),
            from.ports?.output?.side ?? DEFAULT_PORTS.output.side,
            from.ports?.output?.t ?? DEFAULT_PORTS.output.t);
        const p1 = portAnchor(to, sizes.get(to.id),
            to.ports?.input?.side ?? DEFAULT_PORTS.input.side,
            to.ports?.input?.t ?? DEFAULT_PORTS.input.t);
        const { d, mid } = edgePath(p0, p1);
        out.push(`<path d="${d}" fill="none" stroke="#6e7681" stroke-width="2"/>`);
        let label = link.label || '';
        if (link.choiceOptionId && Array.isArray(from.choiceOptions)) {
            const opt = from.choiceOptions.find(o => o && o.id === link.choiceOptionId);
            if (opt && opt.label) label = opt.label;
        }
        if (label) {
            out.push(`<text x="${mid.x}" y="${mid.y - 6}" text-anchor="middle" fill="#c9d1d9" font-size="13">${esc(label)}</text>`);
        }
        if (link.requirements) {
            out.push(`<text x="${mid.x}" y="${mid.y + (label ? 12 : -6)}" text-anchor="middle" fill="#8b949e" font-size="11" font-family="monospace">${esc(link.requirements)}</text>`);
        }
    }

    // Nodes
    for (const node of nodes) {
        const size = sizes.get(node.id);
        const color = TYPE_COLORS[node.type] || '#6e7681';
        const dash = TYPE_COLORS[node.type] ? '' : ' stroke-dasharray="6 4"';
        out.push(`<rect x="${node.x}" y="${node.y}" width="${size.width}" height="${size.height}" rx="8" fill="#161b22" stroke="${color}" stroke-width="1.5"${dash}/>`);
        out.push(`<text x="${node.x + 10}" y="${node.y + 22}" fill="${color}" font-size="14" font-weight="bold">${esc(truncate(`${node.type} · ${node.title || ''}`, 40))}</text>`);
        const preview = node.type === 'Choice' && Array.isArray(node.choiceOptions)
            ? node.choiceOptions.map(o => `• ${o.label}`).join('  ')
            : truncate(node.body || '', 120);
        if (preview) {
            out.push(`<text x="${node.x + 10}" y="${node.y + 44}" fill="#c9d1d9" font-size="12">${esc(preview)}</text>`);
        }
    }

    if (errors.length > 0) {
        out.push(`<text x="${x0 + 10}" y="${y0 + 24}" fill="#f85149" font-size="14">parse errors: ${errors.length}</text>`);
    }

    out.push('</svg>');
    const outPath = join(__dirname, `render-${basename(filePath, '.ncanvas')}.svg`);
    writeFileSync(outPath, out.join('\n'), 'utf-8');
    console.log(`[render-fixture] ${basename(filePath)}: ${nodes.length} nodes, ${links.length} links, ${errors.length} errors -> ${outPath}`);
}

for (const file of process.argv.slice(2)) {
    render(file);
}

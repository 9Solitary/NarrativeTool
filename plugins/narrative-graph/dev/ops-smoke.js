// ops-smoke.js — headless edit→export pipeline proof (Phase 11 M1b)
//
// Applies a scripted ops sequence to tests/fixtures/med-nested-choice.ncanvas
// through the pure model layer (no DOM, no Obsidian), then re-exports via the
// narrative-tool engine and prints before/after output:
//
//   node plugins/narrative-graph/dev/ops-smoke.js
//
// Sequence: move a node, edit a body, add a third option to Choice n2, add a
// Content node linked from that option with a requirements condition, add a
// Dialog with turns (body regenerated per NG-05), delete the 'Leave' node
// (link cascade), rename an option (link labels follow at render time).

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const { parseSavedState, serializeSavedState } = require('../src/model/io');
const ops = require('../src/model/ops');
const { exportEngine } = require('../../narrative-tool/src/engine/export-engine');

const FIXTURE = join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'med-nested-choice.ncanvas');

function exportOf(state) {
    const warnings = [];
    const text = exportEngine(parseSavedState(serializeSavedState(state)).state,
        { medEnabled: true, warnings });
    return { text, warnings };
}

const { state, errors } = parseSavedState(readFileSync(FIXTURE, 'utf-8'));
if (errors.length) {
    console.error('fixture has parse errors:', errors);
    process.exit(1);
}

console.log('================ BEFORE (original fixture) ================');
console.log(exportOf(state).text);

// --- scripted ops sequence -------------------------------------------------
ops.moveNode(state, 'n2', 560, 40);
ops.setNodeBody(state, 'n3', 'The merchant smiles and hands you the key. (edited)');

// Add a third option to Choice n2 and branch a new Content node off it.
const n2 = ops.findNode(state, 'n2');
ops.setChoiceOptions(n2, [
    ...n2.choiceOptions.map(o => ({ id: o.id, label: o.label, requires: o.requires, effects: o.effects })),
    { label: 'Ask about the weather', requires: '', effects: [] }
], state.project.nodes);
const weatherOpt = n2.choiceOptions[2].id;

const extra = ops.addNode(state, 'Content', 900, 300);
ops.setNodeBody(state, extra.id, 'The merchant talks about the rain.');
const link = ops.addLink(state, 'n2', extra.id, weatherOpt);
ops.setLinkRequirements(state, link.id, 'flag_honest == true');

// New Dialog with turns -> body regenerated (NG-05).
const dialog = ops.addNode(state, 'Dialog', 900, 560);
ops.setNodeTitle(state, dialog.id, 'Merchant');
ops.setTurns(dialog, [
    { speaker: 'Merchant', line: 'Fine weather for a deal.' },
    { speaker: 'You', line: 'Indeed.' }
]);
ops.addLink(state, extra.id, dialog.id);

// Delete the 'Leave' node (n5): its incoming link l2 must cascade away.
ops.deleteNode(state, 'n5');

console.log('================ AFTER (ops sequence) ================');
const after = exportOf(state);
console.log(after.text);

console.log('================ CHECKS ================');
const reparsed = parseSavedState(serializeSavedState(state));
console.log('re-parse errors:', reparsed.errors.length ? reparsed.errors : 'none');
console.log('export warnings:', after.warnings.length ? after.warnings : 'none');
console.log('dialog body regenerated:', JSON.stringify(ops.findNode(state, dialog.id).body));
console.log('n5 links cascaded:', state.project.links.every(l => l.from !== 'n5' && l.to !== 'n5'));
console.log('new link requirements:', JSON.stringify(ops.findLink(state, link.id).requirements));

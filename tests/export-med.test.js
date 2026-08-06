// export-med.test.js — MED state extension export tests (MED-01 through MED-08)
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const MED_TOKENS = require('../plugins/narrative-tool/src/engine/med-constants').MED_TOKENS;

// Import the format functions directly for unit testing
const medFormat = require('../plugins/narrative-tool/src/engine/med-format');
const { detectMedState, formatMedHeader, formatMedNode } = medFormat;
const { exportEngine } = require('../plugins/narrative-tool/src/engine/export-engine');

const FIXTURES_DIR = join(__dirname, 'fixtures');
const GOLDEN_DIR = join(__dirname, 'golden');

// =========================================================================
// Unit tests: MED Detection (Task 1 — TDD RED phase)
// =========================================================================

describe('MED Detection', () => {
  it('detects MED state when varariables have flag_ prefix', () => {
    const ncanvas = { project: { variables: { flag_test: true } } };
    assert.strictEqual(detectMedState(ncanvas), true);
  });

  it('detects MED state when variables have res_ prefix', () => {
    const ncanvas = { project: { variables: { res_coins: 10 } } };
    assert.strictEqual(detectMedState(ncanvas), true);
  });

  it('returns false for projects without MED constructs', () => {
    const ncanvas = { project: { variables: { coins: 5, name: 'test' } } };
    assert.strictEqual(detectMedState(ncanvas), false);
  });

  it('detects MED state from script.actions with set_flag', () => {
    const ncanvas = {
      project: {
        script: { actions: [{ op: 'set_flag', key: 'flag_done', value: 'true' }] }
      }
    };
    assert.strictEqual(detectMedState(ncanvas), true);
  });

  it('detects MED state from script.actions with add_res', () => {
    const ncanvas = {
      project: {
        script: { actions: [{ op: 'add_res', key: 'res_coins', value: '5' }] }
      }
    };
    assert.strictEqual(detectMedState(ncanvas), true);
  });

  it('detects MED state from script.actions with subtract', () => {
    const ncanvas = {
      project: {
        script: { actions: [{ op: 'subtract', key: 'res_coins', value: '5' }] }
      }
    };
    assert.strictEqual(detectMedState(ncanvas), true);
  });

  it('detects MED state from choiceOptions.requires (non-empty string)', () => {
    const ncanvas = {
      project: {
        variables: {},
        nodes: [{
          id: 'n0', type: 'Choice', title: 'Test',
          choiceOptions: [{ id: 'o1', label: 'A', requires: 'res_coins >= 2' }]
        }]
      }
    };
    assert.strictEqual(detectMedState(ncanvas), true);
  });

  it('detects MED state from choiceOptions.effects with set_flag', () => {
    const ncanvas = {
      project: {
        variables: {},
        nodes: [{
          id: 'n0', type: 'Choice', title: 'Test',
          choiceOptions: [{
            id: 'o1', label: 'A',
            effects: [{ trigger: 'onChoose', op: 'set_flag', key: 'flag_done', value: 'true' }]
          }]
        }]
      }
    };
    assert.strictEqual(detectMedState(ncanvas), true);
  });

  it('detects MED state from choiceOptions.effects with subtract', () => {
    const ncanvas = {
      project: {
        variables: {},
        nodes: [{
          id: 'n0', type: 'Choice', title: 'Test',
          choiceOptions: [{
            id: 'o1', label: 'A',
            effects: [{ trigger: 'onChoose', op: 'subtract', key: 'res_coins', value: '3' }]
          }]
        }]
      }
    };
    assert.strictEqual(detectMedState(ncanvas), true);
  });

  it('returns false for truthy but empty requires strings', () => {
    const ncanvas = {
      project: {
        variables: {},
        nodes: [{
          id: 'n0', type: 'Choice', title: 'Test',
          choiceOptions: [{ id: 'o1', label: 'A', requires: '' }]
        }]
      }
    };
    assert.strictEqual(detectMedState(ncanvas), false);
  });
});

// =========================================================================
// Unit tests: MED Header (Task 1 — TDD RED phase)
// =========================================================================

describe('MED Header', () => {
  it('returns using S + blank line when MED detected', () => {
    const ncanvas = { project: { variables: { flag_ok: true } } };
    const header = formatMedHeader(ncanvas);
    assert.deepStrictEqual(header, ['using S', '']);
  });

  it('returns empty array when no MED detected', () => {
    const ncanvas = { project: { variables: {} } };
    const header = formatMedHeader(ncanvas);
    assert.deepStrictEqual(header, []);
  });
});

// =========================================================================
// Unit tests: MED Format — State Mutations (Task 1 — TDD RED phase)
// =========================================================================

describe('MED Format - State Mutations', () => {
  it('formats set_flag effect for a Choice node', () => {
    const node = {
      type: 'Choice',
      choiceOptions: [{
        id: 'opt1',
        label: 'Test',
        effects: [{ trigger: 'onChoose', op: 'set_flag', key: 'flag_done', value: 'true' }]
      }]
    };
    const lines = formatMedNode(node, { depth: 0, medEnabled: true });
    assert.ok(lines.some(l => l.includes('do set_flag')), 'Should emit do set_flag');
  });

  it('formats add_res effect for a Choice node', () => {
    const node = {
      type: 'Choice',
      choiceOptions: [{
        id: 'opt1',
        label: 'Add',
        effects: [{ trigger: 'onChoose', op: 'add_res', key: 'res_coins', value: '5' }]
      }]
    };
    const lines = formatMedNode(node, { depth: 1, medEnabled: true });
    assert.ok(lines.some(l => l.includes('do add_res') && l.includes('5')), 'Should emit do add_res with positive value');
  });

  it('formats subtract as do add_res with negative value', () => {
    const node = {
      type: 'Choice',
      choiceOptions: [{
        id: 'opt1',
        label: 'Spend',
        effects: [{ trigger: 'onChoose', op: 'subtract', key: 'res_coins', value: '3' }]
      }]
    };
    const lines = formatMedNode(node, { depth: 0, medEnabled: true });
    assert.ok(lines.some(l => l.includes('do add_res') && l.includes('-3')),
      'Should emit do add_res with negative value for subtract');
  });

  it('strips flag_ prefix from key in do set_flag output', () => {
    const node = {
      type: 'Choice',
      choiceOptions: [{
        id: 'opt1',
        label: 'Test',
        effects: [{ trigger: 'onChoose', op: 'set_flag', key: 'flag_watch_missing', value: 'false' }]
      }]
    };
    const lines = formatMedNode(node, { depth: 0, medEnabled: true });
    const flagLine = lines.find(l => l.includes('do set_flag'));
    assert.ok(flagLine, 'Should emit a set_flag line');
    // Should use "watch_missing" not "flag_watch_missing"
    assert.ok(flagLine.includes('watch_missing'), 'Should strip flag_ prefix from key');
  });

  it('strips res_ prefix from key in do add_res output', () => {
    const node = {
      type: 'Choice',
      choiceOptions: [{
        id: 'opt1',
        label: 'Test',
        effects: [{ trigger: 'onChoose', op: 'subtract', key: 'res_coins', value: '2' }]
      }]
    };
    const lines = formatMedNode(node, { depth: 0, medEnabled: true });
    const resLine = lines.find(l => l.includes('do add_res'));
    assert.ok(resLine, 'Should emit an add_res line');
    // Should use "coins" not "res_coins"
    assert.ok(resLine.includes('coins'), 'Should strip res_ prefix from key');
  });

  it('emits mutations at correct indentation depth', () => {
    const node = {
      type: 'Choice',
      choiceOptions: [{
        id: 'opt1',
        label: 'Test',
        effects: [{ trigger: 'onChoose', op: 'set_flag', key: 'flag_done', value: 'true' }]
      }]
    };
    const lines = formatMedNode(node, { depth: 2, medEnabled: true });
    assert.ok(lines.every(l => l.startsWith('\t\t')), 'All lines should be indented to depth 2');
  });

  it('returns empty array for nodes with no MED constructs', () => {
    const node = { type: 'Content', title: 'Plain', body: 'Hello.' };
    const lines = formatMedNode(node, { depth: 0, medEnabled: true });
    assert.deepStrictEqual(lines, []);
  });
});

// =========================================================================
// MED Checks and Terms (as passthrough from body text)
// =========================================================================

describe('MED Format - Checks and Terms', () => {
  it('recognizes nodes with [#check] in body via MED context', () => {
    // The [#check] and [term] tokens are authored directly in .ncanvas body text.
    // The export engine preserves them verbatim (after variable resolution).
    // formatMedNode does not transform the body text — gd-format.js handles body emission.
    // formatMedNode emits mutations only. This test verifies the separation of concerns.
    const node = {
      type: 'Dialog',
      title: 'Guard',
      body: '[#check=flag:has_key:true] Halt!'
    };
    const lines = formatMedNode(node, { depth: 0, medEnabled: true });
    // No state mutations on this node, so formatMedNode returns empty
    assert.deepStrictEqual(lines, []);
  });
});

// =========================================================================
// MED Direct Check (MED-07)
// =========================================================================

describe('MED Format - Direct Check', () => {
  it('emits ~ direct_check for Event nodes with check metadata', () => {
    const node = {
      type: 'Event',
      title: 'Strength Check',
      body: 'The guard tests your strength.',
      customFields: { directCheck: 'strength' }
    };
    const lines = formatMedNode(node, { depth: 0, medEnabled: true });
    assert.ok(lines.some(l => l.includes('~ direct_check')), 'Should emit direct_check cue');
    assert.ok(lines.some(l => l.includes('strength')), 'Should include check id');
  });

  it('emits ~ direct_check using title as fallback check id', () => {
    const node = {
      type: 'Event',
      title: 'Perception Check',
      body: 'You look around carefully.',
      customFields: { directCheck: 'perception' }
    };
    const lines = formatMedNode(node, { depth: 1, medEnabled: true });
    assert.ok(lines.some(l => l.includes('~ direct_check perception')),
      'Should emit direct_check with check id');
  });

  it('does not emit direct_check for non-Event nodes', () => {
    const node = {
      type: 'Content',
      title: 'Plain text',
      body: 'Hello.',
      customFields: { directCheck: 'test' }
    };
    const lines = formatMedNode(node, { depth: 0, medEnabled: true });
    const directCheckLines = lines.filter(l => l.includes('~ direct_check'));
    assert.strictEqual(directCheckLines.length, 0, 'Should not emit direct_check for non-Event nodes');
  });
});

// =========================================================================
// MED Conditional Branching (MED-08)
// =========================================================================

describe('MED Format - Conditional Branching', () => {
  it('emits conditional blocks when some Choice options have requires', () => {
    const node = {
      type: 'Choice',
      title: 'Gatekeeper',
      choiceOptions: [
        { id: 'o1', label: 'Bribe', requires: 'res_coins >= 5', effects: [{ op: 'subtract', key: 'res_coins', value: '5' }] },
        { id: 'o2', label: 'Key', requires: 'flag_has_key == true', effects: [] },
        { id: 'o3', label: 'Walk away', requires: '', effects: [] }
      ]
    };
    const lines = formatMedNode(node, { depth: 0, medEnabled: true });

    // Should contain [if] for first conditional option
    assert.ok(lines.some(l => l.includes('[if res_coins >= 5]')),
      'Should emit [if] block for first conditional option');

    // Should contain [else] for second conditional option
    assert.ok(lines.some(l => l.includes('[else]')),
      'Should emit [else] block for next conditional option');

    // Should contain [/if] at the end
    assert.ok(lines.some(l => l.includes('[/if]')),
      'Should emit [/if] block close');
  });

  it('emits only mutation lines (no conditional blocks) when all requires are empty', () => {
    const node = {
      type: 'Choice',
      title: 'Simple',
      choiceOptions: [
        { id: 'o1', label: 'A', requires: '', effects: [] },
        { id: 'o2', label: 'B', requires: '', effects: [] }
      ]
    };
    const lines = formatMedNode(node, { depth: 0, medEnabled: true });
    assert.ok(lines.length === 0,
      'Should emit no conditional blocks when all options are unconditional');
  });

  it('emits [if] for single conditional option with one unconditional option', () => {
    const node = {
      type: 'Choice',
      title: 'Mixed',
      choiceOptions: [
        { id: 'o1', label: 'Conditional', requires: 'flag_test == true', effects: [] },
        { id: 'o2', label: 'Always', requires: '', effects: [] }
      ]
    };
    const lines = formatMedNode(node, { depth: 0, medEnabled: true });
    assert.ok(lines.length > 0, 'Should emit conditional block');
    assert.ok(lines.some(l => l.includes('[if flag_test == true]')),
      'Should open with [if] for conditional option');
    assert.ok(lines.some(l => l.includes('[else]')),
      'Should include [else] for unconditional option');
  });

  it('emits conditional blocks at correct indentation', () => {
    const node = {
      type: 'Choice',
      title: 'Deep',
      choiceOptions: [
        { id: 'o1', label: 'A', requires: 'x > 0', effects: [] },
        { id: 'o2', label: 'B', requires: '', effects: [] }
      ]
    };
    const lines = formatMedNode(node, { depth: 2, medEnabled: true });
    assert.ok(lines.every(l => l.startsWith('\t\t')),
      'All conditional block lines should be at correct indentation');
  });

  it('does not emit conditional blocks for non-Choice nodes', () => {
    const node = { type: 'Content', title: 'Test', body: 'Hello.' };
    const lines = formatMedNode(node, { depth: 0, medEnabled: true });
    assert.strictEqual(lines.length, 0);
  });
});

// =========================================================================
// MED Variable Resolution (MED-06) — tests via exportEngine integration
// =========================================================================

describe('MED Export - Inline State Display (MED-06)', () => {
  it('res_ variable in body converts to {{res()}} display syntax with medEnabled', () => {
    const ncanvas = {
      project: {
        nodes: [{ id: 'n0', type: 'Entry', title: 'Start', body: 'Coins: {res_coins}', x: 0, y: 0 }],
        links: [],
        variables: { res_coins: 5 }
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: true });
    assert.ok(output.includes('{{res(&"coins")}}'), 'Should use MED display syntax');
  });

  it('flag_ variable in body converts to display syntax with medEnabled', () => {
    const ncanvas = {
      project: {
        nodes: [{ id: 'n0', type: 'Entry', title: 'Start', body: 'Watch: {flag_test}', x: 0, y: 0 }],
        links: [],
        variables: { flag_test: true }
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: true });
    assert.ok(output.includes('{{res(&"test")}}'), 'Should convert flag_ variable to display syntax');
  });

  it('non-prefixed variables resolve to literal values with medEnabled', () => {
    const ncanvas = {
      project: {
        nodes: [{ id: 'n0', type: 'Entry', title: 'Start', body: 'HP: {hp}', x: 0, y: 0 }],
        links: [],
        variables: { hp: 10 }
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: true });
    assert.ok(output.includes('HP: 10'), 'Should resolve non-prefixed variable to literal value');
    assert.ok(!output.includes('{{res('), 'Should NOT use display syntax for non-prefixed vars');
  });

  it('non-prefixed variables resolve to literal values with medEnabled false', () => {
    const ncanvas = {
      project: {
        nodes: [{ id: 'n0', type: 'Entry', title: 'Start', body: 'HP: {hp}', x: 0, y: 0 }],
        links: [],
        variables: { hp: 10 }
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: false });
    assert.ok(output.includes('HP: 10'), 'Should resolve to literal value');
  });

  it('res_ variable resolves to literal value when medEnabled is false', () => {
    const ncanvas = {
      project: {
        nodes: [{ id: 'n0', type: 'Entry', title: 'Start', body: 'Coins: {res_coins}', x: 0, y: 0 }],
        links: [],
        variables: { res_coins: 5 }
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: false });
    assert.ok(output.includes('Coins: 5'), 'Should resolve res_ var to literal when MED disabled');
  });
});

// =========================================================================
// Integration: MED Header (MED-01)
// =========================================================================

describe('MED Export - Integration', () => {
  it('exportEngine with medEnabled true includes using S when MED detected', () => {
    const ncanvas = {
      project: {
        nodes: [{ id: 'n0', type: 'Entry', title: 'Start', body: 'Hello.', x: 0, y: 0 }],
        links: [],
        variables: { flag_test: true }
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: true });
    assert.ok(output.startsWith('using S\n'), 'Output should start with using S');
  });

  it('exportEngine with medEnabled false excludes using S', () => {
    const ncanvas = {
      project: {
        nodes: [{ id: 'n0', type: 'Entry', title: 'Start', body: 'Hello.', x: 0, y: 0 }],
        links: [],
        variables: { flag_test: true }
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: false });
    assert.ok(!output.includes('using S'), 'Output should NOT contain using S');
  });

  it('#check syntax in body text is preserved verbatim', () => {
    const ncanvas = {
      project: {
        nodes: [
          { id: 'n0', type: 'Entry', title: 'Start', body: '', x: 0, y: 0 },
          { id: 'n1', type: 'Dialog', title: 'Guard', body: '[#check=flag:has_key:true] Halt!', x: 0, y: 0 }
        ],
        links: [{ id: 'l0', from: 'n0', to: 'n1' }],
        variables: { flag_has_key: true }
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: true });
    assert.ok(output.includes('[#check=flag:has_key:true]'), 'Should preserve [#check] syntax');
  });

  it('term syntax in body text is preserved verbatim', () => {
    const ncanvas = {
      project: {
        nodes: [
          { id: 'n0', type: 'Entry', title: 'Start', body: '', x: 0, y: 0 },
          { id: 'n1', type: 'Dialog', title: 'Guard', body: 'I sense [term=old_reyes] Old Reyes is nearby.', x: 0, y: 0 }
        ],
        links: [{ id: 'l0', from: 'n0', to: 'n1' }],
        variables: {}
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: true });
    assert.ok(output.includes('[term=old_reyes]'), 'Should preserve [term] syntax');
  });

  it('exportEngine medEnabled false resolves all vars to literal values', () => {
    const ncanvas = {
      project: {
        nodes: [{ id: 'n0', type: 'Entry', title: 'Start', body: 'HP: {hp}, Coins: {res_coins}', x: 0, y: 0 }],
        links: [],
        variables: { hp: 10, res_coins: 3 }
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: false });
    assert.ok(output.includes('HP: 10'), 'Should resolve hp');
    assert.ok(output.includes('Coins: 3'), 'Should resolve res_coins as literal');
    assert.ok(!output.includes('{{res('), 'Should not use MED display syntax');
  });
});

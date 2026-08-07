// export-base.test.js — Base Godot DM export tests (EXP-01 through EXP-07)
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { readFileSync, readdirSync, existsSync } = require('node:fs');
const { join, basename } = require('node:path');

// Import the real export engine
const { exportEngine } = require('../plugins/narrative-tool/src/engine/export-engine');

const FIXTURES_DIR = join(__dirname, 'fixtures');
const GOLDEN_DIR = join(__dirname, 'golden');

// -------------------------------------------------------------------------
// Fixture-driven golden file comparison for ALL .ncanvas fixtures
// -------------------------------------------------------------------------

describe('Dialogue Export - Base DM', () => {
  // Exclude MED-specific fixtures — they are tested separately with medEnabled: true
  const fixtures = readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.ncanvas') && !f.startsWith('.') && !f.startsWith('med-'));

  for (const fixture of fixtures) {
    const name = basename(fixture, '.ncanvas');
    it(`exports ${name}.ncanvas to match golden .dialogue`, () => {
      const fixturePath = join(FIXTURES_DIR, fixture);
      const goldenPath = join(GOLDEN_DIR, `${name}.dialogue`);

      assert.ok(existsSync(goldenPath), `Missing golden file: ${goldenPath}`);

      const ncanvas = JSON.parse(readFileSync(fixturePath, 'utf-8'));
      const output = exportEngine(ncanvas, { medEnabled: false });
      const expected = readFileSync(goldenPath, 'utf-8');

      assert.strictEqual(output, expected,
        `Export for '${fixture}' does not match golden file.\n--- OUTPUT ---\n${output}\n--- EXPECTED ---\n${expected}`);
    });
  }
});

// -------------------------------------------------------------------------
// Unit tests for core algorithm functions
// -------------------------------------------------------------------------

// Unit tests for topologicalSort
describe('Export Engine - Topological Sort', () => {
  it('finds Entry node and returns nodes in DFS order', () => {
    const nodes = [
      { id: 'n0', type: 'Entry', title: 'Start' },
      { id: 'n1', type: 'Dialog', title: 'A' },
      { id: 'n2', type: 'Dialog', title: 'B' },
      { id: 'n3', type: 'Content', title: 'Unreachable' }
    ];
    const links = [
      { id: 'l0', from: 'n0', to: 'n1' },
      { id: 'l1', from: 'n1', to: 'n2' }
    ];
    const { topologicalSort } = require('../plugins/narrative-tool/src/engine/export-engine');
    const order = topologicalSort(nodes, links, 'n0');
    const ids = order.map(n => n.id);
    assert.deepStrictEqual(ids, ['n0', 'n1', 'n2']);
  });

  it('excludes unreachable nodes', () => {
    const nodes = [
      { id: 'n0', type: 'Entry', title: 'Start' },
      { id: 'n1', type: 'Dialog', title: 'Orphan' }
    ];
    const links = [];
    const { topologicalSort } = require('../plugins/narrative-tool/src/engine/export-engine');
    const order = topologicalSort(nodes, links, 'n0');
    const ids = order.map(n => n.id);
    assert.deepStrictEqual(ids, ['n0']);
  });

  it('handles graph with no Entry node — uses first node', () => {
    const nodes = [
      { id: 'n1', type: 'Dialog', title: 'First' },
      { id: 'n2', type: 'Dialog', title: 'Second' }
    ];
    const links = [{ id: 'l0', from: 'n1', to: 'n2' }];
    const { topologicalSort } = require('../plugins/narrative-tool/src/engine/export-engine');
    const order = topologicalSort(nodes, links, 'n1');
    assert.strictEqual(order.length, 2);
  });
});

// Unit tests for character resolution
describe('Export Engine - Character Resolution', () => {
  it('resolves character from cast[0] with role Speaker', () => {
    const { resolveCharacter } = require('../plugins/narrative-tool/src/engine/export-engine');
    const node = { cast: [{ characterId: 'c0', role: 'Speaker', name: 'Mara' }] };
    const chars = [{ id: 'c0', name: 'Mara' }];
    assert.strictEqual(resolveCharacter(node, chars), 'Mara');
  });

  it('falls back to node.title when no cast', () => {
    const { resolveCharacter } = require('../plugins/narrative-tool/src/engine/export-engine');
    const node = { title: 'Nathan', body: 'Hello.' };
    assert.strictEqual(resolveCharacter(node, []), 'Nathan');
  });

  it('returns null for narrator/Content nodes', () => {
    const { resolveCharacter } = require('../plugins/narrative-tool/src/engine/export-engine');
    const node = { title: '', body: 'Narrator text.' };
    assert.strictEqual(resolveCharacter(node, []), null);
  });
});

// -------------------------------------------------------------------------
// Robustness tests
// -------------------------------------------------------------------------

describe('Export Engine - Robustness', () => {
  it('returns empty string for empty nodes array', () => {
    const ncanvas = { project: { nodes: [] } };
    const output = exportEngine(ncanvas, { medEnabled: false });
    assert.strictEqual(output, '');
  });

  it('throws for missing project.nodes', () => {
    assert.throws(() => {
      exportEngine({ project: {} }, { medEnabled: false });
    }, /nodes/);
  });

  it('does not throw for any fixture with medEnabled: false', () => {
    const fixtures = readdirSync(FIXTURES_DIR)
      .filter(f => f.endsWith('.ncanvas') && !f.startsWith('.'));
    for (const fixture of fixtures) {
      const fixturePath = join(FIXTURES_DIR, fixture);
      assert.doesNotThrow(() => {
        const ncanvas = JSON.parse(readFileSync(fixturePath, 'utf-8'));
        exportEngine(ncanvas, { medEnabled: false });
      }, `exportEngine should not throw for '${fixture}'`);
    }
  });
});

// -------------------------------------------------------------------------
// Embedded speaker prefix handling (restored fix — UAT C1 regression)
// Users write multi-turn dialogue inside one node body as "Speaker: text"
// lines; the engine must not add a second prefix, must recognize the
// full-width colon (U+FF1A), must keep per-line indentation inside Choice
// subtrees, and must not treat unknown "Name:"-shaped text as a speaker.
// -------------------------------------------------------------------------

describe('Export Engine - Embedded speaker prefixes', () => {
  const baseProject = (body) => ({
    project: {
      characters: [{ id: 'c0', name: '王裕昌' }, { id: 'c1', name: '程靖霖' }],
      nodes: [
        { id: 'n0', type: 'Entry', title: 'Start', body: '' },
        { id: 'n1', type: 'Dialog', title: '掌柜', body, cast: [{ characterId: 'c0', role: 'Speaker' }] }
      ],
      links: [{ id: 'l0', from: 'n0', to: 'n1' }]
    }
  });

  it('does not duplicate a known speaker prefix already in the body', () => {
    const output = exportEngine(baseProject('王裕昌: “哦哟。”'), { medEnabled: false });
    assert.ok(output.includes('王裕昌: “哦哟。”'), 'line kept with single prefix');
    assert.ok(!output.includes('王裕昌: 王裕昌:'), 'no doubled prefix');
  });

  it('recognizes full-width colon (U+FF1A) and normalizes to half-width', () => {
    const output = exportEngine(baseProject('王裕昌：“哦哟。”'), { medEnabled: false });
    assert.ok(output.includes('王裕昌: “哦哟。”'), 'normalized to half-width colon');
    assert.ok(!output.includes('王裕昌：'), 'full-width colon not emitted');
  });

  it('handles multi-line bodies: per-line prefixes, no doubling', () => {
    const body = '程靖霖: “这怎么说？”\n王裕昌: “西边也不好过。”';
    const output = exportEngine(baseProject(body), { medEnabled: false });
    assert.ok(output.includes('程靖霖: “这怎么说？”\n王裕昌: “西边也不好过。”'),
      'each line keeps its own embedded speaker exactly once');
  });

  it('does not treat unknown "Name:"-shaped text as a speaker prefix', () => {
    const output = exportEngine(baseProject('Strength: 5.'), { medEnabled: false });
    assert.ok(output.includes('王裕昌: Strength: 5.'), 'node speaker still prepended');
  });

  it('keeps continuation lines indented inside Choice subtrees', () => {
    const ncanvas = {
      project: {
        characters: [{ id: 'c0', name: '王裕昌' }],
        nodes: [
          { id: 'n0', type: 'Entry', title: 'Start', body: '' },
          { id: 'n1', type: 'Choice', title: 'Q', body: '', choices: ['甲'] },
          { id: 'n2', type: 'Dialog', title: '掌柜',
            body: '王裕昌: “第一行。”\n王裕昌: “第二行。”',
            cast: [{ characterId: 'c0', role: 'Speaker' }] }
        ],
        links: [
          { id: 'l0', from: 'n0', to: 'n1' },
          { id: 'l1', from: 'n1', to: 'n2', choiceIndex: 0 }
        ]
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: false });
    assert.ok(output.includes('\t王裕昌: “第一行。”\n\t王裕昌: “第二行。”'),
      'both lines of a multi-line body are indented inside the option');
  });
});

// export-base.test.js — Base Godot DM export tests (EXP-01 through EXP-07)
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { readFileSync, readdirSync, existsSync } = require('node:fs');
const { join, basename } = require('node:path');

// Import the real export engine
const { exportEngine } = require('../plugins/dialogue-export/src/export-engine');

const FIXTURES_DIR = join(__dirname, 'fixtures');
const GOLDEN_DIR = join(__dirname, 'golden');

// -------------------------------------------------------------------------
// Fixture-driven golden file comparison for ALL .ncanvas fixtures
// -------------------------------------------------------------------------

describe('Dialogue Export - Base DM', () => {
  const fixtures = readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.ncanvas') && !f.startsWith('.'));

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
    const { topologicalSort } = require('../plugins/dialogue-export/src/export-engine');
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
    const { topologicalSort } = require('../plugins/dialogue-export/src/export-engine');
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
    const { topologicalSort } = require('../plugins/dialogue-export/src/export-engine');
    const order = topologicalSort(nodes, links, 'n1');
    assert.strictEqual(order.length, 2);
  });
});

// Unit tests for character resolution
describe('Export Engine - Character Resolution', () => {
  it('resolves character from cast[0] with role Speaker', () => {
    const { resolveCharacter } = require('../plugins/dialogue-export/src/export-engine');
    const node = { cast: [{ characterId: 'c0', role: 'Speaker', name: 'Mara' }] };
    const chars = [{ id: 'c0', name: 'Mara' }];
    assert.strictEqual(resolveCharacter(node, chars), 'Mara');
  });

  it('falls back to node.title when no cast', () => {
    const { resolveCharacter } = require('../plugins/dialogue-export/src/export-engine');
    const node = { title: 'Nathan', body: 'Hello.' };
    assert.strictEqual(resolveCharacter(node, []), 'Nathan');
  });

  it('returns null for narrator/Content nodes', () => {
    const { resolveCharacter } = require('../plugins/dialogue-export/src/export-engine');
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

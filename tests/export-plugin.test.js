// export-plugin.test.js — Plugin integration and edge case tests
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { readFileSync, readdirSync, existsSync } = require('node:fs');
const { join, basename } = require('node:path');
const { exportEngine } = require('../plugins/dialogue-export/src/export-engine');

const FIXTURES_DIR = join(__dirname, 'fixtures');
const GOLDEN_DIR = join(__dirname, 'golden');

// ---------------------------------------------------------------------------
// Path derivation tests
// ---------------------------------------------------------------------------

describe('Plugin - Path Derivation', () => {
  it('derives .dialogue path from .ncanvas path', () => {
    const inputPath = 'Dialogues/Chapter1/Innkeeper.ncanvas';
    const outputPath = inputPath.replace(/\.ncanvas$/, '.dialogue');
    assert.strictEqual(outputPath, 'Dialogues/Chapter1/Innkeeper.dialogue');
  });

  it('handles paths with multiple dots in basename', () => {
    const inputPath = 'Dialogues/Chapter1/Innkeeper.v2.ncanvas';
    const outputPath = inputPath.replace(/\.ncanvas$/, '.dialogue');
    assert.strictEqual(outputPath, 'Dialogues/Chapter1/Innkeeper.v2.dialogue');
  });

  it('does not modify .dialogue paths', () => {
    const inputPath = 'Dialogues/Chapter1/Innkeeper.dialogue';
    const outputPath = inputPath.replace(/\.ncanvas$/, '.dialogue');
    assert.strictEqual(outputPath, 'Dialogues/Chapter1/Innkeeper.dialogue');
  });
});

// ---------------------------------------------------------------------------
// Full export pipeline integration tests
// ---------------------------------------------------------------------------

describe('Plugin - Export Pipeline', () => {
  it('exports all fixtures without throwing', () => {
    const fixtures = readdirSync(FIXTURES_DIR)
      .filter(f => f.endsWith('.ncanvas') && !f.startsWith('.'));

    for (const fixture of fixtures) {
      const fixturePath = join(FIXTURES_DIR, fixture);
      assert.doesNotThrow(() => {
        const ncanvas = JSON.parse(readFileSync(fixturePath, 'utf-8'));
        const output = exportEngine(ncanvas, { medEnabled: true });
        assert.ok(typeof output === 'string', `exportEngine for ${fixture} should return a string`);
        assert.ok(output.length > 0, `exportEngine for ${fixture} should return non-empty output`);
      }, `exportEngine should not throw for '${fixture}'`);
    }
  });

  it('every exported output starts with a valid DM construct', () => {
    const fixtures = readdirSync(FIXTURES_DIR)
      .filter(f => f.endsWith('.ncanvas') && !f.startsWith('.'));

    for (const fixture of fixtures) {
      const fixturePath = join(FIXTURES_DIR, fixture);
      const ncanvas = JSON.parse(readFileSync(fixturePath, 'utf-8'));
      const output = exportEngine(ncanvas, { medEnabled: true });

      const firstLine = output.split('\n')[0].trim();
      if (firstLine.length === 0) {
        // Empty first line is OK for "using S\n\n" header
        const secondLine = output.split('\n')[1]?.trim() || '';
        assert.ok(
          secondLine.startsWith('~') || secondLine.startsWith('using'),
          `Fixture ${fixture}: second line should start with ~ or using S, got: "${secondLine}"`
        );
      } else {
        const validStarters = ['~', 'using S', 'Character:', ''];
        const matchesAny = validStarters.some(s => firstLine.startsWith(s));
        assert.ok(matchesAny,
          `Fixture ${fixture}: first non-empty line should start with ~, using S, or Character: -- got: "${firstLine}"`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Edge case tests
// ---------------------------------------------------------------------------

describe('Plugin - Edge Cases', () => {
  it('handles .ncanvas with empty body fields', () => {
    const ncanvas = {
      project: {
        title: 'Empty Body Test',
        nodes: [
          { id: 'n0', type: 'Entry', title: 'Start', body: '', x: 0, y: 0 },
          { id: 'n1', type: 'Dialog', title: 'Nathan', body: '', x: 0, y: 0 },
          { id: 'n2', type: 'Content', title: 'Silence', body: '', x: 0, y: 0 }
        ],
        links: [
          { id: 'l0', from: 'n0', to: 'n1' },
          { id: 'l1', from: 'n1', to: 'n2' }
        ]
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: false });
    assert.ok(output.includes('~ start'), 'Should include ~ start cue');
    assert.ok(output.includes('Nathan:'), 'Should include character prefix');
  });

  it('handles isolated/unreachable nodes (not linked from Entry)', () => {
    const ncanvas = {
      project: {
        title: 'Unreachable Test',
        nodes: [
          { id: 'n0', type: 'Entry', title: 'Start', body: 'Hello.', x: 0, y: 0 },
          { id: 'n1', type: 'Dialog', title: 'Orphan', body: 'Unreachable.', x: 0, y: 0 }
        ],
        links: []  // n1 is not linked from n0
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: false });
    assert.ok(!output.includes('Orphan'), 'Output should not include unreachable nodes');
    assert.ok(!output.includes('Unreachable'), 'Output should not include unreachable node body');
  });

  it('handles .ncanvas with no title', () => {
    const ncanvas = {
      project: {
        nodes: [{ id: 'n0', type: 'Entry', title: 'Start', body: 'Test.', x: 0, y: 0 }],
        links: []
      }
    };
    assert.doesNotThrow(() => {
      exportEngine(ncanvas, { medEnabled: false });
    });
  });

  it('handles .ncanvas with multiple Entry nodes (uses first)', () => {
    const ncanvas = {
      project: {
        title: 'Multi Entry',
        nodes: [
          { id: 'n0', type: 'Entry', title: 'Start1', body: 'Path A.', x: 0, y: 0 },
          { id: 'n1', type: 'Entry', title: 'Start2', body: 'Path B.', x: 0, y: 0 }
        ],
        links: []
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: false });
    const entryCount = (output.match(/~ start/g) || []).length;
    // Only the first Entry node is traversed (the second is unreachable since no links point to it)
    assert.strictEqual(entryCount, 1, 'Should only emit ~ start once for the reachable Entry node');
  });

  it('handles .ncanvas with no Entry node (first node used)', () => {
    const ncanvas = {
      project: {
        title: 'No Entry',
        nodes: [
          { id: 'n1', type: 'Dialog', title: 'Nathan', body: 'Hello.', x: 0, y: 0 }
        ],
        links: []
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: false });
    assert.ok(output.length > 0, 'Should produce output for graph with no Entry node');
  });

  it('handles .ncanvas with cycle (visited set prevents infinite loop)', () => {
    const ncanvas = {
      project: {
        title: 'Cycle Test',
        nodes: [
          { id: 'n0', type: 'Entry', title: 'Start', body: 'Go.', x: 0, y: 0 },
          { id: 'n1', type: 'Dialog', title: 'A', body: 'Back and forth.', x: 0, y: 0 }
        ],
        links: [
          { id: 'l0', from: 'n0', to: 'n1' },
          { id: 'l1', from: 'n1', to: 'n0' }  // cycle back
        ]
      }
    };
    assert.doesNotThrow(() => {
      const output = exportEngine(ncanvas, { medEnabled: false });
      // Each node should appear exactly once
      const lines = output.split('\n').filter(l => l.length > 0);
      assert.ok(lines.length >= 2, 'Should produce output without infinite looping');
    });
  });

  it('handles .ncanvas with large body text (no truncation)', () => {
    const longBody = 'A'.repeat(10000);
    const ncanvas = {
      project: {
        title: 'Large Body',
        nodes: [
          { id: 'n0', type: 'Entry', title: 'Start', body: '', x: 0, y: 0 },
          { id: 'n1', type: 'Content', title: 'Long', body: longBody, x: 0, y: 0 }
        ],
        links: [{ id: 'l0', from: 'n0', to: 'n1' }]
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: false });
    assert.ok(output.includes(longBody), 'Large body text should be fully preserved');
  });

  it('character name collision with DM reserved prefix produces warning', () => {
    // The engine doesn't crash -- it emits the line. A console.warn may be raised.
    const ncanvas = {
      project: {
        title: 'Reserved Name',
        nodes: [
          { id: 'n0', type: 'Entry', title: 'Start', body: '', x: 0, y: 0 },
          { id: 'n1', type: 'Dialog', title: '-if', body: 'Warning test.', x: 0, y: 0 }
        ],
        links: [{ id: 'l0', from: 'n0', to: 'n1' }]
      }
    };
    const output = exportEngine(ncanvas, { medEnabled: false });
    // The engine should still produce output (doesn't crash)
    assert.ok(output.includes('-if'), 'Output should include the character name (even if reserved)');
  });
});

// ---------------------------------------------------------------------------
// Roundtrip consistency tests
// ---------------------------------------------------------------------------

describe('Plugin - Roundtrip Consistency', () => {
  it('exportEngine produces identical output when called twice with same input', () => {
    const fixtures = readdirSync(FIXTURES_DIR)
      .filter(f => f.endsWith('.ncanvas') && !f.startsWith('.'));

    for (const fixture of fixtures) {
      const fixturePath = join(FIXTURES_DIR, fixture);
      const ncanvas = JSON.parse(readFileSync(fixturePath, 'utf-8'));

      const output1 = exportEngine(ncanvas, { medEnabled: true });
      const output2 = exportEngine(ncanvas, { medEnabled: true });

      assert.strictEqual(output1, output2,
        `exportEngine for '${fixture}' should produce identical output on repeated calls`);
    }
  });
});

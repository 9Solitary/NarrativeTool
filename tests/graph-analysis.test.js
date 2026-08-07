// graph-analysis.test.js — Unit tests for the Phase 6 graph pre-pass (FEAT-01/FEAT-02)
const { describe, it } = require('node:test');
const assert = require('node:assert');

const { analyzeGraph } = require('../plugins/narrative-tool/src/engine/graph-analysis');

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function node(id, type, extra) {
    return { id, type, title: id, ...extra };
}

function link(id, from, to, extra) {
    return { id, from, to, ...extra };
}

// -------------------------------------------------------------------------
// Regression contract: acyclic graphs return all-empty results
// -------------------------------------------------------------------------

describe('analyzeGraph — acyclic graphs (regression contract)', () => {
    it('returns all-empty results for a linear graph', () => {
        const nodes = [node('n0', 'Entry'), node('n1', 'Dialog'), node('n2', 'Dialog')];
        const links = [link('l0', 'n0', 'n1'), link('l1', 'n1', 'n2')];
        const g = analyzeGraph(nodes, links, 'n0');
        assert.strictEqual(g.loops.size, 0);
        assert.strictEqual(g.loopEdges.size, 0);
        assert.strictEqual(g.merges.size, 0);
        assert.deepStrictEqual(g.warnings, []);
    });

    it('returns all-empty results for a choice with distinct branches (no convergence)', () => {
        const nodes = [
            node('n0', 'Entry'),
            node('n1', 'Choice', { choices: ['a', 'b'] }),
            node('n2', 'Dialog'),
            node('n3', 'Dialog')
        ];
        const links = [
            link('l0', 'n0', 'n1'),
            link('l1', 'n1', 'n2', { choiceIndex: 0 }),
            link('l2', 'n1', 'n3', { choiceIndex: 1 })
        ];
        const g = analyzeGraph(nodes, links, 'n0');
        assert.strictEqual(g.loops.size, 0);
        assert.strictEqual(g.loopEdges.size, 0);
        assert.strictEqual(g.merges.size, 0);
        assert.deepStrictEqual(g.warnings, []);
    });
});

// -------------------------------------------------------------------------
// FEAT-01: loop detection
// -------------------------------------------------------------------------

describe('analyzeGraph — loop detection (FEAT-01)', () => {
    it('detects a back-edge to an ancestor Choice node', () => {
        const nodes = [
            node('n0', 'Entry'),
            node('n1', 'Choice', { title: 'Shopkeeper Question', choices: ['a'] }),
            node('n2', 'Dialog')
        ];
        const links = [
            link('l0', 'n0', 'n1'),
            link('l1', 'n1', 'n2', { choiceIndex: 0 }),
            link('l2', 'n2', 'n1') // user-drawn loop back to the Choice
        ];
        const g = analyzeGraph(nodes, links, 'n0');
        assert.strictEqual(g.loops.get('n1'), 'shopkeeper_question');
        assert.ok(g.loopEdges.has('l2'));
        assert.strictEqual(g.loopEdges.size, 1);
        assert.deepStrictEqual(g.warnings, []);
    });

    it('falls back to node id when the Choice title slugifies to empty', () => {
        const nodes = [
            node('n0', 'Entry'),
            node('n1', 'Choice', { title: '!!!', choices: ['a'] }),
            node('n2', 'Dialog')
        ];
        const links = [
            link('l0', 'n0', 'n1'),
            link('l1', 'n1', 'n2', { choiceIndex: 0 }),
            link('l2', 'n2', 'n1')
        ];
        const g = analyzeGraph(nodes, links, 'n0');
        assert.strictEqual(g.loops.get('n1'), 'n1');
    });

    it('warns on cycles to non-Choice nodes and does not register a loop', () => {
        const nodes = [node('n0', 'Entry'), node('n1', 'Dialog'), node('n2', 'Dialog')];
        const links = [
            link('l0', 'n0', 'n1'),
            link('l1', 'n1', 'n2'),
            link('l2', 'n2', 'n1') // cycle to a Dialog — unsupported
        ];
        const g = analyzeGraph(nodes, links, 'n0');
        assert.strictEqual(g.loops.size, 0);
        assert.strictEqual(g.loopEdges.size, 0);
        assert.strictEqual(g.warnings.length, 1);
        assert.match(g.warnings[0], /non-Choice/);
    });

    it('deduplicates cue names that collide with existing Marker cues', () => {
        const nodes = [
            node('n0', 'Entry'),
            node('n1', 'Marker', { title: 'Question' }), // reserves cue "question"
            node('n2', 'Choice', { title: 'Question', choices: ['a'] }),
            node('n3', 'Dialog')
        ];
        const links = [
            link('l0', 'n0', 'n1'),
            link('l1', 'n1', 'n2'),
            link('l2', 'n2', 'n3', { choiceIndex: 0 }),
            link('l3', 'n3', 'n2')
        ];
        const g = analyzeGraph(nodes, links, 'n0');
        assert.strictEqual(g.loops.get('n2'), 'question_2');
    });
});

// -------------------------------------------------------------------------
// End-to-end: ambiguous convergence surfaces a warning via config.warnings
// -------------------------------------------------------------------------

describe('exportEngine — ambiguity warnings (FEAT-02)', () => {
    it('pushes a warning and duplicates content for an ambiguous merge', () => {
        const { readFileSync } = require('node:fs');
        const { join } = require('node:path');
        const { exportEngine } = require('../plugins/narrative-tool/src/engine/export-engine');
        const fixture = JSON.parse(readFileSync(
            join(__dirname, 'fixtures', 'choice-merge-ambiguous.ncanvas'), 'utf-8'));
        const warnings = [];
        const output = exportEngine(fixture, { medEnabled: false, warnings });
        assert.strictEqual(warnings.length, 1);
        assert.match(warnings[0], /Ambiguous convergence/);
        // Duplicated, not deduplicated: no merge cue emitted
        assert.ok(!output.includes('~ merge_'), 'ambiguous merge must not emit a shared section');
        assert.ok(!output.includes('=> merge_'), 'ambiguous merge must not emit jump lines');
    });
});

// -------------------------------------------------------------------------
// FEAT-02: merge detection
// -------------------------------------------------------------------------

describe('analyzeGraph — merge detection (FEAT-02)', () => {
    it('detects convergence of two branches with an auto-generated cue', () => {
        const nodes = [
            node('n0', 'Entry'),
            node('n1', 'Choice', { choices: ['a', 'b'] }),
            node('n2', 'Dialog'),
            node('n3', 'Dialog'),
            node('n4', 'Dialog') // shared
        ];
        const links = [
            link('l0', 'n0', 'n1'),
            link('l1', 'n1', 'n2', { choiceIndex: 0 }),
            link('l2', 'n1', 'n3', { choiceIndex: 1 }),
            link('l3', 'n2', 'n4'),
            link('l4', 'n3', 'n4')
        ];
        const g = analyzeGraph(nodes, links, 'n0');
        assert.strictEqual(g.merges.get('n4'), 'merge_01');
        assert.deepStrictEqual(g.warnings, []);
    });

    it('names the cue after a Marker at the merge point (D3 hybrid)', () => {
        const nodes = [
            node('n0', 'Entry'),
            node('n1', 'Choice', { choices: ['a', 'b'] }),
            node('n2', 'Dialog'),
            node('n3', 'Dialog'),
            node('n4', 'Marker', { title: 'Shared Path' })
        ];
        const links = [
            link('l0', 'n0', 'n1'),
            link('l1', 'n1', 'n2', { choiceIndex: 0 }),
            link('l2', 'n1', 'n3', { choiceIndex: 1 }),
            link('l3', 'n2', 'n4'),
            link('l4', 'n3', 'n4')
        ];
        const g = analyzeGraph(nodes, links, 'n0');
        assert.strictEqual(g.merges.get('n4'), 'shared_path');
    });

    it('flags convergence whose subtree contains a Choice as ambiguous', () => {
        const nodes = [
            node('n0', 'Entry'),
            node('n1', 'Choice', { choices: ['a', 'b'] }),
            node('n2', 'Dialog'),
            node('n3', 'Dialog'),
            node('n4', 'Dialog'), // shared
            node('n5', 'Choice', { choices: ['x'] }) // Choice inside the shared chain
        ];
        const links = [
            link('l0', 'n0', 'n1'),
            link('l1', 'n1', 'n2', { choiceIndex: 0 }),
            link('l2', 'n1', 'n3', { choiceIndex: 1 }),
            link('l3', 'n2', 'n4'),
            link('l4', 'n3', 'n4'),
            link('l5', 'n4', 'n5')
        ];
        const g = analyzeGraph(nodes, links, 'n0');
        assert.strictEqual(g.merges.size, 0);
        assert.strictEqual(g.warnings.length, 1);
        assert.match(g.warnings[0], /Ambiguous convergence/);
    });

    it('does not treat a loop target Choice with multiple back-edges as a merge', () => {
        const nodes = [
            node('n0', 'Entry'),
            node('n1', 'Choice', { title: 'Q', choices: ['a', 'b'] }),
            node('n2', 'Dialog'),
            node('n3', 'Dialog')
        ];
        const links = [
            link('l0', 'n0', 'n1'),
            link('l1', 'n1', 'n2', { choiceIndex: 0 }),
            link('l2', 'n1', 'n3', { choiceIndex: 1 }),
            link('l3', 'n2', 'n1'), // two loops back
            link('l4', 'n3', 'n1')
        ];
        const g = analyzeGraph(nodes, links, 'n0');
        assert.strictEqual(g.loops.get('n1'), 'q');
        assert.strictEqual(g.loopEdges.size, 2);
        assert.strictEqual(g.merges.size, 0);
        assert.deepStrictEqual(g.warnings, []);
    });
});

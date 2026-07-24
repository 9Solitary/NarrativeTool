// export.test.js -- Fixture-driven export test harness for FND-05
//
// Loads .ncanvas fixture files from tests/fixtures/, runs them through a stub
// export function, and compares output against golden .dialogue files in
// tests/golden/. Establishes the pattern Phase 2 will use for real export tests.
//
// FND-05: node:test infrastructure — fixture .ncanvas -> golden .dialogue comparison.
// Coverage: Stub export pipeline, golden file comparison, fixture auto-discovery.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { readFileSync, readdirSync, existsSync } = require('node:fs');
const { join, basename } = require('node:path');

// -------------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------------

const FIXTURES_DIR = join(__dirname, 'fixtures');
const GOLDEN_DIR = join(__dirname, 'golden');

// -------------------------------------------------------------------------
// Stub Export Function (Phase 1 placeholder)
//
// Phase 1: returns minimal placeholder output in the form:
//   # <project.title>
//   (blank line)
//   Character: Export stub - Phase 1
//
// Phase 2: this will be replaced with the real export engine that converts
// .ncanvas JSON to Godot Dialogue Manager .dialogue format.
// -------------------------------------------------------------------------

/**
 * Minimal stub export that mimics the Phase 2 export pipeline shape.
 *
 * @param {string} ncanvasPath - Absolute path to a .ncanvas JSON file
 * @returns {string} Placeholder .dialogue content
 */
function stubExport(ncanvasPath) {
    const ncanvas = JSON.parse(readFileSync(ncanvasPath, 'utf-8'));
    const title = ncanvas.project?.title || 'untitled';
    return `# ${title}\n\nCharacter: Export stub - Phase 1\n`;
}

// -------------------------------------------------------------------------
// Test: Fixture-driven golden file comparison
// -------------------------------------------------------------------------

describe('Dialogue Export', () => {
    // Auto-discover all .ncanvas fixture files
    const fixtures = readdirSync(FIXTURES_DIR)
        .filter(f => f.endsWith('.ncanvas') && !f.startsWith('.'));

    for (const fixture of fixtures) {
        const name = basename(fixture, '.ncanvas');

        it(`exports ${name}.ncanvas`, () => {
            const fixturePath = join(FIXTURES_DIR, fixture);
            const goldenPath = join(GOLDEN_DIR, `${name}.dialogue`);

            // Ensure the golden file exists
            assert.ok(
                existsSync(goldenPath),
                `Missing golden file for fixture '${fixture}'. Expected: ${goldenPath}`
            );

            const output = stubExport(fixturePath);
            const expected = readFileSync(goldenPath, 'utf-8');

            // Byte-for-byte comparison against golden file
            assert.strictEqual(
                output,
                expected,
                `Export output for '${fixture}' does not match golden file`
            );
        });
    }
});

// -------------------------------------------------------------------------
// Test: No orphan fixtures (every .ncanvas has a matching .dialogue)
// -------------------------------------------------------------------------

describe('Fixture-Golden Pairing', () => {
    it('every .ncanvas fixture has a corresponding .dialogue golden file', () => {
        const fixtureFiles = readdirSync(FIXTURES_DIR)
            .filter(f => f.endsWith('.ncanvas') && !f.startsWith('.'));

        for (const fixture of fixtureFiles) {
            const name = basename(fixture, '.ncanvas');
            const goldenPath = join(GOLDEN_DIR, `${name}.dialogue`);

            assert.ok(
                existsSync(goldenPath),
                `Orphan fixture '${fixture}' — no matching golden file at '${goldenPath}'`
            );
        }
    });
});

// -------------------------------------------------------------------------
// Test: Stub export basic contract
// -------------------------------------------------------------------------

describe('Stub Export Contract', () => {
    it('stubExport() returns a non-empty string', () => {
        const fixtures = readdirSync(FIXTURES_DIR)
            .filter(f => f.endsWith('.ncanvas') && !f.startsWith('.'));

        for (const fixture of fixtures) {
            const fixturePath = join(FIXTURES_DIR, fixture);
            const output = stubExport(fixturePath);

            assert.ok(
                typeof output === 'string',
                `stubExport(${fixture}) should return a string`
            );
            assert.ok(
                output.length > 0,
                `stubExport(${fixture}) should return a non-empty string`
            );
        }
    });

    it('stubExport() includes the project title in the output', () => {
        const fixtures = readdirSync(FIXTURES_DIR)
            .filter(f => f.endsWith('.ncanvas') && !f.startsWith('.'));

        for (const fixture of fixtures) {
            const fixturePath = join(FIXTURES_DIR, fixture);
            const ncanvas = JSON.parse(readFileSync(fixturePath, 'utf-8'));
            const title = ncanvas.project?.title;

            assert.ok(
                title,
                `Fixture '${fixture}' should have a project.title`
            );

            const output = stubExport(fixturePath);

            assert.ok(
                output.includes(title),
                `Output for '${fixture}' should contain the project title '${title}'`
            );
        }
    });
});

// -------------------------------------------------------------------------
// Test: Graceful handling of missing golden files (robustness guard)
// -------------------------------------------------------------------------

describe('Export Robustness', () => {
    it('stubExport() does not throw for any fixture', () => {
        const fixtures = readdirSync(FIXTURES_DIR)
            .filter(f => f.endsWith('.ncanvas') && !f.startsWith('.'));

        for (const fixture of fixtures) {
            const fixturePath = join(FIXTURES_DIR, fixture);

            assert.doesNotThrow(() => {
                stubExport(fixturePath);
            }, `stubExport() should not throw for fixture '${fixture}'`);
        }
    });
});

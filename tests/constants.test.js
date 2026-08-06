// constants.test.js -- Token constant validation for FND-02
//
// Validates that all Godot Dialogue Manager (GD) and MED extension tokens
// are present, non-empty, frozen, and correctly separated across the two
// shared constant files.
//
// FND-02: gd-constants.js contains all DM and MED syntax tokens.
// Coverage: gd-constants.js (TOKENS), med-constants.js (MED_TOKENS)
// (Relocated per D-03: constants merged into plugins/narrative-tool/src/engine/)

const { describe, it } = require('node:test');
const assert = require('node:assert');

// -------------------------------------------------------------------------
// Test: godot-dialogue-manager (GD) base token constants
// -------------------------------------------------------------------------

describe('gd-constants.js — Godot Dialogue Manager Tokens', () => {
    const { TOKENS } = require('../plugins/narrative-tool/src/engine/gd-constants.js');

    // --- Frozen -------------------------------------------------------
    it('TOKENS object is frozen (immutable)', () => {
        assert.ok(
            Object.isFrozen(TOKENS),
            'Expected TOKENS to be frozen'
        );
    });

    // --- Required line-level tokens -----------------------------------
    it('contains all required line-level tokens', () => {
        const required = [
            'CHARACTER_PREFIX',
            'OPTION_PREFIX',
            'CUE_PREFIX',
            'JUMP_PREFIX',
        ];
        for (const key of required) {
            assert.ok(
                key in TOKENS,
                `Missing required line-level token: ${key}`
            );
        }
    });

    // --- Required inline tokens ---------------------------------------
    it('contains all required inline tokens', () => {
        const required = [
            'IF_BLOCK_OPEN',
            'IF_BLOCK_CLOSE',
            'ELSE_BLOCK',
            'TAG_BRACKET_OPEN',
            'TAG_BRACKET_CLOSE',
        ];
        for (const key of required) {
            assert.ok(
                key in TOKENS,
                `Missing required inline token: ${key}`
            );
        }
    });

    // --- Exact token set check ----------------------------------------
    it('exports exactly 9 tokens (line-level + inline)', () => {
        const expected = new Set([
            'CHARACTER_PREFIX',
            'OPTION_PREFIX',
            'CUE_PREFIX',
            'JUMP_PREFIX',
            'IF_BLOCK_OPEN',
            'IF_BLOCK_CLOSE',
            'ELSE_BLOCK',
            'TAG_BRACKET_OPEN',
            'TAG_BRACKET_CLOSE',
        ]);
        const keys = Object.keys(TOKENS);
        assert.strictEqual(keys.length, expected.size);

        const sorted = [...keys].sort().join(',');
        const expectedSorted = [...expected].sort().join(',');
        assert.strictEqual(
            sorted,
            expectedSorted,
            'Token keys do not match expected set'
        );
    });

    // --- Non-empty string values --------------------------------------
    it('every TOKENS property is a non-empty string', () => {
        for (const [key, value] of Object.entries(TOKENS)) {
            assert.strictEqual(
                typeof value,
                'string',
                `${key}: expected string, got ${typeof value}`
            );
            assert.ok(
                value.length > 0,
                `${key}: expected non-empty string`
            );
        }
    });
});

// -------------------------------------------------------------------------
// Test: MED extension token constants
// -------------------------------------------------------------------------

describe('med-constants.js — MED Extension Tokens', () => {
    const { MED_TOKENS } = require('../plugins/narrative-tool/src/engine/med-constants.js');

    // --- Frozen -------------------------------------------------------
    it('MED_TOKENS object is frozen (immutable)', () => {
        assert.ok(
            Object.isFrozen(MED_TOKENS),
            'Expected MED_TOKENS to be frozen'
        );
    });

    // --- Required MED tokens ------------------------------------------
    it('contains all required MED tokens', () => {
        const required = [
            'USING_STATE',
            'SET_FLAG',
            'ADD_RES',
            'CHECK_PATTERN',
            'DIRECT_CHECK',
            'TERM_PATTERN',
            'RES_DISPLAY_PREFIX',
            'RES_DISPLAY_SUFFIX',
        ];
        for (const key of required) {
            assert.ok(
                key in MED_TOKENS,
                `Missing required MED token: ${key}`
            );
        }
    });

    // --- Exact token set check ----------------------------------------
    it('exports exactly 8 MED tokens', () => {
        const expected = new Set([
            'USING_STATE',
            'SET_FLAG',
            'ADD_RES',
            'CHECK_PATTERN',
            'DIRECT_CHECK',
            'TERM_PATTERN',
            'RES_DISPLAY_PREFIX',
            'RES_DISPLAY_SUFFIX',
        ]);
        const keys = Object.keys(MED_TOKENS);
        assert.strictEqual(keys.length, expected.size);

        const sorted = [...keys].sort().join(',');
        const expectedSorted = [...expected].sort().join(',');
        assert.strictEqual(
            sorted,
            expectedSorted,
            'MED_TOKENS keys do not match expected set'
        );
    });

    // --- Non-empty string values --------------------------------------
    it('every MED_TOKENS property is a non-empty string', () => {
        for (const [key, value] of Object.entries(MED_TOKENS)) {
            assert.strictEqual(
                typeof value,
                'string',
                `${key}: expected string, got ${typeof value}`
            );
            assert.ok(
                value.length > 0,
                `${key}: expected non-empty string`
            );
        }
    });
});

// -------------------------------------------------------------------------
// Test: GD and MED constants are separate files
// -------------------------------------------------------------------------

describe('GD and MED token separation', () => {
    it('gd-constants.js and med-constants.js are separate files with distinct exports', () => {
        const gd = require('../plugins/narrative-tool/src/engine/gd-constants.js');
        const med = require('../plugins/narrative-tool/src/engine/med-constants.js');

        // Both export different objects
        assert.ok('TOKENS' in gd, 'gd-constants should export TOKENS');
        assert.ok(
            'MED_TOKENS' in med,
            'med-constants should export MED_TOKENS'
        );

        // They should not be the same object reference
        assert.notStrictEqual(
            gd.TOKENS,
            med.MED_TOKENS,
            'TOKENS and MED_TOKENS should be distinct objects'
        );
    });
});

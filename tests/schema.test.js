// schema.test.js -- Entity schema validation for FND-03
//
// Validates that all four shared/schema entity type definitions (Character,
// Location, Quest, Item) export frozen templates, correct field lists, and
// required-field arrays. Also verifies JSDoc type annotations are present
// in every schema source file.
//
// FND-03: shared/schema/ defines Character, Location, Quest, Item with
//         JSDoc annotations.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

/**
 * Assert a file at `relativePath` (from repo root) contains at least one
 * `@typedef` JSDoc annotation.
 */
function assertHasJSDoc(relativePath) {
    const abs = join(__dirname, '..', relativePath);
    const contents = readFileSync(abs, 'utf-8');
    assert.ok(
        /@typedef/.test(contents),
        `${relativePath} should contain @typedef JSDoc annotation`
    );
}

/**
 * Assert a template object is frozen and has exactly the expected keys.
 */
function assertTemplate(importPath, exportName, expectedKeys) {
    const { [exportName]: template } = require(importPath);

    assert.ok(
        Object.isFrozen(template),
        `${exportName} should be frozen`
    );

    const actualKeys = Object.keys(template).sort();
    const expectedSorted = [...expectedKeys].sort();

    assert.strictEqual(
        actualKeys.join(','),
        expectedSorted.join(','),
        `${exportName} keys mismatch`
    );
}

/**
 * Assert Fields array includes all template keys, and Required includes
 * ['id', 'name'].
 */
function assertFieldsAndRequired(importPath, fieldExport, reqExport, expectedKeys) {
    const { [fieldExport]: fields, [reqExport]: required } = require(importPath);

    // Fields should have the same length as expected keys
    assert.strictEqual(
        fields.length,
        expectedKeys.length,
        `${fieldExport} length mismatch: expected ${expectedKeys.length}, got ${fields.length}`
    );

    // Every expected key should be in Fields
    for (const key of expectedKeys) {
        assert.ok(
            fields.includes(key),
            `${fieldExport} missing key: ${key}`
        );
    }

    // Required should include 'id' and 'name'
    assert.ok(
        required.includes('id'),
        `${reqExport} should include 'id'`
    );
    assert.ok(
        required.includes('name'),
        `${reqExport} should include 'name'`
    );
}

// -------------------------------------------------------------------------
// Test: Character schema
// -------------------------------------------------------------------------

describe('shared/schema/character.js — Character entity', () => {
    const path = '../shared/schema/character.js';
    const expectedKeys = [
        'id',
        'name',
        'role',
        'voice',
        'notes',
        'appearanceScenes',
    ];

    // Template frozen and keys
    it('CharacterTemplate is frozen with correct keys', () => {
        assertTemplate(path, 'CharacterTemplate', expectedKeys);
    });

    // Fields and Required
    it('CharacterFields includes all template keys; CharacterRequired includes id, name', () => {
        assertFieldsAndRequired(
            path,
            'CharacterFields',
            'CharacterRequired',
            expectedKeys
        );
    });

    // JSDoc presence
    it('character.js has @typedef JSDoc annotation', () => {
        assertHasJSDoc('shared/schema/character.js');
    });
});

// -------------------------------------------------------------------------
// Test: Location schema
// -------------------------------------------------------------------------

describe('shared/schema/location.js — Location entity', () => {
    const path = '../shared/schema/location.js';
    const expectedKeys = [
        'id',
        'name',
        'description',
        'region',
        'connectedLocations',
        'notes',
    ];

    it('LocationTemplate is frozen with correct keys', () => {
        assertTemplate(path, 'LocationTemplate', expectedKeys);
    });

    it('LocationFields includes all template keys; LocationRequired includes id, name', () => {
        assertFieldsAndRequired(
            path,
            'LocationFields',
            'LocationRequired',
            expectedKeys
        );
    });

    it('location.js has @typedef JSDoc annotation', () => {
        assertHasJSDoc('shared/schema/location.js');
    });
});

// -------------------------------------------------------------------------
// Test: Quest schema
// -------------------------------------------------------------------------

describe('shared/schema/quest.js — Quest entity', () => {
    const path = '../shared/schema/quest.js';
    const expectedKeys = [
        'id',
        'name',
        'description',
        'questType',
        'prerequisites',
        'stages',
        'giverCharacterId',
        'involvedLocationIds',
        'notes',
    ];

    it('QuestTemplate is frozen with correct keys', () => {
        assertTemplate(path, 'QuestTemplate', expectedKeys);
    });

    it('QuestFields includes all template keys; QuestRequired includes id, name', () => {
        assertFieldsAndRequired(
            path,
            'QuestFields',
            'QuestRequired',
            expectedKeys
        );
    });

    it('quest.js has @typedef JSDoc annotation', () => {
        assertHasJSDoc('shared/schema/quest.js');
    });
});

// -------------------------------------------------------------------------
// Test: Item schema
// -------------------------------------------------------------------------

describe('shared/schema/item.js — Item entity', () => {
    const path = '../shared/schema/item.js';
    const expectedKeys = [
        'id',
        'name',
        'description',
        'itemType',
        'relatedQuestId',
        'ownerCharacterId',
        'notes',
    ];

    it('ItemTemplate is frozen with correct keys', () => {
        assertTemplate(path, 'ItemTemplate', expectedKeys);
    });

    it('ItemFields includes all template keys; ItemRequired includes id, name', () => {
        assertFieldsAndRequired(
            path,
            'ItemFields',
            'ItemRequired',
            expectedKeys
        );
    });

    it('item.js has @typedef JSDoc annotation', () => {
        assertHasJSDoc('shared/schema/item.js');
    });
});

// entity-templates.test.js -- Entity Markdown template tests for ENT-01 through ENT-05
//
// Validates that all four entity template generators (Character, Location, Quest,
// Item) produce correct YAML frontmatter and body content matching golden files.
// Also verifies Graph View tags and YAML injection safety.
//
// ENT-01: Character .md template
// ENT-02: Location .md template
// ENT-03: Quest .md template
// ENT-04: Item .md template
// ENT-05: Graph View tags frontmatter

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

/** Read a golden file from tests/fixtures/ */
function readGolden(filename) {
    const abs = join(__dirname, 'fixtures', filename);
    return readFileSync(abs, 'utf-8');
}

// -------------------------------------------------------------------------
// Test 1: Character template golden match
// -------------------------------------------------------------------------

describe('Character template (ENT-01)', () => {
    it('should match golden file expected-character.md', () => {
        const { createCharacterMd } = require('../plugins/narrative-tool/src/flow/entity-templates');
        const expected = readGolden('expected-character.md');

        const actual = createCharacterMd({
            id: 'bob',
            name: 'Bob',
            role: 'Guard',
            voice: 'Gruff',
            notes: 'Test char',
            appearanceScenes: ['ch1']
        });

        assert.strictEqual(actual, expected);
    });
});

// -------------------------------------------------------------------------
// Test 2: Location template golden match
// -------------------------------------------------------------------------

describe('Location template (ENT-02)', () => {
    it('should match golden file expected-location.md', () => {
        const { createLocationMd } = require('../plugins/narrative-tool/src/flow/entity-templates');
        const expected = readGolden('expected-location.md');

        const actual = createLocationMd({
            id: 'village',
            name: 'Village',
            description: 'A small village',
            region: 'Valley',
            connectedLocations: ['inn'],
            notes: 'Hub location'
        });

        assert.strictEqual(actual, expected);
    });
});

// -------------------------------------------------------------------------
// Test 3: Quest template golden match
// -------------------------------------------------------------------------

describe('Quest template (ENT-03)', () => {
    it('should match golden file expected-quest.md', () => {
        const { createQuestMd } = require('../plugins/narrative-tool/src/flow/entity-templates');
        const expected = readGolden('expected-quest.md');

        const actual = createQuestMd({
            id: 'main-01',
            name: 'Main Quest 01',
            description: 'Save the world',
            questType: 'main',
            prerequisites: [],
            stages: ['Find key', 'Open gate'],
            giverCharacterId: 'elder',
            involvedLocationIds: ['village'],
            notes: ''
        });

        assert.strictEqual(actual, expected);
    });
});

// -------------------------------------------------------------------------
// Test 4: Item template golden match
// -------------------------------------------------------------------------

describe('Item template (ENT-04)', () => {
    it('should match golden file expected-item.md', () => {
        const { createItemMd } = require('../plugins/narrative-tool/src/flow/entity-templates');
        const expected = readGolden('expected-item.md');

        const actual = createItemMd({
            id: 'key01',
            name: 'Rusty Key',
            description: 'Old key',
            itemType: 'key',
            relatedQuestId: 'main-01',
            ownerCharacterId: '',
            notes: ''
        });

        assert.strictEqual(actual, expected);
    });
});

// -------------------------------------------------------------------------
// Test 5: Graph View tags (ENT-05)
// -------------------------------------------------------------------------

describe('Graph View tags (ENT-05)', () => {
    it('character template should contain tags: [character]', () => {
        const { createCharacterMd } = require('../plugins/narrative-tool/src/flow/entity-templates');
        const output = createCharacterMd({
            id: 'bob', name: 'Bob', role: 'Guard', voice: 'Gruff',
            notes: '', appearanceScenes: []
        });
        assert.ok(output.includes('tags: [character]'));
    });

    it('location template should contain tags: [location]', () => {
        const { createLocationMd } = require('../plugins/narrative-tool/src/flow/entity-templates');
        const output = createLocationMd({
            id: 'village', name: 'Village', description: '', region: '',
            connectedLocations: [], notes: ''
        });
        assert.ok(output.includes('tags: [location]'));
    });

    it('quest template should contain tags: [quest]', () => {
        const { createQuestMd } = require('../plugins/narrative-tool/src/flow/entity-templates');
        const output = createQuestMd({
            id: 'main-01', name: 'Main Quest 01', description: '', questType: 'main',
            prerequisites: [], stages: [], giverCharacterId: '', involvedLocationIds: [], notes: ''
        });
        assert.ok(output.includes('tags: [quest]'));
    });

    it('item template should contain tags: [item]', () => {
        const { createItemMd } = require('../plugins/narrative-tool/src/flow/entity-templates');
        const output = createItemMd({
            id: 'key01', name: 'Rusty Key', description: '', itemType: 'key',
            relatedQuestId: '', ownerCharacterId: '', notes: ''
        });
        assert.ok(output.includes('tags: [item]'));
    });
});

// -------------------------------------------------------------------------
// Test 6: Frontmatter required fields
// -------------------------------------------------------------------------

describe('Frontmatter required fields', () => {
    it('all templates should include id and name in YAML frontmatter', () => {
        const { createCharacterMd, createLocationMd, createQuestMd, createItemMd } =
            require('../plugins/narrative-tool/src/flow/entity-templates');

        const charOutput = createCharacterMd({
            id: 'bob', name: 'Bob', role: 'Guard', voice: 'Gruff',
            notes: '', appearanceScenes: []
        });
        const locOutput = createLocationMd({
            id: 'village', name: 'Village', description: '', region: '',
            connectedLocations: [], notes: ''
        });
        const questOutput = createQuestMd({
            id: 'main-01', name: 'Main Quest 01', description: '', questType: 'main',
            prerequisites: [], stages: [], giverCharacterId: '', involvedLocationIds: [], notes: ''
        });
        const itemOutput = createItemMd({
            id: 'key01', name: 'Rusty Key', description: '', itemType: 'key',
            relatedQuestId: '', ownerCharacterId: '', notes: ''
        });

        const regexIds = [
            { label: 'character id', output: charOutput },
            { label: 'character name', output: charOutput },
            { label: 'location id', output: locOutput },
            { label: 'location name', output: locOutput },
            { label: 'quest id', output: questOutput },
            { label: 'quest name', output: questOutput },
            { label: 'item id', output: itemOutput },
            { label: 'item name', output: itemOutput }
        ];

        for (const { label, output } of regexIds) {
            // Check that the field appears in the YAML frontmatter section (between --- and ---)
            const frontmatterMatch = output.match(/^---\n([\s\S]*?)\n---/);
            assert.ok(frontmatterMatch !== null, `${label}: frontmatter section not found`);
            const frontmatter = frontmatterMatch[1];

            // Check for id field
            if (label.endsWith(' id')) {
                assert.ok(/^id: "/m.test(frontmatter), `${label}: id field missing in frontmatter`);
            }
            // Check for name field
            if (label.endsWith(' name')) {
                assert.ok(/^name: "/m.test(frontmatter), `${label}: name field missing in frontmatter`);
            }
        }
    });
});

// -------------------------------------------------------------------------
// Test 7: YAML injection safety
// -------------------------------------------------------------------------

describe('YAML injection safety', () => {
    it('should escape double quotes in name values', () => {
        const { createCharacterMd, createLocationMd, createQuestMd, createItemMd } =
            require('../plugins/narrative-tool/src/flow/entity-templates');

        const nameWithQuotes = 'He said: "Hello"';

        // Character with quoted name
        const charMd = createCharacterMd({
            id: 'bob', name: nameWithQuotes, role: 'Guard', voice: 'Gruff',
            notes: '', appearanceScenes: []
        });
        assert.ok(charMd.includes(`name: "He said: \\"Hello\\""`),
            'Character: quotes should be escaped');

        // Location with quoted name
        const locMd = createLocationMd({
            id: 'v', name: nameWithQuotes, description: '', region: '',
            connectedLocations: [], notes: ''
        });
        assert.ok(locMd.includes(`name: "He said: \\"Hello\\""`),
            'Location: quotes should be escaped');

        // Quest with quoted name
        const questMd = createQuestMd({
            id: 'q', name: nameWithQuotes, description: '', questType: 'side',
            prerequisites: [], stages: [], giverCharacterId: '', involvedLocationIds: [], notes: ''
        });
        assert.ok(questMd.includes(`name: "He said: \\"Hello\\""`),
            'Quest: quotes should be escaped');

        // Item with quoted name
        const itemMd = createItemMd({
            id: 'i', name: nameWithQuotes, description: '', itemType: 'misc',
            relatedQuestId: '', ownerCharacterId: '', notes: ''
        });
        assert.ok(itemMd.includes(`name: "He said: \\"Hello\\""`),
            'Item: quotes should be escaped');
    });

    it('should handle colons in string values without breaking YAML', () => {
        const { createCharacterMd } = require('../plugins/narrative-tool/src/flow/entity-templates');

        const nameWithColon = 'Chapter: The Beginning';
        const md = createCharacterMd({
            id: 'bob', name: nameWithColon, role: 'Guard', voice: 'Gruff',
            notes: '', appearanceScenes: []
        });

        // The value should be in double quotes, colon inside quotes is safe
        assert.ok(md.includes(`name: "Chapter: The Beginning"`),
            'Colons should be safe inside quoted values');
    });
});

// -------------------------------------------------------------------------
// Test 8: Empty optional fields
// -------------------------------------------------------------------------

describe('Empty optional fields', () => {
    it('should not produce invalid YAML for empty arrays', () => {
        const { createLocationMd } = require('../plugins/narrative-tool/src/flow/entity-templates');

        const md = createLocationMd({
            id: 'v', name: 'V', description: '', region: '',
            connectedLocations: [], notes: ''
        });

        // connected_locations should be [] not empty
        assert.ok(md.includes('connected_locations: []'),
            'Empty connectedLocations should produce "[]"');
    });

    it('should produce valid YAML for empty strings', () => {
        const { createItemMd } = require('../plugins/narrative-tool/src/flow/entity-templates');

        const md = createItemMd({
            id: 'i', name: 'I', description: '', itemType: 'misc',
            relatedQuestId: '', ownerCharacterId: '', notes: ''
        });

        // Empty strings should be "" not missing
        assert.ok(md.includes('owner_character_id: ""'),
            'Empty ownerCharacterId should produce ""');
        assert.ok(md.includes('related_quest_id: ""'),
            'Empty relatedQuestId should produce ""');
    });

    it('should not produce empty appearance_scenes value', () => {
        const { createCharacterMd } = require('../plugins/narrative-tool/src/flow/entity-templates');

        const md = createCharacterMd({
            id: 'bob', name: 'Bob', role: 'Guard', voice: 'Gruff',
            notes: '', appearanceScenes: []
        });

        // appearance_scenes should be [] not empty
        assert.ok(md.includes('appearance_scenes: []'),
            'Empty appearanceScenes should produce "[]"');
    });
});

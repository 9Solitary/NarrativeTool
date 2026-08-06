// Character entity type definition -- [source: NarrativeCanvas character model, PROJECT.md entity table]
//
// Defines the Character entity schema used across all three plugins.
// Fields are validated against NarrativeCanvas/tests/fixtures/characters-cast-chips.ncanvas
// which defines characters with: id, name, role, voice, notes (plus appearanceScenes for scope tracking).

/**
 * @typedef {Object} Character
 * @property {string} id - Unique identifier (slug or UUID)
 * @property {string} name - Display name (Chinese or English)
 * @property {string} role - Character role/archetype in the story
 * @property {string} voice - Description of character's speech style/tone
 * @property {string} notes - Freeform design notes
 * @property {string[]} appearanceScenes - List of scene/chapter references where this character appears
 */

/** @type {Character} */
const CharacterTemplate = Object.freeze({
    id: '',
    name: '',
    role: '',
    voice: '',
    notes: '',
    appearanceScenes: []
});

/** @type {string[]} */
const CharacterFields = ['id', 'name', 'role', 'voice', 'notes', 'appearanceScenes'];

/** @type {string[]} */
const CharacterRequired = ['id', 'name'];

module.exports = { CharacterTemplate, CharacterFields, CharacterRequired };

// Quest entity type definition -- [source: PROJECT.md entity table, RESEARCH.md Assumption A4]
//
// Defines the Quest entity schema. Quests represent narrative objectives
// with prerequisites, ordered stages, and character/location associations.

/**
 * @typedef {Object} Quest
 * @property {string} id - Unique identifier (slug or UUID)
 * @property {string} name - Display name of the quest
 * @property {string} description - Narrative description of the quest objective
 * @property {'main'|'side'|'world_event'} questType - Classification: main storyline, side content, or world event
 * @property {string[]} prerequisites - Quest IDs that must be completed before this quest is available
 * @property {string[]} stages - Ordered list of quest stage descriptions
 * @property {string} giverCharacterId - Character ID of the quest giver
 * @property {string[]} involvedLocationIds - Location IDs relevant to this quest
 * @property {string} notes - Freeform design notes
 */

/** @type {Quest} */
const QuestTemplate = Object.freeze({
    id: '',
    name: '',
    description: '',
    questType: '',
    prerequisites: [],
    stages: [],
    giverCharacterId: '',
    involvedLocationIds: [],
    notes: ''
});

/** @type {string[]} */
const QuestFields = ['id', 'name', 'description', 'questType', 'prerequisites', 'stages', 'giverCharacterId', 'involvedLocationIds', 'notes'];

/** @type {string[]} */
const QuestRequired = ['id', 'name'];

module.exports = { QuestTemplate, QuestFields, QuestRequired };

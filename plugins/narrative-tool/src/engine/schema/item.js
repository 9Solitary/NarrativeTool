// Item entity type definition -- [source: PROJECT.md entity table, RESEARCH.md Assumption A4]
//
// Defines the Item entity schema. Items represent objects in the narrative
// world, potentially linked to quests or owned by characters.

/**
 * @typedef {Object} Item
 * @property {string} id - Unique identifier (slug or UUID)
 * @property {string} name - Display name of the item
 * @property {string} description - Prose description of the item
 * @property {'key'|'consumable'|'equipment'|'misc'} itemType - Classification: key item, consumable, equipment, or miscellaneous
 * @property {string} relatedQuestId - Quest ID if this item is quest-related (empty string if not)
 * @property {string} ownerCharacterId - Character ID if this item is owned (empty string if not)
 * @property {string} notes - Freeform design notes
 */

/** @type {Item} */
const ItemTemplate = Object.freeze({
    id: '',
    name: '',
    description: '',
    itemType: '',
    relatedQuestId: '',
    ownerCharacterId: '',
    notes: ''
});

/** @type {string[]} */
const ItemFields = ['id', 'name', 'description', 'itemType', 'relatedQuestId', 'ownerCharacterId', 'notes'];

/** @type {string[]} */
const ItemRequired = ['id', 'name'];

module.exports = { ItemTemplate, ItemFields, ItemRequired };

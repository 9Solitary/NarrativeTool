// entity-templates.js -- Markdown template generators for ENT-01 through ENT-05
//
// Generates .md content with YAML frontmatter for four entity types:
// Character, Location, Quest, Item.
//
// Field definitions are sourced from shared/schema/. Each template function
// takes a plain object with entity fields and returns a complete Markdown
// string ready to write to a Vault file via app.vault.create().

const { CharacterFields, CharacterRequired } = require('../../../shared/schema/character');
const { LocationFields, LocationRequired } = require('../../../shared/schema/location');
const { QuestFields, QuestRequired } = require('../../../shared/schema/quest');
const { ItemFields, ItemRequired } = require('../../../shared/schema/item');

// -------------------------------------------------------------------------
// YAML safety helpers
// -------------------------------------------------------------------------

/**
 * Escape a string value for safe YAML frontmatter. Wraps in double quotes
 * and escapes internal double quotes as \".
 * @param {string} val
 * @returns {string}
 */
function yamlStr(val) {
    if (typeof val !== 'string') return String(val);
    return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/**
 * Format an array of strings as a YAML array: ["a", "b"]
 * @param {string[]} arr
 * @returns {string}
 */
function yamlArr(arr) {
    if (!arr || arr.length === 0) return '[]';
    return '[' + arr.map(s => yamlStr(s)).join(', ') + ']';
}

/**
 * Build the YAML frontmatter section.
 * Each entry is a line like: key: "value" or key: ["a", "b"]
 * @param {[string, string][]} lines - pairs of [key, rendered_value]
 * @param {string} tag - one of 'character', 'location', 'quest', 'item'
 * @returns {string}
 */
function buildFrontmatter(lines, tag) {
    const parts = ['---'];
    for (const [key, val] of lines) {
        parts.push(`${key}: ${val}`);
    }
    parts.push(`tags: [${tag}]`);
    parts.push('---');
    parts.push('');
    parts.push('');
    return parts.join('\n');
}

// -------------------------------------------------------------------------
// createCharacterMd
// -------------------------------------------------------------------------

/**
 * Generate a Character .md file with YAML frontmatter.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.name
 * @param {string} params.role
 * @param {string} params.voice
 * @param {string} params.notes
 * @param {string[]} params.appearanceScenes
 * @returns {string}
 */
function createCharacterMd({ id, name, role, voice, notes, appearanceScenes }) {
    const frontmatterLines = [
        ['id', yamlStr(id)],
        ['name', yamlStr(name)],
        ['role', yamlStr(role)],
        ['voice', yamlStr(voice)],
        ['appearance_scenes', yamlArr(appearanceScenes)]
    ];

    const frontmatter = buildFrontmatter(frontmatterLines, 'character');

    const body = [
        `# ${name}`,
        '',
        `**Role:** ${role}`,
        `**Voice:** ${voice}`,
        ''
    ];

    if (notes) {
        body.push('## Notes', '', notes, '');
    }

    body.push('## Speaker Scenes', '');

    return frontmatter + body.join('\n') + '\n';
}

// -------------------------------------------------------------------------
// createLocationMd
// -------------------------------------------------------------------------

/**
 * Generate a Location .md file with YAML frontmatter.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.name
 * @param {string} params.description
 * @param {string} params.region
 * @param {string[]} params.connectedLocations
 * @param {string} params.notes
 * @returns {string}
 */
function createLocationMd({ id, name, description, region, connectedLocations, notes }) {
    const frontmatterLines = [
        ['id', yamlStr(id)],
        ['name', yamlStr(name)],
        ['description', yamlStr(description)],
        ['region', yamlStr(region)],
        ['connected_locations', yamlArr(connectedLocations)]
    ];

    const frontmatter = buildFrontmatter(frontmatterLines, 'location');

    const body = [
        `# ${name}`,
        '',
        description,
        '',
        `**Region:** ${region}`,
        ''
    ];

    if (connectedLocations && connectedLocations.length > 0) {
        body.push('## 相关地点', '');
        for (const loc of connectedLocations) {
            body.push(`- [[${loc}]]`);
        }
        body.push('');
    }

    if (notes) {
        body.push('## Notes', '', notes);
    }

    return frontmatter + body.join('\n') + '\n';
}

// -------------------------------------------------------------------------
// createQuestMd
// -------------------------------------------------------------------------

/**
 * Generate a Quest .md file with YAML frontmatter.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.name
 * @param {string} params.description
 * @param {string} params.questType
 * @param {string[]} params.prerequisites
 * @param {string[]} params.stages
 * @param {string} params.giverCharacterId
 * @param {string[]} params.involvedLocationIds
 * @param {string} params.notes
 * @returns {string}
 */
function createQuestMd({ id, name, description, questType, prerequisites, stages, giverCharacterId, involvedLocationIds, notes }) {
    const frontmatterLines = [
        ['id', yamlStr(id)],
        ['name', yamlStr(name)],
        ['description', yamlStr(description)],
        ['quest_type', yamlStr(questType)],
        ['prerequisites', yamlArr(prerequisites)],
        ['stages', yamlArr(stages)],
        ['giver_character_id', yamlStr(giverCharacterId)],
        ['involved_location_ids', yamlArr(involvedLocationIds)]
    ];

    const frontmatter = buildFrontmatter(frontmatterLines, 'quest');

    const body = [
        `# ${name}`,
        '',
        description,
        '',
        `**Type:** ${questType}`,
        ''
    ];

    if (stages && stages.length > 0) {
        body.push('## 任务阶段', '');
        stages.forEach((s, i) => body.push(`${i + 1}. ${s}`));
        body.push('');
    }

    if (giverCharacterId) {
        body.push('## 关联角色', '', `- [[${giverCharacterId}]]`, '');
    }

    if (involvedLocationIds && involvedLocationIds.length > 0) {
        body.push('## 关联地点', '');
        for (const locId of involvedLocationIds) {
            body.push(`- [[${locId}]]`);
        }
    }

    return frontmatter + body.join('\n') + '\n';
}

// -------------------------------------------------------------------------
// createItemMd
// -------------------------------------------------------------------------

/**
 * Generate an Item .md file with YAML frontmatter.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.name
 * @param {string} params.description
 * @param {string} params.itemType
 * @param {string} params.relatedQuestId
 * @param {string} params.ownerCharacterId
 * @param {string} params.notes
 * @returns {string}
 */
function createItemMd({ id, name, description, itemType, relatedQuestId, ownerCharacterId, notes }) {
    const frontmatterLines = [
        ['id', yamlStr(id)],
        ['name', yamlStr(name)],
        ['description', yamlStr(description)],
        ['item_type', yamlStr(itemType)],
        ['related_quest_id', yamlStr(relatedQuestId)],
        ['owner_character_id', yamlStr(ownerCharacterId)]
    ];

    const frontmatter = buildFrontmatter(frontmatterLines, 'item');

    const body = [
        `# ${name}`,
        '',
        description,
        '',
        `**Type:** ${itemType}`,
        ''
    ];

    if (relatedQuestId) {
        body.push('## 关联任务', '', `- [[${relatedQuestId}]]`);
    }

    if (ownerCharacterId) {
        body.push('## 持有角色', '', `- [[${ownerCharacterId}]]`);
    }

    return frontmatter + body.join('\n') + '\n';
}

// -------------------------------------------------------------------------
// Exports
// -------------------------------------------------------------------------

module.exports = {
    createCharacterMd,
    createLocationMd,
    createQuestMd,
    createItemMd
};

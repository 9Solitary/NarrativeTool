// Location entity type definition -- [source: PROJECT.md entity table, RESEARCH.md Assumption A4]
//
// Defines the Location entity schema. Locations represent named areas/regions
// within the narrative world, with connections to other locations.

/**
 * @typedef {Object} Location
 * @property {string} id - Unique identifier (slug or UUID)
 * @property {string} name - Display name of the location
 * @property {string} description - Prose description of the location
 * @property {string} region - Broader area or zone this location belongs to
 * @property {string[]} connectedLocations - References to other Location IDs that connect to this one
 * @property {string} notes - Freeform design notes
 */

/** @type {Location} */
const LocationTemplate = Object.freeze({
    id: '',
    name: '',
    description: '',
    region: '',
    connectedLocations: [],
    notes: ''
});

/** @type {string[]} */
const LocationFields = ['id', 'name', 'description', 'region', 'connectedLocations', 'notes'];

/** @type {string[]} */
const LocationRequired = ['id', 'name'];

module.exports = { LocationTemplate, LocationFields, LocationRequired };

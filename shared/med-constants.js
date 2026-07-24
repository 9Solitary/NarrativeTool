// MED state system extension tokens -- [source: documented in ROADMAP.md, assumed comprehensive]
//
// These constants define the MED (Multi-dimensional Event-driven Dialogue)
// extension tokens that extend Godot Dialogue Manager's base syntax with a
// state system (flags, resources, checks) and inline display tokens.
//
// MED tokens are kept in a separate file from gd-constants.js to support
// toggling MED extensions on/off per export profile (see Phase 2).
//
// All tokens are organized by functional category and exported as a single
// frozen MED_TOKENS object to prevent accidental mutation at runtime.

/**
 * @typedef {Object} MEDTokens
 * @property {string} USING_STATE - Declaration that opens a state namespace. Format: "using S"
 * @property {string} SET_FLAG - Mutation command to set a boolean flag. Format: "do set_flag id value"
 * @property {string} ADD_RES - Mutation command to add to a numeric resource. Format: "do add_res id amount"
 * @property {string} CHECK_PATTERN - Prefix for inline stat checks. Format: "[#check=type:id:threshold]"
 * @property {string} DIRECT_CHECK - Direct check cue for stat verification. Format: "~ direct_check ..."
 * @property {string} TERM_PATTERN - Prefix for inline term definitions. Format: "[term=id]"
 * @property {string} RES_DISPLAY_PREFIX - Opening delimiter for inline resource display. Format: "{{res(&\""
 * @property {string} RES_DISPLAY_SUFFIX - Closing delimiter for inline resource display. Format: "\")}}"
 */

/**
 * Declaration tokens -- state namespace and system-level constructs.
 * @type {{ USING_STATE: string }}
 */
const DECLARATION = {
    /** "using S" -- declares the state namespace for MED state operations */
    USING_STATE: "using S"
};

/**
 * Mutation tokens -- commands that modify state (flags, resources).
 * @type {{ SET_FLAG: string, ADD_RES: string }}
 */
const MUTATIONS = {
    /** "do set_flag" -- mutation prefix to set a boolean state flag */
    SET_FLAG: "do set_flag",
    /** "do add_res" -- mutation prefix to add to a numeric state resource */
    ADD_RES: "do add_res"
};

/**
 * Check tokens -- inline and cue-based state verification.
 * @type {{ CHECK_PATTERN: string, DIRECT_CHECK: string }}
 */
const CHECKS = {
    /** "[#check=" -- prefix for inline stat check, followed by type:id:threshold */
    CHECK_PATTERN: "[#check=",
    /** "~ direct_check" -- cue prefix for a direct stat check operation */
    DIRECT_CHECK: "~ direct_check"
};

/**
 * Term tokens -- inline term/glossary definitions.
 * @type {{ TERM_PATTERN: string }}
 */
const TERMS = {
    /** "[term=" -- prefix for inline term reference, followed by term id and closing bracket */
    TERM_PATTERN: "[term="
};

/**
 * Display tokens -- inline resource value rendering.
 * @type {{ RES_DISPLAY_PREFIX: string, RES_DISPLAY_SUFFIX: string }}
 */
const DISPLAY = {
    /** "{{res(&\"" -- opening delimiter for inline resource value display */
    RES_DISPLAY_PREFIX: '{{res(&"',
    /** "\")}}" -- closing delimiter for inline resource value display */
    RES_DISPLAY_SUFFIX: '")}}'
};

/** @type {MEDTokens} */
const MED_TOKENS = Object.freeze({
    ...DECLARATION,
    ...MUTATIONS,
    ...CHECKS,
    ...TERMS,
    ...DISPLAY
});

module.exports = { MED_TOKENS };

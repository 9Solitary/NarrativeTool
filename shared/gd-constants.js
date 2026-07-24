// Godot Dialogue Manager syntax tokens -- [source: documented in ROADMAP.md, assumed comprehensive]
//
// These constants define every syntax token in the Godot Dialogue Manager format
// used by Godot Engine's Dialogue Manager addon. They are consumed by the Dialogue
// Export plugin to generate `.dialogue` files in the canonical DM format.
//
// All tokens are organized by functional category and exported as a single frozen
// TOKENS object to prevent accidental mutation at runtime.

/**
 * @typedef {Object} GDTokens
 * @property {string} CHARACTER_PREFIX - Prefix for character dialogue lines. Format: "Character: text"
 * @property {string} OPTION_PREFIX - Prefix for player choice options. Format: "- option text"
 * @property {string} CUE_PREFIX - Prefix for cue/event lines. Format: "~ cue_name"
 * @property {string} JUMP_PREFIX - Prefix for jump/goto lines. Format: "=> target_label"
 * @property {string} IF_BLOCK_OPEN - Opening tag for conditional blocks. Format: "[if condition]"
 * @property {string} IF_BLOCK_CLOSE - Closing tag for conditional blocks. Format: "[/if]"
 * @property {string} ELSE_BLOCK - Else branch within conditional blocks. Format: "[else]"
 * @property {string} TAG_BRACKET_OPEN - Opening tag bracket. Format: "[#tag_name"
 * @property {string} TAG_BRACKET_CLOSE - Closing bracket for tags. Format: "]"
 */

/**
 * Line-level tokens -- each occupies a full dialogue line as its own entry.
 * @type {{ CHARACTER_PREFIX: string, OPTION_PREFIX: string, CUE_PREFIX: string, JUMP_PREFIX: string }}
 */
const LINE_TOKENS = {
    /** "Character: " -- prefixed to character names to indicate a dialogue line from that character */
    CHARACTER_PREFIX: "Character: ",
    /** "- " -- prefixed to text to create a player-selectable dialogue option */
    OPTION_PREFIX: "- ",
    /** "~ " -- prefixed to a cue name to trigger a named event */
    CUE_PREFIX: "~ ",
    /** "=> " -- prefixed to a target label to jump to another dialogue block */
    JUMP_PREFIX: "=> "
};

/**
 * Inline tokens -- placed within dialogue lines to control flow and metadata.
 * @type {{ IF_BLOCK_OPEN: string, IF_BLOCK_CLOSE: string, ELSE_BLOCK: string, TAG_BRACKET_OPEN: string, TAG_BRACKET_CLOSE: string }}
 */
const INLINE_TOKENS = {
    /** "[if " -- opens a conditional block; followed by a condition expression */
    IF_BLOCK_OPEN: "[if ",
    /** "[/if]" -- closes a conditional block */
    IF_BLOCK_CLOSE: "[/if]",
    /** "[else]" -- alternative branch within a conditional block */
    ELSE_BLOCK: "[else]",
    /** "[#" -- opens a tag bracket; followed by tag name(s) */
    TAG_BRACKET_OPEN: "[#",
    /** "]" -- closes a tag bracket */
    TAG_BRACKET_CLOSE: "]"
};

/** @type {GDTokens} */
const TOKENS = Object.freeze({
    ...LINE_TOKENS,
    ...INLINE_TOKENS
});

module.exports = { TOKENS };

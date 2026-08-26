// med-format.js — MED (Multi-dimensional Event-driven Dialogue) state extension formatter
//
// Provides three exported functions:
//   detectMedState(ncanvas)   — scan project for MED constructs
//   formatMedHeader(ncanvas)  — emit "using S" header when MED detected
//   formatMedNode(node, ctx)  — emit MED-specific lines for a node
//
// Implements all 8 MED requirements (MED-01 through MED-08) as specified
// in 02-02-PLAN.md and 02-RESEARCH.md (Pattern 5: MED State Detection).
//
// Threat mitigations (from threat_model):
//   T-02-05: Validate op types — only process known ops (set_flag, add_res, subtract).
//            Unknown ops logged and skipped.
//   T-02-06: Pass requires strings through as-is. Do NOT execute or eval them.
//            They are opaque strings for the Godot runtime.
//   T-02-07: Emit [#check] and [term] AFTER the Character: prefix + colon,
//            within dialogue text body. (Handled by gd-format.js during body emission.)

const { MED_TOKENS } = require('./med-constants');
const { TOKENS } = require('./gd-constants');

// -------------------------------------------------------------------------
// Utility helpers
// -------------------------------------------------------------------------

/**
 * Return a tab string repeated for the given indentation depth.
 *
 * @param {number} depth - Indentation level
 * @returns {string} Tab characters
 */
function indent(depth) {
    return '\t'.repeat(depth || 0);
}

/**
 * Strip known state prefixes (flag_, res_) from a variable key.
 * Returns the stripped key, or the original if no prefix matches.
 *
 * @param {string} key - The variable key
 * @returns {string} Stripped key
 */
function stripStatePrefix(key) {
    if (typeof key !== 'string') return key;
    return key.replace(/^(flag_|res_)/, '');
}

/**
 * Known/acceptable mutation operation types.
 * Unknown ops are logged and skipped (T-02-05 mitigation).
 */
const KNOWN_MUTATION_OPS = new Set(['set_flag', 'add_res', 'subtract']);

// -------------------------------------------------------------------------
// MED Header — "using S" declaration (MED-01)
// -------------------------------------------------------------------------

/**
 * Generate the MED header lines.
 * Returns ["using S", ""] if MED state is detected, otherwise [].
 *
 * @param {Object} ncanvas - Parsed .ncanvas JSON
 * @returns {Array<string>} Header lines
 */
function formatMedHeader(ncanvas) {
    if (detectMedState(ncanvas)) {
        return [MED_TOKENS.USING_STATE, ''];
    }
    return [];
}

// -------------------------------------------------------------------------
// MED State Detection (MED-01 trigger)
// -------------------------------------------------------------------------

/**
 * Detect whether a .ncanvas project uses MED state system constructs.
 * Returns true if ANY of these are found:
 * - project.variables has any key starting with flag_ or res_
 * - project.script.actions[] has any action with op matching set_flag, add_res, subtract
 * - Any node has choiceOptions[].requires that is a truthy non-empty string
 * - Any node has choiceOptions[].effects[] with op matching set_flag, add_res, subtract
 * - Any link in project.links[] has a non-empty requirements string
 *
 * @param {Object} ncanvas - Parsed .ncanvas JSON
 * @returns {boolean} Whether MED state system is in use
 */
function detectMedState(ncanvas) {
    if (!ncanvas || !ncanvas.project) return false;
    const project = ncanvas.project;

    // Check project.variables for flag_ or res_ prefixed keys
    if (project.variables && typeof project.variables === 'object') {
        const varKeys = Object.keys(project.variables);
        if (varKeys.some(k => k.startsWith('flag_') || k.startsWith('res_'))) {
            return true;
        }
    }

    // Check project.script.actions[] for MED-related ops
    if (project.script && Array.isArray(project.script.actions)) {
        const hasMedAction = project.script.actions.some(
            a => a && a.op && KNOWN_MUTATION_OPS.has(a.op)
        );
        if (hasMedAction) return true;
    }

    // Check project.links[] for conditional requirements (link-level branches)
    if (Array.isArray(project.links)) {
        if (project.links.some(
            l => l && typeof l.requirements === 'string' && l.requirements.trim().length > 0
        )) {
            return true;
        }
    }

    // Check all nodes for MED constructs
    if (Array.isArray(project.nodes)) {
        for (const node of project.nodes) {
            if (!node) continue;

            // Check choiceOptions[].requires for truthy non-empty strings
            if (Array.isArray(node.choiceOptions)) {
                if (node.choiceOptions.some(
                    o => o && typeof o.requires === 'string' && o.requires.trim().length > 0
                )) {
                    return true;
                }

                // Check choiceOptions[].effects[] for MED-related ops
                if (node.choiceOptions.some(o => o && Array.isArray(o.effects) && o.effects.some(
                    e => e && e.op && KNOWN_MUTATION_OPS.has(e.op)
                ))) {
                    return true;
                }
            }
        }
    }

    return false;
}

// -------------------------------------------------------------------------
// MED Node Formatting — main dispatch
// -------------------------------------------------------------------------

/**
 * Format a node using MED extended syntax.
 * Returns an array of lines that should be appended AFTER the base DM formatting.
 *
 * Handles:
 *   - State mutations (MED-02/MED-03): do set_flag, do add_res from choiceOptions.effects[]
 *   - Direct check (MED-07): ~ direct_check for Event nodes with check metadata
 *   - Link conditional branching (MED-08): native if/else blocks via
 *     formatLinkConditionalBlocks (Choice option visibility stays inline
 *     [if condition /], handled by gd-format.js's formatChoiceNode)
 *
 * Note: Inline checks [#check] (MED-04), terms [term] (MED-05), and variable display
 * {{res()}} (MED-06) are handled by gd-format.js's resolveVariables during body
 * text processing. They pass through body text verbatim.
 *
 * @param {Object} node - The .ncanvas node object
 * @param {Object} ctx - Context object (depth, medEnabled, variables, etc.)
 * @returns {Array<string>} MED-specific lines to append to output
 */
function formatMedNode(node, ctx) {
    if (!node || !ctx) return [];

    const lines = [];
    const depth = ctx.depth || 0;

    // State mutations (MED-02, MED-03)
    const mutationLines = emitMutations(node, depth);
    lines.push(...mutationLines);

    // Direct checks (MED-07)
    const directCheckLines = emitDirectCheck(node, depth);
    lines.push(...directCheckLines);

    return lines;
}

// -------------------------------------------------------------------------
// State Mutations — do set_flag / do add_res (MED-02, MED-03)
// -------------------------------------------------------------------------

/**
 * Format mutation lines for a single effect array (e.g., from one choice option).
 * Used by formatChoiceNode to emit per-option mutations inline under target content.
 *
 * Processes:
 *   - op: "set_flag"  → do set_flag <key> <value>
 *   - op: "add_res"   → do add_res <key> <value>
 *   - op: "subtract"  → do add_res <key> -<value>  (subtract is inverse add)
 *
 * Key names have flag_/res_ prefixes stripped for MED output.
 * Unknown ops are silently skipped (T-02-05 mitigation).
 *
 * @param {Array<Object>} effects - Array of effect objects with op, key, value
 * @param {number} depth - Current indentation depth
 * @returns {Array<string>} Mutation lines
 */
function formatMutationsForEffects(effects, depth) {
    if (!Array.isArray(effects)) return [];
    const lines = [];
    const d = depth || 0;

    for (const effect of effects) {
        if (!effect || !effect.op) continue;

        const cleanKey = stripStatePrefix(effect.key || '');

        switch (effect.op) {
            case 'set_flag':
                lines.push(indent(d) +
                    MED_TOKENS.SET_FLAG + ' ' + cleanKey + ' ' + (effect.value !== undefined ? effect.value : ''));
                break;

            case 'add_res':
                lines.push(indent(d) +
                    MED_TOKENS.ADD_RES + ' ' + cleanKey + ' ' + (effect.value !== undefined ? effect.value : ''));
                break;

            case 'subtract':
                lines.push(indent(d) +
                    MED_TOKENS.ADD_RES + ' ' + cleanKey + ' -' + (effect.value !== undefined ? effect.value : '0'));
                break;

            default:
                break;
        }
    }

    return lines;
}

/**
 * Emit state mutation lines for a node's choiceOptions effects (all options merged).
 *
 * @param {Object} node - The .ncanvas node object
 * @param {number} depth - Current indentation depth
 * @returns {Array<string>} Mutation lines
 */
function emitMutations(node, depth) {
    const lines = [];

    // Collect all effects from all choiceOptions
    if (Array.isArray(node.choiceOptions)) {
        for (const opt of node.choiceOptions) {
            if (!opt || !Array.isArray(opt.effects)) continue;
            lines.push(...formatMutationsForEffects(opt.effects, depth));
        }
    }

    return lines;
}

// -------------------------------------------------------------------------
// Direct Check — ~ direct_check (MED-07)
// -------------------------------------------------------------------------

/**
 * Emit direct check cue lines for Event nodes that have check metadata.
 * Lookup order for check id:
 *   1. node.customFields.directCheck
 *   2. Slugified node.title
 *
 * Only applies to nodes with type "Event".
 *
 * @param {Object} node - The .ncanvas node object
 * @param {number} depth - Current indentation depth
 * @returns {Array<string>} Direct check lines
 */
function emitDirectCheck(node, depth) {
    // Only Event nodes can emit direct_check cues
    if (node.type !== 'Event') return [];

    let checkId = null;

    // Priority 1: customFields.directCheck
    if (node.customFields && typeof node.customFields.directCheck === 'string' && node.customFields.directCheck.trim().length > 0) {
        checkId = node.customFields.directCheck.trim();
    }

    // Priority 2: slugified node title
    if (!checkId && node.title) {
        checkId = slugifyForCheck(node.title);
    }

    if (!checkId) return [];

    return [indent(depth) + MED_TOKENS.DIRECT_CHECK + ' ' + checkId];
}

/**
 * Slugify a node title for use as a direct_check id.
 *
 * @param {string} name - Raw name to slugify
 * @returns {string} Slugified check id, or empty string
 */
function slugifyForCheck(name) {
    if (!name || typeof name !== 'string') return '';
    let slug = name
        .toLowerCase()
        .replace(/[\s_]+/g, '_')
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return slug;
}

// -------------------------------------------------------------------------
// Link Conditional Branching — native if/else blocks for link.requirements
// -------------------------------------------------------------------------

/**
 * Wrap the conditional outgoing links of a non-Choice node in native
 * Dialogue Manager if/else blocks (indentation-delimited, no closer).
 * Condition strings are passed through verbatim (T-02-06).
 *
 * Semantics:
 *   - The first link with non-empty requirements opens `if <requirements>`.
 *   - No elif is emitted: each further conditional link is expressed as
 *     `else` + a nested `if` block one level deeper.
 *   - Links with empty requirements form the trailing `else` branch.
 *   - Blocks end by dedent; there is no endif/closer token.
 *   - Returns null when no link carries requirements, so callers fall back
 *     to the plain walk and output stays byte-identical without conditions.
 *
 * @param {Array<Object>} links - Outgoing links of the node, in order
 * @param {number} depth - Indentation depth for the block keywords
 * @param {function(Object, number): Array<string>} walkLink - Renders one
 *   link's subtree (or loop/merge jump line) at the given depth
 * @returns {Array<string>|null} Block lines, or null when nothing to wrap
 */
function formatLinkConditionalBlocks(links, depth, walkLink) {
    const hasRequirements = (l) => l && typeof l.requirements === 'string'
        && l.requirements.trim().length > 0;
    if (!links.some(hasRequirements)) return null;

    const condLinks = links.filter(hasRequirements);
    const elseLinks = links.filter((l) => !hasRequirements(l));
    const lines = [];

    function emitGroup(cond, els, d) {
        const prefix = indent(d);
        lines.push(prefix + TOKENS.IF_OPEN + cond[0].requirements);
        lines.push(...walkLink(cond[0], d + 1));
        const rest = cond.slice(1);
        if (rest.length > 0) {
            // No elif: nest a deeper if block under else
            lines.push(prefix + TOKENS.ELSE);
            emitGroup(rest, els, d + 1);
        } else if (els.length > 0) {
            lines.push(prefix + TOKENS.ELSE);
            for (const l of els) {
                lines.push(...walkLink(l, d + 1));
            }
        }
    }

    emitGroup(condLinks, elseLinks, depth);
    return lines;
}

// -------------------------------------------------------------------------
// Exports
// -------------------------------------------------------------------------

module.exports = {
    detectMedState,
    formatMedHeader,
    formatMedNode,
    formatMutationsForEffects,
    formatLinkConditionalBlocks
};

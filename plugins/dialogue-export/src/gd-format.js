// gd-format.js — Godot Dialogue Manager base syntax formatter
//
// Exports a single `formatNode(node, ctx)` function that dispatches to
// type-specific formatters for all 6 node types (Entry, Dialog, Content,
// Choice, Marker, Event).
//
// As specified in 02-01-PLAN.md and RESEARCH.md Pattern 2 (Format Function Dispatch).

const { TOKENS } = require('../../../shared/gd-constants');

// -------------------------------------------------------------------------
// Utility helpers
// -------------------------------------------------------------------------

/**
 * Return a tab string repeated for the given indentation depth.
 * Godot DM uses tab characters for nesting (confirmed per Basic_Dialogue.md).
 *
 * @param {number} depth - Indentation level
 * @returns {string} Tab characters
 */
function indent(depth) {
    return '\t'.repeat(depth);
}

/**
 * Return text prefixed with the appropriate indentation.
 *
 * @param {number} depth - Indentation level
 * @param {string} text - The line text
 * @returns {string} Indented line
 */
function indentedLine(depth, text) {
    return indent(depth) + text;
}

/**
 * Format a dialogue line with character prefix or plain body text.
 *
 * @param {string|null} characterName - Character display name, or null for narrator
 * @param {string} bodyText - The dialogue body text
 * @returns {string} Formatted line
 */
function formatDialogLine(characterName, bodyText) {
    if (!characterName || characterName.length === 0) {
        // Narrator line — no character prefix
        return bodyText;
    }
    // Godot DM format: "CharacterName: body text" (no "Character: " prefix)
    // The TOKENS.CHARACTER_PREFIX constant is a vocabulary reference, not a literal prefix
    return `${characterName}: ${bodyText}`;
}

/**
 * Slugify a node title for use as a cue name.
 * Godot DM cue names must be alphanumeric + underscore, no spaces.
 * RESEARCH.md Pitfall 5: replace spaces/underscores with single underscore,
 * remove non-alphanumeric-except-underscore chars. If empty, use node.id.
 *
 * @param {string} name - Raw name to slugify
 * @param {string} fallbackId - Node ID to use as fallback
 * @returns {string} Slugified cue name
 */
function slugifyCueName(name, fallbackId) {
    if (!name || typeof name !== 'string') {
        return fallbackId || 'cue';
    }
    // Replace spaces and underscores with single underscore, remove other non-alphanumeric
    let slug = name
        .toLowerCase()
        .replace(/[\s_]+/g, '_')
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    if (!slug || slug.length === 0) {
        return fallbackId || 'cue';
    }
    return slug;
}

/**
 * Resolve a nested key path against an object (e.g., "inventory.coins" -> 3).
 *
 * @param {Object} obj - The variables object
 * @param {string} dotPath - Dot-separated key path
 * @returns {*} The resolved value, or undefined
 */
function resolveNestedKey(obj, dotPath) {
    const parts = dotPath.split('.');
    let current = obj;
    for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined;
        current = current[part];
    }
    return current;
}

/**
 * Replace {variable_name} and {nested.key} patterns in text with literal values.
 * Unresolved patterns stay as-is.
 *
 * @param {string} text - Body text potentially containing {variable} templates
 * @param {Object} variables - project.variables{} object
 * @returns {string} Text with resolved variables
 */
function resolveVariables(text, variables) {
    if (!text || typeof text !== 'string') return text || '';
    if (!variables || typeof variables !== 'object') return text;

    return text.replace(/\{(\w+(?:\.\w+)*)\}/g, (match, key) => {
        const value = resolveNestedKey(variables, key);
        if (value !== undefined) {
            return String(value);
        }
        return match; // Unresolved — leave as-is
    });
}

// -------------------------------------------------------------------------
// Node type formatters
// -------------------------------------------------------------------------

/**
 * Format an Entry node.
 * Emits "~ start" cue line. If node has body content, emits it as well.
 *
 * Entry body is treated as a narrator/dialogue line after the cue.
 *
 * @param {Object} node - The Entry node
 * @param {Object} ctx - Context object with depth, characters, variables, etc.
 * @returns {Array<string>} Output lines
 */
function formatEntryNode(node, ctx) {
    const lines = [];
    lines.push(indentedLine(ctx.depth, '~ start'));

    // If Entry has body text, emit it as plain narrator text (no character prefix)
    // Entry nodes are structural — body content is narration, not character dialogue
    if (node.body && node.body.trim().length > 0) {
        const resolvedBody = resolveVariables(node.body, ctx.variablesObj || ctx.variables);
        lines.push(indentedLine(ctx.depth, resolvedBody));
    }

    return lines;
}

/**
 * Format a Dialog node.
 * Emits "Character: body text". Resolves character name via resolveCharacter
 * in the context, resolves {variables} in body.
 * If node has customFields with readout, emit that as additional line.
 *
 * @param {Object} node - The Dialog node
 * @param {Object} ctx - Context object
 * @returns {Array<string>} Output lines
 */
function formatDialogNode(node, ctx) {
    const lines = [];

    // Resolve character name
    const charName = ctx.resolveCharacter
        ? ctx.resolveCharacter(node, ctx.charactersArr)
        : node.title;

    // Resolve variables in body
    const variables = ctx.variablesObj || ctx.variables;
    const resolvedBody = resolveVariables(node.body, variables);

    lines.push(indentedLine(ctx.depth, formatDialogLine(charName, resolvedBody)));

    // If node has customFields with readout, emit that as additional line
    if (node.customFields && node.customFields.readout) {
        const readoutBody = resolveVariables(node.customFields.readout, variables);
        lines.push(indentedLine(ctx.depth, formatDialogLine(charName, readoutBody)));
    }

    return lines;
}

/**
 * Format a Content node.
 * Emits body text only (narrator, no character prefix).
 * Resolves {variables} in body.
 *
 * @param {Object} node - The Content node
 * @param {Object} ctx - Context object
 * @returns {Array<string>} Output lines
 */
function formatContentNode(node, ctx) {
    if (!node.body || node.body.trim().length === 0) {
        return [];
    }
    const resolvedBody = resolveVariables(node.body, ctx.variablesObj || ctx.variables);
    return [indentedLine(ctx.depth, resolvedBody)];
}

/**
 * Format a Choice node.
 * Emits body text (if present) using character resolution, then emits each
 * choice option as "- option_label". For each option, follows the corresponding
 * link to emit child content at depth+1.
 *
 * Supports both simple `choices[]` (string array) and rich `choiceOptions[]`
 * (objects with `label`, `requires`, `effects`).
 *
 * @param {Object} node - The Choice node
 * @param {Object} ctx - Context object
 * @returns {Array<string>} Output lines
 */
function formatChoiceNode(node, ctx) {
    const lines = [];

    // Emit choice body (the question/statement) if present
    if (node.body && node.body.trim().length > 0) {
        const charName = ctx.resolveCharacter
            ? ctx.resolveCharacter(node, ctx.charactersArr)
            : null;
        const resolvedBody = resolveVariables(node.body, ctx.variablesObj || ctx.variables);
        lines.push(indentedLine(ctx.depth, formatDialogLine(charName, resolvedBody)));
    }

    // Determine choice list: use choiceOptions[] if present (rich format), fallback to choices[]
    const choiceOptions = node.choiceOptions || [];
    const simpleChoices = node.choices || [];

    if (choiceOptions.length > 0) {
        // Rich choice format: choiceOptions[] has { id, label, requires?, effects? }
        for (let i = 0; i < choiceOptions.length; i++) {
            const opt = choiceOptions[i];
            const label = opt.label || `Option ${i + 1}`;
            lines.push(indentedLine(ctx.depth, TOKENS.OPTION_PREFIX + label));

            // Find the target link for this option
            const links = ctx.adjacency.get(node.id) || [];
            const targetLink = links.find(
                l => l.choiceOptionId === opt.id
            );
            if (targetLink && targetLink.to) {
                const targetNode = ctx.nodeMap.get(targetLink.to);
                if (targetNode) {
                    const childCtx = {
                        ...ctx,
                        depth: ctx.depth + 1,
                        formatNode: ctx.formatNode
                    };
                    const childLines = ctx.formatNode(targetNode, childCtx);
                    lines.push(...childLines.map(l => indent(ctx.depth + 1) + l.trimStart()));
                }
            }
        }
    } else {
        // Simple choice format: choices[] is a string array
        for (let i = 0; i < simpleChoices.length; i++) {
            const choiceLabel = simpleChoices[i];
            lines.push(indentedLine(ctx.depth, TOKENS.OPTION_PREFIX + choiceLabel));

            // Find the target link for this option (match by choiceIndex)
            const links = ctx.adjacency.get(node.id) || [];
            const targetLink = links.find(
                l => l.choiceIndex === i || (l.choiceIndex === undefined && links.indexOf(l) === i)
            );
            if (targetLink && targetLink.to) {
                const targetNode = ctx.nodeMap.get(targetLink.to);
                if (targetNode) {
                    const childCtx = {
                        ...ctx,
                        depth: ctx.depth + 1,
                        formatNode: ctx.formatNode
                    };
                    const childLines = ctx.formatNode(targetNode, childCtx);
                    // Child lines are already indented by childCtx.depth via their own formatters
                    lines.push(...childLines);
                }
            }
        }
    }

    return lines;
}

/**
 * Format a Marker node.
 * Emits "~ cue_name" with slugified name. If node has body, emits as dialogue line.
 *
 * @param {Object} node - The Marker node
 * @param {Object} ctx - Context object
 * @returns {Array<string>} Output lines
 */
function formatMarkerNode(node, ctx) {
    const lines = [];
    const cueName = slugifyCueName(node.title, node.id);
    lines.push(indentedLine(ctx.depth, '~ ' + cueName));

    // If Marker has body text, emit it as plain narrator text
    if (node.body && node.body.trim().length > 0) {
        const resolvedBody = resolveVariables(node.body, ctx.variablesObj || ctx.variables);
        lines.push(indentedLine(ctx.depth, resolvedBody));
    }

    return lines;
}

/**
 * Format an Event node.
 * Same as MarkerNode — emits "~ event_name" cue.
 * Event nodes may have additional effects handled by MED in Plan 02-02.
 *
 * @param {Object} node - The Event node
 * @param {Object} ctx - Context object
 * @returns {Array<string>} Output lines
 */
function formatEventNode(node, ctx) {
    const lines = [];
    const cueName = slugifyCueName(node.title, node.id);
    lines.push(indentedLine(ctx.depth, '~ ' + cueName));

    if (node.body && node.body.trim().length > 0) {
        const resolvedBody = resolveVariables(node.body, ctx.variablesObj || ctx.variables);
        lines.push(indentedLine(ctx.depth, resolvedBody));
    }

    return lines;
}

// -------------------------------------------------------------------------
// Dispatch
// -------------------------------------------------------------------------

const FORMATTERS = {
    'Entry': formatEntryNode,
    'Dialog': formatDialogNode,
    'Content': formatContentNode,
    'Choice': formatChoiceNode,
    'Marker': formatMarkerNode,
    'Event': formatEventNode,
};

/**
 * Format a node to an array of output lines using type dispatch.
 *
 * @param {Object} node - The .ncanvas node object
 * @param {Object} ctx - Context object (depth, characters, variables, formatNode, etc.)
 * @returns {Array<string>} Array of output lines for this node
 */
function formatNode(node, ctx) {
    // If ctx already has depth, use it directly
    const nodeCtx = ctx || { depth: 0 };

    // If not a recognized node type, treat as Content (plain text)
    const formatter = FORMATTERS[node.type] || FORMATTERS['Content'];
    return formatter(node, nodeCtx);
}

// -------------------------------------------------------------------------
// Exports
// -------------------------------------------------------------------------

module.exports = {
    formatNode
};

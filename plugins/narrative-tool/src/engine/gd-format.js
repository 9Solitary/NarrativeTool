// gd-format.js — Godot Dialogue Manager base syntax formatter
//
// Exports a single `formatNode(node, ctx)` function that dispatches to
// type-specific formatters for all 6 node types (Entry, Dialog, Content,
// Choice, Marker, Event).
//
// As specified in 02-01-PLAN.md and RESEARCH.md Pattern 2 (Format Function Dispatch).

const { TOKENS } = require('./gd-constants');
const { formatLinkConditionalBlocks, translateConditionToMed } = require('./med-format');

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
 * Detect an embedded speaker prefix at the start of a body line.
 * Recognizes both half-width ':' and full-width '：' (U+FF1A, produced by
 * Chinese IMEs). The extracted name must be a KNOWN character name (project
 * characters / cast entries) or the node's own resolved charName — this
 * guard prevents false positives like "Strength: {res_strength}.".
 *
 * @param {string} line - A single body line
 * @param {Set<string>|null} knownNames - Known character display names
 * @param {string|null} charName - The node's resolved speaker name
 * @returns {{name: string, rest: string}|null}
 */
function stripSpeakerPrefix(line, knownNames, charName) {
    if (!line) return null;
    const m = line.match(/^\s*([^:：\s][^:：]{0,39}?)\s*[:：]\s*(.*)$/);
    if (!m) return null;
    const name = m[1];
    if (charName && name === charName) return { name, rest: m[2] };
    if (knownNames && knownNames.has(name)) return { name, rest: m[2] };
    return null;
}

/**
 * Emit a dialog body line-by-line at the given indent depth.
 * Lines that already carry a known speaker prefix are normalized to
 * "Name: text" (half-width colon) and NOT prefixed again; other lines get
 * the node's resolved speaker via formatDialogLine. Blank lines stay truly
 * empty (no stray indent) to preserve byte-level output.
 *
 * @param {Array<string>} out - Output line accumulator
 * @param {number} depth - Indentation depth
 * @param {string|null} charName - The node's resolved speaker name
 * @param {string} body - (Variable-resolved) body text, possibly multi-line
 * @param {Set<string>|null} knownNames - Known character display names
 */
function pushDialogLines(out, depth, charName, body, knownNames) {
    const text = body || '';
    // Empty body: keep the legacy single "CharName: " line behavior
    if (text.length === 0) {
        out.push(indentedLine(depth, formatDialogLine(charName, text)));
        return;
    }
    for (const rawLine of text.split('\n')) {
        const embedded = stripSpeakerPrefix(rawLine, knownNames, charName);
        if (embedded) {
            out.push(indentedLine(depth, embedded.name + ': ' + embedded.rest));
        } else if (rawLine.trim().length === 0) {
            // Blank continuation lines stay untouched (no stray indent)
            out.push(rawLine);
        } else {
            out.push(indentedLine(depth, formatDialogLine(charName, rawLine)));
        }
    }
}

/**
 * Emit a structural node's description body as Godot DM comment lines.
 * Entry/Marker/Event bodies (and Choice bodies without a speaker) are block
 * descriptions for the author, not game text — they must not land in the
 * exported dialogue as playable lines. Each non-blank line becomes a
 * `# comment` line at the given indent; blank lines are dropped.
 *
 * @param {Array<string>} out - Output line accumulator
 * @param {number} depth - Indentation depth
 * @param {string} body - (Variable-resolved) description text, possibly multi-line
 */
function pushCommentLines(out, depth, body) {
    const text = body || '';
    for (const rawLine of text.split('\n')) {
        if (rawLine.trim().length === 0) continue;
        out.push(indentedLine(depth, '# ' + rawLine));
    }
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
 * When medEnabled is true, variables with flag_/res_ prefixes are converted to
 * MED inline display syntax: {{res(&"name")}}.
 * Unresolved patterns stay as-is.
 *
 * @param {string} text - Body text potentially containing {variable} templates
 * @param {Object} variables - project.variables{} object
 * @param {boolean} [medEnabled] - If true, convert state-prefixed vars to MED display syntax
 * @returns {string} Text with resolved variables
 */
function resolveVariables(text, variables, medEnabled) {
    if (!text || typeof text !== 'string') return text || '';
    if (!variables || typeof variables !== 'object') return text;

    return text.replace(/\{(\w+(?:\.\w+)*)\}/g, (match, key) => {
        // MED mode: convert flag_ and res_ prefixed variables to inline display syntax
        if (medEnabled && (key.startsWith('flag_') || key.startsWith('res_'))) {
            const medKey = key.replace(/^(flag_|res_)/, '');
            return '{{res(&"' + medKey + '")}}';
        }
        // Standard mode: resolve to literal value
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
 * Emits "~ start" cue line. If node has body content, emits it as comment lines.
 *
 * Entry body is the block's description for the author, not playable text —
 * it is exported as `# comment` lines after the cue.
 *
 * @param {Object} node - The Entry node
 * @param {Object} ctx - Context object with depth, characters, variables, etc.
 * @returns {Array<string>} Output lines
 */
function formatEntryNode(node, ctx) {
    const lines = [];
    lines.push(indentedLine(ctx.depth, '~ start'));

    // Entry nodes are structural — body content is a block description,
    // exported as comment lines, never as narration.
    if (node.body && node.body.trim().length > 0) {
        const resolvedBody = resolveVariables(node.body, ctx.variablesObj || ctx.variables, ctx.medEnabled);
        pushCommentLines(lines, ctx.depth, resolvedBody);
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
    const resolvedBody = resolveVariables(node.body, variables, ctx.medEnabled);

    // Users write multi-turn dialogue inside a single node body as
    // "Speaker: text" lines. Emit per line: lines already carrying a known
    // speaker prefix are kept (normalized), others get charName prepended.
    // Per-line emission also keeps continuation lines correctly indented
    // inside Choice subtrees.
    pushDialogLines(lines, ctx.depth, charName, resolvedBody, ctx.knownCharacterNames || null);

    // If node has customFields with readout, emit that as additional line(s)
    if (node.customFields && node.customFields.readout) {
        const readoutBody = resolveVariables(node.customFields.readout, variables, ctx.medEnabled);
        pushDialogLines(lines, ctx.depth, charName, readoutBody, ctx.knownCharacterNames || null);
    }

    return lines;
}

/**
 * Format a Content node.
 * Emits body text only (narrator, no character prefix).
 * Resolves {variables} in body.
 *
 * Multi-line bodies are emitted per line, each non-blank line indented
 * (blank lines stay truly empty) — mirroring pushDialogLines. Indenting only
 * the first line would drop continuation lines to column 0, breaking Godot
 * DM nesting inside Choice subtrees ("Nested dialogue lines may only
 * contain dialogue").
 *
 * @param {Object} node - The Content node
 * @param {Object} ctx - Context object
 * @returns {Array<string>} Output lines
 */
function formatContentNode(node, ctx) {
    if (!node.body || node.body.trim().length === 0) {
        return [];
    }
    const resolvedBody = resolveVariables(node.body, ctx.variablesObj || ctx.variables, ctx.medEnabled);
    const lines = [];
    for (const rawLine of resolvedBody.split('\n')) {
        lines.push(rawLine.trim().length === 0 ? rawLine : indentedLine(ctx.depth, rawLine));
    }
    return lines;
}

/**
 * Format a Choice node.
 * Emits body text (if present): as a prompt line when the node has a cast
 * character, otherwise as comment lines (lines carrying a known speaker
 * prefix stay as dialogue). Then emits each choice option as
 * "- option_label". For each option, follows the corresponding link to emit
 * child content at depth+1 — except when the Choice has exactly ONE option:
 * a single-option Choice is a gate, not a branch, so its continuation stays
 * at the Choice's own depth and following text resets to the surrounding
 * indentation.
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

    // FEAT-01 (D2): a Choice that is the target of a user-drawn loop gets a
    // `~ cue` title line BEFORE its body/options, so looping branches can
    // jump back with `=> cue` and re-enter the whole choice.
    if (ctx.graph && ctx.graph.loops.has(node.id)) {
        lines.push(indentedLine(ctx.depth, '~ ' + ctx.graph.loops.get(node.id)));
    }

    // Emit choice body (the question/statement) if present.
    // A Choice with a bound cast character speaks its body as a prompt line.
    // Without cast, the body is a block description: lines carrying a known
    // "Name: text" speaker prefix stay as dialogue, everything else is
    // exported as `# comment` lines so descriptions never become game text.
    if (node.body && node.body.trim().length > 0) {
        const resolvedBody = resolveVariables(node.body, ctx.variablesObj || ctx.variables, ctx.medEnabled);
        const hasCast = Array.isArray(node.cast) && node.cast.length > 0;
        if (hasCast) {
            const charName = ctx.resolveCharacter
                ? ctx.resolveCharacter(node, ctx.charactersArr)
                : null;
            lines.push(indentedLine(ctx.depth, formatDialogLine(charName, resolvedBody)));
        } else {
            const knownNames = ctx.knownCharacterNames || null;
            for (const rawLine of resolvedBody.split('\n')) {
                const embedded = stripSpeakerPrefix(rawLine, knownNames, null);
                if (embedded) {
                    lines.push(indentedLine(ctx.depth, embedded.name + ': ' + embedded.rest));
                } else if (rawLine.trim().length === 0) {
                    continue;
                } else {
                    lines.push(indentedLine(ctx.depth, '# ' + rawLine));
                }
            }
        }
    }

    // Determine choice list: use choiceOptions[] if present (rich format), fallback to choices[]
    const choiceOptions = node.choiceOptions || [];
    const simpleChoices = node.choices || [];

    // A Choice with exactly one option is a gate, not a branch: the
    // continuation after it resets to the choice's own depth instead of
    // nesting one level deeper, so text following the choice keeps the
    // surrounding indentation (Godot DM reports "Nested dialogue lines may
    // only contain dialogue" when a broken/deeper nested block follows
    // non-nested text).
    const optionCount = choiceOptions.length > 0 ? choiceOptions.length : simpleChoices.length;
    const childDepth = optionCount === 1 ? ctx.depth : ctx.depth + 1;

    /**
     * Walk the subtree rooted at a node, collecting formatted lines recursively.
     * Handles both Choice and non-Choice nodes at any depth.
     *
     * @param {string} startNodeId - ID of the node to start from
     * @param {number} walkDepth - Current indentation depth for this subtree
     * @param {Set} walkVisited - Set of visited node IDs to prevent cycles
     * @returns {Array<string>} Collected lines for this subtree
     */
    function walkSubtree(startNodeId, walkDepth, walkVisited) {
        // FEAT-02: convergence point — jump to the shared section instead of
        // duplicating the subtree; the shared section is emitted once at the
        // end of the export. Checked before walkVisited so every incoming
        // branch still emits its own jump line.
        if (ctx.graph && ctx.graph.merges.has(startNodeId)) {
            if (ctx.emittedMerges && !ctx.emittedMerges.includes(startNodeId)) {
                ctx.emittedMerges.push(startNodeId);
            }
            return [indentedLine(walkDepth, '=> ' + ctx.graph.merges.get(startNodeId))];
        }

        if (walkVisited.has(startNodeId)) return [];
        walkVisited.add(startNodeId);

        const subNode = ctx.nodeMap.get(startNodeId);
        if (!subNode) return [];

        const result = [];
        const subCtx = { ...ctx, depth: walkDepth, formatNode: ctx.formatNode };

        // Format this node
        const subLines = ctx.formatNode(subNode, subCtx);
        result.push(...subLines);

        if (subNode.type === 'Choice') {
            // Choice nodes handle their own children inline — nothing more to do here
            // as formatChoiceNode already recurses into option targets
        } else {
            // For non-Choice nodes, walk their children at the same depth
            const outgoingLinks = ctx.adjacency.get(startNodeId) || [];
            const walkOutLink = (outLink, d) => {
                // FEAT-01: loop back-edge — emit the jump line, do not recurse
                if (ctx.graph && ctx.graph.loopEdges.has(outLink.id)) {
                    return [indentedLine(d, '=> ' + ctx.graph.loops.get(outLink.to))];
                }
                return walkSubtree(outLink.to, d, walkVisited);
            };
            // MED-08 (links): when MED is enabled and any outgoing link
            // carries requirements, wrap the branches in native if/else
            // blocks; block keywords at this depth, content one level deeper.
            const blockLines = ctx.medEnabled
                ? formatLinkConditionalBlocks(outgoingLinks, walkDepth, walkOutLink, ctx.variables)
                : null;
            if (blockLines) {
                result.push(...blockLines);
            } else {
                for (const outLink of outgoingLinks) {
                    result.push(...walkOutLink(outLink, walkDepth));
                }
            }
        }

        return result;
    }

    if (choiceOptions.length > 0) {
        // Rich choice format: choiceOptions[] has { id, label, requires?, effects? }
        for (let i = 0; i < choiceOptions.length; i++) {
            const opt = choiceOptions[i];
            const label = opt.label || `Option ${i + 1}`;

            // Build the option line with optional inline condition suffix
            let optLine = TOKENS.OPTION_PREFIX + label;

            // MED-08: Add [if condition /] suffix when option has requires and MED is enabled
            // Canvas expressions are translated to MED state spec calls (flag_ok/res_ok/...)
            if (ctx.medEnabled && opt.requires && opt.requires.trim().length > 0) {
                optLine += ' [if ' + translateConditionToMed(opt.requires, ctx.variables) + ' /]';
            }

            lines.push(indentedLine(ctx.depth, optLine));

            // Find the target link for this option
            const links = ctx.adjacency.get(node.id) || [];
            const targetLink = links.find(
                l => l.choiceOptionId === opt.id
            );
            if (targetLink && targetLink.to) {
                const subVisited = new Set();
                const subtreeLines = walkSubtree(targetLink.to, childDepth, subVisited);

                // Emit MED mutations inline under the target content (MED-02, MED-03)
                // Mutations come from choice option effects, not the target node itself.
                // When the subtree ends with a jump (`=> cue`) at this depth, the
                // mutations must precede it: the runtime executes lines in order,
                // so a mutation placed after the jump would never run.
                let trailingJump = null;
                if (subtreeLines.length > 0) {
                    const last = subtreeLines[subtreeLines.length - 1];
                    if (/^\t*=> /.test(last) && last.match(/^\t*/)[0].length === childDepth) {
                        trailingJump = subtreeLines.pop();
                    }
                }
                lines.push(...subtreeLines);
                if (ctx.formatMutationLines && Array.isArray(opt.effects) && opt.effects.length > 0) {
                    const mutLines = ctx.formatMutationLines(opt.effects, childDepth);
                    lines.push(...mutLines);
                }
                if (trailingJump) {
                    lines.push(trailingJump);
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
                const subVisited = new Set();
                const subtreeLines = walkSubtree(targetLink.to, childDepth, subVisited);
                lines.push(...subtreeLines);
            }
        }
    }

    return lines;
}

/**
 * Format a Marker node.
 * Emits "~ cue_name" with slugified name. If node has body, emits it as
 * comment lines — Marker bodies are planning notes, not playable text.
 *
 * @param {Object} node - The Marker node
 * @param {Object} ctx - Context object
 * @returns {Array<string>} Output lines
 */
function formatMarkerNode(node, ctx) {
    const lines = [];
    const cueName = slugifyCueName(node.title, node.id);
    lines.push(indentedLine(ctx.depth, '~ ' + cueName));

    // Marker body is a block description — export as comment lines
    if (node.body && node.body.trim().length > 0) {
        const resolvedBody = resolveVariables(node.body, ctx.variablesObj || ctx.variables, ctx.medEnabled);
        pushCommentLines(lines, ctx.depth, resolvedBody);
    }

    return lines;
}

/**
 * Format an Event node.
 * Same as MarkerNode — emits "~ event_name" cue; body is a block description
 * exported as comment lines.
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
        const resolvedBody = resolveVariables(node.body, ctx.variablesObj || ctx.variables, ctx.medEnabled);
        pushCommentLines(lines, ctx.depth, resolvedBody);
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
    formatNode,
    slugifyCueName
};

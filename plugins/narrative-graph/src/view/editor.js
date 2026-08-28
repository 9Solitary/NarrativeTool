// editor.js — inline editing panels for the narrative-graph canvas
// (Phase 11 M1b)
//
// Floating editor card (screen-anchored in the canvas frame, not in the
// transformed world, so inputs stay usable at any zoom). Opened by
// double-clicking a node or an edge. Pure DOM construction + callbacks —
// all model mutation happens in the view via model/ops.js on commit.
//
// Node editors:
//   Content/Entry/End -> title input + auto-growing body textarea
//   Dialog            -> title input + turns rows (speaker + line),
//                        add/delete row
//   Choice            -> title + body + option rows (label, requires text,
//                        effects rows: op dropdown/key/value), add/delete
// Edge editor: visual condition builder over a text input for the link's
// requirements string (builder + fallback raw text per M2b, NG-07).
//
// Optional cb extras (M2b): cb.getVariables() -> [{ name, type }] wires the
// condition builder into Choice option rows and the edge editor;
// cb.getSpeakers() -> [{ id, name }] wires speaker autocomplete into Dialog
// turn rows. Both omitted -> plain text inputs (M1 behavior).
//
// Escape cancels, Done commits. The panel never touches the model itself.

const { EFFECT_OPS } = require('../model/constants');
const { deriveTurns } = require('../model/turns');
const { attachConditionBuilder } = require('./condition-builder');
const { attachSpeakerAutocomplete } = require('./speaker-autocomplete');

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

function input(className, value, placeholder) {
    const field = el('input', className);
    field.type = 'text';
    field.value = value || '';
    if (placeholder) field.placeholder = placeholder;
    return field;
}

// Auto-growing textarea: starts at content height, grows on input.
function textarea(className, value, placeholder) {
    const field = el('textarea', className);
    field.value = value || '';
    field.rows = 1;
    if (placeholder) field.placeholder = placeholder;
    const grow = () => {
        field.style.height = 'auto';
        field.style.height = `${field.scrollHeight}px`;
    };
    field.addEventListener('input', grow);
    // Grow once attached (scrollHeight is 0 while detached).
    setTimeout(grow, 0);
    return field;
}

function button(className, text, onClick) {
    const btn = el('button', className, text);
    btn.type = 'button';
    btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        onClick();
    });
    return btn;
}

// ---------------------------------------------------------------------------
// Node editor
// ---------------------------------------------------------------------------

function buildTurnsEditor(panel, node, draft, getSpeakers) {
    const list = el('div', 'ng-editor__turns');
    panel.appendChild(list);

    const addRow = (turn) => {
        const row = el('div', 'ng-editor__turn-row');
        const speaker = input('ng-editor__speaker', turn.speaker, 'Speaker');
        const line = textarea('ng-editor__line', turn.line, 'Line');
        row.appendChild(speaker);
        if (getSpeakers) attachSpeakerAutocomplete(speaker, getSpeakers);
        row.appendChild(line);
        row.appendChild(button('ng-editor__row-del', '×', () => {
            row.remove();
        }));
        list.appendChild(row);
    };
    for (const turn of draft.turns) addRow(turn);
    panel.appendChild(button('ng-editor__row-add', '+ turn', () => addRow({ speaker: '', line: '' })));
}

function readTurns(panel) {
    const turns = [];
    for (const row of panel.querySelectorAll('.ng-editor__turn-row')) {
        turns.push({
            speaker: row.querySelector('.ng-editor__speaker').value,
            line: row.querySelector('.ng-editor__line').value
        });
    }
    return turns;
}

function buildEffectsEditor(row, option) {
    const list = el('div', 'ng-editor__effects');
    row.appendChild(list);

    const addEffect = (effect) => {
        const line = el('div', 'ng-editor__effect-row');
        const op = el('select', 'ng-editor__effect-op');
        for (const name of EFFECT_OPS) {
            const opt = el('option', '', name);
            opt.value = name;
            if (effect.op === name) opt.selected = true;
            op.appendChild(opt);
        }
        line.appendChild(op);
        line.appendChild(input('ng-editor__effect-key', effect.key, 'variable'));
        line.appendChild(input('ng-editor__effect-value', effect.value, 'value'));
        line.appendChild(button('ng-editor__row-del', '×', () => line.remove()));
        list.appendChild(line);
    };
    for (const effect of option.effects || []) addEffect(effect);
    row.appendChild(button('ng-editor__row-add', '+ effect', () => addEffect({ op: 'set', key: '', value: '' })));
}

function buildOptionsEditor(panel, node, draft, getVariables) {
    const list = el('div', 'ng-editor__options');
    panel.appendChild(list);

    const addOption = (option) => {
        const row = el('div', 'ng-editor__option-row');
        if (option.id) row.dataset.optionId = option.id;
        const head = el('div', 'ng-editor__option-head');
        head.appendChild(input('ng-editor__option-label', option.label, 'Option label'));
        const requires = input('ng-editor__option-requires', option.requires, 'requires (e.g. res_coins >= 5)');
        head.appendChild(requires);
        head.appendChild(button('ng-editor__row-del', '×', () => row.remove()));
        row.appendChild(head);
        // 条件构建器把 requires 输入挪进可折叠文本区，readOptions 的
        // querySelector 路径不变
        if (getVariables) attachConditionBuilder(row, requires, { getVariables });
        buildEffectsEditor(row, option);
        list.appendChild(row);
    };
    for (const option of draft.options) addOption(option);
    panel.appendChild(button('ng-editor__row-add', '+ option',
        () => addOption({ label: '', requires: '', effects: [] })));
}

function readOptions(panel) {
    const options = [];
    for (const row of panel.querySelectorAll('.ng-editor__option-row')) {
        const effects = [];
        for (const line of row.querySelectorAll('.ng-editor__effect-row')) {
            effects.push({
                trigger: 'onChoose',
                op: line.querySelector('.ng-editor__effect-op').value,
                key: line.querySelector('.ng-editor__effect-key').value,
                value: line.querySelector('.ng-editor__effect-value').value
            });
        }
        const option = {
            label: row.querySelector('.ng-editor__option-label').value,
            requires: row.querySelector('.ng-editor__option-requires').value,
            effects
        };
        if (row.dataset.optionId) option.id = row.dataset.optionId;
        options.push(option);
    }
    return options;
}

/**
 * Build a floating node editor panel.
 *
 * @param {Object} node - The node model object (read as the edit draft)
 * @param {{ onCommit: (result: Object) => void, onCancel: () => void }} cb
 *   result: { title, body?, turns?, options? } — which keys exist depends
 *   on node type; the view maps them onto ops.js calls.
 * @returns {HTMLElement} The detached panel element
 */
function buildNodeEditor(node, cb) {
    const panel = el('div', 'ng-editor');
    panel.dataset.editorFor = node.id;
    panel.appendChild(el('div', 'ng-editor__heading', `Edit ${node.type} · ${node.id}`));

    const title = input('ng-editor__title', node.title, 'Title');
    panel.appendChild(title);

    if (node.type === 'Dialog') {
        const draftTurns = Array.isArray(node.turns) && node.turns.length > 0
            ? node.turns
            : deriveTurns(node);
        buildTurnsEditor(panel, node, { turns: draftTurns.length > 0 ? draftTurns : [{ speaker: '', line: '' }] },
            cb.getSpeakers);
    } else {
        const body = textarea('ng-editor__body', node.body, node.type === 'Choice' ? 'Prompt text' : 'Body');
        panel.appendChild(body);
        if (node.type === 'Choice') {
            const options = (Array.isArray(node.choiceOptions) ? node.choiceOptions : [])
                .map(o => ({ id: o.id, label: o.label, requires: o.requires, effects: o.effects }));
            buildOptionsEditor(panel, node, { options }, cb.getVariables);
        }
    }

    const footer = el('div', 'ng-editor__footer');
    footer.appendChild(button('ng-editor__done', 'Done', () => {
        const result = { title: title.value };
        if (node.type === 'Dialog') {
            result.turns = readTurns(panel);
        } else {
            result.body = panel.querySelector('.ng-editor__body').value;
            if (node.type === 'Choice') result.options = readOptions(panel);
        }
        cb.onCommit(result);
    }));
    footer.appendChild(button('ng-editor__cancel', 'Cancel', () => cb.onCancel()));
    panel.appendChild(footer);

    // Escape cancels; Enter in single-line inputs does not commit (avoids
    // surprise commits mid-typing).
    panel.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape') {
            evt.stopPropagation();
            cb.onCancel();
        }
    });
    return panel;
}

// ---------------------------------------------------------------------------
// Edge requirements editor
// ---------------------------------------------------------------------------

/**
 * Build a small floating input for a link's requirements string.
 * Commit on Done/blur-safe Enter; Escape cancels; empty text clears.
 *
 * @param {Object} link - The link model object
 * @param {{ onCommit: (text: string) => void, onCancel: () => void }} cb
 * @returns {HTMLElement}
 */
function buildLinkEditor(link, cb) {
    const panel = el('div', 'ng-editor ng-editor--link');
    panel.dataset.editorFor = link.id;
    panel.appendChild(el('div', 'ng-editor__heading', `Condition · ${link.id}`));
    const field = input('ng-editor__requires', link.requirements || '', 'e.g. flag_honest == true (empty = always)');
    panel.appendChild(field);
    // 条件构建器：保留 field 作为 canonical 提交字段（挪进可折叠文本区）
    if (cb.getVariables) attachConditionBuilder(panel, field, { getVariables: cb.getVariables });
    const footer = el('div', 'ng-editor__footer');
    footer.appendChild(button('ng-editor__done', 'Done', () => cb.onCommit(field.value)));
    footer.appendChild(button('ng-editor__cancel', 'Cancel', () => cb.onCancel()));
    panel.appendChild(footer);
    panel.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape') {
            evt.stopPropagation();
            cb.onCancel();
        } else if (evt.key === 'Enter') {
            evt.preventDefault();
            cb.onCommit(field.value);
        }
    });
    return panel;
}

module.exports = { buildNodeEditor, buildLinkEditor };

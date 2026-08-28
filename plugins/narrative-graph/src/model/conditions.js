// conditions.js — 条件表达式解析/序列化（Phase 11 M2b, NG-07）
//
// 条件构建器的纯模型层：解析/生成导出器认识的"安全 JS 子集"表达式字符串
// （link.requirements / choiceOptions[].requires 的持久化字段不变，导出链路
// 零改动）。模型参考 NarrativeCanvas fork 的条件构建器（commit da0701c），
// 只提取表达式模型，不带 UI：
//
//   子句类型：
//     - state  变量子句：{ type:'state', key, op, value }
//              op ∈ === !== >= <= > < truthy falsy
//              value = 规范化字面量字符串（'true'/'false'、'5'、'"文本"'）；
//              truthy/falsy 无值（序列化为 `key` / `!key`）
//     - period 时间段子句：{ type:'period', periods:[0..3] }
//              单个 → `at_period(2)`；多个 → `(at_period(2) || at_period(3))`
//              （fork 约定：|| 连接的纯 at_period 组 = 一条多时段子句，
//              可作为单条子句参与 && 链）
//   组合：平铺链 + 单一连接词（全 && 或 全 ||）。带括号、混合连接词、
//   includes() 等更复杂的表达式 → { raw } 原样透传（构建器显示
//   "仅支持文本编辑"）。
//
// parseCondition(text) → { clauses, combinator } 或 { raw }
// serializeCondition(model) → 规范化字符串
// 保证：支持子集内 parse(serialize(parse(x))) 深等于 parse(x)；
// 不支持的文本经 raw 原样往返。
//
// Pure module: no obsidian imports, no DOM access (purity guard).

const STATE_OPS = Object.freeze(['===', '!==', '>=', '<=', '>', '<']);
const PERIOD_MIN = 0;
const PERIOD_MAX = 3;

// -------------------------------------------------------------------------
// Tokenizer
// -------------------------------------------------------------------------

function tokenize(src) {
    const tokens = [];
    let i = 0;
    const isIdentStart = (c) => /[A-Za-z_$]/.test(c);
    const isIdentPart = (c) => /[A-Za-z0-9_$.]/.test(c);
    while (i < src.length) {
        const c = src[i];
        if (/\s/.test(c)) { i++; continue; }
        const two = src.slice(i, i + 2);
        const three = src.slice(i, i + 3);
        if (three === '===' || three === '!==') { tokens.push({ t: 'op', v: three }); i += 3; continue; }
        if (two === '&&' || two === '||' || two === '>=' || two === '<=' || two === '==') {
            tokens.push({ t: two === '==' ? 'badop' : 'op', v: two }); i += 2; continue;
        }
        if (c === '>' || c === '<') { tokens.push({ t: 'op', v: c }); i++; continue; }
        if (c === '!' ) { tokens.push({ t: '!' }); i++; continue; }
        if (c === '(') { tokens.push({ t: '(' }); i++; continue; }
        if (c === ')') { tokens.push({ t: ')' }); i++; continue; }
        if (c === ',') { tokens.push({ t: ',' }); i++; continue; }
        if (c === '"' || c === "'") {
            const quote = c;
            let j = i + 1;
            let value = '';
            let closed = false;
            while (j < src.length) {
                const ch = src[j];
                if (ch === '\\' && j + 1 < src.length) {
                    const next = src[j + 1];
                    if (next === 'n') value += '\n';
                    else if (next === 't') value += '\t';
                    else value += next; // \\ \' \" 等
                    j += 2;
                    continue;
                }
                if (ch === quote) { closed = true; j++; break; }
                value += ch;
                j++;
            }
            if (!closed) return null;
            tokens.push({ t: 'string', value });
            i = j;
            continue;
        }
        if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(src[i + 1] || ''))) {
            let j = i + (c === '-' ? 1 : 0);
            while (j < src.length && /[0-9.]/.test(src[j])) j++;
            const num = Number(src.slice(i, j));
            if (Number.isNaN(num)) return null;
            tokens.push({ t: 'number', value: num });
            i = j;
            continue;
        }
        if (isIdentStart(c)) {
            let j = i;
            while (j < src.length && isIdentPart(src[j])) j++;
            const word = src.slice(i, j);
            if (word === 'true' || word === 'false') tokens.push({ t: 'bool', value: word === 'true' });
            else tokens.push({ t: 'ident', v: word });
            i = j;
            continue;
        }
        return null; // 不认识的字符
    }
    return tokens;
}

// -------------------------------------------------------------------------
// Recursive-descent parser → AST
//   expr    := or
//   or      := and ('||' and)*
//   and     := unary ('&&' unary)*
//   unary   := '!' unary | '(' expr ')' | comparison
//   comparison := primary (binop literal)? | literal(仅作为右值出现)
//   primary := ident | ident '(' args ')' （调用只认 at_period(n)）
// -------------------------------------------------------------------------

function parseTokens(tokens) {
    let pos = 0;
    const peek = () => tokens[pos];
    const eat = () => tokens[pos++];

    function parseExpr() { return parseOr(); }

    function parseOr() {
        let left = parseAnd();
        if (!left) return null;
        while (peek() && peek().t === 'op' && peek().v === '||') {
            eat();
            const right = parseAnd();
            if (!right) return null;
            left = { type: 'logical', operator: '||', left, right };
        }
        return left;
    }

    function parseAnd() {
        let left = parseUnary();
        if (!left) return null;
        while (peek() && peek().t === 'op' && peek().v === '&&') {
            eat();
            const right = parseUnary();
            if (!right) return null;
            left = { type: 'logical', operator: '&&', left, right };
        }
        return left;
    }

    function parseUnary() {
        const tk = peek();
        if (!tk) return null;
        if (tk.t === '!') {
            eat();
            const argument = parseUnary();
            return argument ? { type: 'unary', operator: '!', argument } : null;
        }
        if (tk.t === '(') {
            eat();
            const inner = parseExpr();
            if (!inner || !peek() || peek().t !== ')') return null;
            eat();
            return { type: 'group', expression: inner };
        }
        return parseComparison();
    }

    function parseComparison() {
        const left = parsePrimary();
        if (!left) return null;
        const tk = peek();
        if (tk && tk.t === 'op' && STATE_OPS.includes(tk.v)) {
            eat();
            const right = parsePrimary();
            if (!right) return null;
            return { type: 'binary', operator: tk.v, left, right };
        }
        if (tk && tk.t === 'badop') return null; // `==` 不支持（避免吞掉赋值式拼写）
        return left;
    }

    function parsePrimary() {
        const tk = peek();
        if (!tk) return null;
        if (tk.t === 'ident') {
            eat();
            if (peek() && peek().t === '(') {
                eat();
                const args = [];
                if (peek() && peek().t !== ')') {
                    for (;;) {
                        const arg = parsePrimary();
                        if (!arg || arg.type !== 'literal') return null;
                        args.push(arg);
                        if (peek() && peek().t === ',') { eat(); continue; }
                        break;
                    }
                }
                if (!peek() || peek().t !== ')') return null;
                eat();
                return { type: 'call', name: tk.v, args };
            }
            return { type: 'identifier', path: tk.v };
        }
        if (tk.t === 'number') { eat(); return { type: 'literal', kind: 'number', value: tk.value }; }
        if (tk.t === 'string') { eat(); return { type: 'literal', kind: 'string', value: tk.value }; }
        if (tk.t === 'bool') { eat(); return { type: 'literal', kind: 'bool', value: tk.value }; }
        return null;
    }

    const ast = parseExpr();
    if (!ast || pos !== tokens.length) return null;
    return ast;
}

// -------------------------------------------------------------------------
// AST → clauses（可可视化判定）
// -------------------------------------------------------------------------

// at_period(n) 调用 → 合法则返回 n（0-3 整数），否则 null
function atPeriodValue(node) {
    if (!node || node.type !== 'call' || node.name !== 'at_period') return null;
    if (node.args.length !== 1) return null;
    const arg = node.args[0];
    if (arg.kind !== 'number') return null;
    const n = arg.value;
    return Number.isInteger(n) && n >= PERIOD_MIN && n <= PERIOD_MAX ? n : null;
}

function flattenLogical(node, operator) {
    if (node.type === 'logical' && node.operator === operator) {
        return [...flattenLogical(node.left, operator), ...flattenLogical(node.right, operator)];
    }
    return [node];
}

// 字面量 → 规范化字符串（round-trip 稳定的关键：parse 时就归一化）
function literalRaw(node) {
    if (!node || node.type !== 'literal') return null;
    if (node.kind === 'bool') return node.value ? 'true' : 'false';
    if (node.kind === 'number') return String(node.value);
    return JSON.stringify(node.value);
}

// 单个子句项：比较 / 裸标识符(truthy) / !标识符(falsy) / at_period 调用 /
// 括号包裹的纯 at_period || 组
function convertTerm(node) {
    if (!node) return null;
    if (node.type === 'identifier') {
        return { type: 'state', key: node.path, op: 'truthy', value: '' };
    }
    if (node.type === 'unary' && node.operator === '!' && node.argument.type === 'identifier') {
        return { type: 'state', key: node.argument.path, op: 'falsy', value: '' };
    }
    if (node.type === 'call') {
        const period = atPeriodValue(node);
        return period === null ? null : { type: 'period', periods: [period] };
    }
    if (node.type === 'binary') {
        if (node.left.type !== 'identifier') return null;
        const raw = literalRaw(node.right);
        if (raw === null) return null;
        return { type: 'state', key: node.left.path, op: node.operator, value: raw };
    }
    if (node.type === 'group') {
        // 唯一可可视化的括号组：纯 at_period(...) 的平铺 || 链
        const expr = node.expression;
        const terms = expr.type === 'logical' && expr.operator === '||'
            ? flattenLogical(expr, '||')
            : [expr];
        if (terms.length === 0 || terms.some(t => atPeriodValue(t) === null)) return null;
        return { type: 'period', periods: terms.map(atPeriodValue) };
    }
    return null;
}

function convertAst(ast) {
    if (ast.type === 'logical') {
        const terms = flattenLogical(ast, ast.operator);
        // 顶层纯 at_period || 链 = 一条多时段子句
        if (ast.operator === '||' && terms.every(t => atPeriodValue(t) !== null)) {
            return { clauses: [{ type: 'period', periods: terms.map(atPeriodValue) }], combinator: '&&' };
        }
        const clauses = terms.map(convertTerm);
        if (clauses.some(c => c === null)) return null;
        return { clauses, combinator: ast.operator };
    }
    const clause = convertTerm(ast);
    return clause ? { clauses: [clause], combinator: '&&' } : null;
}

// -------------------------------------------------------------------------
// 公开 API
// -------------------------------------------------------------------------

/**
 * 解析条件表达式文本。
 *
 * @param {string} text
 * @returns {{clauses: Array, combinator: '&&'|'||'} | {raw: string}}
 *   空文本 → { clauses: [], combinator: '&&' }（可编辑的空模型）；
 *   不可可视化（混合连接词/括号/includes/无法解析）→ { raw: 原文 }。
 */
function parseCondition(text) {
    const source = String(text === undefined || text === null ? '' : text).trim();
    if (!source) return { clauses: [], combinator: '&&' };
    const tokens = tokenize(source);
    if (!tokens || tokens.length === 0) return { raw: source };
    const ast = parseTokens(tokens);
    if (!ast) return { raw: source };
    const model = convertAst(ast);
    if (!model) return { raw: source };
    return { clauses: normalizeClauses(model.clauses), combinator: model.combinator };
}

// 归一化：period 子句 periods 去重排序；state 子句字段齐备
function normalizeClauses(clauses) {
    return clauses.map(c => {
        if (c.type === 'period') {
            return { type: 'period', periods: normalizePeriods(c.periods) };
        }
        return { type: 'state', key: c.key, op: c.op, value: c.value };
    });
}

function normalizePeriods(periods) {
    const list = Array.isArray(periods) ? periods : [periods];
    return [...new Set(list.map(Number).filter(
        n => Number.isInteger(n) && n >= PERIOD_MIN && n <= PERIOD_MAX))].sort((a, b) => a - b);
}

/**
 * 序列化条件模型为规范化表达式字符串。
 * { raw } 模型原样返回；不完整子句（无 key / 比较运算缺值 / period 空）
 * 跳过；全部跳过 → ''。
 *
 * @param {{clauses?: Array, combinator?: string, raw?: string}} model
 * @returns {string}
 */
function serializeCondition(model) {
    if (!model || !Array.isArray(model.clauses)) {
        return model && typeof model.raw === 'string' ? model.raw : '';
    }
    const parts = model.clauses.map(serializeClause).filter(Boolean);
    return parts.join(model.combinator === '||' ? ' || ' : ' && ');
}

function serializeClause(clause) {
    if (!clause) return '';
    if (clause.type === 'period') {
        const periods = normalizePeriods(clause.periods);
        if (periods.length === 0) return '';
        const terms = periods.map(p => `at_period(${p})`);
        return terms.length === 1 ? terms[0] : `(${terms.join(' || ')})`;
    }
    const key = String(clause.key || '').trim();
    if (!key) return '';
    if (clause.op === 'truthy') return key;
    if (clause.op === 'falsy') return `!${key}`;
    if (!STATE_OPS.includes(clause.op)) return '';
    const value = String(clause.value === undefined || clause.value === null ? '' : clause.value).trim();
    if (!value) return '';
    return `${key} ${clause.op} ${value}`;
}

/**
 * 按变量类型生成字面量字符串（UI 值控件用）。
 * bool → 'true'/'false'；number → 数字原文（非数字返回 null）；
 * string/未知 → JSON 引号包裹。
 *
 * @param {string} type - bool | number | string（或空 = string 处理）
 * @param {string|boolean|number} value
 * @returns {string|null}
 */
function formatConditionLiteral(type, value) {
    if (type === 'bool') {
        if (value === true || value === 'true') return 'true';
        if (value === false || value === 'false') return 'false';
        return null;
    }
    if (type === 'number') {
        const t = String(value).trim();
        return t !== '' && !Number.isNaN(Number(t)) ? String(Number(t)) : null;
    }
    return JSON.stringify(String(value === undefined || value === null ? '' : value));
}

module.exports = {
    STATE_OPS,
    PERIOD_MIN,
    PERIOD_MAX,
    parseCondition,
    serializeCondition,
    formatConditionLiteral
};

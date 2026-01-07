import { parse } from 'yaml';

export type FilterNode =
	| string
	| {
			and?: FilterNode[];
			or?: FilterNode[];
			not?: FilterNode[];
	  };

export type BaseView = {
	type: string;
	name: string;
	filters?: FilterNode;
	order?: string[];
};

export type BaseDefinition = {
	filters?: FilterNode;
	formulas?: Record<string, string>;
	properties?: Record<string, unknown>;
	views?: BaseView[];
};

export type NoteRecord = {
	note: Record<string, unknown>;
	file: {
		name: string;
		tags: string[];
	};
};

type Token =
	| { type: 'number'; value: number }
	| { type: 'string'; value: string }
	| { type: 'identifier'; value: string }
	| { type: 'operator'; value: string }
	| { type: 'punct'; value: string };

type AstNode =
	| { type: 'literal'; value: unknown }
	| { type: 'identifier'; name: string }
	| { type: 'member'; object: AstNode; property: string }
	| { type: 'call'; callee: AstNode; args: AstNode[] }
	| { type: 'unary'; op: string; argument: AstNode }
	| { type: 'binary'; op: string; left: AstNode; right: AstNode };

const GLOBAL_FUNCS: Record<string, (...args: unknown[]) => unknown> = {
	if: (condition: unknown, whenTrue: unknown, whenFalse: unknown = null) =>
		condition ? whenTrue : whenFalse,
	max: (...values: unknown[]) => Math.max(...values.map((value) => Number(value))),
	min: (...values: unknown[]) => Math.min(...values.map((value) => Number(value))),
};

export function parseBaseDefinition(yamlText: string): BaseDefinition {
	return parse(yamlText) as BaseDefinition;
}

export function evaluateViews(base: BaseDefinition, notes: NoteRecord[], now: Date) {
	const compiled = compileFormulas(base.formulas ?? {});
	const results: Record<string, NoteRecord[]> = {};
	for (const view of base.views ?? []) {
		const filtered = notes.filter((note) => {
			const formulaValues = evaluateFormulas(compiled, note, now);
			if (!evaluateFilter(base.filters, note, formulaValues, now)) return false;
			if (!evaluateFilter(view.filters, note, formulaValues, now)) return false;
			return true;
		});
		results[view.name] = filtered;
	}
	return results;
}

export function evaluateFormula(
	formula: string,
	note: NoteRecord,
	formulaValues: Record<string, unknown>,
	now: Date,
): unknown {
	const ast = parseExpression(formula);
	return evaluateAst(ast, note, formulaValues, now);
}

export function evaluateFormulas(
	formulas: Record<string, string>,
	note: NoteRecord,
	now: Date,
): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	for (const [name, expr] of Object.entries(formulas)) {
		values[name] = evaluateFormula(expr, note, values, now);
	}
	return values;
}

export function evaluateFilter(
	filter: FilterNode | undefined,
	note: NoteRecord,
	formulaValues: Record<string, unknown>,
	now: Date,
): boolean {
	if (!filter) return true;
	if (typeof filter === 'string') {
		const ast = parseExpression(filter);
		return Boolean(evaluateAst(ast, note, formulaValues, now));
	}
	if (filter.and) {
		return filter.and.every((child) => evaluateFilter(child, note, formulaValues, now));
	}
	if (filter.or) {
		return filter.or.some((child) => evaluateFilter(child, note, formulaValues, now));
	}
	if (filter.not) {
		return !filter.not.every((child) => evaluateFilter(child, note, formulaValues, now));
	}
	return true;
}

function compileFormulas(formulas: Record<string, string>) {
	return Object.fromEntries(Object.entries(formulas).map(([name, expr]) => [name, expr]));
}

function evaluateAst(
	node: AstNode,
	note: NoteRecord,
	formulaValues: Record<string, unknown>,
	now: Date,
): unknown {
	switch (node.type) {
		case 'literal':
			return node.value;
		case 'identifier':
			return resolveIdentifier(node.name, note, formulaValues, now);
		case 'member': {
			const object = evaluateAst(node.object, note, formulaValues, now) as Record<string, unknown> | null;
			if (!object) return undefined;
			return object[node.property];
		}
		case 'call': {
			if (node.callee.type === 'member') {
				const object = evaluateAst(node.callee.object, note, formulaValues, now) as Record<string, unknown> | null;
				if (!object) return undefined;
				const fn = object[node.callee.property];
				const args = node.args.map((arg) => evaluateAst(arg, note, formulaValues, now));
				if (typeof fn === 'function') {
					return fn.apply(object, args);
				}
				return undefined;
			}
			if (node.callee.type === 'identifier') {
				if (node.callee.name === 'now') return now;
				const fn = GLOBAL_FUNCS[node.callee.name];
				const args = node.args.map((arg) => evaluateAst(arg, note, formulaValues, now));
				if (fn) return fn(...args);
			}
			return undefined;
		}
		case 'unary': {
			const value = evaluateAst(node.argument, note, formulaValues, now);
			switch (node.op) {
				case '!':
					return !value;
				case '-':
					return -Number(value);
				default:
					return value;
			}
		}
		case 'binary': {
			const left = evaluateAst(node.left, note, formulaValues, now);
			const right = evaluateAst(node.right, note, formulaValues, now);
			switch (node.op) {
				case '+':
					return Number(left) + Number(right);
				case '-':
					return Number(left) - Number(right);
				case '*':
					return Number(left) * Number(right);
				case '/':
					return Number(left) / Number(right);
				case '%':
					return Number(left) % Number(right);
				case '==':
					return left == right;
				case '!=':
					return left != right;
				case '>':
					return Number(left) > Number(right);
				case '<':
					return Number(left) < Number(right);
				case '>=':
					return Number(left) >= Number(right);
				case '<=':
					return Number(left) <= Number(right);
				case '&&':
					return Boolean(left) && Boolean(right);
				case '||':
					return Boolean(left) || Boolean(right);
				default:
					return undefined;
			}
		}
		default:
			return undefined;
	}
}

function resolveIdentifier(
	name: string,
	note: NoteRecord,
	formulaValues: Record<string, unknown>,
	now: Date,
): unknown {
	if (name === 'true') return true;
	if (name === 'false') return false;
	if (name === 'null') return null;
	if (name === 'now') return () => now;
	if (name === 'file') {
		return {
			name: note.file.name,
			tags: note.file.tags,
			hasTag: (...tags: unknown[]) => {
				return tags.some((tag) => note.file.tags.includes(String(tag).replace(/^#/, '')));
			},
		};
	}
	if (name === 'note') {
		return note.note;
	}
	if (name === 'formula') {
		return formulaValues;
	}
	if (name in note.note) {
		return note.note[name];
	}
	return undefined;
}

function parseExpression(input: string): AstNode {
	const tokens = tokenize(input);
	let pos = 0;

	function peek(): Token | undefined {
		return tokens[pos];
	}

	function consume(): Token {
		const token = tokens[pos];
		if (!token) throw new Error('Unexpected end of input');
		pos += 1;
		return token;
	}

	function parsePrimary(): AstNode {
		const token = consume();
		if (token.type === 'number' || token.type === 'string') {
			return { type: 'literal', value: token.value };
		}
		if (token.type === 'identifier') {
			let node: AstNode = { type: 'identifier', name: token.value };
			while (true) {
				const next = peek();
				if (next?.type === 'punct' && next.value === '.') {
					consume();
					const prop = consume();
					if (prop.type !== 'identifier') {
						throw new Error('Expected identifier after "."');
					}
					node = { type: 'member', object: node, property: prop.value };
					continue;
				}
				if (next?.type === 'punct' && next.value === '(') {
					consume();
					const args: AstNode[] = [];
					if (peek() && !(peek()?.type === 'punct' && peek()?.value === ')')) {
						while (true) {
							args.push(parseExpressionNode());
							if (peek()?.type === 'punct' && peek()?.value === ',') {
								consume();
								continue;
							}
							break;
						}
					}
					const closing = consume();
					if (closing.type !== 'punct' || closing.value !== ')') {
						throw new Error('Expected ")"');
					}
					node = { type: 'call', callee: node, args };
					continue;
				}
				break;
			}
			return node;
		}
		if (token.type === 'punct' && token.value === '(') {
			const expr = parseExpressionNode();
			const closing = consume();
			if (closing.type !== 'punct' || closing.value !== ')') {
				throw new Error('Expected ")"');
			}
			return expr;
		}
		if (token.type === 'operator' && (token.value === '-' || token.value === '!')) {
			return { type: 'unary', op: token.value, argument: parsePrimary() };
		}
		throw new Error(`Unexpected token: ${token.type} ${'value' in token ? token.value : ''}`);
	}

	function parseMultiplicative(): AstNode {
		let node = parsePrimary();
		while (true) {
			const next = peek();
			if (next?.type === 'operator' && ['*', '/', '%'].includes(next.value)) {
				const op = consume().value;
				const right = parsePrimary();
				node = { type: 'binary', op, left: node, right };
				continue;
			}
			break;
		}
		return node;
	}

	function parseAdditive(): AstNode {
		let node = parseMultiplicative();
		while (true) {
			const next = peek();
			if (next?.type === 'operator' && ['+', '-'].includes(next.value)) {
				const op = consume().value;
				const right = parseMultiplicative();
				node = { type: 'binary', op, left: node, right };
				continue;
			}
			break;
		}
		return node;
	}

	function parseComparison(): AstNode {
		let node = parseAdditive();
		while (true) {
			const next = peek();
			if (next?.type === 'operator' && ['>=', '<=', '>', '<'].includes(next.value)) {
				const op = consume().value;
				const right = parseAdditive();
				node = { type: 'binary', op, left: node, right };
				continue;
			}
			break;
		}
		return node;
	}

	function parseEquality(): AstNode {
		let node = parseComparison();
		while (true) {
			const next = peek();
			if (next?.type === 'operator' && ['==', '!='].includes(next.value)) {
				const op = consume().value;
				const right = parseComparison();
				node = { type: 'binary', op, left: node, right };
				continue;
			}
			break;
		}
		return node;
	}

	function parseLogicalAnd(): AstNode {
		let node = parseEquality();
		while (true) {
			const next = peek();
			if (next?.type === 'operator' && next.value === '&&') {
				const op = consume().value;
				const right = parseEquality();
				node = { type: 'binary', op, left: node, right };
				continue;
			}
			break;
		}
		return node;
	}

	function parseLogicalOr(): AstNode {
		let node = parseLogicalAnd();
		while (true) {
			const next = peek();
			if (next?.type === 'operator' && next.value === '||') {
				const op = consume().value;
				const right = parseLogicalAnd();
				node = { type: 'binary', op, left: node, right };
				continue;
			}
			break;
		}
		return node;
	}

	function parseExpressionNode(): AstNode {
		return parseLogicalOr();
	}

	const expr = parseExpressionNode();
	if (pos < tokens.length) {
		throw new Error('Unexpected token at end of expression');
	}
	return expr;
}

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < input.length) {
		const char = input[i];
		if (/\s/.test(char)) {
			i += 1;
			continue;
		}
		if (char === '"' || char === "'") {
			const quote = char;
			let value = '';
			i += 1;
			while (i < input.length && input[i] !== quote) {
				if (input[i] === '\\' && i + 1 < input.length) {
					value += input[i + 1];
					i += 2;
					continue;
				}
				value += input[i];
				i += 1;
			}
			i += 1;
			tokens.push({ type: 'string', value });
			continue;
		}
		if (/[0-9]/.test(char)) {
			let value = char;
			i += 1;
			while (i < input.length && /[0-9.]/.test(input[i])) {
				value += input[i];
				i += 1;
			}
			tokens.push({ type: 'number', value: Number(value) });
			continue;
		}
		if (/[A-Za-z_]/.test(char)) {
			let value = char;
			i += 1;
			while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
				value += input[i];
				i += 1;
			}
			tokens.push({ type: 'identifier', value });
			continue;
		}
		const twoChar = input.slice(i, i + 2);
		if (['>=', '<=', '==', '!=', '&&', '||'].includes(twoChar)) {
			tokens.push({ type: 'operator', value: twoChar });
			i += 2;
			continue;
		}
		if (['+', '-', '*', '/', '%', '>', '<', '!'].includes(char)) {
			tokens.push({ type: 'operator', value: char });
			i += 1;
			continue;
		}
		if (['(', ')', ',', '.'].includes(char)) {
			tokens.push({ type: 'punct', value: char });
			i += 1;
			continue;
		}
		throw new Error(`Unexpected character: ${char}`);
	}
	return tokens;
}

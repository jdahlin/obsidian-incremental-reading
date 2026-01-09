import type { RvCommand } from './types';
import type { EngineSnapshot, EngineStore } from '../memory/types';
import { MemoryDataStore } from '../memory/MemoryDataStore';

export interface RvRunResult {
	outputs: string[];
}

export function runRvCommands(commands: RvCommand[]): RvRunResult {
	const outputs: string[] = [];
	const store: EngineStore = new MemoryDataStore();
	let lastNoteId: string | null = null;

	for (const command of commands) {
		if (command.name === 'expect') {
			const path = command.args[0];
			const expectedRaw = command.args.slice(1).join(' ').trim();
			if (!path || !expectedRaw) {
				throw new Error(`Missing expected state at line ${command.line}`);
			}
			const snapshot = store.snapshot();
			const actualValue = readPath(snapshot, path);
			const expectedValue = parseExpectedValue(expectedRaw);
			if (!isEqual(actualValue, expectedValue)) {
				throw new Error(
					`State mismatch at line ${command.line}\npath:     ${path}\nexpected: ${formatValue(expectedValue)}\nactual:   ${formatValue(actualValue)}`,
				);
			}
			continue;
		}
		applyCommand(store, command, {
			getLastNoteId: () => lastNoteId,
			setLastNoteId: (noteId: string) => {
				lastNoteId = noteId;
			},
		});
	}

	return { outputs };
}

interface CommandContext {
	getLastNoteId(): string | null;
	setLastNoteId(noteId: string): void;
}

function applyCommand(store: EngineStore, command: RvCommand, ctx: CommandContext): void {
	switch (command.name) {
		case 'topic': {
			const { options, positional } = parseArgs(command.args);
			const content = positional[0] ?? '';
			const noteId = store.createNote(content, {
				title: options.title,
				priority: options.priority ? Number(options.priority) : undefined,
			});
			ctx.setLastNoteId(noteId);
			break;
		}
		case 'extract': {
			const { positional } = parseArgs(command.args);
			const source = resolveNoteId(positional[0], ctx);
			const noteId = store.createExtract(
				source,
				Number(positional[1] ?? 0),
				Number(positional[2] ?? 0),
			);
			ctx.setLastNoteId(noteId);
			break;
		}
		case 'cloze': {
			const { options, positional } = parseArgs(command.args);
			const noteId = resolveNoteId(positional[0], ctx);
			const start = Number(positional[1] ?? 0);
			const end = Number(positional[2] ?? 0);
			store.addCloze(noteId, start, end, options.hint);
			break;
		}
		case 'grade': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			const rating = Number(positional[1] ?? 0);
			store.recordGrade(itemId, rating);
			break;
		}
		case 'again': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			store.recordAgain(itemId);
			break;
		}
		case 'postpone': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			const days = Number(positional[1] ?? 0);
			store.recordPostpone(itemId, days);
			break;
		}
		case 'dismiss': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			store.recordDismiss(itemId);
			break;
		}
		case 'priority': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			const value = Number(positional[1] ?? 0);
			store.recordPriority(itemId, value);
			break;
		}
		case 'scroll': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			const value = Number(positional[1] ?? 0);
			store.recordScroll(itemId, value);
			break;
		}
		case 'show': {
			const { positional, options } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			store.recordShow(itemId, options.phase);
			break;
		}
		case 'session': {
			const { options, positional } = parseArgs(command.args);
			store.setSession({
				strategy: positional[0] ?? 'JD1',
				examDate: options.exam ?? null,
				capacity: options.capacity ? Number(options.capacity) : undefined,
				clump: options.clump ? Number(options.clump) : undefined,
				cooldown: options.cooldown ? Number(options.cooldown) : undefined,
			});
			break;
		}
		case 'scheduler': {
			const { positional } = parseArgs(command.args);
			store.setScheduler(positional[0] ?? 'fsrs');
			break;
		}
		case 'clock': {
			const { positional } = parseArgs(command.args);
			store.setClock(positional[0] ?? '');
			break;
		}
		default:
			break;
	}
}

function resolveNoteId(value: string | undefined, ctx: CommandContext): string {
	if (!value) return '';
	if (value === 'LAST') return ctx.getLastNoteId() ?? '';
	return value;
}

function parseArgs(args: string[]): { positional: string[]; options: Record<string, string> } {
	const positional: string[] = [];
	const options: Record<string, string> = {};
	let i = 0;
	while (i < args.length) {
		const token = args[i];
		if (token?.startsWith('--')) {
			const key = token.slice(2);
			const value = args[i + 1] ?? '';
			options[key] = value;
			i += 2;
			continue;
		}
		positional.push(token ?? '');
		i += 1;
	}
	return { positional, options };
}

function parseExpectedValue(raw: string): unknown {
	const trimmed = raw.trim();
	if (trimmed === 'null') return null;
	if (trimmed === 'true') return true;
	if (trimmed === 'false') return false;
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
	if (
		(trimmed.startsWith('{') && trimmed.endsWith('}')) ||
		(trimmed.startsWith('[') && trimmed.endsWith(']'))
	) {
		try {
			return JSON.parse(trimmed);
		} catch {
			return trimmed;
		}
	}
	return trimmed;
}

function readPath(state: EngineSnapshot, path: string): unknown {
	const segments = path
		.replace(/\[(\d+)\]/g, '.$1')
		.split('.')
		.filter(Boolean);
	let current: unknown = state;
	for (const segment of segments) {
		if (current == null) return undefined;
		const value = (current as Record<string, unknown>)[segment];
		current = value;
	}
	return current;
}

function isEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (Number.isNaN(a) && Number.isNaN(b)) return true;
	return JSON.stringify(a) === JSON.stringify(b);
}

function formatValue(value: unknown): string {
	if (typeof value === 'string') return value;
	return JSON.stringify(value);
}

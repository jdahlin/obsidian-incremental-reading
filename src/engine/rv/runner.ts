import type { RvCommand } from './types';
import type { EngineSnapshot, EngineStore } from '../memory/types';
import { MemoryDataStore } from '../memory/MemoryDataStore';
import { SessionManager } from '../SessionManager';
import { InMemoryNotePlatform } from '../tests/InMemoryNotePlatform';
import type { SessionConfig, Rating, SessionStrategyId } from '../types';

export interface RvRunResult {
	outputs: string[];
}

export async function runRvCommands(commands: RvCommand[]): Promise<RvRunResult> {
	const outputs: string[] = [];
	const store = new MemoryDataStore();
	const platform = new InMemoryNotePlatform();
	// Default config
	let config: SessionConfig = {
		strategy: 'JD1',
		mode: 'review',
		examDate: null,
		deterministic: true,
	};
	const sessionManager = new SessionManager(store, platform, config);

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
		await applyCommand(store, platform, sessionManager, command, {
			getLastNoteId: () => lastNoteId,
			setLastNoteId: (noteId: string) => {
				lastNoteId = noteId;
			},
			updateConfig: (newConfig) => {
				config = { ...config, ...newConfig };
				sessionManager.setConfig(config);
			},
		});
	}

	return { outputs };
}

interface CommandContext {
	getLastNoteId(): string | null;
	setLastNoteId(noteId: string): void;
	updateConfig(config: Partial<SessionConfig>): void;
}

async function applyCommand(
	store: MemoryDataStore, // Use concrete type to access setNextItem if not in interface yet? No, added to interface.
	platform: InMemoryNotePlatform,
	sessionManager: SessionManager,
	command: RvCommand,
	ctx: CommandContext,
): Promise<void> {
	switch (command.name) {
		case 'topic': {
			const { options, positional } = parseArgs(command.args);
			const content = positional[0] ?? '';
			const noteId = store.createNote(content, {
				title: options.title,
				priority: options.priority ? Number(options.priority) : undefined,
			});
			await platform.setNote(noteId, content);
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
			await platform.setNote(noteId, `extract from ${source}`); // Dummy content
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
			const snapshot = store.snapshot();
			const now = snapshot.clock ? new Date(snapshot.clock + 'T00:00:00Z') : new Date();
			await sessionManager.loadPool(now);
			await sessionManager.recordReview(itemId, rating as Rating, now);
			break;
		}
		case 'again': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			const snapshot = store.snapshot();
			const now = snapshot.clock ? new Date(snapshot.clock + 'T00:00:00Z') : new Date();
			await sessionManager.loadPool(now);
			await sessionManager.recordReview(itemId, 1, now);
			break;
		}
		case 'inspect-next': {
			const { options } = parseArgs(command.args);
			await sessionManager.loadPool();
			const limit = options.limit ? Number(options.limit) : 1;
			// We only support peeking 1 for now via getNext().
			const snapshot = store.snapshot();
			const now = snapshot.clock ? new Date(snapshot.clock + 'T00:00:00Z') : new Date();
			const next = await sessionManager.getNext(now);
			store.setNextItem(next ? next.item.id : null);
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
			const newConfig: Partial<SessionConfig> = {};
			if (positional[0]) newConfig.strategy = positional[0] as SessionStrategyId;
			if (options.exam) newConfig.examDate = new Date(options.exam);
			if (options.capacity) newConfig.capacity = Number(options.capacity);

			if (options.clump) newConfig.clumpLimit = Number(options.clump);
			if (options.cooldown) newConfig.cooldown = Number(options.cooldown);

			store.setSession({
				strategy: newConfig.strategy,
				examDate: newConfig.examDate ? newConfig.examDate.toISOString() : null,
				capacity: newConfig.capacity,
				clump: newConfig.clumpLimit,
				cooldown: newConfig.cooldown,
			});
			ctx.updateConfig(newConfig);
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

import type { RvCommand } from './types';
import type { EngineStore, EngineSnapshot } from '../memory/types';
import { MemoryDataStore } from '../memory/MemoryDataStore';
import { SessionManager } from '../SessionManager';
import { InMemoryNotePlatform } from '../tests/InMemoryNotePlatform';
import type { SessionConfig, Rating, SessionStrategyId, NotePlatform } from '../types';

export interface RvRunResult {
	outputs: string[];
}

export async function runRvCommands(
	commands: RvCommand[],
	storeFactory?: () => Promise<{
		store: EngineStore;
		sessionManager: SessionManager;
		platform: NotePlatform;
	}>,
): Promise<RvRunResult> {
	const outputs: string[] = [];

	let store: EngineStore;
	let sessionManager: SessionManager;
	let platform: NotePlatform;

	if (storeFactory) {
		const result = await storeFactory();
		store = result.store;
		sessionManager = result.sessionManager;
		platform = result.platform;
	} else {
		const memStore = new MemoryDataStore();
		store = memStore;
		platform = new InMemoryNotePlatform();
		const config: SessionConfig = {
			strategy: 'JD1',
			mode: 'review',
			examDate: null,
			deterministic: true,
		};
		sessionManager = new SessionManager(memStore, platform, config);
	}

	let lastNoteId: string | null = null;
	let config: SessionConfig = {
		strategy: 'JD1',
		mode: 'review',
		examDate: null,
		deterministic: true,
	};

	for (const command of commands) {
		if (command.name === 'expect') {
			const path = command.args[0];
			const expectedRaw = command.args.slice(1).join(' ').trim();
			if (!path || !expectedRaw) {
				throw new Error(`Missing expected state at line ${command.line}`);
			}
			const snapshot = await store.snapshot();
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
	store: EngineStore,
	platform: NotePlatform,
	sessionManager: SessionManager,
	command: RvCommand,
	ctx: CommandContext,
): Promise<void> {
	switch (command.name) {
		case 'topic': {
			const { options, positional } = parseArgs(command.args);
			const content = positional[0] ?? '';
			const noteId = await store.createNote(content, {
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
			const start = Number(positional[1] ?? 0);
			const end = Number(positional[2] ?? 0);
			const noteId = await store.createExtract(source, start, end);
			await platform.setNote(noteId, `extract:${source}:${start}-${end}`);
			ctx.setLastNoteId(noteId);
			break;
		}
		case 'cloze': {
			const { options, positional } = parseArgs(command.args);
			const noteId = resolveNoteId(positional[0], ctx);
			const start = Number(positional[1] ?? 0);
			const end = Number(positional[2] ?? 0);
			await store.addCloze(noteId, start, end, options.hint);
			break;
		}
		case 'grade': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			const rating = Number(positional[1] ?? 0);
			const clock = store.getClock();
			const now = clock ? new Date(clock + 'T00:00:00Z') : new Date();
			await sessionManager.loadPool(now);
			await sessionManager.recordReview(itemId, rating as Rating, now);
			break;
		}
		case 'again': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			const clock = store.getClock();
			const now = clock ? new Date(clock + 'T00:00:00Z') : new Date();
			await sessionManager.loadPool(now);
			await sessionManager.recordReview(itemId, 1, now);
			break;
		}
		case 'inspect-next': {
			const { options } = parseArgs(command.args);
			const clock = store.getClock();
			const now = clock ? new Date(clock + 'T00:00:00Z') : new Date();
			const snapshot = await store.snapshot();
			const sessionConfig = snapshot.session;
			await sessionManager.loadPool(now, {
				folderFilter: sessionConfig.folder as string | undefined,
			});
			const limit = options.limit ? Number(options.limit) : 1;
			const nextItems = await sessionManager.getNextN(limit, now);
			const itemIds = nextItems.map((si) => si.item.id);
			store.setNextItems(itemIds);
			store.setNextItem(itemIds[0] ?? null);
			break;
		}
		case 'status': {
			// Status outputs session progress - data is available via expect on stats
			await sessionManager.loadPool();
			break;
		}
		case 'inspect-counts': {
			const clock = store.getClock();
			const now = clock ? new Date(clock + 'T00:00:00Z') : new Date();
			const snapshot = await store.snapshot();
			const sessionConfig = snapshot.session;
			await sessionManager.loadPool(now, {
				folderFilter: sessionConfig.folder as string | undefined,
			});
			const counts = sessionManager.getCounts(now);
			store.setSession({
				...sessionConfig,
				counts,
			});
			break;
		}
		case 'inspect-stats': {
			const stats = sessionManager.getSessionStats();
			const snapshot = await store.snapshot();
			const sessionConfig = snapshot.session;
			store.setSession({
				...sessionConfig,
				sessionStats: stats,
			});
			break;
		}
		case 'reset-session': {
			sessionManager.resetSession();
			break;
		}
		case 'postpone': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			const days = Number(positional[1] ?? 0);
			await store.recordPostpone(itemId, days);
			break;
		}
		case 'dismiss': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			await store.recordDismiss(itemId);
			break;
		}
		case 'priority': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			const value = Number(positional[1] ?? 0);
			await store.recordPriority(itemId, value);
			break;
		}
		case 'scroll': {
			const { positional } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			const value = Number(positional[1] ?? 0);
			await store.recordScroll(itemId, value);
			break;
		}
		case 'show': {
			const { positional, options } = parseArgs(command.args);
			const itemId = positional[0] ?? '';
			await store.recordShow(itemId, options.phase);
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
			if (options['new-cards-limit'])
				newConfig.newCardsLimit = Number(options['new-cards-limit']);

			store.setSession({
				strategy: newConfig.strategy,
				examDate: newConfig.examDate ? newConfig.examDate.toISOString() : null,
				capacity: newConfig.capacity,
				clump: newConfig.clumpLimit,
				cooldown: newConfig.cooldown,
				newCardsLimit: newConfig.newCardsLimit,
				folder: options.folder,
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
		if (current == null || typeof current !== 'object') return undefined;
		current = (current as Record<string, unknown>)[segment];
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

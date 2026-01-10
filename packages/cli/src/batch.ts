import type { SessionStrategyId } from '@repo/core/types';
import { MarkdownDataStore } from '@repo/core/data/MarkdownDataStore';
import { parseRvScript } from '@repo/core/rv/parser';
import { SessionManager } from '@repo/core/SessionManager';
import { NodeFileSystem } from './fs.js';

interface ParsedArgs {
	positional: string[];
	options: Record<string, string>;
}

function parseArgs(args: string[]): ParsedArgs {
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

export async function runBatch(
	vaultPath: string,
	input: string,
	strategy: SessionStrategyId,
): Promise<string> {
	const outputs: string[] = [];

	const fs = new NodeFileSystem(vaultPath);
	const dataStore = new MarkdownDataStore(fs, fs);
	const sessionManager = new SessionManager(dataStore, fs, {
		strategy,
		mode: 'review',
		schedulerId: 'fsrs',
	});

	await sessionManager.loadPool();

	const commands = parseRvScript(input);

	for (const command of commands) {
		switch (command.name) {
			case 'inspect-next': {
				const { options } = parseArgs(command.args);
				const limit =
					options.limit !== undefined && options.limit !== '' ? Number(options.limit) : 1;
				const nextItems = await sessionManager.getNextN(limit);

				if (nextItems.length === 0) {
					outputs.push('No cards due');
				} else {
					for (const si of nextItems) {
						const statusStr = si.state.status;
						const dueStr = si.state.due ? si.state.due.toISOString() : 'never';
						outputs.push(
							`${si.item.id} | ${si.item.type} | ${statusStr} | due: ${dueStr}`,
						);
						outputs.push(`  path: ${si.item.notePath}`);
						if (si.item.clozeIndex != null) {
							outputs.push(`  cloze: ${si.item.clozeIndex}`);
						}
					}
				}
				break;
			}

			case 'status': {
				const items = await sessionManager.getNextN(10000);
				const now = new Date();

				let newCount = 0;
				let learningCount = 0;
				let dueCount = 0;
				const totalCount = items.length;

				for (const item of items) {
					if (item.state.status === 'new') {
						newCount++;
					} else if (
						item.state.status === 'learning' ||
						item.state.status === 'relearning'
					) {
						learningCount++;
					} else if (item.state.due && item.state.due <= now) {
						dueCount++;
					}
				}

				outputs.push(`Total: ${totalCount}`);
				outputs.push(`New: ${newCount}`);
				outputs.push(`Learning: ${learningCount}`);
				outputs.push(`Due: ${dueCount}`);
				break;
			}

			default:
				outputs.push(`Unknown command: ${command.name}`);
		}
	}

	return `${outputs.join('\n')}\n`;
}

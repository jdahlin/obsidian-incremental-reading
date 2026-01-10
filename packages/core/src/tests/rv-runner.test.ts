import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRvScript, runRvCommands } from '../rv';

const rvDir = join(process.cwd(), 'tests', 'rv');

const files = readdirSync(rvDir)
	.filter((name) => name.endsWith('.rv'))
	.sort();

describe('.rv script runner', () => {
	files.forEach((file) => {
		it(`runs ${file}`, async () => {
			const filePath = join(rvDir, file);
			const content = readFileSync(filePath, 'utf8');
			const commands = parseRvScript(content);
			await expect(runRvCommands(commands)).resolves.not.toThrow();
		});
	});
});

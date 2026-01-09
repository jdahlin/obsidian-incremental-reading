/* eslint-disable import/no-nodejs-modules, no-undef */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseRvScript, runRvCommands } from '../rv';

const rvDir = join(process.cwd(), 'tests', 'rv');

function getRvFiles(): string[] {
	return readdirSync(rvDir)
		.filter((name) => name.endsWith('.rv'))
		.sort()
		.map((name) => join(rvDir, name));
}

describe('.rv script runner', () => {
	it.each(getRvFiles())('runs %s', (filePath) => {
		const content = readFileSync(filePath, 'utf8');
		const commands = parseRvScript(content);
		expect(() => runRvCommands(commands)).not.toThrow();
	});
});

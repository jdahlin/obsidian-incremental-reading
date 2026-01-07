import type { App, TFile } from 'obsidian';

export interface RevlogEntry {
	timestamp: Date;
	file: TFile;
	grade: number;
	type: string;
	status: string;
	due: Date;
}

export async function appendRevlog(app: App, machineId: string, entry: RevlogEntry): Promise<void> {
	const folderPath = 'IR/RevLog';
	const filePath = `${folderPath}/${machineId}.md`;
	const line = formatEntry(entry);

	// Ensure folders exist (IR and IR/RevLog)
	await ensureFolderExists(app, 'IR');
	await ensureFolderExists(app, folderPath);

	// Check if file exists
	let file = app.vault.getAbstractFileByPath(filePath);

	if (file) {
		// File exists - append to it
		await app.vault.append(file as TFile, line);
	} else {
		// File doesn't exist - try to create it
		try {
			await app.vault.create(filePath, `# Review Log\n\n${line}`);
		} catch {
			// File was created between check and create - append instead
			file = app.vault.getAbstractFileByPath(filePath);
			if (file) {
				await app.vault.append(file as TFile, line);
			}
		}
	}
}

async function ensureFolderExists(app: App, path: string): Promise<void> {
	const folder = app.vault.getAbstractFileByPath(path);
	if (!folder) {
		try {
			await app.vault.createFolder(path);
		} catch {
			// Folder might have been created by another operation - ignore
		}
	}
}

function formatEntry(entry: RevlogEntry): string {
	const timestamp = formatDateTime(entry.timestamp);
	const due = formatDateTime(entry.due);
	const path = entry.file.path.replace(/\|/g, '/');
	return `- ${timestamp} | ${path} | grade=${entry.grade} | type=${entry.type} | status=${entry.status} | due=${due}\n`;
}

function formatDateTime(value: Date): string {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	const hours = String(value.getHours()).padStart(2, '0');
	const minutes = String(value.getMinutes()).padStart(2, '0');
	const seconds = String(value.getSeconds()).padStart(2, '0');
	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Session state persistence for debugging and state recovery.
 * Writes current review state to IR/.session.json
 */

import type { SessionItem } from '@repo/core/types';
import type { App, TFile } from 'obsidian';

export interface SessionStateData {
	deck: string | null;
	currentItem: {
		id: string;
		noteId: string;
		notePath: string;
		type: string;
		clozeIndex: number | null;
		phase: 'question' | 'answer';
		rawMarkdown: string | null;
		formattedMarkdown: string | null;
	} | null;
	queue: {
		new: number;
		learning: number;
		due: number;
		total: number;
	};
	session: {
		startedAt: string | null;
		reviewed: number;
		again: number;
		hard: number;
		good: number;
		easy: number;
	};
	lastError: string | null;
	updatedAt: string;
}

const SESSION_FILE_PATH = 'IR/.session.json';

export async function writeSessionState(app: App, data: SessionStateData): Promise<void> {
	const content = JSON.stringify(data, null, 2);

	try {
		const existing = app.vault.getAbstractFileByPath(SESSION_FILE_PATH);
		if (existing instanceof app.vault.adapter.constructor) {
			// This won't work, need to check TFile
		}

		const file = app.vault.getAbstractFileByPath(SESSION_FILE_PATH);
		if (file && 'path' in file) {
			await app.vault.modify(file as TFile, content);
		} else {
			// Ensure IR directory exists
			const irDir = app.vault.getAbstractFileByPath('IR');
			if (!irDir) {
				await app.vault.createFolder('IR');
			}
			await app.vault.create(SESSION_FILE_PATH, content);
		}
	} catch {
		// Try to create if modify failed
		try {
			const irDir = app.vault.getAbstractFileByPath('IR');
			if (!irDir) {
				await app.vault.createFolder('IR');
			}
			await app.vault.create(SESSION_FILE_PATH, content);
		} catch {
			// Ignore - best effort
		}
	}
}

export function buildSessionState(params: {
	deck: string | null;
	currentItem: SessionItem | null;
	phase: 'question' | 'answer';
	queueCounts: { new: number; learning: number; due: number; total: number };
	sessionStats: { reviewed: number; again: number; hard: number; good: number; easy: number };
	startedAt: Date | null;
	lastError?: string | null;
	rawMarkdown?: string | null;
	formattedMarkdown?: string | null;
}): SessionStateData {
	return {
		deck: params.deck,
		currentItem: params.currentItem
			? {
					id: params.currentItem.item.id,
					noteId: params.currentItem.item.noteId,
					notePath: params.currentItem.item.notePath,
					type: params.currentItem.item.type,
					clozeIndex: params.currentItem.item.clozeIndex ?? null,
					phase: params.phase,
					rawMarkdown: params.rawMarkdown ?? null,
					formattedMarkdown: params.formattedMarkdown ?? null,
				}
			: null,
		queue: params.queueCounts,
		session: {
			startedAt: params.startedAt?.toISOString() ?? null,
			reviewed: params.sessionStats.reviewed,
			again: params.sessionStats.again,
			hard: params.sessionStats.hard,
			good: params.sessionStats.good,
			easy: params.sessionStats.easy,
		},
		lastError: params.lastError ?? null,
		updatedAt: new Date().toISOString(),
	};
}

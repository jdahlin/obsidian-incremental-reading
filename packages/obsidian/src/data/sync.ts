import type { ItemState } from '@repo/core/core/types'
import type { App, TFile } from 'obsidian'
import type { ClozeEntry, ReviewItemFile } from './review-items'
import { parseClozeIndices } from '@repo/core/core/cloze'
import { parseFrontmatter } from '@repo/core/core/frontmatter'
import { createId } from './ids'
import {
	deleteReviewItemFile,
	ensureNoteId,
	readReviewItemFile,
	writeReviewItemFile,
} from './review-items'

/**
 * Syncs a note's cloze indices to its sidecar file, preserving existing scheduling state.
 *
 * Preservation rules:
 * - Existing cloze entries keep their cloze_uid and scheduling state (due, stability, etc.)
 * - New clozes (indices not in sidecar) get fresh UIDs and default state
 * - Removed clozes (in sidecar but not in note) are dropped (not explicitly deleted)
 * - Topic state is preserved; only created if missing
 */
export async function syncNoteToSidecar(
	app: App,
	file: TFile,
	extractTag: string,
	frontmatterOverride?: Record<string, unknown>,
): Promise<void> {
	const frontmatter =
		frontmatterOverride ?? app.metadataCache.getFileCache(file)?.frontmatter ?? {}
	const parsed = parseFrontmatter(frontmatter, extractTag)
	if (!parsed) {
		console.warn(`IR: Skipped syncing ${file.path} - frontmatter parsing failed (tag missing?)`)
		return
	}

	const noteId = parsed.ir_note_id || (await ensureNoteId(app, file))
	const content = await app.vault.read(file)
	const indices = parseClozeIndices(content)
	const clozeKeys = indices.map((index) => `c${index}`)
	const existing = await readReviewItemFile(app, noteId)
	const now = new Date()

	// Preserve existing topic state, or create default if first sync
	const topicState = existing?.topic ?? createDefaultState(now)
	const existingClozes = existing?.clozes ?? {}
	const clozes: Record<string, ClozeEntry> = {}

	// Only include clozes that currently exist in the note content
	for (const index of indices) {
		const key = `c${index}`
		const current = existingClozes[key]
		clozes[key] = {
			cloze_uid: current?.cloze_uid ?? createId(),
			...(current ?? createDefaultState(now)),
		}
	}

	const updated: ReviewItemFile = {
		ir_note_id: noteId,
		note_path: file.path,
		type: parsed.type,
		priority: parsed.priority,
		cloze: clozeKeys.length ? clozeKeys : undefined,
		topic: topicState,
		clozes: Object.keys(clozes).length ? clozes : undefined,
	}

	await writeReviewItemFile(app, noteId, updated)
}

/**
 * Syncs all tagged notes and cleans up orphaned sidecar files.
 *
 * Orphan detection: a sidecar is deleted if ANY of these are true:
 * 1. note_path is empty (corrupt sidecar)
 * 2. Source note no longer exists in vault
 * 3. Source note exists but no longer has the extractTag
 *
 * This prevents stale sidecars from accumulating when notes are deleted or untagged.
 */
export async function syncAllNotes(app: App, extractTag: string): Promise<void> {
	const files = app.vault.getMarkdownFiles()
	const syncedPaths = new Set<string>()
	for (const file of files) {
		const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter ?? {}
		if (!parseFrontmatter(frontmatter, extractTag)) continue
		await syncNoteToSidecar(app, file, extractTag)
		syncedPaths.add(file.path)
	}

	// Clean up orphaned sidecars
	const reviewFiles = app.vault
		.getMarkdownFiles()
		.filter((file) => file.path.startsWith('IR/Review Items/'))
	for (const sidecar of reviewFiles) {
		const noteId = sidecar.basename
		const data = await readReviewItemFile(app, noteId)
		if (!data) continue
		const notePath = data.note_path
		if (!notePath || !app.vault.getAbstractFileByPath(notePath) || !syncedPaths.has(notePath)) {
			await deleteReviewItemFile(app, noteId)
		}
	}
}

function createDefaultState(now: Date): ItemState {
	return {
		status: 'new',
		due: now,
		stability: 0,
		difficulty: 0,
		reps: 0,
		lapses: 0,
		last_review: null,
	}
}

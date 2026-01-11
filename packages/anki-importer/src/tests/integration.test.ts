/**
 * Integration Tests for Anki Import
 *
 * Creates a real Anki SQLite database with test data, imports it,
 * and verifies the output files are correctly generated.
 */

import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parse as yamlParse } from 'yaml'
import { importAnkiDatabase } from '../importer/index.js'
import { writeAnkiData } from '../writer/index.js'

// =============================================================================
// Test Setup
// =============================================================================

const TEST_DIR = join(tmpdir(), 'anki-importer-integration-test')
const DB_PATH = join(TEST_DIR, 'collection.anki2')
const OUTPUT_DIR = join(TEST_DIR, 'vault', 'Anki')
const SIDECAR_DIR = join(TEST_DIR, 'vault', 'IR', 'Review Items')

// Model IDs (timestamps as in real Anki)
const BASIC_MODEL_ID = 1704067200000
const CLOZE_MODEL_ID = 1704067200001
const IO_MODEL_ID = 1704067200002

// Deck IDs
const DEFAULT_DECK_ID = 1
const SPANISH_DECK_ID = 1704067200010
const MEDICAL_DECK_ID = 1704067200011

// Note IDs
const BASIC_NOTE_ID = 1704067200100
const CLOZE_NOTE_ID = 1704067200101
const IO_NOTE_ID = 1704067200102

// Card IDs
const BASIC_CARD_ID = 1704067200200
const CLOZE_CARD_1_ID = 1704067200201
const CLOZE_CARD_2_ID = 1704067200202
const IO_CARD_1_ID = 1704067200203
const IO_CARD_2_ID = 1704067200204

// Collection creation time (for scheduling)
const COLLECTION_CRT = 1704067200 // 2024-01-01 00:00:00 UTC

/**
 * Create a template config protobuf for testing
 */
function createTemplateConfig(qfmt: string, afmt: string): Uint8Array {
	const encoder = new TextEncoder()
	const qfmtBytes = encoder.encode(qfmt)
	const afmtBytes = encoder.encode(afmt)

	const parts: number[] = []

	// Field 1: qfmt (tag = 0x0A = field 1, wire type 2)
	parts.push(0x0a)
	if (qfmtBytes.length < 128) {
		parts.push(qfmtBytes.length)
	} else {
		let len = qfmtBytes.length
		while (len >= 128) {
			parts.push((len & 0x7f) | 0x80)
			len >>>= 7
		}
		parts.push(len)
	}
	for (const b of qfmtBytes) parts.push(b)

	// Field 2: afmt (tag = 0x12 = field 2, wire type 2)
	parts.push(0x12)
	if (afmtBytes.length < 128) {
		parts.push(afmtBytes.length)
	} else {
		let len = afmtBytes.length
		while (len >= 128) {
			parts.push((len & 0x7f) | 0x80)
			len >>>= 7
		}
		parts.push(len)
	}
	for (const b of afmtBytes) parts.push(b)

	return new Uint8Array(parts)
}

/**
 * Create the Anki v18 database schema
 *
 * This is based on the real Anki schema (see anki-v18.sql) but with
 * 'COLLATE unicase' replaced with 'COLLATE NOCASE' since better-sqlite3
 * doesn't support custom collations without registration.
 */
function createAnkiSchema(db: Database.Database): void {
	// Collection table
	db.exec(`
		CREATE TABLE col (
			id integer PRIMARY KEY,
			crt integer NOT NULL,
			mod integer NOT NULL,
			scm integer NOT NULL,
			ver integer NOT NULL,
			dty integer NOT NULL,
			usn integer NOT NULL,
			ls integer NOT NULL,
			conf text NOT NULL,
			models text NOT NULL,
			decks text NOT NULL,
			dconf text NOT NULL,
			tags text NOT NULL
		)
	`)

	// Notes table
	db.exec(`
		CREATE TABLE notes (
			id integer PRIMARY KEY,
			guid text NOT NULL,
			mid integer NOT NULL,
			mod integer NOT NULL,
			usn integer NOT NULL,
			tags text NOT NULL,
			flds text NOT NULL,
			sfld integer NOT NULL,
			csum integer NOT NULL,
			flags integer NOT NULL,
			data text NOT NULL
		)
	`)

	// Cards table
	db.exec(`
		CREATE TABLE cards (
			id integer PRIMARY KEY,
			nid integer NOT NULL,
			did integer NOT NULL,
			ord integer NOT NULL,
			mod integer NOT NULL,
			usn integer NOT NULL,
			type integer NOT NULL,
			queue integer NOT NULL,
			due integer NOT NULL,
			ivl integer NOT NULL,
			factor integer NOT NULL,
			reps integer NOT NULL,
			lapses integer NOT NULL,
			left integer NOT NULL,
			odue integer NOT NULL,
			odid integer NOT NULL,
			flags integer NOT NULL,
			data text NOT NULL
		)
	`)

	// Revlog table
	db.exec(`
		CREATE TABLE revlog (
			id integer PRIMARY KEY,
			cid integer NOT NULL,
			usn integer NOT NULL,
			ease integer NOT NULL,
			ivl integer NOT NULL,
			lastIvl integer NOT NULL,
			factor integer NOT NULL,
			time integer NOT NULL,
			type integer NOT NULL
		)
	`)

	// Fields table (unicase → NOCASE for testing)
	db.exec(`
		CREATE TABLE fields (
			ntid integer NOT NULL,
			ord integer NOT NULL,
			name text NOT NULL COLLATE NOCASE,
			config blob NOT NULL,
			PRIMARY KEY (ntid, ord)
		)
	`)

	// Templates table (unicase → NOCASE for testing)
	db.exec(`
		CREATE TABLE templates (
			ntid integer NOT NULL,
			ord integer NOT NULL,
			name text NOT NULL COLLATE NOCASE,
			mtime_secs integer NOT NULL,
			usn integer NOT NULL,
			config blob NOT NULL,
			PRIMARY KEY (ntid, ord)
		)
	`)

	// Notetypes table (unicase → NOCASE for testing)
	db.exec(`
		CREATE TABLE notetypes (
			id integer NOT NULL PRIMARY KEY,
			name text NOT NULL COLLATE NOCASE,
			mtime_secs integer NOT NULL,
			usn integer NOT NULL,
			config blob NOT NULL
		)
	`)

	// Decks table (unicase → NOCASE for testing)
	db.exec(`
		CREATE TABLE decks (
			id integer PRIMARY KEY NOT NULL,
			name text NOT NULL COLLATE NOCASE,
			mtime_secs integer NOT NULL,
			usn integer NOT NULL,
			common blob NOT NULL,
			kind blob NOT NULL
		)
	`)

	// Indexes used by the importer
	db.exec(`CREATE INDEX ix_cards_nid ON cards (nid)`)
	db.exec(`CREATE INDEX idx_notes_mid ON notes (mid)`)
}

/**
 * Insert test data into the database
 */
function insertTestData(db: Database.Database): void {
	// Insert collection metadata
	db.prepare(
		`
		INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
		VALUES (1, ?, ?, 0, 18, 0, -1, 0, '{}', '{}', '{}', '{}', '{}')
	`,
	).run(COLLECTION_CRT, COLLECTION_CRT)

	// Insert notetypes
	const insertNotetype = db.prepare(`
		INSERT INTO notetypes (id, name, mtime_secs, usn, config)
		VALUES (?, ?, ?, -1, ?)
	`)
	insertNotetype.run(BASIC_MODEL_ID, 'Basic', COLLECTION_CRT, Buffer.from([]))
	insertNotetype.run(CLOZE_MODEL_ID, 'Cloze', COLLECTION_CRT, Buffer.from([]))
	insertNotetype.run(IO_MODEL_ID, 'Image Occlusion Enhanced', COLLECTION_CRT, Buffer.from([]))

	// Insert fields
	const insertField = db.prepare(`
		INSERT INTO fields (ntid, ord, name, config)
		VALUES (?, ?, ?, ?)
	`)

	// Basic fields
	insertField.run(BASIC_MODEL_ID, 0, 'Front', Buffer.from([]))
	insertField.run(BASIC_MODEL_ID, 1, 'Back', Buffer.from([]))

	// Cloze fields
	insertField.run(CLOZE_MODEL_ID, 0, 'Text', Buffer.from([]))
	insertField.run(CLOZE_MODEL_ID, 1, 'Back Extra', Buffer.from([]))

	// Image Occlusion fields
	insertField.run(IO_MODEL_ID, 0, 'Image', Buffer.from([]))
	insertField.run(IO_MODEL_ID, 1, 'Occlusion', Buffer.from([]))
	insertField.run(IO_MODEL_ID, 2, 'Header', Buffer.from([]))
	insertField.run(IO_MODEL_ID, 3, 'Back Extra', Buffer.from([]))

	// Insert templates
	const insertTemplate = db.prepare(`
		INSERT INTO templates (ntid, ord, name, mtime_secs, usn, config)
		VALUES (?, ?, ?, ?, -1, ?)
	`)

	// Basic template
	insertTemplate.run(
		BASIC_MODEL_ID,
		0,
		'Card 1',
		COLLECTION_CRT,
		createTemplateConfig('{{Front}}', '{{FrontSide}}<hr id=answer>{{Back}}'),
	)

	// Cloze template
	insertTemplate.run(
		CLOZE_MODEL_ID,
		0,
		'Cloze',
		COLLECTION_CRT,
		createTemplateConfig('{{cloze:Text}}', '{{cloze:Text}}<br>{{Back Extra}}'),
	)

	// IO template
	insertTemplate.run(
		IO_MODEL_ID,
		0,
		'Card',
		COLLECTION_CRT,
		createTemplateConfig('{{Image}}', '{{Image}}{{Occlusion}}'),
	)

	// Insert decks
	const insertDeck = db.prepare(`
		INSERT INTO decks (id, name, mtime_secs, usn, common, kind)
		VALUES (?, ?, ?, -1, ?, ?)
	`)
	insertDeck.run(DEFAULT_DECK_ID, 'Default', COLLECTION_CRT, Buffer.from([]), Buffer.from([]))
	insertDeck.run(
		SPANISH_DECK_ID,
		'Languages::Spanish',
		COLLECTION_CRT,
		Buffer.from([]),
		Buffer.from([]),
	)
	insertDeck.run(
		MEDICAL_DECK_ID,
		'Medical::Anatomy',
		COLLECTION_CRT,
		Buffer.from([]),
		Buffer.from([]),
	)

	// Insert notes
	const insertNote = db.prepare(`
		INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
		VALUES (?, ?, ?, ?, -1, ?, ?, ?, 0, 0, '')
	`)

	// Basic note - Spanish vocabulary
	insertNote.run(
		BASIC_NOTE_ID,
		'basic_guid_001',
		BASIC_MODEL_ID,
		COLLECTION_CRT,
		' spanish vocabulary ',
		'Hola\x1FHello',
		'Hola',
	)

	// Cloze note - Spanish sentence with two clozes
	insertNote.run(
		CLOZE_NOTE_ID,
		'cloze_guid_001',
		CLOZE_MODEL_ID,
		COLLECTION_CRT,
		' spanish grammar ',
		'La palabra {{c1::hola}} significa {{c2::hello}}.\x1FGreeting',
		'La palabra',
	)

	// Image Occlusion note
	insertNote.run(
		IO_NOTE_ID,
		'io_guid_001',
		IO_MODEL_ID,
		COLLECTION_CRT,
		' anatomy ',
		'<img src="heart.png">\x1F{{c1::image-occlusion:rect:left=0.1:top=0.2:width=0.3:height=0.4}}{{c2::image-occlusion:rect:left=0.5:top=0.6:width=0.2:height=0.1}}\x1FHeart Anatomy\x1FNote the chambers',
		'Heart',
	)

	// Insert cards
	const insertCard = db.prepare(`
		INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
		VALUES (?, ?, ?, ?, ?, -1, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, '')
	`)

	// Basic card - in review state
	// Note: For review cards, 'due' is days since collection creation (not epoch!)
	insertCard.run(
		BASIC_CARD_ID,
		BASIC_NOTE_ID,
		SPANISH_DECK_ID,
		0,
		COLLECTION_CRT,
		2, // type: review
		2, // queue: review
		10, // due: 10 days after collection creation
		30, // interval: 30 days
		2500, // factor: 2500 (default)
		10, // reps
		1, // lapses
	)

	// Cloze cards - c1 is new, c2 is learning
	insertCard.run(
		CLOZE_CARD_1_ID,
		CLOZE_NOTE_ID,
		SPANISH_DECK_ID,
		0, // ord 0 = c1
		COLLECTION_CRT,
		0, // type: new
		0, // queue: new
		0, // due: position in new queue
		0, // interval
		0, // factor
		0, // reps
		0, // lapses
	)

	insertCard.run(
		CLOZE_CARD_2_ID,
		CLOZE_NOTE_ID,
		SPANISH_DECK_ID,
		1, // ord 1 = c2
		COLLECTION_CRT,
		1, // type: learning
		1, // queue: learning
		COLLECTION_CRT + 600, // due: 10 min from now (timestamp)
		0, // interval
		0, // factor
		2, // reps
		0, // lapses
	)

	// Image Occlusion cards - both in review
	// Note: For review cards, 'due' is days since collection creation
	insertCard.run(
		IO_CARD_1_ID,
		IO_NOTE_ID,
		MEDICAL_DECK_ID,
		0, // ord 0 = c1
		COLLECTION_CRT,
		2, // type: review
		2, // queue: review
		5, // due: 5 days after creation
		14, // interval: 14 days
		2200, // factor: 2200
		5, // reps
		0, // lapses
	)

	insertCard.run(
		IO_CARD_2_ID,
		IO_NOTE_ID,
		MEDICAL_DECK_ID,
		1, // ord 1 = c2
		COLLECTION_CRT,
		2, // type: review
		2, // queue: review
		7, // due: 7 days after creation
		21, // interval: 21 days
		2700, // factor: 2700
		8, // reps
		1, // lapses
	)
}

// =============================================================================
// Tests
// =============================================================================

describe('anki Import Integration', () => {
	beforeAll(() => {
		// Clean up and create test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true })
		}
		mkdirSync(TEST_DIR, { recursive: true })

		// Create and populate test database
		const db = new Database(DB_PATH)
		createAnkiSchema(db)
		insertTestData(db)
		db.close()
	})

	afterAll(() => {
		// Clean up test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true })
		}
	})

	describe('database Import', () => {
		it('imports all models, decks, notes, and cards', () => {
			const result = importAnkiDatabase(DB_PATH)

			expect(result.stats.modelCount).toBe(3)
			expect(result.stats.deckCount).toBe(3)
			expect(result.stats.noteCount).toBe(3)
			expect(result.stats.cardCount).toBe(5)
		})

		it('correctly parses basic model', () => {
			const result = importAnkiDatabase(DB_PATH)
			const basicModel = result.models.find((m) => m.name === 'Basic')

			expect(basicModel).toBeDefined()
			expect(basicModel?.fields).toHaveLength(2)
			expect(basicModel?.fields[0]?.name).toBe('Front')
			expect(basicModel?.fields[1]?.name).toBe('Back')
		})

		it('correctly parses cloze model', () => {
			const result = importAnkiDatabase(DB_PATH)
			const clozeModel = result.models.find((m) => m.name === 'Cloze')

			expect(clozeModel).toBeDefined()
			expect(clozeModel?.fields).toHaveLength(2)
			expect(clozeModel?.fields[0]?.name).toBe('Text')
		})

		it('correctly parses image occlusion model', () => {
			const result = importAnkiDatabase(DB_PATH)
			const ioModel = result.models.find((m) => m.name === 'Image Occlusion Enhanced')

			expect(ioModel).toBeDefined()
			expect(ioModel?.fields).toHaveLength(4)
			expect(ioModel?.fields.map((f) => f.name)).toContain('Image')
			expect(ioModel?.fields.map((f) => f.name)).toContain('Occlusion')
		})

		it('correctly parses nested deck names', () => {
			const result = importAnkiDatabase(DB_PATH)
			const spanishDeck = result.decks.find((d) => d.name === 'Languages::Spanish')
			const medicalDeck = result.decks.find((d) => d.name === 'Medical::Anatomy')

			expect(spanishDeck).toBeDefined()
			expect(medicalDeck).toBeDefined()
		})
	})

	describe('write Output', () => {
		beforeAll(async () => {
			// Import and write
			const data = importAnkiDatabase(DB_PATH)
			await writeAnkiData(data, {
				outputDir: OUTPUT_DIR,
				sidecarDir: SIDECAR_DIR,
				vaultRelativePrefix: 'Anki',
				collectionCreatedAt: COLLECTION_CRT,
			})
		})

		it('creates note files in correct deck folders', () => {
			// Basic note in Languages/Spanish
			const basicNotePath = join(OUTPUT_DIR, 'Languages', 'Spanish', `${BASIC_NOTE_ID}.md`)
			expect(existsSync(basicNotePath)).toBe(true)

			// Cloze note in Languages/Spanish
			const clozeNotePath = join(OUTPUT_DIR, 'Languages', 'Spanish', `${CLOZE_NOTE_ID}.md`)
			expect(existsSync(clozeNotePath)).toBe(true)

			// IO note in Medical/Anatomy
			const ioNotePath = join(OUTPUT_DIR, 'Medical', 'Anatomy', `${IO_NOTE_ID}.md`)
			expect(existsSync(ioNotePath)).toBe(true)
		})

		it('creates sidecar files in IR/Review Items', () => {
			// Count sidecar files
			const sidecarFiles = readdirSync(SIDECAR_DIR).filter((f) => f.endsWith('.md'))

			// Should have 3 sidecars (one per note)
			expect(sidecarFiles.length).toBe(3)
		})

		describe('basic Note', () => {
			let noteContent: string
			let noteFrontmatter: Record<string, unknown>

			beforeAll(() => {
				const notePath = join(OUTPUT_DIR, 'Languages', 'Spanish', `${BASIC_NOTE_ID}.md`)
				noteContent = readFileSync(notePath, 'utf-8')
				const fmMatch = noteContent.match(/^---\n([\s\S]*?)\n---/)
				noteFrontmatter = yamlParse(fmMatch?.[1] ?? '') as Record<string, unknown>
			})

			it('has correct frontmatter', () => {
				expect(noteFrontmatter['anki_note_id']).toBe(String(BASIC_NOTE_ID))
				expect(noteFrontmatter['anki_model_id']).toBe(String(BASIC_MODEL_ID))
				expect(noteFrontmatter['type']).toBe('basic')
				expect(noteFrontmatter['tags']).toContain('spanish')
				expect(noteFrontmatter['tags']).toContain('vocabulary')
			})

			it('has field sections', () => {
				expect(noteContent).toContain('## Front')
				expect(noteContent).toContain('Hola')
				expect(noteContent).toContain('## Back')
				expect(noteContent).toContain('Hello')
			})
		})

		describe('cloze Note', () => {
			let noteContent: string
			let noteFrontmatter: Record<string, unknown>

			beforeAll(() => {
				const notePath = join(OUTPUT_DIR, 'Languages', 'Spanish', `${CLOZE_NOTE_ID}.md`)
				noteContent = readFileSync(notePath, 'utf-8')
				const fmMatch = noteContent.match(/^---\n([\s\S]*?)\n---/)
				noteFrontmatter = yamlParse(fmMatch?.[1] ?? '') as Record<string, unknown>
			})

			it('has correct frontmatter', () => {
				expect(noteFrontmatter['anki_note_id']).toBe(String(CLOZE_NOTE_ID))
				expect(noteFrontmatter['type']).toBe('cloze')
				expect(noteFrontmatter['cloze']).toEqual(['c1', 'c2'])
			})

			it('preserves cloze syntax', () => {
				expect(noteContent).toContain('{{c1::hola}}')
				expect(noteContent).toContain('{{c2::hello}}')
			})
		})

		describe('image Occlusion Note', () => {
			let noteContent: string
			let noteFrontmatter: Record<string, unknown>

			beforeAll(() => {
				const notePath = join(OUTPUT_DIR, 'Medical', 'Anatomy', `${IO_NOTE_ID}.md`)
				noteContent = readFileSync(notePath, 'utf-8')
				const fmMatch = noteContent.match(/^---\n([\s\S]*?)\n---/)
				noteFrontmatter = yamlParse(fmMatch?.[1] ?? '') as Record<string, unknown>
			})

			it('has correct frontmatter', () => {
				expect(noteFrontmatter['anki_note_id']).toBe(String(IO_NOTE_ID))
				expect(noteFrontmatter['type']).toBe('image_occlusion')
				expect(noteFrontmatter['cloze']).toEqual(['c1', 'c2'])
			})

			it('preserves image occlusion syntax', () => {
				expect(noteContent).toContain('image-occlusion:rect')
				expect(noteContent).toContain('left=0.1')
				expect(noteContent).toContain('left=0.5')
			})
		})

		describe('sidecar Files', () => {
			it('basic sidecar has note_path', () => {
				const sidecarFiles = readdirSync(SIDECAR_DIR)

				let foundBasicSidecar = false
				for (const file of sidecarFiles) {
					const content = readFileSync(join(SIDECAR_DIR, file), 'utf-8')
					const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
					const fm = yamlParse(fmMatch?.[1] ?? '') as Record<string, unknown>

					if (fm['anki_note_id'] === String(BASIC_NOTE_ID)) {
						foundBasicSidecar = true
						expect(fm['note_path']).toBe(`Anki/Languages/Spanish/${BASIC_NOTE_ID}.md`)
						expect(fm['type']).toBe('basic')
						expect(fm['basic']).toBeDefined()
						const basic = fm['basic'] as Record<string, unknown>
						expect(basic['status']).toBe('review')
						expect(basic['reps']).toBe(10)
						expect(basic['lapses']).toBe(1)
					}
				}
				expect(foundBasicSidecar).toBe(true)
			})

			it('cloze sidecar has clozes map with scheduling', () => {
				const sidecarFiles = readdirSync(SIDECAR_DIR)

				let foundClozeSidecar = false
				for (const file of sidecarFiles) {
					const content = readFileSync(join(SIDECAR_DIR, file), 'utf-8')
					const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
					const fm = yamlParse(fmMatch?.[1] ?? '') as Record<string, unknown>

					if (fm['anki_note_id'] === String(CLOZE_NOTE_ID)) {
						foundClozeSidecar = true
						expect(fm['note_path']).toBe(`Anki/Languages/Spanish/${CLOZE_NOTE_ID}.md`)
						expect(fm['type']).toBe('cloze')
						expect(fm['clozes']).toBeDefined()

						const clozes = fm['clozes'] as Record<string, Record<string, unknown>>
						expect(clozes['c1']).toBeDefined()
						expect(clozes['c2']).toBeDefined()
						expect(clozes['c1']?.['status']).toBe('new')
						expect(clozes['c2']?.['status']).toBe('learning')
					}
				}
				expect(foundClozeSidecar).toBe(true)
			})

			it('image occlusion sidecar has clozes with review state', () => {
				const sidecarFiles = readdirSync(SIDECAR_DIR)

				let foundIOSidecar = false
				for (const file of sidecarFiles) {
					const content = readFileSync(join(SIDECAR_DIR, file), 'utf-8')
					const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
					const fm = yamlParse(fmMatch?.[1] ?? '') as Record<string, unknown>

					if (fm['anki_note_id'] === String(IO_NOTE_ID)) {
						foundIOSidecar = true
						expect(fm['note_path']).toBe(`Anki/Medical/Anatomy/${IO_NOTE_ID}.md`)
						expect(fm['type']).toBe('image_occlusion')
						expect(fm['clozes']).toBeDefined()

						const clozes = fm['clozes'] as Record<string, Record<string, unknown>>
						expect(clozes['c1']).toBeDefined()
						expect(clozes['c2']).toBeDefined()
						expect(clozes['c1']?.['status']).toBe('review')
						expect(clozes['c2']?.['status']).toBe('review')
						expect(clozes['c1']?.['reps']).toBe(5)
						expect(clozes['c2']?.['reps']).toBe(8)
					}
				}
				expect(foundIOSidecar).toBe(true)
			})
		})
	})

	describe('scheduling Conversion', () => {
		let sidecars: Map<string, Record<string, unknown>>

		beforeAll(() => {
			sidecars = new Map()
			const sidecarFiles = readdirSync(SIDECAR_DIR)

			for (const file of sidecarFiles) {
				const content = readFileSync(join(SIDECAR_DIR, file), 'utf-8')
				const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
				const fm = yamlParse(fmMatch?.[1] ?? '') as Record<string, unknown>
				sidecars.set(fm['anki_note_id'] as string, fm)
			}
		})

		it('converts Anki factor to FSRS difficulty', () => {
			const basicSidecar = sidecars.get(String(BASIC_NOTE_ID))
			const basic = basicSidecar?.['basic'] as Record<string, unknown>

			// factor 2500 → difficulty = (3000 - 2500) / 170 ≈ 2.94
			expect(basic?.['difficulty']).toBeCloseTo(2.94, 1)
		})

		it('converts due date correctly for review cards', () => {
			const basicSidecar = sidecars.get(String(BASIC_NOTE_ID))
			const basic = basicSidecar?.['basic'] as Record<string, unknown>

			// Due was set to 10 days after collection creation
			// dueToDate calculates: (collectionCreatedAt + due * 86400) * 1000
			const dueDate = new Date(basic?.['due'] as string)
			const expectedDue = new Date((COLLECTION_CRT + 10 * 86400) * 1000)

			// The due dates should match exactly (within a day to account for any timezone issues)
			expect(Math.abs(dueDate.getTime() - expectedDue.getTime())).toBeLessThan(86400 * 1000)
		})

		it('stability reflects interval', () => {
			const basicSidecar = sidecars.get(String(BASIC_NOTE_ID))
			const basic = basicSidecar?.['basic'] as Record<string, unknown>

			// Interval was 30 days
			expect(basic?.['stability']).toBe(30)
		})
	})
})

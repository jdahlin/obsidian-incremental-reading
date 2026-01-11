/**
 * IR (Incremental Reading) Storage Type Definitions
 *
 * Types for the markdown file output format as specified in markdown-storage.md
 */

// =============================================================================
// Branded Types for IR
// =============================================================================

declare const __brand: unique symbol
type Brand<T, B extends string> = T & { readonly [__brand]: B }

/** IR note ID (12-char alphanumeric, e.g., "H4573WdOw2q0") */
export type IRNoteId = Brand<string, 'IRNoteId'>

/** Cloze UID for individual cloze cards (12-char alphanumeric) */
export type ClozeUid = Brand<string, 'ClozeUid'>

// =============================================================================
// Scheduling State Types
// =============================================================================

/**
 * Card status in the scheduling system
 */
export const SchedulingStatus = {
	New: 'new',
	Learning: 'learning',
	Review: 'review',
	Relearning: 'relearning',
} as const

// eslint-disable-next-line ts/no-redeclare -- Intentional: const object + type pattern
export type SchedulingStatus = (typeof SchedulingStatus)[keyof typeof SchedulingStatus]

/**
 * FSRS scheduling state for a single card
 * @invariant stability >= 0
 * @invariant difficulty >= 0 && difficulty <= 10
 * @invariant reps >= 0
 * @invariant lapses >= 0
 */
export interface FSRSState {
	readonly status: SchedulingStatus
	readonly due: string // ISO 8601 datetime
	readonly stability: number // FSRS stability in days
	readonly difficulty: number // FSRS difficulty 0-10
	readonly reps: number // Total review count
	readonly lapses: number // Times forgotten
	readonly lastReview: string | null // ISO 8601 datetime or null
}

/**
 * Cloze-specific scheduling with unique ID
 */
export interface ClozeSchedulingState extends FSRSState {
	readonly clozeUid: ClozeUid
}

// =============================================================================
// Note Type Classification
// =============================================================================

/**
 * Note type for scheduling and display purposes
 */
export const NoteType = {
	Basic: 'basic',
	Cloze: 'cloze',
	ImageOcclusion: 'image_occlusion',
	Standard: 'standard', // Generic multi-template
	Topic: 'topic', // IR topic (not from Anki)
} as const

// eslint-disable-next-line ts/no-redeclare -- Intentional: const object + type pattern
export type NoteType = (typeof NoteType)[keyof typeof NoteType]

// =============================================================================
// Model File Types (IR/Anki-Import/Models/)
// =============================================================================

/**
 * Field definition in model file
 * @invariant ord is 0-indexed and contiguous
 */
export interface ModelField {
	readonly name: string
	readonly ord: number
}

/**
 * Template definition in model file
 * @invariant ord is 0-indexed and contiguous
 */
export interface ModelTemplate {
	readonly name: string
	readonly ord: number
	readonly qfmt: string // Question format (front template HTML)
	readonly afmt: string // Answer format (back template HTML)
}

/**
 * Model file frontmatter
 * @invariant fields.length >= 1
 * @invariant templates.length >= 1
 * @invariant fields are sorted by ord ascending
 * @invariant templates are sorted by ord ascending
 */
export interface ModelFrontmatter {
	readonly anki_model_id: string
	readonly name: string
	readonly fields: readonly ModelField[]
	readonly templates: readonly ModelTemplate[]
}

// =============================================================================
// Note File Types (Anki/{DeckPath}/{note_id}.md)
// =============================================================================

/**
 * Cloze index identifier (e.g., "c1", "c2")
 * @invariant matches pattern /^c[1-9]\d*$/
 */
export type ClozeIndex = `c${number}`

/**
 * Note file frontmatter
 * @invariant ir_note_id is 12 chars alphanumeric
 * @invariant anki_note_id matches original Anki ID
 * @invariant anki_model_id references existing model
 * @invariant cloze array only present for cloze/image_occlusion types
 */
export interface NoteFrontmatter {
	readonly ir_note_id: string
	readonly anki_note_id: string
	readonly anki_model_id: string
	readonly tags: readonly string[]
	readonly created: string // YYYY-MM-DD
	readonly type: NoteType
	readonly priority: number // 0-100, default 50
	readonly cloze?: readonly ClozeIndex[] // Only for cloze/image_occlusion
}

/**
 * Parsed note file with frontmatter and field content
 * @invariant fields.length matches model.fields.length
 * @invariant fields[i].name matches model.fields[i].name
 */
export interface ParsedNoteFile {
	readonly frontmatter: NoteFrontmatter
	readonly fields: readonly {
		readonly name: string
		readonly content: string
	}[]
}

// =============================================================================
// Sidecar File Types (IR/Review Items/{ir_note_id}.md)
// =============================================================================

/**
 * Basic card sidecar state
 */
export interface BasicSidecarState {
	readonly type: 'basic'
	readonly basic: FSRSState
}

/**
 * Cloze card sidecar state
 * @invariant clozes has at least one entry
 * @invariant cloze keys match note's cloze array
 */
export interface ClozeSidecarState {
	readonly type: 'cloze' | 'image_occlusion'
	readonly clozes: Readonly<Record<ClozeIndex, ClozeSchedulingState>>
}

/**
 * Topic sidecar state (IR native, not from Anki)
 */
export interface TopicSidecarState {
	readonly type: 'topic'
	readonly topic: FSRSState
}

/**
 * Sidecar file frontmatter (discriminated union by type)
 */
export type SidecarFrontmatter = {
	readonly ir_note_id: string
	readonly note_path: string // Relative path to note file
	readonly priority: number
} & (BasicSidecarState | ClozeSidecarState | TopicSidecarState)

// =============================================================================
// Deck File Types (IR/Anki-Import/Decks/)
// =============================================================================

/**
 * Deck tree file frontmatter
 */
export interface DeckTreeFrontmatter {
	readonly generated: string // ISO 8601 datetime
	readonly deck_count: number
}

/**
 * Deck node in hierarchy
 * @invariant pathSegments.length >= 1
 * @invariant pathSegments.join('::') reconstructs original Anki name
 */
export interface DeckNode {
	readonly id: string // Anki deck ID as string
	readonly name: string // Leaf name only
	readonly pathSegments: readonly string[] // Full path
	readonly children: readonly DeckNode[]
}

// =============================================================================
// Conversion Types (Anki → IR)
// =============================================================================

/**
 * Queue to status mapping result
 */
export interface QueueStatusMapping {
	readonly status: SchedulingStatus
	readonly skip: boolean // true for suspended cards
	readonly reset: boolean // true for buried cards
}

/**
 * Factor to difficulty conversion result
 * Formula: (3000 - clamp(factor, 1300, 3000)) / 170
 * @invariant result is between 0 and 10
 */
export type Difficulty = number & { readonly __difficulty: unique symbol }

// =============================================================================
// Type Guards
// =============================================================================

export function isSchedulingStatus(value: string): value is SchedulingStatus {
	return (
		value === SchedulingStatus.New ||
		value === SchedulingStatus.Learning ||
		value === SchedulingStatus.Review ||
		value === SchedulingStatus.Relearning
	)
}

export function isNoteType(value: string): value is NoteType {
	return (
		value === NoteType.Basic ||
		value === NoteType.Cloze ||
		value === NoteType.ImageOcclusion ||
		value === NoteType.Standard ||
		value === NoteType.Topic
	)
}

export function isClozeIndex(value: string): value is ClozeIndex {
	return /^c[1-9]\d*$/.test(value)
}

export function isBasicSidecar(
	sidecar: SidecarFrontmatter,
): sidecar is { ir_note_id: string; note_path: string; priority: number } & BasicSidecarState {
	return sidecar.type === 'basic'
}

export function isClozeSidecar(
	sidecar: SidecarFrontmatter,
): sidecar is { ir_note_id: string; note_path: string; priority: number } & ClozeSidecarState {
	return sidecar.type === 'cloze' || sidecar.type === 'image_occlusion'
}

export function isTopicSidecar(
	sidecar: SidecarFrontmatter,
): sidecar is { ir_note_id: string; note_path: string; priority: number } & TopicSidecarState {
	return sidecar.type === 'topic'
}

// =============================================================================
// ID Generation
// =============================================================================

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Generate a 12-character alphanumeric ID
 * Uses crypto.getRandomValues for secure randomness
 */
export function generateIRNoteId(): IRNoteId {
	const bytes = new Uint8Array(12)
	crypto.getRandomValues(bytes)
	let result = ''
	for (let i = 0; i < 12; i++) {
		result += ALPHANUMERIC[bytes[i]! % ALPHANUMERIC.length]
	}
	return result as IRNoteId
}

/**
 * Generate a cloze UID
 */
export function generateClozeUid(): ClozeUid {
	const bytes = new Uint8Array(12)
	crypto.getRandomValues(bytes)
	let result = ''
	for (let i = 0; i < 12; i++) {
		result += ALPHANUMERIC[bytes[i]! % ALPHANUMERIC.length]
	}
	return result as ClozeUid
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate IR note ID format
 * @invariant 12 chars, alphanumeric only
 */
export function isValidIRNoteId(id: string): id is IRNoteId {
	return /^[A-Z0-9]{12}$/i.test(id)
}

/**
 * Validate priority is in valid range
 * @invariant 0 <= priority <= 100
 */
export function isValidPriority(priority: number): boolean {
	return Number.isInteger(priority) && priority >= 0 && priority <= 100
}

/**
 * Validate FSRS difficulty is in valid range
 * @invariant 0 <= difficulty <= 10
 */
export function isValidDifficulty(difficulty: number): boolean {
	return difficulty >= 0 && difficulty <= 10
}

/**
 * Convert Anki factor (permille) to FSRS difficulty (0-10)
 * Formula: (3000 - clamp(factor, 1300, 3000)) / 170
 */
export function factorToDifficulty(factor: number): Difficulty {
	const clamped = Math.max(1300, Math.min(3000, factor))
	const difficulty = (3000 - clamped) / 170
	return difficulty as Difficulty
}

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Sanitize a string for use as a filename
 * Replaces filesystem-unsafe characters with underscore
 */
export function sanitizeFilename(name: string): string {
	return name.replace(/[<>:"/\\|?*]/g, '_').trim()
}

/**
 * Convert Anki deck name to filesystem path
 * Parent::Child::Grandchild → Parent/Child/Grandchild
 */
export function deckNameToPath(deckName: string): string {
	return deckName.split('::').map(sanitizeFilename).join('/')
}

/**
 * Parse deck path back to segments
 */
export function pathToDeckSegments(path: string): readonly string[] {
	return path.split('/').filter((s) => s.length > 0)
}

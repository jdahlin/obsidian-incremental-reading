/**
 * Anki Database Type Definitions
 *
 * Strict types matching schema-v18.md with enforced invariants.
 */

// =============================================================================
// Branded Types (Nominal Typing)
// =============================================================================

declare const __brand: unique symbol
type Brand<T, B extends string> = T & { readonly [__brand]: B }

/** Anki notetype ID (millisecond timestamp) */
export type ModelId = Brand<number, 'ModelId'>

/** Anki note ID (millisecond timestamp) */
export type NoteId = Brand<number, 'NoteId'>

/** Anki card ID (millisecond timestamp) */
export type CardId = Brand<number, 'CardId'>

/** Anki deck ID (millisecond timestamp, 1 = default) */
export type DeckId = Brand<number, 'DeckId'>

/** Anki review log ID (millisecond timestamp of review) */
export type RevlogId = Brand<number, 'RevlogId'>

// =============================================================================
// Enums with Exhaustive Checking
// =============================================================================

/**
 * Card queue - determines scheduling behavior
 * @see schema-v18.md Table: cards
 */
export const CardQueue = {
	/** Manually buried by user */
	UserBuried: -3,
	/** Automatically buried sibling */
	SchedBuried: -2,
	/** Suspended */
	Suspended: -1,
	/** New card queue */
	New: 0,
	/** Intraday learning (due = unix timestamp seconds) */
	Learning: 1,
	/** Review queue (due = days since collection creation) */
	Review: 2,
	/** Interday learning (due = days since collection creation) */
	DayLearn: 3,
	/** Preview in filtered deck */
	Preview: 4,
} as const

// eslint-disable-next-line ts/no-redeclare -- Intentional: const object + type pattern
export type CardQueue = (typeof CardQueue)[keyof typeof CardQueue]

/**
 * Card type - current learning state
 * @see schema-v18.md Table: cards
 */
export const CardType = {
	/** Never reviewed */
	New: 0,
	/** In initial learning phase */
	Learn: 1,
	/** Graduated to review queue */
	Review: 2,
	/** Lapsed, in relearning phase */
	Relearn: 3,
} as const

// eslint-disable-next-line ts/no-redeclare -- Intentional: const object + type pattern
export type CardType = (typeof CardType)[keyof typeof CardType]

/**
 * Notetype kind from config protobuf
 * @see schema-v18.md Table: notetypes
 */
export const NotetypeKind = {
	/** Standard notetype (Basic, etc.) */
	Normal: 0,
	/** Cloze deletion notetype */
	Cloze: 1,
} as const

// eslint-disable-next-line ts/no-redeclare -- Intentional: const object + type pattern
export type NotetypeKind = (typeof NotetypeKind)[keyof typeof NotetypeKind]

/**
 * Review log entry type
 * @see schema-v18.md Table: revlog
 */
export const RevlogKind = {
	/** Initial learning */
	Learning: 0,
	/** Normal review */
	Review: 1,
	/** Lapsed card relearning */
	Relearning: 2,
	/** Filtered deck or early review */
	Filtered: 3,
	/** Manual reschedule */
	Manual: 4,
	/** Bulk reschedule operation */
	Rescheduled: 5,
} as const

// eslint-disable-next-line ts/no-redeclare -- Intentional: const object + type pattern
export type RevlogKind = (typeof RevlogKind)[keyof typeof RevlogKind]

/**
 * Ease button pressed during review
 * @see schema-v18.md Table: revlog
 */
export const EaseButton = {
	/** Manual reschedule (not a button press) */
	Manual: 0,
	/** Again button */
	Again: 1,
	/** Hard button */
	Hard: 2,
	/** Good button */
	Good: 3,
	/** Easy button */
	Easy: 4,
} as const

// eslint-disable-next-line ts/no-redeclare -- Intentional: const object + type pattern
export type EaseButton = (typeof EaseButton)[keyof typeof EaseButton]

// =============================================================================
// Constrained Number Types
// =============================================================================

/** Field ordinal: 0-indexed, contiguous */
export type FieldOrd = number & { readonly __fieldOrd: unique symbol }

/** Template ordinal: 0-indexed, contiguous */
export type TemplateOrd = number & { readonly __templateOrd: unique symbol }

/** Card ordinal: matches template ord (basic) or cloze index - 1 (cloze) */
export type CardOrd = number & { readonly __cardOrd: unique symbol }

/** Unix timestamp in seconds */
export type UnixSeconds = number & { readonly __unixSeconds: unique symbol }

/** Unix timestamp in milliseconds */
export type UnixMillis = number & { readonly __unixMillis: unique symbol }

/** Interval in days (positive) */
export type IntervalDays = number & { readonly __intervalDays: unique symbol }

/** Ease factor in permille (e.g., 2500 = 250% = 2.5x multiplier) */
export type EaseFactorPermille = number & { readonly __easeFactorPermille: unique symbol }

/** Days since collection creation (for due dates) */
export type DaysSinceCreation = number & { readonly __daysSinceCreation: unique symbol }

// =============================================================================
// Raw Database Row Types (direct from SQLite)
// =============================================================================

/**
 * Raw row from `notetypes` table
 * @invariant id is unique
 * @invariant name is unique (case-insensitive via unicase collation)
 */
export interface NotetypeRow {
	readonly id: number
	readonly name: string
	readonly mtime_secs: number
	readonly usn: number
	readonly config: Uint8Array // Protobuf NotetypeConfig
}

/**
 * Raw row from `fields` table
 * @invariant (ntid, ord) is unique (composite primary key)
 * @invariant (name, ntid) is unique
 * @invariant ord is 0-indexed and contiguous within ntid
 */
export interface FieldRow {
	readonly ntid: number
	readonly ord: number
	readonly name: string
	readonly config: Uint8Array // Protobuf NoteFieldConfig
}

/**
 * Raw row from `templates` table
 * @invariant (ntid, ord) is unique (composite primary key)
 * @invariant (name, ntid) is unique
 * @invariant ord is 0-indexed and contiguous within ntid
 */
export interface TemplateRow {
	readonly ntid: number
	readonly ord: number
	readonly name: string
	readonly mtime_secs: number
	readonly usn: number
	readonly config: Uint8Array // Protobuf CardTemplateConfig
}

/**
 * Parsed template config from protobuf
 */
export interface TemplateConfig {
	readonly qfmt: string // Question format (front template)
	readonly afmt: string // Answer format (back template)
}

/**
 * Raw row from `notes` table
 * @invariant id is unique (millisecond timestamp)
 * @invariant guid is globally unique
 * @invariant mid references notetypes.id
 * @invariant flds has exactly N values separated by \x1f where N = field count for mid
 */
export interface NoteRow {
	readonly id: number
	readonly guid: string
	readonly mid: number
	readonly mod: number
	readonly usn: number
	readonly tags: string // Space-separated
	readonly flds: string // \x1f-separated field values
	readonly sfld: number | string // Sort field (integer type for numeric sort)
	readonly csum: number // First 4 bytes of SHA1 of first field
	readonly flags: number // Always 0
	readonly data: string // Always empty
}

/**
 * Raw row from `cards` table
 * @invariant id is unique (millisecond timestamp)
 * @invariant nid references notes.id
 * @invariant did references decks.id
 * @invariant For normal notetypes: ord references templates.ord
 * @invariant For cloze notetypes: ord = cloze_index - 1
 * @invariant queue and type have valid combinations (see below)
 */
export interface CardRow {
	readonly id: number
	readonly nid: number
	readonly did: number
	readonly ord: number
	readonly mod: number
	readonly usn: number
	readonly type: CardType
	readonly queue: CardQueue
	readonly due: number // Interpretation depends on queue
	readonly ivl: number // Days, 0 for new/learning
	readonly factor: number // Permille, 0 for new
	readonly reps: number
	readonly lapses: number
	readonly left: number // Encoded: remaining_steps + (remaining_today * 1000)
	readonly odue: number // Original due when in filtered deck
	readonly odid: number // Original deck ID (0 if not filtered)
	readonly flags: number // Bits 0-2 = flag color
	readonly data: string // JSON with FSRS data
}

/**
 * Raw row from `decks` table
 * @invariant id is unique (1 = default deck)
 * @invariant name is unique (case-insensitive)
 * @invariant name uses :: as hierarchy separator
 */
export interface DeckRow {
	readonly id: number
	readonly name: string // e.g., "Parent::Child::Grandchild"
	readonly mtime_secs: number
	readonly usn: number
	readonly common: Uint8Array // Protobuf DeckCommon
	readonly kind: Uint8Array // Protobuf NormalDeck or FilteredDeck
}

/**
 * Raw row from `revlog` table
 * @invariant id is unique (millisecond timestamp of review)
 * @invariant cid references cards.id
 */
export interface RevlogRow {
	readonly id: number
	readonly cid: number
	readonly usn: number
	readonly ease: EaseButton
	readonly ivl: number // Positive = days, negative = seconds
	readonly lastIvl: number // Previous interval
	readonly factor: number // Ease after review; FSRS: difficulty 100-1100
	readonly time: number // Milliseconds spent reviewing
	readonly type: RevlogKind
}

// =============================================================================
// Parsed/Hydrated Types
// =============================================================================

/**
 * Field definition
 * @invariant ord is 0-indexed and contiguous within model
 */
export interface Field {
	readonly name: string
	readonly ord: FieldOrd
}

/**
 * Template definition with card formats
 * @invariant ord is 0-indexed and contiguous within model
 */
export interface Template {
	readonly name: string
	readonly ord: TemplateOrd
	readonly qfmt: string // Question format (front template HTML)
	readonly afmt: string // Answer format (back template HTML)
}

/**
 * Complete notetype (model) with fields and templates
 * @invariant fields.length >= 1
 * @invariant templates.length >= 1 (for normal) or exactly 1 (for cloze)
 * @invariant fields are sorted by ord ascending
 * @invariant templates are sorted by ord ascending
 */
export interface Model {
	readonly id: ModelId
	readonly name: string
	readonly kind: NotetypeKind
	readonly fields: readonly Field[]
	readonly templates: readonly Template[]
}

/**
 * Deck with parsed path
 * @invariant pathSegments.length >= 1
 * @invariant pathSegments.join('::') === name
 */
export interface Deck {
	readonly id: DeckId
	readonly name: string
	readonly pathSegments: readonly string[]
}

/**
 * Note with parsed field values
 * @invariant fieldValues.length === model.fields.length
 * @invariant fieldValues[i] corresponds to model.fields[i]
 */
export interface Note {
	readonly id: NoteId
	readonly guid: string
	readonly modelId: ModelId
	readonly tags: readonly string[]
	readonly fieldValues: readonly string[]
	readonly modifiedAt: Date
}

/**
 * Card with typed scheduling data
 * @invariant noteId references a valid Note
 * @invariant deckId references a valid Deck
 */
export interface Card {
	readonly id: CardId
	readonly noteId: NoteId
	readonly deckId: DeckId
	readonly ord: CardOrd
	readonly queue: CardQueue
	readonly type: CardType
	readonly due: number
	readonly interval: IntervalDays
	readonly factor: EaseFactorPermille
	readonly reps: number
	readonly lapses: number
}

// =============================================================================
// Validation & Invariant Helpers
// =============================================================================

/** Validate card queue and type combination */
export function isValidQueueTypeCombo(queue: CardQueue, type: CardType): boolean {
	switch (queue) {
		case CardQueue.New:
			return type === CardType.New
		case CardQueue.Learning:
		case CardQueue.DayLearn:
		case CardQueue.Preview:
			return type === CardType.Learn || type === CardType.Relearn
		case CardQueue.Review:
			return type === CardType.Review
		case CardQueue.Suspended:
		case CardQueue.UserBuried:
		case CardQueue.SchedBuried:
			// Any type valid when suspended/buried
			return true
		default:
			return false
	}
}

/** Field separator in notes.flds */
export const FIELD_SEPARATOR = '\x1F' // U+001F Unit Separator

/** Deck hierarchy separator */
export const DECK_SEPARATOR = '::'

/** Parse field values from flds string */
export function parseFieldValues(flds: string): readonly string[] {
	return flds.split(FIELD_SEPARATOR)
}

/** Parse tags from space-separated string */
export function parseTags(tags: string): readonly string[] {
	return tags.trim() === '' ? [] : tags.trim().split(/\s+/)
}

/** Parse deck path segments from name */
export function parseDeckPath(name: string): readonly string[] {
	return name.split(DECK_SEPARATOR)
}

/** Decode left field: returns [remainingSteps, remainingToday] */
export function decodeLeft(left: number): readonly [number, number] {
	const remainingSteps = left % 1000
	const remainingToday = Math.floor(left / 1000)
	return [remainingSteps, remainingToday] as const
}

// =============================================================================
// Type Guards
// =============================================================================

export function isCardQueue(value: number): value is CardQueue {
	return value >= -3 && value <= 4
}

export function isCardType(value: number): value is CardType {
	return value >= 0 && value <= 3
}

export function isNotetypeKind(value: number): value is NotetypeKind {
	return value === 0 || value === 1
}

export function isEaseButton(value: number): value is EaseButton {
	return value >= 0 && value <= 4
}

export function isRevlogKind(value: number): value is RevlogKind {
	return value >= 0 && value <= 5
}

// =============================================================================
// Brand Constructors (with validation)
// =============================================================================

export function modelId(id: number): ModelId {
	if (!Number.isInteger(id) || id <= 0) {
		throw new Error(`Invalid ModelId: ${id}`)
	}
	return id as ModelId
}

export function noteId(id: number): NoteId {
	if (!Number.isInteger(id) || id <= 0) {
		throw new Error(`Invalid NoteId: ${id}`)
	}
	return id as NoteId
}

export function cardId(id: number): CardId {
	if (!Number.isInteger(id) || id <= 0) {
		throw new Error(`Invalid CardId: ${id}`)
	}
	return id as CardId
}

export function deckId(id: number): DeckId {
	if (!Number.isInteger(id) || id <= 0) {
		throw new Error(`Invalid DeckId: ${id}`)
	}
	return id as DeckId
}

export function fieldOrd(ord: number): FieldOrd {
	if (!Number.isInteger(ord) || ord < 0) {
		throw new Error(`Invalid FieldOrd: ${ord}`)
	}
	return ord as FieldOrd
}

export function templateOrd(ord: number): TemplateOrd {
	if (!Number.isInteger(ord) || ord < 0) {
		throw new Error(`Invalid TemplateOrd: ${ord}`)
	}
	return ord as TemplateOrd
}

export function cardOrd(ord: number): CardOrd {
	if (!Number.isInteger(ord) || ord < 0) {
		throw new Error(`Invalid CardOrd: ${ord}`)
	}
	return ord as CardOrd
}

// =============================================================================
// Protobuf Parsing
// =============================================================================

/**
 * Parse a varint from a buffer at a given offset
 * @returns [value, bytesRead]
 */
function readVarint(buffer: Uint8Array, offset: number): [number, number] {
	let result = 0
	let shift = 0
	let bytesRead = 0

	while (offset + bytesRead < buffer.length) {
		const byte = buffer[offset + bytesRead]!
		result |= (byte & 0x7F) << shift
		bytesRead++
		if ((byte & 0x80) === 0) {
			break
		}
		shift += 7
	}

	return [result, bytesRead]
}

/**
 * Parse CardTemplateConfig protobuf to extract qfmt and afmt
 *
 * The protobuf structure is:
 * - Field 1 (string): qfmt (question format / front template)
 * - Field 2 (string): afmt (answer format / back template)
 * - Other fields we ignore
 */
export function parseTemplateConfig(config: Uint8Array): TemplateConfig {
	let qfmt = ''
	let afmt = ''
	let offset = 0

	const decoder = new TextDecoder('utf-8')

	while (offset < config.length) {
		// Read field tag (field number + wire type)
		const [tag, tagBytes] = readVarint(config, offset)
		offset += tagBytes

		const fieldNumber = tag >>> 3
		const wireType = tag & 0x7

		if (wireType === 2) {
			// Length-delimited (string, bytes, embedded message)
			const [length, lengthBytes] = readVarint(config, offset)
			offset += lengthBytes

			if (fieldNumber === 1) {
				// qfmt
				qfmt = decoder.decode(config.slice(offset, offset + length))
			} else if (fieldNumber === 2) {
				// afmt
				afmt = decoder.decode(config.slice(offset, offset + length))
			}

			offset += length
		} else if (wireType === 0) {
			// Varint - skip
			const [, varBytes] = readVarint(config, offset)
			offset += varBytes
		} else if (wireType === 1) {
			// 64-bit - skip 8 bytes
			offset += 8
		} else if (wireType === 5) {
			// 32-bit - skip 4 bytes
			offset += 4
		} else {
			// Unknown wire type, break to avoid infinite loop
			break
		}
	}

	return { qfmt, afmt }
}

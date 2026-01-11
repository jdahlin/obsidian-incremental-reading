/**
 * Anki Importer
 *
 * Imports Anki database to Obsidian markdown files for incremental reading.
 */

// =============================================================================
// Anki Database Types
// =============================================================================

export {
	countCardsPerDeck,
	countNotesPerNotetype,
	getCollectionCreationTime,
	getCollectionModTime,
	getDatabaseStats,
	openAnkiDatabase,
	readCards,
	readCardsForNote,
	readDeck,
	readDecks,
	readFields,
	readFieldsForNotetype,
	readNotes,
	readNotesForNotetype,
	readNotetypes,
	readTemplates,
	readTemplatesForNotetype,
} from './database.js'

export type { DatabaseStats } from './database.js'

// =============================================================================
// IR Storage Types
// =============================================================================

export {
	buildCardMap,
	factorToDifficulty as cardFactorToDifficulty,
	cardToFSRSState,
	dueToDate,
	groupCardsByDeck,
	groupCardsByNote,
	importCardsWithScheduling,
	queueToStatus,
} from './importer/cards.js'

export type { FSRSSchedulingState } from './importer/cards.js'

// =============================================================================
// Database Operations
// =============================================================================

export {
	buildDeckMap,
	buildDeckTree,
	getDeckPath,
} from './importer/decks.js'

export type { DeckTreeNode } from './importer/decks.js'

// =============================================================================
// Model Operations
// =============================================================================

export {
	importAnkiDatabase,
	importCards,
	importDecks,
	importFromDatabase,
	importModels,
	importNotes,
} from './importer/index.js'

export type { AnkiImportResult, ImportStats } from './importer/index.js'

// =============================================================================
// Importer Module
// =============================================================================

export {
	buildNoteMap,
	extractClozeIndices,
	getFirstFieldValue,
	groupNotesByModel,
} from './importer/notes.js'

export type {
	// Sidecar files
	BasicSidecarState,
	// Note files
	ClozeIndex,
	ClozeSchedulingState,
	ClozeSidecarState,
	ClozeUid,
	DeckNode,
	// Deck files
	DeckTreeFrontmatter,
	Difficulty,
	// Scheduling
	FSRSState,
	// Branded IDs
	IRNoteId,
	// Model files
	ModelField,
	ModelFrontmatter,
	ModelTemplate,
	NoteFrontmatter,
	ParsedNoteFile,
	// Conversion
	QueueStatusMapping,
	SidecarFrontmatter,
	TopicSidecarState,
} from './ir-types.js'

export {
	deckNameToPath,
	factorToDifficulty,
	generateClozeUid,
	// ID generation
	generateIRNoteId,
	isBasicSidecar,
	isClozeIndex,
	isClozeSidecar,
	isNoteType,
	// Type guards
	isSchedulingStatus,
	isTopicSidecar,
	isValidDifficulty,
	// Validation
	isValidIRNoteId,
	isValidPriority,
	NoteType,
	pathToDeckSegments,
	// Path utilities
	sanitizeFilename,
	// Enums
	SchedulingStatus,
} from './ir-types.js'

export {
	detectNotetypeKind,
	exportAllModels,
	exportModelsToMarkdown,
	getModelFilename,
	hydrateField,
	hydrateModel,
	hydrateTemplate,
	isImageOcclusionNotetype,
	modelToMarkdown,
	readAllModels,
} from './models.js'

export type { ExportedModelFile, ModelExportSummary } from './models.js'

export type {
	Card,
	CardId,
	CardOrd,
	CardRow,
	DaysSinceCreation,
	Deck,
	DeckId,
	DeckRow,
	EaseFactorPermille,
	// Hydrated types
	Field,
	// Constrained numbers
	FieldOrd,
	FieldRow,
	IntervalDays,
	Model,
	// Branded IDs
	ModelId,
	Note,
	NoteId,
	NoteRow,
	// Raw database rows
	NotetypeRow,
	RevlogId,
	RevlogRow,
	Template,
	TemplateOrd,
	TemplateRow,
	UnixMillis,
	UnixSeconds,
} from './types.js'

export {
	cardId,
	cardOrd,
	// Enums
	CardQueue,
	CardType,
	DECK_SEPARATOR,
	deckId,
	decodeLeft,
	EaseButton,
	// Constants
	FIELD_SEPARATOR,
	fieldOrd,
	isCardQueue,
	isCardType,
	isEaseButton,
	isNotetypeKind,
	isRevlogKind,
	// Validation
	isValidQueueTypeCombo,
	// Brand constructors
	modelId,
	noteId,
	NotetypeKind,
	parseDeckPath,
	// Parsing
	parseFieldValues,
	parseTags,
	RevlogKind,
	templateOrd,
} from './types.js'

// =============================================================================
// Writer Module
// =============================================================================

export {
	createOutputPaths,
	ensureDirectories,
	writeAnkiData,
} from './writer/index.js'

export type {
	OutputPaths,
	WriteError,
	WriteOptions,
	WriteResult,
} from './writer/index.js'

import type { ReviewItem } from '@repo/core/types'
import type { WebDataStore } from './adapters/WebDataStore'
import type { WebNotePlatform } from './adapters/WebNotePlatform'

/**
 * Create demo data for testing the web review interface.
 */
// eslint-disable-next-line ts/prefer-readonly-parameter-types -- data stores
export function createDemoData(dataStore: WebDataStore, notePlatform: WebNotePlatform): void {
	const notes: Record<string, string> = {
		'demo/spaced-repetition': `# Spaced Repetition

Spaced repetition is a learning technique that incorporates increasing intervals of time between subsequent review of previously learned material.

The {{c1::spacing effect}} demonstrates that learning is more effective when study sessions are spaced out.

{{c2::Hermann Ebbinghaus}} first described the forgetting curve in 1885.`,

		'demo/fsrs': `# FSRS Algorithm

FSRS (Free Spaced Repetition Scheduler) is a modern spaced repetition algorithm.

Key parameters:
- {{c1::Stability}}: How long you'll remember something
- {{c2::Difficulty}}: How hard the material is to learn
- {{c3::Retrievability}}: Probability of recall at any given time`,

		'demo/incremental-reading': `# Incremental Reading

Incremental reading is a learning technique that allows you to read multiple articles in parallel.

Benefits:
- {{c1::Better retention}} through spaced repetition
- {{c2::Diverse learning}} from multiple sources
- {{c3::Priority-based}} scheduling`,

		'demo/cloze-deletion': `# Cloze Deletion

A {{c1::cloze deletion}} is a fill-in-the-blank exercise.

The term comes from {{c2::Gestalt psychology}}.

Cloze deletions are effective because they require {{c3::active recall}}.`,

		'demo/memory-palace': `# Memory Palace

The {{c1::method of loci}} (memory palace) is a mnemonic technique.

It works by associating {{c2::information with specific locations}} in an imagined place.

This technique dates back to {{c3::ancient Greece}}.`,
	}

	const items: ReviewItem[] = [
		// Spaced Repetition note - 2 clozes
		{
			id: 'demo/spaced-repetition::c1',
			noteId: 'demo/spaced-repetition',
			notePath: 'demo/spaced-repetition.md',
			type: 'cloze',
			clozeIndex: 1,
			priority: 50,
			created: new Date(),
		},
		{
			id: 'demo/spaced-repetition::c2',
			noteId: 'demo/spaced-repetition',
			notePath: 'demo/spaced-repetition.md',
			type: 'cloze',
			clozeIndex: 2,
			priority: 50,
			created: new Date(),
		},

		// FSRS note - 3 clozes
		{
			id: 'demo/fsrs::c1',
			noteId: 'demo/fsrs',
			notePath: 'demo/fsrs.md',
			type: 'cloze',
			clozeIndex: 1,
			priority: 60,
			created: new Date(),
		},
		{
			id: 'demo/fsrs::c2',
			noteId: 'demo/fsrs',
			notePath: 'demo/fsrs.md',
			type: 'cloze',
			clozeIndex: 2,
			priority: 60,
			created: new Date(),
		},
		{
			id: 'demo/fsrs::c3',
			noteId: 'demo/fsrs',
			notePath: 'demo/fsrs.md',
			type: 'cloze',
			clozeIndex: 3,
			priority: 60,
			created: new Date(),
		},

		// Incremental Reading note - 3 clozes
		{
			id: 'demo/incremental-reading::c1',
			noteId: 'demo/incremental-reading',
			notePath: 'demo/incremental-reading.md',
			type: 'cloze',
			clozeIndex: 1,
			priority: 70,
			created: new Date(),
		},
		{
			id: 'demo/incremental-reading::c2',
			noteId: 'demo/incremental-reading',
			notePath: 'demo/incremental-reading.md',
			type: 'cloze',
			clozeIndex: 2,
			priority: 70,
			created: new Date(),
		},
		{
			id: 'demo/incremental-reading::c3',
			noteId: 'demo/incremental-reading',
			notePath: 'demo/incremental-reading.md',
			type: 'cloze',
			clozeIndex: 3,
			priority: 70,
			created: new Date(),
		},

		// Cloze Deletion note - 3 clozes
		{
			id: 'demo/cloze-deletion::c1',
			noteId: 'demo/cloze-deletion',
			notePath: 'demo/cloze-deletion.md',
			type: 'cloze',
			clozeIndex: 1,
			priority: 40,
			created: new Date(),
		},
		{
			id: 'demo/cloze-deletion::c2',
			noteId: 'demo/cloze-deletion',
			notePath: 'demo/cloze-deletion.md',
			type: 'cloze',
			clozeIndex: 2,
			priority: 40,
			created: new Date(),
		},
		{
			id: 'demo/cloze-deletion::c3',
			noteId: 'demo/cloze-deletion',
			notePath: 'demo/cloze-deletion.md',
			type: 'cloze',
			clozeIndex: 3,
			priority: 40,
			created: new Date(),
		},

		// Memory Palace note - 3 clozes
		{
			id: 'demo/memory-palace::c1',
			noteId: 'demo/memory-palace',
			notePath: 'demo/memory-palace.md',
			type: 'cloze',
			clozeIndex: 1,
			priority: 30,
			created: new Date(),
		},
		{
			id: 'demo/memory-palace::c2',
			noteId: 'demo/memory-palace',
			notePath: 'demo/memory-palace.md',
			type: 'cloze',
			clozeIndex: 2,
			priority: 30,
			created: new Date(),
		},
		{
			id: 'demo/memory-palace::c3',
			noteId: 'demo/memory-palace',
			notePath: 'demo/memory-palace.md',
			type: 'cloze',
			clozeIndex: 3,
			priority: 30,
			created: new Date(),
		},
	]

	// Import notes
	notePlatform.importNotes(notes)

	// Import items
	dataStore.importItems(items)
}

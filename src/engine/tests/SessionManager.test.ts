import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../SessionManager';
import { MemoryDataStore } from '../memory/MemoryDataStore';
import { InMemoryNotePlatform } from './InMemoryNotePlatform';
import type { SessionConfig } from '../types';

describe('SessionManager (Integration with MemoryDataStore)', () => {
	let dataStore: MemoryDataStore;
	let notePlatform: InMemoryNotePlatform;
	let config: SessionConfig;

	beforeEach(() => {
		vi.spyOn(Math, 'random').mockReturnValue(0.0); // Always pick top item by default
		dataStore = new MemoryDataStore();
		notePlatform = new InMemoryNotePlatform();
		config = {
			strategy: 'JD1',
			mode: 'review',
			schedulerId: 'fsrs',
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('loads pool from data store', async () => {
		// Setup data
		const noteId = dataStore.createNote('content', { priority: 50 });

		const sm = new SessionManager(dataStore, notePlatform, config);
		await sm.loadPool();

		const next = await sm.getNext();
		expect(next?.item.id).toBe(noteId);
	});

	it('Anki strategy uses bucket order', async () => {
		config.strategy = 'Anki';

		// Create New item
		dataStore.createNote('New Topic', { priority: 50 });

		// Create Due item (Review status, past due)
		const dueNoteId = dataStore.createNote('Due Cloze Source', { priority: 50 });
		const dueClozeId = dataStore.addCloze(dueNoteId, 0, 5);

		await dataStore.setState(dueClozeId, {
			status: 'review',
			due: new Date(2000, 1, 1), // Past due
			stability: 10,
			difficulty: 5,
			reps: 5,
			lapses: 0,
			lastReview: new Date(1999, 1, 1),
		});

		const sm = new SessionManager(dataStore, notePlatform, config);
		await sm.loadPool();

		const next = await sm.getNext();
		// Expect Due item first
		expect(next?.item.id).toBe(dueClozeId);
	});

	it('JD1 strategy uses priority', async () => {
		dataStore.createNote('Low Priority', { priority: 10 });
		const highId = dataStore.createNote('High Priority', { priority: 90 });

		const sm = new SessionManager(dataStore, notePlatform, config);
		await sm.loadPool();

		const next = await sm.getNext();
		expect(next?.item.id).toBe(highId);
	});

	it('JD1 strategy applies affinity boost', async () => {
		dataStore.createNote('Other', { priority: 50 });
		const linkedId = dataStore.createNote('Linked', { priority: 50 });

		// Setup link from "prev" note to "Linked" note
		// First we need a "prev" note that was just reviewed.
		const prevId = dataStore.createNote('Previous', { priority: 50 });
		notePlatform.addLink(prevId, linkedId);

		const sm = new SessionManager(dataStore, notePlatform, config);
		await sm.loadPool();

		// Manually simulate a review of 'prevId' to set the context
		// We need to inject 'prev' into the pool first so we can review it
		(await sm.getNext())!;
		// Since priorities are equal, it might pick any. Let's force prevId to be high priority first?
		// Actually, let's just use recordReview.
		// SessionManager needs the item to be in the pool to record a review.
		// Let's rely on internal state manipulation or just ensure 'prev' is picked.

		// Better approach:
		// 1. Create prev (high prio)
		// 2. Create other (med prio)
		// 3. Create linked (med prio)
		// 4. Review prev. Next should be linked (boosted) > other.

		// Reset store for cleaner setup
		dataStore = new MemoryDataStore();

		const pId = dataStore.createNote('Previous', { priority: 90 });
		dataStore.createNote('Other', { priority: 50 });
		const lId = dataStore.createNote('Linked', { priority: 50 });

		notePlatform.addLink(pId, lId);

		const sm2 = new SessionManager(dataStore, notePlatform, config);
		await sm2.loadPool();

		// Pick first (Previous)
		const first = await sm2.getNext();
		expect(first?.item.id).toBe(pId);

		// Review it
		await sm2.recordReview(pId, 3);

		// Next should be Linked (50 + boost) > Other (50)
		const second = await sm2.getNext();
		expect(second?.item.id).toBe(lId);
	});

	it('applies exam date adjustment', async () => {
		const now = new Date(2025, 0, 1);
		const examDate = new Date(2025, 0, 10); // 9 days away
		config.examDate = examDate;

		const noteId = dataStore.createNote('Exam Topic', { priority: 50 });

		// Set state: due far in future (2026)
		await dataStore.setState(noteId, {
			status: 'review',
			due: new Date(2026, 0, 1),
			stability: 100,
			difficulty: 5,
			reps: 10,
			lapses: 0,
			lastReview: new Date(2024, 11, 1),
		});

		const sm = new SessionManager(dataStore, notePlatform, config);
		await sm.loadPool(now);

		const next = await sm.getNext();
		// Just verify the state in the pool has been clamped
		// We can't easily access sm.pool private, but we can verify via snapshot or indirectly?
		// SessionManager works on a copy in 'pool'.
		// Let's cheat slightly and check the result of getNext(), specifically its state.

		expect(next?.state.due?.getTime()).toBeLessThan(new Date(2026, 0, 1).getTime());
	});

	it('respects volatile queue and cooldown', async () => {
		// We need enough items to cycle through cooldown
		const id1 = dataStore.createNote('1', { priority: 50 });
		const id2 = dataStore.createNote('2', { priority: 50 });
		dataStore.createNote('3', { priority: 50 });
		dataStore.createNote('4', { priority: 50 });
		dataStore.createNote('5', { priority: 50 });
		dataStore.createNote('6', { priority: 50 });

		const sm = new SessionManager(dataStore, notePlatform, config);
		await sm.loadPool();

		// Review item 1 with Again (rating 1)
		// We need to make sure we pick id1 first. Since all have equal priority, order is ID-based usually.
		// MemoryDataStore IDs are note-1, note-2...
		// note-1 comes first.

		let next = await sm.getNext();
		expect(next?.item.id).toBe(id1);

		await sm.recordReview(id1, 1);

		// Item 1 should now be in volatile queue and NOT returned immediately
		next = await sm.getNext();
		expect(next?.item.id).toBe(id2);

		// Burn through cooldown (5 items)
		await sm.recordReview(next!.item.id, 3); // 2
		await sm.recordReview((await sm.getNext())!.item.id, 3); // 3
		await sm.recordReview((await sm.getNext())!.item.id, 3); // 4
		await sm.recordReview((await sm.getNext())!.item.id, 3); // 5
		await sm.recordReview((await sm.getNext())!.item.id, 3); // 6

		// Now id1 should reappear from volatile queue
		next = await sm.getNext();
		expect(next?.item.id).toBe(id1);
	});

	it('applies clump limit', async () => {
		config.clumpLimit = 3;

		const noteA = dataStore.createNote('Note A');
		// Add 4 clozes to Note A
		dataStore.addCloze(noteA, 0, 1); // c1
		dataStore.addCloze(noteA, 2, 3); // c2
		dataStore.addCloze(noteA, 4, 5); // c3
		dataStore.addCloze(noteA, 6, 7); // c4

		const noteB = dataStore.createNote('Note B', { priority: 10 }); // c5 (topic)

		// Ensure Note A clozes come first (IDs note-1::c1 etc come before note-2)
		// Wait, topic note-2 vs clozes of note-1.
		// note-1 topic comes first.
		// Let's verify priority. All 50.
		// Order: note-1 (topic), note-1::c1, c2, c3, c4, note-2 (topic).

		const sm = new SessionManager(dataStore, notePlatform, config);
		await sm.loadPool();

		// 1. note-1 (topic)
		let next = await sm.getNext();
		await sm.recordReview(next!.item.id, 3);

		// 2. note-1::c1
		next = await sm.getNext();
		await sm.recordReview(next!.item.id, 3);

		// 3. note-1::c2
		next = await sm.getNext();
		await sm.recordReview(next!.item.id, 3);

		// Now we have 3 items from note-1 in history. Limit is 3.
		// Next item should NOT be from note-1 (so skipping c3, c4).
		// Should be note-2.

		next = await sm.getNext();
		expect(next?.item.noteId).toBe(noteB);
	});

	it('applies 80/20 rule in JD1', async () => {
		const lowId = dataStore.createNote('Low', { priority: 10 });
		dataStore.createNote('High', { priority: 90 });

		const sm = new SessionManager(dataStore, notePlatform, config);
		await sm.loadPool();

		// Override global mock to trigger 20% case
		vi.mocked(Math.random).mockReturnValue(0.9);

		// Should pick low priority item (index 1) instead of high (index 0)
		const next = await sm.getNext();
		expect(next?.item.id).toBe(lowId);
	});
});

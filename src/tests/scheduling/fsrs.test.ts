import { describe, expect, it } from 'vitest';
import { cardToState, fsrsToStatus, stateToCard, statusToFsrs } from '../../scheduling/fsrs';

describe('status mapping', () => {
	it('maps new -> 0', () => {
		expect(statusToFsrs('new')).toBe(0);
	});

	it('maps learning -> 1', () => {
		expect(statusToFsrs('learning')).toBe(1);
	});

	it('maps review -> 2', () => {
		expect(statusToFsrs('review')).toBe(2);
	});

	it('maps relearning -> 3', () => {
		expect(statusToFsrs('relearning')).toBe(3);
	});

	it('maps 0 -> new', () => {
		expect(fsrsToStatus(0)).toBe('new');
	});

	it('maps 1 -> learning', () => {
		expect(fsrsToStatus(1)).toBe('learning');
	});

	it('maps 2 -> review', () => {
		expect(fsrsToStatus(2)).toBe('review');
	});

	it('maps 3 -> relearning', () => {
		expect(fsrsToStatus(3)).toBe('relearning');
	});

	it('maps unknown numeric values -> new', () => {
		expect(fsrsToStatus(99)).toBe('new');
	});
});

describe('stateToCard and cardToState roundtrip', () => {
	it('preserves due date through conversion', () => {
		const state = {
			source: '',
			type: 'item',
			created: new Date('2024-01-01T00:00:00'),
			due: new Date('2024-01-10T00:00:00'),
			status: 'review',
			priority: 50,
			last_review: new Date('2024-01-05T00:00:00'),
			stability: 2.5,
			difficulty: 6.3,
			reps: 4,
			lapses: 1,
			scroll_pos: 0,
		} as const;
		const card = stateToCard(state);
		const roundtrip = cardToState(card);
		expect(roundtrip.due.getTime()).toBe(state.due.getTime());
	});

	it('preserves stability through conversion', () => {
		const state = {
			source: '',
			type: 'item',
			created: new Date('2024-01-01T00:00:00'),
			due: new Date('2024-01-10T00:00:00'),
			status: 'review',
			priority: 50,
			last_review: new Date('2024-01-05T00:00:00'),
			stability: 9.1,
			difficulty: 3.2,
			reps: 2,
			lapses: 0,
			scroll_pos: 0,
		} as const;
		const roundtrip = cardToState(stateToCard(state));
		expect(roundtrip.stability).toBe(state.stability);
	});

	it('preserves difficulty through conversion', () => {
		const state = {
			source: '',
			type: 'item',
			created: new Date('2024-01-01T00:00:00'),
			due: new Date('2024-01-10T00:00:00'),
			status: 'review',
			priority: 50,
			last_review: new Date('2024-01-05T00:00:00'),
			stability: 1.1,
			difficulty: 7.4,
			reps: 2,
			lapses: 0,
			scroll_pos: 0,
		} as const;
		const roundtrip = cardToState(stateToCard(state));
		expect(roundtrip.difficulty).toBe(state.difficulty);
	});

	it('preserves reps through conversion', () => {
		const state = {
			source: '',
			type: 'item',
			created: new Date('2024-01-01T00:00:00'),
			due: new Date('2024-01-10T00:00:00'),
			status: 'review',
			priority: 50,
			last_review: new Date('2024-01-05T00:00:00'),
			stability: 1.1,
			difficulty: 7.4,
			reps: 5,
			lapses: 0,
			scroll_pos: 0,
		} as const;
		const roundtrip = cardToState(stateToCard(state));
		expect(roundtrip.reps).toBe(state.reps);
	});

	it('preserves lapses through conversion', () => {
		const state = {
			source: '',
			type: 'item',
			created: new Date('2024-01-01T00:00:00'),
			due: new Date('2024-01-10T00:00:00'),
			status: 'review',
			priority: 50,
			last_review: new Date('2024-01-05T00:00:00'),
			stability: 1.1,
			difficulty: 7.4,
			reps: 5,
			lapses: 2,
			scroll_pos: 0,
		} as const;
		const roundtrip = cardToState(stateToCard(state));
		expect(roundtrip.lapses).toBe(state.lapses);
	});

	it('preserves status through conversion', () => {
		const state = {
			source: '',
			type: 'item',
			created: new Date('2024-01-01T00:00:00'),
			due: new Date('2024-01-10T00:00:00'),
			status: 'learning',
			priority: 50,
			last_review: new Date('2024-01-05T00:00:00'),
			stability: 1.1,
			difficulty: 7.4,
			reps: 5,
			lapses: 2,
			scroll_pos: 0,
		} as const;
		const roundtrip = cardToState(stateToCard(state));
		expect(roundtrip.status).toBe(state.status);
	});

	it('handles null last_review', () => {
		const state = {
			source: '',
			type: 'item',
			created: new Date('2024-01-01T00:00:00'),
			due: new Date('2024-01-10T00:00:00'),
			status: 'review',
			priority: 50,
			last_review: null,
			stability: 1.1,
			difficulty: 7.4,
			reps: 5,
			lapses: 2,
			scroll_pos: 0,
		} as const;
		const roundtrip = cardToState(stateToCard(state));
		expect(roundtrip.last_review).toBeNull();
	});
});

import type { CardState } from '../../scheduling/types';

export const newCard: CardState = {
	source: '',
	type: 'item',
	status: 'new',
	priority: 50,
	created: new Date('2024-01-01T00:00:00'),
	due: new Date('2024-01-01T00:00:00'),
	last_review: null,
	stability: 0,
	difficulty: 0,
	reps: 0,
	lapses: 0,
	scroll_pos: 0,
};

export const learningCard: CardState = {
	source: '',
	type: 'item',
	status: 'learning',
	priority: 30,
	created: new Date('2024-01-01T00:00:00'),
	due: new Date('2024-01-15T10:00:00'),
	last_review: null,
	stability: 0,
	difficulty: 0,
	reps: 0,
	lapses: 0,
	scroll_pos: 0,
};

export const dueCard: CardState = {
	source: '',
	type: 'item',
	status: 'review',
	priority: 20,
	created: new Date('2024-01-01T00:00:00'),
	due: new Date('2024-01-10T00:00:00'),
	last_review: null,
	stability: 0,
	difficulty: 0,
	reps: 0,
	lapses: 0,
	scroll_pos: 0,
};

export const upcomingCard: CardState = {
	source: '',
	type: 'item',
	status: 'review',
	priority: 50,
	created: new Date('2024-01-01T00:00:00'),
	due: new Date('2024-02-01T00:00:00'),
	last_review: null,
	stability: 0,
	difficulty: 0,
	reps: 0,
	lapses: 0,
	scroll_pos: 0,
};

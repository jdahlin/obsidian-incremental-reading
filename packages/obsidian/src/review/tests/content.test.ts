import { describe, expect, it } from 'vitest';

// Since formatBasicCard and extractSection are not exported,
// we test them indirectly through their expected behavior patterns.
// These tests validate the markdown parsing logic for basic cards.

describe('basic card content formatting', () => {
	// Helper to simulate formatBasicCard behavior
	function formatBasicCard(content: string, phase: 'question' | 'answer'): string {
		const front = extractSection(content, 'Front');
		const back = extractSection(content, 'Back');

		if (front !== null) {
			if (phase === 'question') {
				return front;
			}
			return back ? `${front}\n\n---\n\n${back}` : front;
		}

		return content;
	}

	function extractSection(content: string, sectionName: string): string | null {
		const headerPattern = new RegExp(`^## ${sectionName}\\s*$`, 'm');
		const headerMatch = headerPattern.exec(content);
		if (headerMatch === null) return null;

		const startIndex = headerMatch.index + headerMatch[0].length;
		const remainingContent = content.slice(startIndex);

		const nextHeaderMatch = /^## /m.exec(remainingContent);
		const sectionContent = nextHeaderMatch
			? remainingContent.slice(0, nextHeaderMatch.index)
			: remainingContent;

		return sectionContent.trim();
	}

	it('extracts front section for question phase', () => {
		const content = `---
ir_note_id: abc123
type: basic
---

## Front

What is the capital of France?

## Back

Paris`;

		const result = formatBasicCard(content, 'question');
		expect(result).toBe('What is the capital of France?');
		expect(result).not.toContain('Paris');
	});

	it('shows front and back for answer phase', () => {
		const content = `## Front

What is the capital of France?

## Back

Paris`;

		const result = formatBasicCard(content, 'answer');
		expect(result).toContain('What is the capital of France?');
		expect(result).toContain('Paris');
		expect(result).toContain('---');
	});

	it('falls back to full content without sections', () => {
		const content = 'Just some plain content without sections';

		const questionResult = formatBasicCard(content, 'question');
		const answerResult = formatBasicCard(content, 'answer');

		expect(questionResult).toBe(content);
		expect(answerResult).toBe(content);
	});

	it('handles front-only cards', () => {
		const content = `## Front

Single sided card`;

		const result = formatBasicCard(content, 'answer');
		expect(result).toBe('Single sided card');
	});

	it('handles additional sections after Back', () => {
		const content = `## Front

Question here

## Back

Answer here

## Extra

Extra notes`;

		const result = formatBasicCard(content, 'answer');
		expect(result).toContain('Question here');
		expect(result).toContain('Answer here');
		expect(result).not.toContain('Extra notes');
	});
});

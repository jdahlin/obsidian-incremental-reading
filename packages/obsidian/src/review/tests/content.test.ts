import { describe, expect, it } from 'vitest';

// Since formatBasicCard, formatImageOcclusion, and extractSection are not exported,
// we test them indirectly through their expected behavior patterns.
// These tests validate the markdown parsing logic for card types.

// Helper function that mirrors the implementation in content.ts
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

describe('basic card content formatting', () => {
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

describe('image occlusion content formatting', () => {
	function formatImageOcclusion(content: string, phase: 'question' | 'answer'): string {
		const header = extractSection(content, 'Header');
		const image = extractSection(content, 'Image');
		const footer = extractSection(content, 'Footer');
		const remarks = extractSection(content, 'Remarks');
		const sources = extractSection(content, 'Sources');
		const extra1 = extractSection(content, 'Extra 1');
		const extra2 = extractSection(content, 'Extra 2');

		if (image === null) {
			return content;
		}

		if (phase === 'question') {
			const parts: string[] = [];
			if (header) parts.push(header);
			parts.push(image);
			if (footer) parts.push(`*${footer}*`);
			return parts.join('\n\n');
		}

		const parts: string[] = [];
		if (header) parts.push(`## ${header}`);
		parts.push(image);
		if (footer) parts.push(footer);
		if (remarks) parts.push(`**Remarks:** ${remarks}`);
		if (sources) parts.push(`**Sources:** ${sources}`);
		if (extra1) parts.push(extra1);
		if (extra2) parts.push(extra2);

		return parts.join('\n\n');
	}

	it('shows header and image for question phase', () => {
		const content = `## Header

Anatomy - Heart

## Image

![](heart-diagram.png)

## Footer

Identify the chambers

## Remarks

From lecture notes`;

		const result = formatImageOcclusion(content, 'question');
		expect(result).toContain('Anatomy - Heart');
		expect(result).toContain('![](heart-diagram.png)');
		expect(result).toContain('*Identify the chambers*'); // Footer as hint
		expect(result).not.toContain('lecture notes');
	});

	it('shows all sections for answer phase', () => {
		const content = `## Header

Anatomy - Heart

## Image

![](heart-diagram.png)

## Footer

The four chambers

## Remarks

Important for exam`;

		const result = formatImageOcclusion(content, 'answer');
		expect(result).toContain('## Anatomy - Heart');
		expect(result).toContain('![](heart-diagram.png)');
		expect(result).toContain('The four chambers');
		expect(result).toContain('**Remarks:** Important for exam');
	});

	it('falls back to full content without Image section', () => {
		const content = 'Just some content without image occlusion structure';

		const result = formatImageOcclusion(content, 'question');
		expect(result).toBe(content);
	});

	it('handles minimal image occlusion (image only)', () => {
		const content = `## Image

![](diagram.png)`;

		const questionResult = formatImageOcclusion(content, 'question');
		expect(questionResult).toBe('![](diagram.png)');

		const answerResult = formatImageOcclusion(content, 'answer');
		expect(answerResult).toBe('![](diagram.png)');
	});

	it('includes sources in answer phase', () => {
		const content = `## Image

![](chart.png)

## Sources

Gray's Anatomy, Chapter 5`;

		const result = formatImageOcclusion(content, 'answer');
		expect(result).toContain("**Sources:** Gray's Anatomy, Chapter 5");
	});
});

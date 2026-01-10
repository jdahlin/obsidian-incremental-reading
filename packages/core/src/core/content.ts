/**
 * Shared content formatting for reviews.
 * Pure functions for formatting markdown content based on card type and phase.
 */

import type { ItemType } from '../types.js';
import type { CardType } from './types.js';
import { formatClozeAnswer, formatClozeQuestion } from './cloze.js';

export type ReviewPhase = 'question' | 'answer';

/** Type that accepts both CardType ('item') and ItemType ('cloze') */
export type ContentItemType = CardType | ItemType;

/**
 * Strip YAML frontmatter from markdown content.
 */
export function stripFrontmatter(content: string): string {
	const lines = content.split('\n');
	if (lines[0]?.trim() !== '---') return content;

	let endIndex = -1;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i]?.trim() === '---') {
			endIndex = i;
			break;
		}
	}

	if (endIndex === -1) return content;
	return lines
		.slice(endIndex + 1)
		.join('\n')
		.trim();
}

/**
 * Extract content from a markdown section (## SectionName).
 * Returns null if section not found.
 */
export function extractSection(content: string, sectionName: string): string | null {
	const headerPattern = new RegExp(`^## ${sectionName}\\s*$`, 'm');
	const headerMatch = headerPattern.exec(content);
	if (headerMatch === null) return null;

	const startIndex = headerMatch.index + headerMatch[0].length;
	const remainingContent = content.slice(startIndex);

	// Find the next ## header or end of content
	const nextHeaderMatch = /^## /m.exec(remainingContent);
	const sectionContent = nextHeaderMatch
		? remainingContent.slice(0, nextHeaderMatch.index)
		: remainingContent;

	return sectionContent.trim();
}

/**
 * Format cloze card content for question/answer phase.
 * Question: Show Text section with cloze hidden
 * Answer: Show Text section with cloze revealed + Back Extra
 */
export function formatClozeCard(content: string, phase: ReviewPhase, clozeIndex: number): string {
	const text = extractSection(content, 'Text');
	const backExtra = extractSection(content, 'Back Extra');

	// If no Text section, fall back to full content
	const mainContent = text ?? content;

	if (phase === 'question') {
		return formatClozeQuestion(mainContent, clozeIndex);
	}

	// Answer phase: show revealed cloze + back extra
	const revealed = formatClozeAnswer(mainContent, clozeIndex);
	if (backExtra !== null) {
		return `${revealed}\n\n---\n\n${backExtra}`;
	}
	return revealed;
}

/**
 * Format basic card content for question/answer phase.
 * Looks for ## Front and ## Back sections, or falls back to showing all content.
 */
export function formatBasicCard(content: string, phase: ReviewPhase): string {
	const front = extractSection(content, 'Front');
	const back = extractSection(content, 'Back');

	if (front !== null) {
		if (phase === 'question') {
			return front;
		}
		// Answer phase: show both front and back
		return back !== null ? `${front}\n\n---\n\n${back}` : front;
	}

	// Fallback: no Front/Back sections found, show full content
	return content;
}

/**
 * Format review content based on item type and phase.
 * Main orchestrator that delegates to type-specific formatters.
 * Accepts both CardType ('item') and ItemType ('cloze') for compatibility.
 */
export function formatReviewContent(
	content: string,
	itemType: ContentItemType,
	phase: ReviewPhase,
	clozeIndex?: number | null,
): string {
	// Strip frontmatter first
	const cleanContent = stripFrontmatter(content);

	// Cloze card rendering - handle both 'item' (CardType) and 'cloze' (ItemType)
	const isCloze = itemType === 'item' || itemType === 'cloze';
	if (isCloze && typeof clozeIndex === 'number' && clozeIndex !== 0) {
		return formatClozeCard(cleanContent, phase, clozeIndex);
	}

	// Basic card rendering
	if (itemType === 'basic') {
		return formatBasicCard(cleanContent, phase);
	}

	// Topic and image_occlusion - show full content
	// (image_occlusion needs platform-specific HTML overlays, handled separately)
	return cleanContent;
}

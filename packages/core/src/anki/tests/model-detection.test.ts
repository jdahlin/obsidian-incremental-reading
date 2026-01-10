import { describe, expect, it } from 'vitest';
import { ANKI_MODEL_TYPE } from '../schema.js';

/**
 * Test model type detection logic.
 * This mirrors the detection logic in reader.ts to test it in isolation
 * without requiring an actual Anki database.
 */
function detectModelType(modelName: string): number {
	const nameLower = modelName.toLowerCase();
	let modelType: number;

	if (nameLower.includes('image occlusion') || nameLower.includes('imageocclusion')) {
		modelType = ANKI_MODEL_TYPE.IMAGE_OCCLUSION;
	} else if (nameLower.includes('cloze')) {
		modelType = ANKI_MODEL_TYPE.CLOZE;
	} else if (
		nameLower.includes('basic') ||
		nameLower === 'default' ||
		nameLower.startsWith('basic ')
	) {
		modelType = ANKI_MODEL_TYPE.BASIC;
	} else {
		modelType = ANKI_MODEL_TYPE.STANDARD;
	}

	return modelType;
}

describe('anki model type detection', () => {
	describe('cloze detection', () => {
		it('detects standard cloze model', () => {
			expect(detectModelType('Cloze')).toBe(ANKI_MODEL_TYPE.CLOZE);
		});

		it('detects case-insensitive cloze', () => {
			expect(detectModelType('CLOZE')).toBe(ANKI_MODEL_TYPE.CLOZE);
			expect(detectModelType('cLoZe')).toBe(ANKI_MODEL_TYPE.CLOZE);
		});

		it('detects cloze variants', () => {
			expect(detectModelType('Cloze (with extra)')).toBe(ANKI_MODEL_TYPE.CLOZE);
			expect(detectModelType('My Custom Cloze')).toBe(ANKI_MODEL_TYPE.CLOZE);
		});
	});

	describe('basic detection', () => {
		it('detects standard basic model', () => {
			expect(detectModelType('Basic')).toBe(ANKI_MODEL_TYPE.BASIC);
		});

		it('detects basic variants', () => {
			expect(detectModelType('Basic (and reversed card)')).toBe(ANKI_MODEL_TYPE.BASIC);
			expect(detectModelType('Basic (optional reversed card)')).toBe(ANKI_MODEL_TYPE.BASIC);
			expect(detectModelType('Basic (type in the answer)')).toBe(ANKI_MODEL_TYPE.BASIC);
		});

		it('detects default model as basic', () => {
			expect(detectModelType('Default')).toBe(ANKI_MODEL_TYPE.BASIC);
			expect(detectModelType('default')).toBe(ANKI_MODEL_TYPE.BASIC);
		});
	});

	describe('image occlusion detection', () => {
		it('detects image occlusion enhanced', () => {
			expect(detectModelType('Image Occlusion Enhanced')).toBe(
				ANKI_MODEL_TYPE.IMAGE_OCCLUSION,
			);
		});

		it('detects image occlusion variants', () => {
			expect(detectModelType('Image Occlusion')).toBe(ANKI_MODEL_TYPE.IMAGE_OCCLUSION);
			expect(detectModelType('ImageOcclusion')).toBe(ANKI_MODEL_TYPE.IMAGE_OCCLUSION);
		});

		it('is case insensitive', () => {
			expect(detectModelType('IMAGE OCCLUSION ENHANCED')).toBe(
				ANKI_MODEL_TYPE.IMAGE_OCCLUSION,
			);
			expect(detectModelType('image occlusion enhanced')).toBe(
				ANKI_MODEL_TYPE.IMAGE_OCCLUSION,
			);
		});
	});

	describe('topic/standard detection', () => {
		it('falls back to standard for unknown models', () => {
			expect(detectModelType('Custom Model')).toBe(ANKI_MODEL_TYPE.STANDARD);
			expect(detectModelType('My Notes')).toBe(ANKI_MODEL_TYPE.STANDARD);
			expect(detectModelType('Reading Material')).toBe(ANKI_MODEL_TYPE.STANDARD);
		});
	});

	describe('priority ordering', () => {
		it('image occlusion takes precedence over cloze', () => {
			// If someone named a model "Image Occlusion Cloze", image occlusion should win
			expect(detectModelType('Image Occlusion Cloze')).toBe(ANKI_MODEL_TYPE.IMAGE_OCCLUSION);
		});

		it('cloze takes precedence over basic', () => {
			// If someone named a model "Basic Cloze", cloze should win
			expect(detectModelType('Basic Cloze')).toBe(ANKI_MODEL_TYPE.CLOZE);
		});
	});
});

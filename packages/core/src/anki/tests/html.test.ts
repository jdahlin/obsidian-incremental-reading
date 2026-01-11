import { describe, expect, it } from 'vitest';
import {
	hasImageOcclusionSyntax,
	isSvgContent,
	parseImageOcclusionRects,
	preserveSvg,
} from '../html.js';

describe('sVG content detection', () => {
	it('detects SVG content', () => {
		expect(isSvgContent('<svg></svg>')).toBe(true);
		expect(isSvgContent('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe(true);
		expect(isSvgContent('  <svg></svg>  ')).toBe(true);
	});

	it('rejects non-SVG content', () => {
		expect(isSvgContent('<div></div>')).toBe(false);
		expect(isSvgContent('plain text')).toBe(false);
		expect(isSvgContent('<svg>incomplete')).toBe(false);
		expect(isSvgContent('not <svg></svg>')).toBe(false);
	});
});

describe('sVG preservation', () => {
	it('wraps SVG in code block', () => {
		const svg = '<svg><rect/></svg>';
		expect(preserveSvg(svg)).toBe('```svg\n<svg><rect/></svg>\n```');
	});

	it('returns non-SVG content unchanged', () => {
		const html = '<div>content</div>';
		expect(preserveSvg(html)).toBe('<div>content</div>');
	});
});

describe('native image occlusion syntax detection', () => {
	it('detects native IO syntax', () => {
		const content = '{{c1::image-occlusion:rect:left=.5:top=.5:width=.1:height=.1}}';
		expect(hasImageOcclusionSyntax(content)).toBe(true);
	});

	it('detects IO syntax within larger content', () => {
		const content = `## Image
![](image.png)
{{c1::image-occlusion:rect:left=.5:top=.5:width=.1:height=.1}}`;
		expect(hasImageOcclusionSyntax(content)).toBe(true);
	});

	it('rejects regular cloze syntax', () => {
		expect(hasImageOcclusionSyntax('{{c1::answer}}')).toBe(false);
	});

	it('rejects plain text', () => {
		expect(hasImageOcclusionSyntax('just some text')).toBe(false);
	});
});

describe('parseImageOcclusionRects', () => {
	it('parses single rectangle', () => {
		const content = '{{c1::image-occlusion:rect:left=.5:top=.25:width=.1:height=.15}}';
		const rects = parseImageOcclusionRects(content);

		expect(rects).toHaveLength(1);
		expect(rects[0]).toEqual({
			clozeIndex: 1,
			left: 0.5,
			top: 0.25,
			width: 0.1,
			height: 0.15,
		});
	});

	it('parses multiple rectangles', () => {
		const content = `{{c1::image-occlusion:rect:left=.1:top=.1:width=.2:height=.2}}
{{c2::image-occlusion:rect:left=.5:top=.5:width=.3:height=.3}}
{{c3::image-occlusion:rect:left=.8:top=.2:width=.15:height=.15}}`;

		const rects = parseImageOcclusionRects(content);

		expect(rects).toHaveLength(3);
		expect(rects[0]?.clozeIndex).toBe(1);
		expect(rects[1]?.clozeIndex).toBe(2);
		expect(rects[2]?.clozeIndex).toBe(3);
	});

	it('handles oi parameter', () => {
		const content =
			'{{c1::image-occlusion:rect:left=.6784:top=.0961:width=.1107:height=.0858:oi=1}}';
		const rects = parseImageOcclusionRects(content);

		expect(rects).toHaveLength(1);
		expect(rects[0]).toEqual({
			clozeIndex: 1,
			left: 0.6784,
			top: 0.0961,
			width: 0.1107,
			height: 0.0858,
		});
	});

	it('parses coordinates embedded in markdown', () => {
		const content = `## Image

![](anatomy.png)

## Occlusion

{{c1::image-occlusion:rect:left=.1:top=.2:width=.3:height=.4}}
{{c2::image-occlusion:rect:left=.5:top=.6:width=.2:height=.1}}

## Header

Identify the parts`;

		const rects = parseImageOcclusionRects(content);

		expect(rects).toHaveLength(2);
		expect(rects[0]?.left).toBe(0.1);
		expect(rects[1]?.left).toBe(0.5);
	});

	it('returns empty array for content without IO syntax', () => {
		expect(parseImageOcclusionRects('plain text')).toEqual([]);
		expect(parseImageOcclusionRects('{{c1::regular cloze}}')).toEqual([]);
	});
});

import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { renderMarkdownToEl } from '../../markdown';
import { ReviewItemView } from './ReviewItemView';

export function MarkdownBlock(props: {
	component: ReviewItemView;
	emptyText: string;
}): JSX.Element {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const card = props.component.getCurrentCard();
	const path = card?.path;
	const app = props.component.getApp();

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		if (!card) {
			host.textContent = props.emptyText;
			return;
		}

		let cancelled = false;
		const run = async () => {
			const markdown = await app.vault.cachedRead(card);
			if (cancelled) return;
			await renderMarkdownToEl(app, markdown, host, card.path, props.component);
			if (cancelled) return;

			const scrollEl = host.closest<HTMLElement>('.ir-review-scroll');
			const fm = app.metadataCache.getFileCache(card)?.frontmatter;
			const type = fm?.type;
			const scrollPos = typeof fm?.scroll_pos === 'number' ? fm.scroll_pos : Number(fm?.scroll_pos ?? 0);
			if (type === 'topic' && scrollEl && Number.isFinite(scrollPos) && scrollPos > 0) {
				scrollEl.scrollTop = scrollPos;
			}
		};
		void run().catch(() => {
			// ignore (view might be closing / card might change)
		});

		return () => {
			cancelled = true;
		};
	}, [app, props.component, card, props.emptyText, path]);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		const onClick = (evt: MouseEvent) => {
			const target = evt.target as HTMLElement | null;
			const cloze = target?.closest('.ir-cloze') as HTMLElement | null;
			if (!cloze) return;
			if (cloze.classList.contains('is-revealed')) return;

			const raw = cloze.textContent ?? '';
			const answer = extractClozeText(raw);
			cloze.textContent = answer;
			cloze.classList.add('is-revealed');
		};

		host.addEventListener('click', onClick);
		return () => {
			host.removeEventListener('click', onClick);
		};
	}, [card]);

	return <div className="ir-review-card" ref={hostRef} />;
}

function extractClozeText(value: string): string {
	const match = value.match(/\{\{c\d+::([^}]+)\}\}/);
	return match?.[1] ?? value;
}

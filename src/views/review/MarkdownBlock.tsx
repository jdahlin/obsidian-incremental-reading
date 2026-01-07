import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { renderMarkdownToEl } from '../../markdown';
import { ReviewItemView } from './ReviewItemView';
import { EditorState } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, WidgetType, type ViewUpdate } from '@codemirror/view';

export function MarkdownBlock(props: {
	component: ReviewItemView;
	phase: 'question' | 'answer';
	emptyText: string;
}): JSX.Element {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const editorRef = useRef<EditorView | null>(null);
	const card = props.component.getCurrentCard();
	const path = card?.path;
	const app = props.component.getApp();

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		if (editorRef.current) {
			editorRef.current.destroy();
			editorRef.current = null;
		}

		if (!card) {
			host.textContent = props.emptyText;
			return;
		}

		let cancelled = false;
		const run = async () => {
			const markdown = await app.vault.cachedRead(card);
			const cleaned = stripFrontmatter(markdown);
			if (cancelled) return;
			const fm = app.metadataCache.getFileCache(card)?.frontmatter;
			const type = fm?.type;
			if (type === 'item' && props.phase === 'question') {
				editorRef.current = createClozeEditor(host, cleaned);
				return;
			}

			// For answer phase, replace cloze syntax with revealed answers
			let contentToRender = cleaned;
			if (type === 'item' && props.phase === 'answer') {
				contentToRender = revealClozes(cleaned);
			}

			await renderMarkdownToEl(app, contentToRender, host, card.path, props.component);
			if (cancelled) return;

			const scrollEl = host.closest<HTMLElement>('.ir-review-content');
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
			if (editorRef.current) {
				editorRef.current.destroy();
				editorRef.current = null;
			}
		};
	}, [app, props.component, card, props.emptyText, path, props.phase]);


	return <div className="ir-review-card" ref={hostRef} />;
}

/**
 * Replace all cloze patterns with revealed answers for display.
 * {{c1::answer}} → **[answer]**
 * {{c1::answer::hint}} → **[answer]**
 */
function revealClozes(content: string): string {
	return content.replace(
		/\{\{c\d+::([^:}]+)(?:::[^}]*)?\}\}/g,
		(_match, answer) => `**[${answer}]**`
	);
}

function stripFrontmatter(content: string): string {
	if (!content.startsWith('---')) return content;
	const end = content.indexOf('\n---', 3);
	if (end === -1) return content;
	const after = content.slice(end + 4);
	return after.replace(/^\s+/, '');
}

function createClozeEditor(container: HTMLElement, text: string): EditorView {
	container.empty();
	const clozePlugin = ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = buildClozeDecorations(view.state.doc.toString());
			}
			update(update: ViewUpdate) {
				if (update.docChanged) {
					this.decorations = buildClozeDecorations(update.state.doc.toString());
				}
			}
		},
		{
			decorations: (plugin) => plugin.decorations,
		},
	);

	const state = EditorState.create({
		doc: text,
		extensions: [
			EditorState.readOnly.of(true),
			EditorView.editable.of(false),
			EditorView.lineWrapping,
			clozePlugin,
		],
	});

	const view = new EditorView({
		state,
		parent: container,
	});
	view.dom.classList.add('ir-review-codemirror');
	return view;
}

function buildClozeDecorations(doc: string): DecorationSet {
	const ranges: any[] = [];
	// Match plain Anki-style clozes: {{cN::answer}} or {{cN::answer::hint}}
	const regex = /\{\{c\d+::[^}]+\}\}/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(doc)) !== null) {
		const from = match.index;
		const to = match.index + match[0].length;
		ranges.push(
			Decoration.replace({
				widget: new ClozeWidget(),
				inclusive: false,
			}).range(from, to)
		);
	}
	return Decoration.set(ranges, true);
}

class ClozeWidget extends WidgetType {
	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'ir-cloze-placeholder';
		span.textContent = '[...]';
		return span;
	}
}

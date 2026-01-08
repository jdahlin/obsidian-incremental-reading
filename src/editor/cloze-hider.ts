import { StateEffect, StateField, type Extension } from '@codemirror/state';
import {
	Decoration,
	EditorView,
	ViewPlugin,
	type DecorationSet,
	type ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import { MarkdownView, type App } from 'obsidian';
import './cloze-hider.css';

export type ClozePhase = 'question' | 'answer';

interface ClozeState {
	index: number | null;
	phase: ClozePhase;
}

const setClozeState = StateEffect.define<ClozeState>();

const clozeStateField = StateField.define<ClozeState>({
	create: () => ({ index: null, phase: 'answer' }),
	update(value, transaction) {
		for (const effect of transaction.effects) {
			if (effect.is(setClozeState)) {
				return effect.value;
			}
		}
		return value;
	},
});

class ClozeWidget extends WidgetType {
	constructor(private text: string) {
		super();
	}

	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'ir-cloze-hidden';
		span.textContent = this.text;
		return span;
	}
}

const clozeHiderPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view, view.state.field(clozeStateField));
		}

		update(update: ViewUpdate): void {
			const prev = update.startState.field(clozeStateField);
			const next = update.state.field(clozeStateField);
			if (update.docChanged || prev !== next) {
				this.decorations = buildDecorations(update.view, next);
			}
		}
	},
	{
		decorations: (value) => value.decorations,
	},
);

export const clozeHiderExtension: Extension = [clozeStateField, clozeHiderPlugin];

export function setActiveCloze(app: App, index: number | null, phase: ClozePhase): void {
	const markdownView = app.workspace.getActiveViewOfType(MarkdownView);
	if (!markdownView) return;
	const editorView = getEditorView(markdownView);
	if (!editorView) return;
	editorView.dispatch({
		effects: setClozeState.of({ index, phase }),
	});
}

function buildDecorations(view: EditorView, state: ClozeState): DecorationSet {
	if (!state.index || state.phase !== 'question') {
		return Decoration.none;
	}
	const doc = view.state.doc.toString();
	const decorations: { from: number; to: number; deco: Decoration }[] = [];
	const regex = /\{\{c(\d+)::([\s\S]*?)(?:::(.*?))?\}\}/g;
	for (const match of doc.matchAll(regex)) {
		const index = Number(match[1]);
		if (index !== state.index) continue;
		const hint = match[3];
		const placeholder = hint ? `[...] (${hint})` : '[...]';
		const from = match.index ?? 0;
		const to = from + match[0].length;
		const deco = Decoration.replace({ widget: new ClozeWidget(placeholder) });
		decorations.push({ from, to, deco });
	}

	return Decoration.set(decorations.map((d) => d.deco.range(d.from, d.to)));
}

function getEditorView(view: MarkdownView): EditorView | null {
	const editor = view.editor as { cm?: EditorView };
	return editor.cm ?? null;
}

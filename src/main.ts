import { Editor, MarkdownView, Plugin, WorkspaceLeaf } from 'obsidian';
import { clozeSelection } from './cloze';
import { extractToIncrementalNote } from './extract';
import { ReviewView, VIEW_TYPE_REVIEW } from './reviewView';

export default class IncrementalReadingPlugin extends Plugin {
	async onload() {
		this.registerView(VIEW_TYPE_REVIEW, (leaf: WorkspaceLeaf) => new ReviewView(leaf, this.app));

		this.addRibbonIcon('dice', 'Review', async () => {
			await this.activateReviewView();
		});

		this.addCommand({
			id: 'open-review-view',
			name: 'Open review',
			callback: async () => {
				await this.activateReviewView();
			}
		});

		this.addCommand({
			id: 'extract-to-incremental-note',
			name: 'Extract to incremental note',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await extractToIncrementalNote(this, editor, view, { titleWords: 5 });
			}
		});

		this.addCommand({
			id: 'cloze-selection',
			name: 'Cloze selection',
			editorCallback: (editor: Editor) => {
				// Default title is "..." for now.
				clozeSelection(editor, { index: 1, title: '...' });
			}
		});
	}

	onunload() {
		// Don't detach leaves here; users may have moved the view.
		// Obsidian will unload the view type when the plugin is disabled.
	}

	private async activateReviewView(): Promise<void> {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_REVIEW)[0];
		if (!leaf) {
			const mostRecent = workspace.getMostRecentLeaf();
			if (!mostRecent) return;
			leaf = mostRecent;
			await leaf.setViewState({ type: VIEW_TYPE_REVIEW, active: true });
		}

		// revealLeaf may return a Promise depending on Obsidian version; don't leave it floating.
		void workspace.revealLeaf(leaf);

		const view = leaf.view;
		if (view instanceof ReviewView) {
			view.contentEl.focus();
		}
	}
}

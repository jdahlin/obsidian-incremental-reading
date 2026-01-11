import type { App as IApp } from 'obsidian'
import { describe, expect, it } from 'vitest'
import { App, MarkdownView } from '../../tests/obsidian-stub'
import { setActiveCloze } from '../cloze-hider'

describe('cloze hider', () => {
	it('does nothing without an active markdown view', () => {
		const app = new App()
		setActiveCloze(app as unknown as IApp, 1, 'question')
		setActiveCloze(app as unknown as IApp, null, 'answer')
		expect(true).toBe(true)
	})

	it('dispatches cloze state to the editor when available', () => {
		const app = new App()
		const markdownView = new MarkdownView(null)
		let dispatched = false
		markdownView.editor = {
			cm: {
				dispatch: (_payload: unknown) => {
					dispatched = true
				},
			},
		}
		app.workspace.setActiveView(markdownView)

		setActiveCloze(app as unknown as IApp, 2, 'question')
		expect(dispatched).toBe(true)
	})
})

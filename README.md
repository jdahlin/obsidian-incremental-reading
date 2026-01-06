# Obsidian Incremental Reading

This plugin adds commands for an incremental reading workflow.

## Commands

- **Extract to incremental note**: creates a new note next to the current note using the first 5 words of the selection as the filename, and replaces the selection with a Markdown link to the new note.
- **Cloze selection**: wraps the selection in an Anki-style cloze (`{{c1::...::...}}`) inside an inline HTML wrapper so you can style/hide it via CSS.

## Cloze styling

Cloze is inserted as:

`<span class="ir-cloze" data-cloze="c1" data-title="...">{{c1::selected::...}}</span>`

Customize `styles.css` to hide/reveal clozes in reading view.

## Development

- Install deps: `npm i`
- Dev build (watch): `npm run dev`
- Lint: `npm run lint`
- Production build: `npm run build`

## Manual install

Copy `main.js`, `manifest.json`, and `styles.css` into:

`<your-vault>/.obsidian/plugins/<your-plugin-id>/`

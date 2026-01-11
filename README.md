# Obsidian Incremental Reading

A plugin for [Obsidian](https://obsidian.md) that brings SuperMemo-inspired incremental reading to your vault.

## What is Incremental Reading?

Incremental reading is a learning technique where you:

1. **Extract** important passages from articles into separate notes
2. **Create cloze deletions** to turn passive highlights into active recall questions
3. **Review** extracts and clozes on a spaced repetition schedule

This plugin implements the core incremental reading workflow, allowing you to build a knowledge base that grows with your reading.

## Features

### Current Features

- **Extract to topic note** - Select text and extract it to a new note, linked from the source
- **Cloze deletion** - Wrap selections in Anki-style cloze syntax (`{{c1::text}}`)
- **Review interface** - Built-in review panel with deck summary and spaced repetition
- **FSRS scheduling** - Uses the Free Spaced Repetition Scheduler algorithm for optimal review intervals
- **Per-cloze scheduling** - Each cloze deletion is scheduled independently
- **Priority queue** - Items are reviewed based on priority and due date
- **Review statistics** - Track your daily reviews and streaks

### Commands

| Command               | Description                                           |
| --------------------- | ----------------------------------------------------- |
| Extract to topic note | Creates a new note from selection, replaces with link |
| Cloze selection       | Wraps selection in `{{c1::...}}` cloze syntax         |
| Open review           | Opens the review panel                                |
| Sync all notes        | Re-syncs all tagged notes to sidecar files            |

## How It Works

### Workflow

1. **Import** - Add articles or content to your vault
2. **Tag** - Add the extract tag (default: `#extract`) to notes you want to process
3. **Extract** - Select important passages and use "Extract to topic note"
4. **Cloze** - Create cloze deletions from key facts: `{{c1::answer}}`
5. **Review** - Open the review panel to study due items

### Data Storage

The plugin stores scheduling data in sidecar files:

- `IR/Review Items/<note-id>.md` - Per-note scheduling state
- `IR/Revlog/YYYY-MM.md` - Review history (JSONL format)

Your notes remain clean - all scheduling metadata is kept separate.

## Status

**Alpha** - Core functionality works but expect rough edges.

### What Works

- Extract and cloze commands
- Basic review loop with FSRS scheduling
- Deck-based organization (folder hierarchy)
- Topic and cloze item review

### Known Limitations

- No priority editing UI yet
- No manual interval adjustments
- Limited statistics display

## Roadmap

- [ ] Keyboard shortcuts in review
- [ ] Reading progress tracking
- [ ] Advanced statistics and charts
- [ ] Export/import review data
- [ ] Image occlusion

## Installation

### From Obsidian Community Plugins

_Coming soon_

### Using BRAT (Recommended for Beta Testing)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. Open BRAT settings
3. Click **Add Beta Plugin**
4. Enter: `https://github.com/jdahlin/obsidian-incremental-reading`
5. Click **Add Plugin**
6. Enable the plugin in **Settings → Community plugins**

BRAT will automatically keep the plugin updated when new releases are published.

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create folder: `<your-vault>/.obsidian/plugins/obsidian-incremental-reading/`
3. Copy the files into that folder
4. Enable the plugin in Obsidian settings

### Development

```bash
# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Configuration

Settings available in the plugin options:

| Setting           | Default   | Description                                    |
| ----------------- | --------- | ---------------------------------------------- |
| Extract tag       | `extract` | Tag that marks notes for incremental reading   |
| Title words       | 5         | Words from selection used for extract filename |
| New cards per day | 20        | Maximum new items introduced daily             |
| Maximum interval  | 365       | Maximum days between reviews                   |
| Request retention | 0.9       | Target retention rate (0.0-1.0)                |
| Show streak       | true      | Display streak in review summary               |

## Credits

- Inspired by [SuperMemo](https://supermemo.guru/wiki/Incremental_reading)
- Scheduling algorithm is [FSRS](https://github.com/open-spaced-repetition/fsrs4anki)
- Built on the [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)

## License

MIT

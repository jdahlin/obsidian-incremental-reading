# Roadmap: Validated Obsidian Incremental Learning Workflow

This roadmap focuses on delivering a working, tested incremental reading workflow in Obsidian.

## Current State Assessment

### What's Working Well

| Component      | Status           | Coverage | Notes                                  |
| -------------- | ---------------- | -------- | -------------------------------------- |
| Engine Core    | ✅ Solid         | 95%      | SessionManager, strategies, scheduling |
| Data Stores    | ✅ Good          | 90%      | MemoryDataStore, MarkdownDataStore     |
| RV Test DSL    | ✅ Comprehensive | -        | 31 integration test scenarios          |
| Core Utilities | ✅ Complete      | 95%      | Cloze, dates, frontmatter, decks       |
| UI Components  | ⚠️ Partial       | 68%      | DeckSummary, ReviewCard working        |

### What Needs Work

| Component         | Status        | Coverage | Gap                                              |
| ----------------- | ------------- | -------- | ------------------------------------------------ |
| Obsidian Adapters | ❌ Low        | 23%      | Not tested in real Obsidian context              |
| Review Flow UI    | ⚠️ Partial    | 40%      | Router, state hooks need testing                 |
| Commands          | ⚠️ Good logic | 84%      | Extract/cloze work, but manual validation needed |
| Editor Hider      | ⚠️ Partial    | 60%      | Live editor extension untested                   |

## Phase 1: Validate Core Workflow (Priority: NOW)

**Goal**: A user can import content, make extracts, create clozes, and review with spaced repetition.

### 1.1 Manual Testing Checklist

Before more code, validate what exists works in Obsidian:

- [ ] **Install plugin in test vault**
    - Build with `npm run build`
    - Copy to `.obsidian/plugins/incremental-reading/`
    - Enable plugin

- [ ] **Test topic creation**
    - Create note with `#topic` tag
    - Verify sidecar created in `IR/Review Items/`
    - Check frontmatter has `ir_note_id`

- [ ] **Test extract command** (Alt+X)
    - Select text in topic note
    - Run extract command
    - Verify new note created with `source` link
    - Verify new sidecar for extract

- [ ] **Test cloze creation** (Alt+Z)
    - Select text in note
    - Run cloze command
    - Verify `{{c1::text}}` syntax inserted
    - Verify sidecar updated with cloze entry

- [ ] **Test review flow**
    - Open review view (Cmd+Shift+R or ribbon)
    - Deck summary shows counts
    - Start review → items appear
    - Grade item → state updates
    - Next item loads
    - Session completes

- [ ] **Test persistence**
    - Close Obsidian
    - Reopen
    - Review state preserved
    - Due items still due

### 1.2 Fix Blocking Issues

Based on manual testing, fix issues in priority order:

1. **File sync on startup** - Ensure sidecars sync when plugin loads
2. **Review view initialization** - Deck list loads correctly
3. **Grading persistence** - State changes save immediately
4. **Queue building** - Due items appear in queue

### 1.3 Integration Test with Real Files

Create test fixtures that exercise the full flow:

```typescript
// tests/integration/obsidian-workflow.test.ts
describe('Obsidian Workflow', () => {
	it('creates topic from tagged note', async () => {
		// Create .md file with #topic tag
		// Verify sidecar created
		// Verify sync picks it up
	});

	it('extract creates linked note', async () => {
		// Source note exists
		// Run extract command
		// Verify child note with source link
	});

	it('review cycle persists state', async () => {
		// Item due
		// Grade it
		// Verify sidecar updated
		// Verify revlog entry
	});
});
```

## Phase 2: Essential Workflow Polish

**Goal**: Workflow is reliable and pleasant to use.

### 2.1 Review UI Refinements

- **Keyboard navigation**: 1-4 for grades, Space/Enter for reveal, Esc for back
- **Progress indicator**: Show "3 of 12" or progress bar
- **Session stats**: Reviewed/Again/Good counts visible
- **Completion screen**: Summary when queue empty

### 2.2 Editor Integration

- **Cloze hiding in edit mode**: Active cloze hidden during review question phase
- **Syntax highlighting**: Visual distinction for cloze syntax
- **Inline grading**: Grade without leaving editor context

### 2.3 Error Handling

- **Missing sidecar**: Recreate from note content
- **Orphaned sidecar**: Cleanup on startup
- **Sync conflicts**: Handle graceful merge

## Phase 3: Overload Management

**Goal**: System remains usable when life gets busy.

### 3.1 Manual Postpone

```
Command: "Postpone item" (Cmd+P)
- Prompt for days
- Update due date in sidecar
- Log postpone in revlog
```

### 3.2 Auto-Postpone

```
Settings:
- maxDailyReviews: 100 (default)
- autoPostpone: true

Behavior:
- On queue build, if count > max
- Postpone lowest priority items
- Spread across next N days
- Notify user: "Postponed 23 items"
```

### 3.3 Workload Visibility

- Show daily forecast in deck summary
- Calendar view of upcoming reviews
- "Mercy" button for bulk postpone

## Phase 4: Knowledge Organization

**Goal**: Content naturally organizes into a knowledge tree.

### 4.1 Folder-as-Deck

Already working:

- Folder selection in deck summary
- Filter reviews by folder
- Counts per folder

Needed:

- Nested folder support
- "Study folder" command from file explorer

### 4.2 Source Chain

Track extraction provenance:

```yaml
# In extract's frontmatter
source: '[[Parent Note]]'
original_source: '[[Root Article]]' # Inherited from parent
```

### 4.3 Branch Review

- Right-click folder → "Review this branch"
- Include all descendants
- Track branch-level progress

## Phase 5: Advanced Features (Future)

### 5.1 Search & Review

- Search notes → build queue from results
- Tag-based review subsets

### 5.2 Statistics Dashboard

- Retention over time
- Heatmap of activity
- Review forecast

### 5.3 Import/Export

- Anki deck import
- CSV export for analysis
- Backup/restore

---

## Immediate Next Steps

1. **Build and install** the plugin in a test vault
2. **Manual testing** through the checklist above
3. **Document issues** found during testing
4. **Fix blockers** preventing basic workflow
5. **Add integration tests** for the fixed paths

## Success Criteria for MVP

- [ ] User can tag a note as `#topic` and it becomes reviewable
- [ ] User can select text and extract to new note
- [ ] User can create cloze deletions from selected text
- [ ] Review view shows due items correctly
- [ ] Grading updates scheduling state
- [ ] State persists across Obsidian restarts
- [ ] 10+ items can be reviewed in a session without errors
- [ ] Review queue respects priority ordering

## Non-Goals for MVP

- AI integration (question generation, Socratic mode)
- Video/audio timestamps
- Image occlusion
- Neural review (semantic similarity)
- Mobile optimization
- Cross-device sync

---

_Last updated: 2025-01-10_

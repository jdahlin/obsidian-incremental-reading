# Anki Desktop Database Schema Reference (v18)

**Schema Version:** 18
**Database:** SQLite
**File:** `collection.anki2`

---

## Table of Contents

- [col — Collection Metadata](#table-col--collection-metadata)
- [notes — Note Data](#table-notes--note-data)
- [cards — Card Data](#table-cards--card-data)
- [revlog — Review History](#table-revlog--review-history)
- [decks — Deck Definitions](#table-decks--deck-definitions)
- [deck_config — Deck Options Presets](#table-deck_config--deck-options-presets)
- [notetypes — Note Type Definitions](#table-notetypes--note-type-definitions)
- [fields — Field Definitions](#table-fields--field-definitions)
- [templates — Card Templates](#table-templates--card-templates)
- [tags — Tag Registry](#table-tags--tag-registry)
- [config — Key-Value Configuration](#table-config--key-value-configuration)
- [graves — Sync Tombstones](#table-graves--sync-tombstones)
- [Index Summary](#index-summary)
- [Entity Relationships](#entity-relationships)
- [Source References](#source-references)

---

## Table: `col` — Collection Metadata

```sql
CREATE TABLE col (
  id integer PRIMARY KEY,
  crt integer NOT NULL,
  mod integer NOT NULL,
  scm integer NOT NULL,
  ver integer NOT NULL,
  dty integer NOT NULL,
  usn integer NOT NULL,
  ls integer NOT NULL,
  conf text NOT NULL,
  models text NOT NULL,
  decks text NOT NULL,
  dconf text NOT NULL,
  tags text NOT NULL
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Always 1 |
| `crt` | integer | Collection creation time (Unix timestamp, seconds) |
| `mod` | integer | Last modification time (Unix timestamp, seconds) |
| `scm` | integer | Schema modification time (forces full sync when changed) |
| `ver` | integer | Schema version (18) |
| `dty` | integer | No longer used (legacy dirty flag) |
| `usn` | integer | Update sequence number for sync (-1 = needs sync) |
| `ls` | integer | Last sync time (Unix timestamp, seconds) |
| `conf` | text | Legacy JSON config (migrated to `config` table) |
| `models` | text | Legacy JSON notetypes (migrated to `notetypes` table) |
| `decks` | text | Legacy JSON decks (migrated to `decks` table) |
| `dconf` | text | Legacy JSON deck configs (migrated to `deck_config` table) |
| `tags` | text | Legacy JSON tags (migrated to `tags` table) |

> **Note:** In schema 14+, the JSON columns contain `'{}'` and data lives in dedicated tables.

---

## Table: `notes` — Note Data

```sql
CREATE TABLE notes (
  id integer PRIMARY KEY,
  guid text NOT NULL,
  mid integer NOT NULL,
  mod integer NOT NULL,
  usn integer NOT NULL,
  tags text NOT NULL,
  flds text NOT NULL,
  -- The use of type integer for sfld is deliberate, because it means that integer values in this
  -- field will sort numerically.
  sfld integer NOT NULL,
  csum integer NOT NULL,
  flags integer NOT NULL,
  data text NOT NULL
);

CREATE INDEX ix_notes_usn ON notes (usn);
CREATE INDEX ix_notes_csum ON notes (csum);
CREATE INDEX idx_notes_mid ON notes (mid);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Note ID (millisecond timestamp when created) |
| `guid` | text | Globally unique ID (base91-encoded random, ~10 chars) |
| `mid` | integer | Model (notetype) ID → `notetypes.id` |
| `mod` | integer | Modification time (Unix timestamp, seconds) |
| `usn` | integer | Update sequence number (-1 = needs sync) |
| `tags` | text | Space-separated list of tags |
| `flds` | text | Field contents joined by `\x1f` (U+001F unit separator) |
| `sfld` | integer | Sort field (first field stripped of HTML; integer type enables numeric sort) |
| `csum` | integer | Checksum for duplicate detection (first 4 bytes of SHA1 of first field) |
| `flags` | integer | Unused, always 0 |
| `data` | text | Unused, always empty string |

---

## Table: `cards` — Card Data

```sql
CREATE TABLE cards (
  id integer PRIMARY KEY,
  nid integer NOT NULL,
  did integer NOT NULL,
  ord integer NOT NULL,
  mod integer NOT NULL,
  usn integer NOT NULL,
  type integer NOT NULL,
  queue integer NOT NULL,
  due integer NOT NULL,
  ivl integer NOT NULL,
  factor integer NOT NULL,
  reps integer NOT NULL,
  lapses integer NOT NULL,
  left integer NOT NULL,
  odue integer NOT NULL,
  odid integer NOT NULL,
  flags integer NOT NULL,
  data text NOT NULL
);

CREATE INDEX ix_cards_usn ON cards (usn);
CREATE INDEX ix_cards_nid ON cards (nid);
CREATE INDEX ix_cards_sched ON cards (did, queue, due);
CREATE INDEX idx_cards_odid ON cards (odid) WHERE odid != 0;
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Card ID (millisecond timestamp when created) |
| `nid` | integer | Note ID → `notes.id` |
| `did` | integer | Deck ID → `decks.id` (current deck, or filtered deck if in one) |
| `ord` | integer | Template index (0 = first template) |
| `mod` | integer | Modification time (Unix timestamp, seconds) |
| `usn` | integer | Update sequence number (-1 = needs sync) |
| `type` | integer | Card type: 0=new, 1=learning, 2=review, 3=relearning |
| `queue` | integer | Queue: -3=user buried, -2=sched buried, -1=suspended, 0=new, 1=learning, 2=review, 3=day learn, 4=preview |
| `due` | integer | Due date/position (see below) |
| `ivl` | integer | Interval in days (0 for new/learning cards) |
| `factor` | integer | Ease factor (permille, e.g., 2500 = 250% = 2.5x) |
| `reps` | integer | Number of reviews |
| `lapses` | integer | Number of times card went to relearning |
| `left` | integer | Remaining steps (see encoding below) |
| `odue` | integer | Original due when in filtered deck |
| `odid` | integer | Original deck ID when in filtered deck (0 if not filtered) |
| `flags` | integer | Card flags (bits 0-2 = flag 1-7 color, upper bits reserved) |
| `data` | text | JSON object (FSRS data, custom data) |

### `type` values (CardType)

| Value | Name | Description |
|-------|------|-------------|
| 0 | New | Never reviewed |
| 1 | Learn | In initial learning phase |
| 2 | Review | Graduated to review queue |
| 3 | Relearn | Lapsed, in relearning phase |

### `queue` values (CardQueue)

| Value | Name | Description |
|-------|------|-------------|
| -3 | UserBuried | Manually buried by user |
| -2 | SchedBuried | Automatically buried sibling |
| -1 | Suspended | Suspended |
| 0 | New | New card queue |
| 1 | Learn | Intraday learning (due = Unix timestamp seconds) |
| 2 | Review | Review queue (due = days since collection creation) |
| 3 | DayLearn | Interday learning (due = days since collection creation) |
| 4 | Preview | Preview in filtered deck (due = Unix timestamp seconds) |

### `due` interpretation by queue

| Queue | `due` meaning |
|-------|---------------|
| 0 (new) | Position in new card queue |
| 1 (learning) | Unix timestamp (seconds) for next review |
| 2 (review) | Days since collection creation (`col.crt / 86400`) |
| 3 (day learn) | Days since collection creation |
| 4 (preview) | Unix timestamp (seconds) |
| -1, -2, -3 | Original due preserved |

### `left` encoding

```
left = remaining_steps + (remaining_today * 1000)
```

- `left % 1000` = total remaining learning steps
- `left / 1000` = steps remaining for today (scheduler optimization)

### `data` JSON structure

```json
{
  "pos": 123,         // original new queue position (before graduating)
  "s": 45.67,         // FSRS stability (days)
  "d": 5.43,          // FSRS difficulty (1.0-10.0)
  "dr": 0.90,         // FSRS desired retention
  "decay": 0.12,      // FSRS decay parameter
  "lrt": 1704067200,  // last review time (Unix timestamp, seconds)
  "cd": "{\"key\":1}" // custom data (max 100 bytes, keys max 8 bytes)
}
```

---

## Table: `revlog` — Review History

```sql
CREATE TABLE revlog (
  id integer PRIMARY KEY,
  cid integer NOT NULL,
  usn integer NOT NULL,
  ease integer NOT NULL,
  ivl integer NOT NULL,
  lastIvl integer NOT NULL,
  factor integer NOT NULL,
  time integer NOT NULL,
  type integer NOT NULL
);

CREATE INDEX ix_revlog_usn ON revlog (usn);
CREATE INDEX ix_revlog_cid ON revlog (cid);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Review ID (millisecond timestamp when review occurred) |
| `cid` | integer | Card ID → `cards.id` |
| `usn` | integer | Update sequence number (-1 = needs sync) |
| `ease` | integer | Button pressed: 1=Again, 2=Hard, 3=Good, 4=Easy; 0=manual reschedule |
| `ivl` | integer | New interval: positive=days, negative=seconds |
| `lastIvl` | integer | Previous interval: positive=days, negative=seconds |
| `factor` | integer | Ease factor after review (permille); FSRS: difficulty shifted to 100-1100 |
| `time` | integer | Time spent reviewing (milliseconds) |
| `type` | integer | Review kind (see below) |

### `type` values (RevlogReviewKind)

| Value | Name | Description |
|-------|------|-------------|
| 0 | Learning | Initial learning |
| 1 | Review | Normal review |
| 2 | Relearning | Lapsed card relearning |
| 3 | Filtered | Filtered deck or early review (factor=0 means cramming) |
| 4 | Manual | Set due date (factor>0) or reset (factor=0) |
| 5 | Rescheduled | Bulk reschedule operation |

---

## Table: `decks` — Deck Definitions

```sql
CREATE TABLE decks (
  id integer PRIMARY KEY NOT NULL,
  name text NOT NULL COLLATE unicase,
  mtime_secs integer NOT NULL,
  usn integer NOT NULL,
  common blob NOT NULL,
  kind blob NOT NULL
);

CREATE UNIQUE INDEX idx_decks_name ON decks (name);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Deck ID (millisecond timestamp; 1 = default deck) |
| `name` | text | Deck name; `::` separates hierarchy (e.g., `Parent::Child`) |
| `mtime_secs` | integer | Modification time (Unix timestamp, seconds) |
| `usn` | integer | Update sequence number |
| `common` | blob | Protobuf `DeckCommon` (collapsed states, review/new counts today, etc.) |
| `kind` | blob | Protobuf `NormalDeck` or `FilteredDeck` |

### Normal deck `kind` fields

| Field | Description |
|-------|-------------|
| `config_id` | Deck config ID → `deck_config.id` |
| `extend_new` | Borrowed new card limit from parent |
| `extend_review` | Borrowed review limit from parent |
| `description` | Deck description (supports markdown) |

### Filtered deck `kind` fields

| Field | Description |
|-------|-------------|
| `reschedule` | Whether to reschedule based on answers |
| `search_terms` | Array of search queries with limits and order |
| `preview_delay` | Minutes before showing again after preview |

---

## Table: `deck_config` — Deck Options Presets

```sql
CREATE TABLE deck_config (
  id integer PRIMARY KEY NOT NULL,
  name text NOT NULL COLLATE unicase,
  mtime_secs integer NOT NULL,
  usn integer NOT NULL,
  config blob NOT NULL
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Config ID (millisecond timestamp; 1 = default config) |
| `name` | text | Configuration preset name |
| `mtime_secs` | integer | Modification time (Unix timestamp, seconds) |
| `usn` | integer | Update sequence number |
| `config` | blob | Protobuf `DeckConfigInner` |

### `config` protobuf fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `learn_steps` | float[] | [1, 10] | Learning steps in minutes |
| `relearn_steps` | float[] | [10] | Relearning steps in minutes |
| `new_per_day` | u32 | 20 | New cards per day |
| `reviews_per_day` | u32 | 200 | Reviews per day |
| `new_per_day_minimum` | u32 | 0 | Minimum new cards (overrides parent limit) |
| `initial_ease` | f32 | 2.5 | Starting ease (250%) |
| `easy_multiplier` | f32 | 1.3 | Easy button multiplier |
| `hard_multiplier` | f32 | 1.2 | Hard button multiplier |
| `lapse_multiplier` | f32 | 0.0 | New interval after lapse (0 = use minimum) |
| `interval_multiplier` | f32 | 1.0 | Global interval modifier |
| `maximum_review_interval` | u32 | 36500 | Max interval (days, ~100 years) |
| `minimum_lapse_interval` | u32 | 1 | Min interval after lapse (days) |
| `graduating_interval_good` | u32 | 1 | Interval after graduating (Good button) |
| `graduating_interval_easy` | u32 | 4 | Interval after graduating (Easy button) |
| `leech_threshold` | u32 | 8 | Lapses before leech action |
| `leech_action` | enum | TagOnly | TagOnly or Suspend |
| `new_card_insert_order` | enum | Due | Due or Random |
| `new_card_gather_priority` | enum | Deck | Deck, LowestPosition, HighestPosition |
| `new_card_sort_order` | enum | Template | Template, TemplateThenRandom, etc. |
| `review_order` | enum | Day | Day, DayThenDeck, DeckThenDay, etc. |
| `new_mix` | enum | MixWithReviews | MixWithReviews, ShowAfterReviews, ShowBeforeReviews |
| `bury_new` | bool | false | Bury new siblings |
| `bury_reviews` | bool | false | Bury review siblings |
| `bury_interday_learning` | bool | false | Bury interday learning siblings |
| `fsrs_params_4` | f32[] | [] | FSRS 4.x model parameters |
| `fsrs_params_5` | f32[] | [] | FSRS 5.x model parameters |
| `fsrs_params_6` | f32[] | [] | FSRS 6.x model parameters |
| `desired_retention` | f32 | 0.9 | Target retention for FSRS |
| `historical_retention` | f32 | 0.9 | Historical retention for optimization |
| `cap_answer_time_to_secs` | u32 | 60 | Max answer time recorded |
| `show_timer` | bool | false | Show answer timer |
| `disable_autoplay` | bool | false | Disable audio autoplay |

---

## Table: `notetypes` — Note Type Definitions

```sql
CREATE TABLE notetypes (
  id integer NOT NULL PRIMARY KEY,
  name text NOT NULL COLLATE unicase,
  mtime_secs integer NOT NULL,
  usn integer NOT NULL,
  config blob NOT NULL
);

CREATE UNIQUE INDEX idx_notetypes_name ON notetypes (name);
CREATE INDEX idx_notetypes_usn ON notetypes (usn);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Notetype ID (millisecond timestamp) |
| `name` | text | Notetype name (e.g., "Basic", "Cloze") |
| `mtime_secs` | integer | Modification time |
| `usn` | integer | Update sequence number |
| `config` | blob | Protobuf `NotetypeConfig` |

### `config` protobuf fields

| Field | Type | Description |
|-------|------|-------------|
| `kind` | enum | Normal (0) or Cloze (1) |
| `sort_field_idx` | u32 | Which field to sort by (default 0) |
| `css` | string | Card styling CSS |
| `latex_pre` | string | LaTeX preamble |
| `latex_post` | string | LaTeX postamble |
| `latex_svg` | bool | Use SVG for LaTeX |
| `target_deck_id` | i64 | Default deck for new cards (0 = none) |
| `original_stock_kind` | enum | Original stock notetype if cloned |

---

## Table: `fields` — Field Definitions

```sql
CREATE TABLE fields (
  ntid integer NOT NULL,
  ord integer NOT NULL,
  name text NOT NULL COLLATE unicase,
  config blob NOT NULL,
  PRIMARY KEY (ntid, ord)
) without rowid;

CREATE UNIQUE INDEX idx_fields_name_ntid ON fields (name, ntid);
```

| Column | Type | Description |
|--------|------|-------------|
| `ntid` | integer | Notetype ID → `notetypes.id` |
| `ord` | integer | Field ordinal (0-indexed) |
| `name` | text | Field name (unique within notetype) |
| `config` | blob | Protobuf `NoteFieldConfig` |

### `config` protobuf fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sticky` | bool | false | Preserve field content when adding notes |
| `rtl` | bool | false | Right-to-left text direction |
| `font_name` | string | "" | Editor font family |
| `font_size` | u32 | 0 | Editor font size |
| `description` | string | "" | Placeholder/description text |
| `plain_text` | bool | false | Plain text mode (no HTML formatting) |
| `collapsed` | bool | false | Collapsed in editor by default |
| `exclude_from_search` | bool | false | Exclude from unqualified searches |
| `id` | i64 | 0 | Field ID (for internal tracking) |
| `tag` | u32 | 0 | Reserved |

---

## Table: `templates` — Card Templates

```sql
CREATE TABLE templates (
  ntid integer NOT NULL,
  ord integer NOT NULL,
  name text NOT NULL COLLATE unicase,
  mtime_secs integer NOT NULL,
  usn integer NOT NULL,
  config blob NOT NULL,
  PRIMARY KEY (ntid, ord)
) without rowid;

CREATE UNIQUE INDEX idx_templates_name_ntid ON templates (name, ntid);
CREATE INDEX idx_templates_usn ON templates (usn);
```

| Column | Type | Description |
|--------|------|-------------|
| `ntid` | integer | Notetype ID → `notetypes.id` |
| `ord` | integer | Template ordinal (0-indexed) |
| `name` | text | Template name (e.g., "Card 1") |
| `mtime_secs` | integer | Modification time |
| `usn` | integer | Update sequence number |
| `config` | blob | Protobuf `CardTemplateConfig` |

### `config` protobuf fields

| Field | Type | Description |
|-------|------|-------------|
| `q_format` | string | Question template (front side HTML) |
| `a_format` | string | Answer template (back side HTML) |
| `q_format_browser` | string | Browser-specific question template |
| `a_format_browser` | string | Browser-specific answer template |
| `target_deck_id` | i64 | Deck override for this template (0 = use notetype default) |
| `browser_font_name` | string | Browser display font |
| `browser_font_size` | u32 | Browser display font size |
| `id` | i64 | Template ID (for internal tracking) |

---

## Table: `tags` — Tag Registry

```sql
CREATE TABLE tags (
  tag text NOT NULL PRIMARY KEY COLLATE unicase,
  usn integer NOT NULL,
  collapsed boolean NOT NULL,
  config blob NULL
) without rowid;
```

| Column | Type | Description |
|--------|------|-------------|
| `tag` | text | Tag name; `::` separates hierarchy (e.g., `language::french`) |
| `usn` | integer | Update sequence number |
| `collapsed` | boolean | UI collapsed state in sidebar |
| `config` | blob | Reserved for future use (NULL) |

---

## Table: `config` — Key-Value Configuration

```sql
CREATE TABLE config (
  KEY text NOT NULL PRIMARY KEY,
  usn integer NOT NULL,
  mtime_secs integer NOT NULL,
  val blob NOT NULL
) without rowid;
```

| Column | Type | Description |
|--------|------|-------------|
| `KEY` | text | Configuration key name |
| `usn` | integer | Update sequence number |
| `mtime_secs` | integer | Modification time |
| `val` | blob | Protobuf-encoded value |

### Common configuration keys

| Key | Description |
|-----|-------------|
| `_currentDeckId` | Active deck ID |
| `_newSpread` | New card distribution mode |
| `_schedVer` | Scheduler version (2) |
| `_localOffset` | Local timezone offset (minutes) |
| `_creationOffset` | Creation timezone offset (minutes) |
| `_rollover` | Day rollover hour (default 4) |
| `_nextNewCardPosition` | Next new card position |
| `_normalize_note_text` | Normalize Unicode in note text |
| `lastDeckForNotetype_<id>` | Last deck used for notetype |
| `lastNotetypeForDeck_<id>` | Last notetype used for deck |
| `_currentNotetypeId` | Current notetype for adding |

---

## Table: `graves` — Sync Tombstones

```sql
CREATE TABLE graves (
  oid integer NOT NULL,
  type integer NOT NULL,
  usn integer NOT NULL,
  PRIMARY KEY (oid, type)
) WITHOUT ROWID;

CREATE INDEX idx_graves_pending ON graves (usn);
```

| Column | Type | Description |
|--------|------|-------------|
| `oid` | integer | Object ID that was deleted |
| `type` | integer | Object type: 0=card, 1=note, 2=deck |
| `usn` | integer | Update sequence number |

---

## Index Summary

| Table | Index | Columns | Type | Purpose |
|-------|-------|---------|------|---------|
| notes | `ix_notes_usn` | (usn) | | Sync |
| notes | `ix_notes_csum` | (csum) | | Duplicate detection |
| notes | `idx_notes_mid` | (mid) | | Notetype queries |
| cards | `ix_cards_usn` | (usn) | | Sync |
| cards | `ix_cards_nid` | (nid) | | Note → cards lookup |
| cards | `ix_cards_sched` | (did, queue, due) | | Scheduling queries |
| cards | `idx_cards_odid` | (odid) | Partial: `WHERE odid != 0` | Filtered deck queries |
| revlog | `ix_revlog_usn` | (usn) | | Sync |
| revlog | `ix_revlog_cid` | (cid) | | Card history |
| fields | `idx_fields_name_ntid` | (name, ntid) | UNIQUE | Field name lookup |
| templates | `idx_templates_name_ntid` | (name, ntid) | UNIQUE | Template name lookup |
| templates | `idx_templates_usn` | (usn) | | Sync |
| notetypes | `idx_notetypes_name` | (name) | UNIQUE | Notetype name lookup |
| notetypes | `idx_notetypes_usn` | (usn) | | Sync |
| decks | `idx_decks_name` | (name) | UNIQUE | Deck name lookup |
| graves | `idx_graves_pending` | (usn) | | Sync pending deletes |

---

## Entity Relationships

```
notetypes (1) ─┬─< fields      (1:N by ntid)
               ├─< templates   (1:N by ntid)
               └─< notes       (1:N by mid)
                      └─< cards      (1:N by nid)
                             └─< revlog    (1:N by cid)

deck_config (1) ─< decks       (1:N via kind.config_id for normal decks)
                      └─< cards      (1:N by did)
```

### Key relationships

- A **notetype** has many **fields** and **templates**
- A **note** belongs to one notetype and has many **cards** (one per template)
- A **card** belongs to one note and one deck, and has many **revlog** entries
- A **deck** (if normal) references one **deck_config**
- **Filtered decks** temporarily hold cards; `odid` stores the original deck

---

## Schema Version History

| Version | Changes |
|---------|---------|
| 11 | Base schema (all config in `col` table as JSON) |
| 14 | Added `deck_config`, `config`, `tags` tables |
| 15 | Added `notetypes`, `fields`, `templates`, `decks` tables; added `idx_notes_mid`, `idx_cards_odid` |
| 16 | Deck config internal changes |
| 17 | Tags table: added `collapsed`, `config` columns |
| 18 | Graves table: added primary key `(oid, type)`, reordered columns |

---

## Source References

| Component | File |
|-----------|------|
| Base schema | `rslib/src/storage/schema11.sql` |
| Schema upgrades | `rslib/src/storage/upgrades/*.sql` |
| Card struct | `rslib/src/card/mod.rs` |
| CardData JSON | `rslib/src/storage/card/data.rs` |
| Note struct | `rslib/src/notes/mod.rs` |
| Revlog struct | `rslib/src/revlog/mod.rs` |
| Deck struct | `rslib/src/decks/mod.rs` |
| DeckConfig struct | `rslib/src/deckconfig/mod.rs` |
| Notetype struct | `rslib/src/notetype/mod.rs` |
| Sync entries | `rslib/src/sync/collection/chunks.rs` |
| Schema version | `rslib/src/storage/upgrades/mod.rs` |

# Stats View Specification

This document specifies a comprehensive statistics view for the Obsidian Incremental Reading plugin, drawing from proven metrics in SuperMemo and Anki.

## Research Summary

### Sources

- [Anki Statistics Manual](https://docs.ankiweb.net/stats.html)
- [SuperMemo Forgetting Index](https://supermemo.guru/wiki/Forgetting_index)
- [FSRS Algorithm Wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki/abc-of-fsrs)
- [FSRS Technical Explanation](https://expertium.github.io/Algorithm.html)

### Key Insights

1. **FSRS metrics** (Stability, Difficulty, Retrievability) are first-class citizens since our plugin uses FSRS
2. **Retention tracking** is the primary measure of learning effectiveness
3. **Workload forecasting** helps users plan their study sessions
4. **Historical trends** reveal learning patterns and motivate consistency

---

## Statistics Tiers

### Tier 1: Essential (MVP)

These are the most important metrics that provide immediate value.

#### 1.1 Today's Summary

**What:** Quick glance at current day's progress
**Metrics:**

- Reviews completed today
- New items introduced today
- Answer distribution (Again/Hard/Good/Easy) with percentages
- Time spent reviewing (if we track elapsed_ms)
- Average time per review

**Visualization:** Card/tile layout with large numbers

#### 1.2 Retention Rate

**What:** The percentage of successful recalls
**Metrics:**

- Overall retention (all time)
- Recent retention (selected time period)
- True retention by maturity:
    - Young cards (interval < 21 days)
    - Mature cards (interval >= 21 days)
- **Comparison to target:** Show actual vs `requestRetention` from settings (default 0.9)

**Visualization:** Large percentage display with:

- Trend indicator (↑↓) vs previous period
- Visual gauge showing actual vs target retention
- Color coding: green if meeting target, yellow/red if below

**Why important:** This is THE metric that tells you if spaced repetition is working. SuperMemo's "measured forgetting index" is essentially `1 - retention`. Comparing to the user's configured `requestRetention` setting provides actionable feedback.

#### 1.3 Review Heatmap

**What:** Calendar showing review activity over time
**Metrics:**

- Daily review counts
- Color intensity based on volume
- Current streak and longest streak
- Period comparison: reviews this period vs previous period

**Visualization:** GitHub-style contribution graph

- 1 month view: ~30 days
- 3 month view: ~90 days
- 1 year view: full year calendar

**Why important:** Visual motivation and habit tracking. One of Anki's most beloved add-ons.

#### 1.4 Forecast

**What:** Upcoming review workload
**Metrics:**

- Reviews due each day for next 30 days
- Cumulative backlog if reviews are skipped
- Average daily load prediction

**Visualization:** Bar chart with date axis

**Why important:** Helps users plan study sessions and avoid review pile-ups.

---

### Tier 2: Important

Deeper insights for users who want to optimize their learning.

#### 2.1 FSRS Memory States

**What:** Distribution of card memory parameters
**Metrics:**

- **Stability distribution:** How long until cards decay to 90% retrievability
- **Difficulty distribution:** How hard cards are to learn (1-10 scale)
- **Retrievability distribution:** Current recall probability across all cards

**Visualization:** Histograms with averages marked

**Why important:** FSRS-native metrics. Shows memory health of your collection.

#### 2.2 Interval Distribution

**What:** How spread out your review intervals are
**Metrics:**

- Count of cards at each interval bucket (1d, 2-3d, 4-7d, 1-2w, 2-4w, 1-3m, 3-6m, 6m-1y, >1y)
- Average interval
- Percentage of cards that are "mature" (>21 days)

**Visualization:** Histogram with cumulative percentage line

**Why important:** Shows progression toward long-term memory.

#### 2.3 Review History

**What:** Historical review counts over time
**Metrics:**

- Daily/weekly/monthly review counts
- Breakdown by card state (new, learning, review, relearning)

**Visualization:** Stacked bar chart or area chart

**Why important:** Tracks study consistency and volume trends.

#### 2.4 Answer Button Distribution

**What:** How you respond to cards over time
**Metrics:**

- Percentage of Again/Hard/Good/Easy responses
- Breakdown by card maturity (young vs mature)
- Trend over time

**Visualization:** Stacked bar chart or pie chart

**Why important:** High "Again" rates indicate difficult material or suboptimal scheduling.

---

### Tier 3: Advanced

For power users who want deep analysis.

#### 3.1 Hourly Performance

**What:** Review success rate by time of day
**Metrics:**

- Reviews count per hour
- Retention rate per hour

**Visualization:** Dual-axis chart (bars for count, line for retention)

**Why important:** Identifies optimal study times.

#### 3.2 Review Time Analysis

**What:** Time spent on reviews
**Metrics:**

- Total time by day/week/month
- Average time per card by difficulty
- Time distribution histogram

**Visualization:** Bar chart, histogram

**Why important:** Helps optimize review efficiency.

#### 3.3 Item-Level Statistics

**What:** Detailed stats for individual items
**Metrics:**

- Review history for a specific item
- Stability/difficulty progression over time
- Predicted next review date

**Visualization:** Timeline or table

**Why important:** Debugging problematic cards (leeches).

#### 3.4 Leech Detection

**What:** Items that consistently fail
**Metrics:**

- Cards with >N lapses
- Cards with low stability despite many reviews

**Visualization:** Table sorted by lapse count

**Why important:** Identify and fix or delete problematic material.

---

## Data Requirements

### Currently Available

From `ReviewRecord` in revlog:

- `ts` - timestamp
- `item_id` - which item
- `rating` - 1/2/3/4 (Again/Hard/Good/Easy)
- `elapsed_ms` - time spent (optional)
- `state_before` - card state before review
- `stability_before` - FSRS stability
- `difficulty_before` - FSRS difficulty

From sidecar files (review items):

- Current stability, difficulty, due date
- State (new, learning, review, relearning)
- Interval

### Needs to be Added

- `retrievability_at_review` - R value when reviewed (can be calculated from stability + elapsed time)
- Possibly: card creation date for tracking card age

---

## UI Design

### Layout Options

**Option A: Single Scrollable View**
One long page with all stats panels stacked vertically, organized by tier.

**Option B: Tabbed Interface**

- Tab 1: Overview (Today + Retention + Streak)
- Tab 2: Activity (Heatmap + History + Forecast)
- Tab 3: Memory (FSRS metrics + Intervals)
- Tab 4: Analysis (Hourly + Leeches + Item details)

**Option C: Dashboard Grid**
Configurable grid of stat panels that users can rearrange.

**Recommendation:** Start with **Option B (Tabbed Interface)** for clear organization without overwhelming users.

### Time Range Selector

Global control to filter all stats by:

- Last 30 days (1 month)
- Last 90 days (3 months)
- Last 365 days (1 year)
- All time

### Period Comparison

Allow users to compare stats between time periods:

- Current month vs previous month
- Current 3 months vs previous 3 months
- Current year vs previous year

Display delta indicators (↑↓) showing improvement or decline.

### Refresh Behavior

- Stats should update when the view is opened
- Optional: real-time updates during review sessions

---

## Implementation Phases

### Phase 1: Core Infrastructure

1. Create new `StatsView` as an Obsidian ItemView
2. Set up Preact component hierarchy
3. Implement time range filtering in core stats functions
4. Add basic CSS framework for stats panels

### Phase 2: Tier 1 Stats

1. Today's Summary panel
2. Retention Rate panel with trend
3. Review Heatmap (extended to 90 days)
4. Forecast chart (extended to 30 days)

### Phase 3: Tier 2 Stats

1. FSRS Memory States histograms
2. Interval Distribution histogram
3. Review History chart
4. Answer Button Distribution

### Phase 4: Tier 3 Stats

1. Hourly Performance analysis
2. Review Time analysis
3. Item-level statistics
4. Leech detection

---

## Technical Notes

### Database: sql.js (WebAssembly SQLite)

Use sql.js for all stats queries. This provides:

- Pure JS/WASM - works in Obsidian without native module issues
- Real SQL queries - portable, reusable when migrating away from Obsidian
- Fast enough for 100k+ reviews in-memory

**Data flow:**

```
JSONL revlog files → parse → INSERT into in-memory sql.js → SQL queries → UI
```

**Rebuild strategy:**

- Rebuild in-memory DB each time stats view opens
- No persistence yet (add later if rebuilds become slow)
- Estimated rebuild time: <2s for 100k reviews

**Schema:**

```sql
CREATE TABLE reviews (
  ts TEXT NOT NULL,
  item_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  elapsed_ms INTEGER,
  state_before TEXT,
  stability_before REAL,
  difficulty_before REAL
);

CREATE INDEX idx_ts ON reviews(ts);
CREATE INDEX idx_item_id ON reviews(item_id);
CREATE INDEX idx_date ON reviews(date(ts));
```

**Example queries:**

```sql
-- Retention for time period
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN rating > 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as retention
FROM reviews
WHERE ts >= date('now', '-30 days');

-- Heatmap data
SELECT date(ts) as day, COUNT(*) as count
FROM reviews
WHERE ts >= date('now', '-365 days')
GROUP BY date(ts);

-- Period comparison (current vs previous)
SELECT
  SUM(CASE WHEN ts >= date('now', '-30 days') THEN 1 ELSE 0 END) as current_period,
  SUM(CASE WHEN ts >= date('now', '-60 days') AND ts < date('now', '-30 days') THEN 1 ELSE 0 END) as previous_period
FROM reviews;

-- Answer distribution
SELECT rating, COUNT(*) as count
FROM reviews
WHERE ts >= date('now', '-30 days')
GROUP BY rating;

-- Hourly breakdown
SELECT
  strftime('%H', ts) as hour,
  COUNT(*) as total,
  SUM(CASE WHEN rating > 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as retention
FROM reviews
GROUP BY strftime('%H', ts);
```

### Charting: D3 + Preact

Use D3 for scales/math, Preact for SVG rendering:

```tsx
// D3 for calculations
const xScale = d3.scaleTime().domain([start, end]).range([0, width])
const yScale = d3.scaleLinear().domain([0, max]).range([height, 0])

// Preact for rendering
return (
  <svg>
    {data.map(d => <rect x={xScale(d.date)} y={yScale(d.count)} ... />)}
  </svg>
)
```

**D3 modules needed (~40kb total):**

- `d3-scale` - scales for axes
- `d3-array` - data utilities (max, extent, bin)
- `d3-time` - date handling
- `d3-shape` - lines/areas if needed

**Why D3:**

- Proven scale/axis calculations
- Modular (import only what's needed)
- Framework-agnostic
- Well-documented

### Performance Considerations

- All stats queries run against in-memory sql.js database
- Rebuild DB on stats view open (acceptable latency for now)
- Future optimization: persist DB to `IR/stats.db`, rebuild only on changes

### Obsidian Integration

- Register as `VIEW_TYPE_STATS` ItemView
- Add ribbon icon for quick access
- Add command: "Open Stats View"
- Consider: Stats sidebar panel for quick glance

---

## Design Decisions

1. **Scope:** Show complete collection stats only (no folder/deck filtering)
2. **Export:** Not included in initial implementation
3. **Time periods:** 1 month, 3 months, 1 year, all time
4. **Comparison:** Yes - compare current period vs previous period (e.g., this month vs last month)
5. **Retention goal:** Use existing `requestRetention` setting from plugin settings (default 0.9)

---

## References

- Anki Stats: https://docs.ankiweb.net/stats.html
- Anki Review Heatmap: https://ankiweb.net/shared/info/1771074083
- SuperMemo Statistics: https://help.supermemo.org/wiki/Statistics
- FSRS Wiki: https://github.com/open-spaced-repetition/fsrs4anki/wiki

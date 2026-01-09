# Session Ordering & IR Logic

This document defines the architecture for review session ordering, separating **Scheduling Logic** (FSRS) from the **Session Experience** (IR Algorithm).

---

## Motivation & Problem

Currently, the plugin uses FSRS outputs (due dates) to dictate both eligibility and order. This results in:

1.  **Context Fragmentation:** Clozes are often shown before the Topics that provide their context.
2.  **Context Exhaustion:** Showing 20 clozes from one note in a row causes fatigue and violates the learning principle of interleaving.
3.  **Static Sessions:** The queue is built once at the start; grading "Again" removes the card from the current session instead of re-queuing it.

## The Solution: Decoupled Layers

### 1. The Scheduling Layer (FSRS)

- **Role:** Eligibility Filter.
- **Output:** A binary state—either an item is "Due" (state.due <= now) or "New".
- **Truth:** Stability and Difficulty intervals.

### 2. The Ordering Layer (IR Engine)

- **Role:** Experience Orchestrator.
- **Output:** A dynamic "Session Pool" based on user priority and context rules.
- **Truth:** Priority, Note-Type, and Context-Affinity.

---

## The IR Ordering Algorithm ("IR Pro")

The session order is determined by a **Session Score** calculated at runtime, followed by **Dynamic Selection** logic that manages context and memory buffers.

### 1. The Scoring Formula

`Score = (Priority * 100) + (TypeWeight) + (UrgencyTerm)`

- **Priority (0-100):** The primary driver. Priority 81 always outranks Priority 80.
- **TypeWeight:**
    - `Topic`: +50 (ensures reading precedes testing).
    - `Cloze`: 0.
- **UrgencyTerm:** Derived from the FSRS `stability`/`difficulty` pair stored in each sidecar:
    - Convert FSRS stability to retrievability via `R = 1 - exp(-stability / intervalExpected)` (approximated in the scheduler). Use `1 - R` (higher when stability is low) so low-stability items (recent lapses) float to the top.
    - Break ties with `difficulty` (higher difficulty => higher urgency) and `last_review` (older review = slightly higher priority).

This keeps scoring deterministic and tied directly to the per-item state stored in `IR/Review Items/<id>.md`, honoring the instruction that FSRS only contributes eligibility/due data.

### 1.1. Eligibility Source

`buildQueue()` in `src/core/queue.ts` still produces the learning/due/new buckets (it now becomes the “candidate gatherer”), but the IR engine consumes those buckets via `buildSession()` instead of directly sorting them by `state.due`. That keeps deck counts (`src/core/decks.ts`) accurate while letting session-order own the presentation flow.

### 2. Contextual Affinity & Bounded Clumping

To balance narrative context with interleaving (spacing):

- When a **Topic** is shown, the engine pulls its associated **Due Clozes** to follow it.
- **Clump Limit:** A maximum of **3 clozes** from the same note will be shown in immediate succession. Remaining clozes from that note are pushed back in the pool to be interleaved with other subjects.

### 3. The Short-Term Memory Buffer (Again Loop)

- **Volatile Pool:** Items graded "Again" (fail) stay in the session; they are flagged for immediate reconsideration inside `ReviewSession.volatileIds`.
- **Buffer Logic:** A failed item is ineligible for re-selection until at least **3-5 other items** have been reviewed. Implement this by tracking `session.history` length and only re-queuing volatile items after `volatileCooldown` steps in `session-order.pickNext()`. That makes sure the rating reflects long-term retrieval effort, not short-term echoing.

---

## Technical Implementation Plan

### 1. `src/core/session-order.ts` (New Module)

A pure functional module that manages the session flow.

- `buildSession(items, settings)` – Wraps eligible items, applies scoring, and respects the session size limit (Capacity Filter).
- `pickNext(session, context)` – Selects the next card by:
    1. Checking the **Volatile Pool** for "Ready" items (buffer elapsed).
    2. Applying **Clump Limits** to the candidate pool.
    3. Selecting the highest-scored eligible card.

### 1.1. Session State & Controller Flow

- Define a `ReviewSession` structure in `src/core/types.ts` with:
    - `pool: ReviewItem[]` (scored candidates),
    - `volatileIds: string[]` (current again buffer),
    - `historyIds: string[]` (completed in this session),
    - `clumpCounts: Record<string, number>` (per note clump tracking),
    - `capacity: number` (max session size, used for auto-postpone).
- `ReviewController` (`src/ui/review/review-controller.ts`) replaces its current `queue` field with this session and:

1.  Calls `buildSession(buildQueue(...))` at the start of `startReview()`.
2.  Routes grades through `sessionOrder.markAgain()` / `markComplete()` before `appendReview()`.
3.  In `advanceQueue()`, calls `sessionOrder.pickNext(session)` and keeps `phase` logic (question/answer) unchanged.
4.  Exposes session progress (`session.historyIds.length / session.capacity`) so the UI can show a single session progress bar instead of the old New/Learning/Due split.

This keeps the controller’s state minimal and makes the new ordering logic testable independently from Obsidian’s UI.

### 2. `src/core/queue.ts` (Refactor)

Simplified into a "Candidate Gatherer."

- `buildQueue()` – Returns an unsorted array of all eligible items (`due <= now` + `New` cards up to the daily limit).

### 3. `src/ui/review/review-controller.ts` (State Machine)

- **Dynamic Discovery:** After a Topic review, the controller re-scans the note. If the user added new clozes, they are injected into the current `SessionPool` if they meet the priority/urgency criteria.
- **Session Progress:** Tracks progress against the `sessionCap` (e.g., `12 / 50`) to prevent backlog burnout.

---

## UX & UI Changes

- **Progress Indicators:** Replace "New/Learning/Due" counts with a "Session Progress" bar.
- **Capacity Management:** If the vault has 500 cards due, the UI shows `Due: 500 (Session: 50)`.
- **Cues:** Visual labels for "Topic" vs "Cloze" and "Re-reviewing" for volatile cards.
- **Always-Editable:** Notes remain editable during review; adding a cloze automatically updates the current session.
- **Component Hooks:** Use `ReviewQuestionScreen`/`ReviewAnswerScreen` for the progress badge and re-review label, and surface session stats in `ReviewSessionSummary` (`src/ui/review/ReviewSessionSummary.tsx`) so the UI reflects the new `session.historyIds` tally.

---

## Why This Matters for Incremental Reading

This architecture treats Incremental Reading as an **active synthesis process**. By prioritizing Topics (reading), limiting clumping (interleaving), and re-testing failures (active recall), the plugin ensures that the user is not just clearing a backlog, but building a durable, contextualized knowledge base.

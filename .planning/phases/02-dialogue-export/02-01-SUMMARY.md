---
phase: 02-dialogue-export
plan: 01
subsystem: export-engine
tags: [export, godot-dm, base-syntax, engine]
summary: >
  Built the export engine core and Godot Dialogue Manager base syntax formatter.
  The export pipeline converts .ncanvas JSON node graphs to valid .dialogue strings
  covering all 7 base DM requirements. Three modules created: export-engine.js
  (graph traversal + character resolution), gd-format.js (6 node type formatters),
  and med-format.js (skeleton stubs for Plan 02-02).
requires: []
provides: [export-engine-core, gd-base-syntax]
affects: [tests/export.test.js, tests/golden/]

decisions:
  - "Entry nodes always emit ~ start cue; Choice-only graphs auto-prepend ~ start"
  - "formatDialogLine uses CharacterName: body (not Character: prefix token)"
  - "Recursive subtree walk handles nested content under non-Choice nodes"
  - "BBCode body text passes through verbatim after variable resolution"

tech-stack:
  added: []
  patterns:
    - "exportEngine(ncanvas, config) pure function — zero runtime deps"
    - "Type dispatch via FORMATTERS object (Strategy pattern)"
    - "Recursive walkNode with visited Set for cycle-safe traversal"
    - "formatChoiceNode uses walkSubtree helper for arbitrary-depth nesting"
key-files:
  created:
    - plugins/dialogue-export/src/export-engine.js
    - plugins/dialogue-export/src/gd-format.js
    - plugins/dialogue-export/src/med-format.js
    - tests/export-base.test.js
    - tests/fixtures/basic-dialogue.ncanvas
    - tests/fixtures/nested-choices.ncanvas
    - tests/fixtures/cues-and-jumps.ncanvas
    - tests/fixtures/bbcode-formatting.ncanvas
    - tests/golden/basic-dialogue.dialogue
    - tests/golden/nested-choices.dialogue
    - tests/golden/cues-and-jumps.dialogue
    - tests/golden/bbcode-formatting.dialogue
  modified:
    - tests/export.test.js
    - tests/golden/choice-link-branches.dialogue
    - tests/golden/characters-cast-chips.dialogue
duration: "415s"
completed-at: "2026-07-24T03:16:38.102Z"
---

# Phase 2 Plan 1: Export Engine Core + Base Godot DM Syntax Summary

One-liner: Built foundational export pipeline converting .ncanvas JSON node graphs to valid Godot Dialogue Manager .dialogue strings across 6 node types.

## Task Summary

| Task | Name | Commit | Files | Status |
|------|------|--------|-------|--------|
| 1 | Create export-engine.js and gd-format.js | `d205b90` | export-engine.js, gd-format.js, med-format.js | Complete |
| 2 | Create base DM test fixtures and golden files | `9673f53` | 4 new fixtures, 4 new golden + 2 updated | Complete |
| 3 | Create export-base.test.js — TDD test suite | `dc609ce` | export-base.test.js, export.test.js (refactored) | Complete |

## Architecture

### Module Structure

```
plugins/dialogue-export/src/
  export-engine.js    — exportEngine(), topologicalSort(), resolveCharacter()
  gd-format.js        — formatNode() with 6 type formatters (Entry, Dialog, Content, Choice, Marker, Event)
  med-format.js       — detectMedState(), formatMedNode(), formatMedHeader() (stubs for Plan 02-02)
```

### Key Design Decisions

1. **Recursive tree walk, not flat loop.** The engine walks the node graph recursively from the Entry node, with `walkNode()` handling each node type differently. Choice nodes handle their own children inline; non-Choice nodes walk their children at the current depth.

2. **WalkSubtree helper for Choice nodes.** `formatChoiceNode` uses a nested `walkSubtree()` function to recursively format all content under each option's target node at arbitrary depth — handling cases where a choice leads to a Dialog that leads to a Content that leads to another Choice.

3. **`~ start` always emitted.** Entry nodes produce `~ start` as the opening cue. For graphs without an Entry node (e.g., choice-link-branches.ncanvas), `~ start` is prepended before walking.

4. **BBCode verbatim passthrough.** Body text goes through `resolveVariables()` (replacing `{variable}` templates) then is emitted unchanged. No BBCode parsing/validation.

### Requirements Met

| Requirement | Description | Status |
|-------------|-------------|--------|
| EXP-01 | Base DM syntax: Character: text | Verified by basic-dialogue golden |
| EXP-02 | Character name mapping from cast/title | Verified by characters-cast-chips golden |
| EXP-03 | Choice options as - option text | Verified by nested-choices golden |
| EXP-04 | Nested branch indentation (3+ levels) | Verified by nested-choices golden |
| EXP-05 | Cue (~) and jump (=>) syntax | Verified by cues-and-jumps golden |
| EXP-06 | Tags exported as [#tag] | Deferred to Plan 02-02 (MED extension) |
| EXP-07 | BBCode preserved verbatim | Verified by bbcode-formatting golden |

## Test Results

```
node --test tests/*.test.js
 53 tests, 0 failures, 80ms

Golden file tests (6 fixtures): ALL PASS
Topological sort unit tests: ALL PASS (3 tests)
Character resolution unit tests: ALL PASS (3 tests)
Robustness tests: ALL PASS (3 tests)
Constants + schema tests (Phase 1): ALL PASS (10+12 tests)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed relative path for gd-constants import**
- Found during: Task 1 verification
- Issue: Plan specified `require('../../../../shared/gd-constants')` (4 levels up) but the correct path from `plugins/dialogue-export/src/gd-format.js` is `../../../shared/gd-constants` (3 levels up)
- Fix: Corrected to `require('../../../shared/gd-constants')`
- Commit: `d205b90`

**2. [Rule 2 - Missing] Added ~ start emission for non-Entry starting graphs**
- Found during: Task 2 verification (choice-link-branches fixture)
- Issue: When the graph has no Entry node (Choice is the first node), the engine did not emit `~ start`, causing golden comparison failure
- Fix: Added `if (entryNodes.length === 0) { lines.push('~ start'); }` before walking the start node
- Commit: `9673f53`

**3. [Rule 2 - Missing] Added recursive subtree walk for nested content under Choice branches**
- Found during: Task 2 verification (nested-choices fixture)
- Issue: When a choice option leads to a Dialog node that itself has children (Content -> Choice), those deeper children were not emitted because the flat for-loop with `processed` Set only handled direct children of the Choice node
- Fix: Replaced flat loop with recursive `walkNode()` function; added `walkSubtree()` helper in `formatChoiceNode` for arbitrary-depth traversal
- Commit: `9673f53`

**4. [Rule 1 - Bug] Fixed Entry body emitting Character prefix**
- Found during: Task 1 smoke test
- Issue: Entry node body text was getting "Character:Start:" prefix from resolveCharacter fallback to title
- Fix: Changed formatEntryNode to emit body as plain narrator text (no character resolution for Entry)
- Commit: `d205b90`

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: spoofing | gd-format.js (formatDialogLine) | T-02-04: Character names not validated against DM reserved prefixes. A character named "if=" could produce ambiguous syntax. Mitigation (warning comment for collision) deferred to Plan 02-02. |

## Known Stubs

| File | Line | Description |
|------|------|-------------|
| med-format.js | detectMedState() | Returns false always — real MED state detection in Plan 02-02 |
| med-format.js | formatMedNode() | Returns [] always — real MED formatting in Plan 02-02 |
| med-format.js | formatMedHeader() | Returns '' always — real MED header in Plan 02-02 |
| export-engine.js | medEnabled check | MED branch never triggered since detectMedState returns false |

These stubs are intentional — they establish the interface contract that Plan 02-02 fills in. The engine is fully functional for all 7 base DM requirements (EXP-01 through EXP-07).

## Self-Check: PASSED

- All 12 created files exist
- All 3 modified files confirmed
- All 3 commits verified (d205b90, 9673f53, dc609ce)
- Full test suite: 53 tests, 0 failures

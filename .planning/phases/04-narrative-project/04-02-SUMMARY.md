---
phase: 04-narrative-project
plan: 02
subsystem: narrative-project
tags: [batch-export, status-bar, tdd]
requires: [04-01]
provides: [04-03]
affects: [dialogue-export, flow-tools]
tech-stack:
  added: []
  patterns: [MockVault, TDD RED/GREEN, Plugin.addStatusBarItem, exportEngine reuse]
key-files:
  created:
    - plugins/narrative-project/src/batch-export.js
    - plugins/narrative-project/src/status-bar.js
    - tests/batch-export.test.js
    - tests/status-bar.test.js
  modified:
    - plugins/narrative-project/src/main.js
    - plugins/narrative-project/styles.css
    - tests/mocks/obsidian.js
decisions:
  - "Batch-export module reused Phase 2 exportEngine via require('../../dialogue-export/src/export-engine') rather than duplicating export logic"
  - "StatusBarManager uses plugin.addStatusBarItem() to create Obsidian-native status bar DOM elements"
  - "Export scope filtering normalizes '/' to vault-root scope matching all .ncanvas files"
  - "exportAllDialogues returns { exported, failed } counts for status bar display"
  - "Styles use CSS @keyframes for spinner animation rather than GIF or icon font"
metrics:
  duration: ""
  completed_date: "2026-07-24"
---

# Phase 4 Plan 2: Batch Export + Status Bar — Summary

**One-liner:** Batch export all .ncanvas files to .dialogue with real-time status bar feedback (exporting spinner, success count, failure display).

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create StatusBarManager (PRJ-04) — TDD RED | `2a9b4d9` | `tests/status-bar.test.js`, `tests/mocks/obsidian.js` |
| 1 | Create StatusBarManager (PRJ-04) — TDD GREEN | `304bda1` | `plugins/narrative-project/src/status-bar.js` |
| 2 | Create batch-export module (PRJ-02) — TDD RED | `f3b2278` | `tests/batch-export.test.js` |
| 2 | Create batch-export module (PRJ-02) — TDD GREEN | `2ce5169` | `plugins/narrative-project/src/batch-export.js` |
| 3 | Wire command + status bar into main.js | `2377da0` | `plugins/narrative-project/src/main.js`, `plugins/narrative-project/styles.css` |

## What Was Built

### batch-export.js — `exportAllDialogues(app, exportPath, exportScope, medEnabled)`
- Iterates all .ncanvas files in vault, filters by `exportScope` (default "/" = all)
- Runs each through Phase 2 `exportEngine(ncanvasJson, { medEnabled })`
- Writes .dialogue output to `exportPath`, mirroring original subdirectory structure
- Handles JSON parse errors and exportEngine exceptions gracefully: counts as failed, continues
- Auto-creates output directories via `app.vault.createFolder()`
- Returns `{ exported: number, failed: number }`

### status-bar.js — `StatusBarManager` class
- Creates status bar element via `plugin.addStatusBarItem()` on construction
- Four states: `pending` (muted "Narrative Toolchain"), `exporting` (spinner + progress count), `success` (green check + exported count), `failure` (red X + error message)
- Consecutive `setState()` calls replace content (no DOM accumulation)
- `destroy()` removes element from DOM

### main.js — Plugin integration
- Initializes `StatusBarManager` in `onload`, destroys in `onunload`
- Registers "Batch Export All Dialogues" command (id: `batch-export-all-dialogues`)
- `batchExportAllDialogues()` reads settings, calls `exportAllDialogues`, updates status bar through exporting -> success/failure
- Shows `new Notice()` for transient result summary

### styles.css — Spinner animation and state colors
- `@keyframes nt-spin` for rotating border animation on `::before` pseudo-element
- State classes: `.nt-status-pending` (muted), `.nt-status-exporting` (spinner), `.nt-status-success` (green), `.nt-status-failure` (red)

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| status-bar.test.js | 9 | 9 | 0 |
| batch-export.test.js | 8 | 8 | 0 |
| settings.test.js | 22 | 22 | 0 |
| **Total** | **39** | **39** | **0** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed incorrect require path in plan for export-engine**
- **Found during:** Task 2 GREEN phase
- **Issue:** Plan specified `require('../../../../dialogue-export/src/export-engine')` (four `../` levels), actual relative path from `plugins/narrative-project/src/` to `plugins/dialogue-export/src/` is `../../dialogue-export/src/export-engine` (two levels).
- **Fix:** Used correct relative path `../../dialogue-export/src/export-engine`.
- **Files modified:** `plugins/narrative-project/src/batch-export.js`

**2. [Rule 2 - Missing] Added addStatusBarItem to obsidian mock**
- **Found during:** Task 1 GREEN phase (implementation)
- **Issue:** `StatusBarManager` constructor calls `plugin.addStatusBarItem()` which didn't exist in the shared `tests/mocks/obsidian.js` Plugin mock.
- **Fix:** Added `addStatusBarItem()` method returning a mock HTMLElement with `innerHTML`, `className`, `addClass`, `removeClass`, `remove`, and `createEl` support. Backward-compatible with existing mock consumers.
- **Files modified:** `tests/mocks/obsidian.js`

## Threat Flags

None. The threat model's `accept` dispositions for T-04-04 (DoS: batch export), T-04-05 (Info Disclosure: counters only), and T-04-06 (EoP: vault API scoped) remain valid. No new trust boundaries introduced.

## Self-Check

- [x] plugins/narrative-project/src/batch-export.js exists
- [x] plugins/narrative-project/src/status-bar.js exists
- [x] plugins/narrative-project/src/main.js updated
- [x] plugins/narrative-project/styles.css updated
- [x] tests/batch-export.test.js exists (8 passing)
- [x] tests/status-bar.test.js exists (9 passing)
- [x] All 39 tests pass, 0 failures
- [x] All commits recorded: `2a9b4d9`, `304bda1`, `f3b2278`, `2ce5169`, `2377da0`

## Self-Check: PASSED

---
phase: 04-narrative-project
plan: 03
subsystem: narrative-project
tags: [auto-export, reference-validation, debounce, integrity-check, tdd]
requires: [04-02]
provides: [PRJ-03, PRJ-05]
affects: [dialogue-export]
tech-stack:
  added: []
  patterns: [TDD RED/GREEN, vault.on('modify') debounce, Set-based dedup, cross-file reference scanning]
key-files:
  created:
    - plugins/narrative-project/src/auto-export.js
    - plugins/narrative-project/src/reference-validator.js
    - tests/auto-export.test.js
    - tests/reference-validator.test.js
  modified:
    - plugins/narrative-project/src/main.js
decisions:
  - "Auto-export 2-second debounce with Set-based dedup matches ROADMAP SC #3 timing"
  - "Reference validator only checks Flow→Dialogue (.canvas→.ncanvas) direction; reverse check is out of scope"
  - "Non-.ncanvas file references (.md, .canvas) in file nodes are skipped, not reported as broken"
  - "exportsing state reused for reference validation check progress (exporting spinner)"
  - "All status bar success/failure states auto-revert to pending after 5 seconds per SC #6"
metrics:
  duration: "2m 58s"
  completed_date: "2026-07-24"
---

# Phase 4 Plan 3: Auto-Export + Reference Validation — Summary

**One-liner:** Save-time auto-export of .ncanvas to .dialogue with 2-second debounce, plus cross-file Flow-to-Dialogue reference integrity checking.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create auto-export module (TDD RED) | `29530c9` | `tests/auto-export.test.js` |
| 1 | Create auto-export module (TDD GREEN) | `e840155` | `plugins/narrative-project/src/auto-export.js` |
| 2 | Create reference-validator module (TDD RED) | `751d7e1` | `tests/reference-validator.test.js` |
| 2 | Create reference-validator module (TDD GREEN) | `58f746c` | `plugins/narrative-project/src/reference-validator.js` |
| 3 | Wire into main.js | `4deaef8` | `plugins/narrative-project/src/main.js` |

## What Was Built

### auto-export.js — `exportSingleFile`, `setupAutoExport`, `teardownAutoExport`
- **exportSingleFile(app, file, exportPath, medEnabled)**: Reads a single .ncanvas file, parses JSON, runs through Phase 2 exportEngine, writes .dialogue output to exportPath while mirroring the original subdirectory structure. Returns `{ success: boolean, error?: string, path?: string }`.
- **setupAutoExport(plugin, onExported)**: Registers `vault.on('modify')` listener. Filters for .ncanvas files only. Uses a 2-second debounce with a `Set`-based dedup queue — multiple rapid changes to the same .ncanvas file result in a single export. On debounce timeout, exports all queued files and calls `onExported(results)`.
- **teardownAutoExport(plugin)**: Clears the debounce timer and flushes the pending queue. Event listener is auto-unregistered by Obsidian's plugin lifecycle (via `registerEvent`).
- Error handling: JSON parse errors return `'Failed to parse .ncanvas JSON'`. exportEngine exceptions return the error message. Neither throws — all failures are soft.

### reference-validator.js — `validateReferences(app)`
- Scans all `.canvas` files in the vault via `app.vault.getFiles()`.
- For each .canvas file, parses JSON and filters nodes where `type === 'file'` and `file.endsWith('.ncanvas')`.
- Checks each referenced .ncanvas file's existence via `app.vault.getAbstractFileByPath()`.
- Returns `{ totalRefs, brokenRefs, details[] }` where details include `canvasPath`, `nodeId`, `referencedFile`, `reason`.
- Non-file node types (text, group) are ignored. File nodes with non-.ncanvas extensions (.md, .canvas) are skipped.
- Invalid JSON in .canvas files is caught and reported in details without crashing — processing continues to remaining files.

### main.js — Plugin integration
- **Requires**: `./auto-export` (3 functions) and `./reference-validator` (1 function).
- **setupAutoExport callback**: On success: `statusBar.setState('success', ...)` with 5-second auto-revert. On failure: `statusBar.setState('failure', ...)` with count.
- **New command `validate-references`**: Calls `runReferenceValidation()` which sets exporting state, runs validator, shows success (green "All N references valid") or failure (red "N broken refs") on status bar, logs details to `console.warn`.
- **New command `export-current-dialogue`**: Exports the active .ncanvas file via `exportSingleFile`. Shows success/failure status on status bar with 5-second auto-revert. Warns if no .ncanvas file is open.
- **onunload updated**: Calls `teardownAutoExport(this)` and clears `_autoExportTimeout`.
- **batchExportAllDialogues updated**: Now auto-reverts to pending after 5 seconds on success (previously persistent).
- **Total Commands**: 3 — `batch-export-all-dialogues` (04-02), `validate-references` (04-03), `export-current-dialogue` (04-03).

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| auto-export.test.js | 7 | 7 | 0 |
| reference-validator.test.js | 7 | 7 | 0 |
| batch-export.test.js | 8 | 8 | 0 |
| status-bar.test.js | 9 | 9 | 0 |
| settings.test.js | 22 | 22 | 0 |
| **Total** | **53** | **53** | **0** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Added status bar auto-revert to batchExportAllDialogues**
- **Found during:** Task 3 implementation
- **Issue:** The plan's success criteria SC #6 states "all status bar feedback auto-reverts to pending after 5 seconds." The batch-export-all-dialogues command (from 04-02) did not auto-revert — it left the success/failure state persistent.
- **Fix:** Added `setTimeout(() => this.statusBar.setState('pending'), 5000)` after both success and failure paths in `batchExportAllDialogues()`.
- **Files modified:** `plugins/narrative-project/src/main.js`

None otherwise — plan executed exactly as written for the two core modules.

## Threat Flags

None. The threat model's `accept` dispositions for T-04-07 (DoS: debounce 2s), T-04-08 (Tampering: .canvas within vault), and T-04-09 (Info Disclosure: details console.warn only) remain valid. No new trust boundaries, network endpoints, or auth paths introduced.

## Verification

- [x] `node --test tests/auto-export.test.js` — 7/7 pass
- [x] `node --test tests/reference-validator.test.js` — 7/7 pass
- [x] `node --test` (all 53 tests) — 53/53 pass, 0 failures
- [x] `validate-references` command registered in main.js
- [x] `export-current-dialogue` command registered in main.js
- [x] `setupAutoExport` wired with onExported callback
- [x] `teardownAutoExport` called in onunload
- [x] All status bar states auto-revert to pending after 5 seconds
- [x] Grep verification: 8 integration references found in main.js

## Self-Check

- [x] `plugins/narrative-project/src/auto-export.js` exists (198 lines)
- [x] `plugins/narrative-project/src/reference-validator.js` exists (102 lines)
- [x] `plugins/narrative-project/src/main.js` updated (163 lines)
- [x] `tests/auto-export.test.js` exists (378 lines, 7 tests)
- [x] `tests/reference-validator.test.js` exists (296 lines, 7 tests)
- [x] All 53 tests pass, 0 failures
- [x] All commits recorded: `29530c9`, `e840155`, `751d7e1`, `58f746c`, `4deaef8`

## Self-Check: PASSED

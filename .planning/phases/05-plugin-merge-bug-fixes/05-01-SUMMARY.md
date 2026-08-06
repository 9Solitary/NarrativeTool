---
phase: 05-plugin-merge-bug-fixes
plan: 01
subsystem: plugin-merge
tags: [git-mv, engine-layer, node-test, purity-guard, plugin-consolidation]
requires:
  - phase: 02-dialogue-export
    provides: export engine modules (export-engine, gd-format, med-format) and shared constants (gd-constants, med-constants)
provides:
  - plugins/narrative-tool/src/engine/ populated with 5 modules (engine/ is now the single home of the pure export layer)
  - narrative-project consumers (auto-export, batch-export) re-pointed to the engine/ location
  - engine-purity.test.js enforcing the no-obsidian / no-window / no-document layer boundary
affects: 05-02 (schema move + flow tests), 05-03, 05-04, 05-05 (esbuild), flow-tools consumers
tech-stack:
  added: []
  patterns:
    - "Engine layer purity: plugins/narrative-tool/src/engine/ is free of any Obsidian runtime dependency, enforced by a recursive readdirSync scan test"
    - "Constants-as-engine-dependencies: gd-constants.js / med-constants.js live beside their consumers inside engine/ (D-03), imported via relative './' paths"
key-files:
  created:
    - plugins/narrative-tool/src/engine/export-engine.js
    - plugins/narrative-tool/src/engine/gd-format.js
    - plugins/narrative-tool/src/engine/med-format.js
    - plugins/narrative-tool/src/engine/gd-constants.js
    - plugins/narrative-tool/src/engine/med-constants.js
    - tests/engine-purity.test.js
  modified:
    - tests/export-base.test.js
    - tests/export-med.test.js
    - tests/export-plugin.test.js
    - tests/constants.test.js
    - plugins/narrative-project/src/auto-export.js
    - plugins/narrative-project/src/batch-export.js
key-decisions:
  - "Engine modules moved with git mv (not cp+delete) so git history and working-tree state ride along"
  - "narrative-project's auto-export.js / batch-export.js consumers re-pointed to the new engine path as a Rule 3 auto-fix (plan did not list them)"
requirements-completed: [ENG-01]

# Metrics
duration: 6min
completed: 2026-08-06
---

# Phase 05 Plan 01: Engine Move + Purity Guard Summary

**Export engine and shared constants relocated into plugins/narrative-tool/src/engine/ via git mv (history-preserving), all test imports re-pointed, narrative-project consumers fixed, and a recursive purity guard test now enforces the zero-obsidian engine/ layer boundary**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-06T13:06:00Z
- **Completed:** 2026-08-06T13:12:53Z
- **Tasks:** 3
- **Files modified:** 11 (5 moved, 6 edited)

## Accomplishments

- `plugins/narrative-tool/src/engine/` now holds export-engine.js, gd-format.js, med-format.js, gd-constants.js, med-constants.js — all 5 shown as renames (R) in git, preserving history
- gd-format.js / med-format.js import constants via `./gd-constants` / `./med-constants`; zero `shared/` references remain in engine/; shared/ now contains only schema/
- All 4 engine test files (85 tests) pass from the new import paths; full suite 244 tests, 240 pass (see Deferred below)
- New `tests/engine-purity.test.js` recursively scans engine/ for `require('obsidian')`, `window.`, `document.` with positive controls; also asserts the D-03 constants relocation landed with TOKENS/MED_TOKENS export names preserved
- Rule 3 auto-fix: narrative-project's auto-export.js and batch-export.js had requires to the now-moved engine path (MODULE_NOT_FOUND) — re-pointed to `../../narrative-tool/src/engine/export-engine`

## Task Commits

Each task was committed atomically:

1. **Task 1: Move engine modules + constants into engine/ (git mv + import fix)** - `8c95c24` (refactor)
2. **Task 2: Re-point engine test imports to engine/** - `2d121f3` (test)
3. **Task 3: Engine purity guard test** - `cf30b80` (test)

**Deviations:** `b28bf2e` (fix: narrative-project require re-point, Rule 3)

## Files Created/Modified

- `plugins/narrative-tool/src/engine/export-engine.js` - Moved verbatim (0 content changes)
- `plugins/narrative-tool/src/engine/gd-format.js` - Moved; require now `./gd-constants`
- `plugins/narrative-tool/src/engine/med-format.js` - Moved; requires now `./med-constants`, `./gd-constants`
- `plugins/narrative-tool/src/engine/gd-constants.js` - Moved from shared/ per D-03
- `plugins/narrative-tool/src/engine/med-constants.js` - Moved from shared/ per D-03
- `tests/engine-purity.test.js` - Created: layer boundary guard (obsidian/window/document scan, positive controls, D-03 sanity)
- `tests/export-base.test.js` - 7 require paths -> engine/export-engine
- `tests/export-med.test.js` - 3 require paths -> engine/
- `tests/export-plugin.test.js` - 1 require path -> engine/
- `tests/constants.test.js` - 4 require paths -> engine/; stale header comment fixed
- `plugins/narrative-project/src/auto-export.js` - exportEngine require -> engine/ (deviation)
- `plugins/narrative-project/src/batch-export.js` - exportEngine require -> engine/ (deviation)

## Decisions Made

- **git mv over cp+delete:** preserves history and carries working-tree changes per plan requirement; verified git shows 5 renames (R) with only 3 insertions/3 deletions total (the two require-path edits)
- **Do-not-touch list honored:** tests/schema.test.js, entity-templates.test.js, canvas-templates.test.js, and shared/schema/ left untouched for Plans 05-02+
- **Golden files normalized to LF in the working tree only:** see Deviations — committed blobs are byte-identical

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] narrative-project consumers broke after engine move**
- **Found during:** Task 3 (full-suite verification)
- **Issue:** Task 1's `git mv` removed `plugins/dialogue-export/src/export-engine.js`, but `plugins/narrative-project/src/auto-export.js` (line 16) and `batch-export.js` (line 12) still required `'../../dialogue-export/src/export-engine'` → MODULE_NOT_FOUND; `node --test tests/auto-export.test.js tests/batch-export.test.js` crashed on load
- **Fix:** Re-pointed both requires to `'../../narrative-tool/src/engine/export-engine'` (2-line change; only the require path)
- **Files modified:** plugins/narrative-project/src/auto-export.js, plugins/narrative-project/src/batch-export.js
- **Verification:** auto-export/batch-export test files load and pass; full-suite failures reduced to the 4 pre-existing out-of-scope ones (below)
- **Committed in:** b28bf2e (separate fix commit)

**2. [Rule 1 - Bug] CRLF checkout artifact breaks golden-file comparisons**
- **Found during:** Task 2 (verification)
- **Issue:** This repo has `core.autocrlf=true`; fresh worktree checkout materialized the 9 committed LF golden `.dialogue` blobs as CRLF working files. Golden tests then compared engine LF output against CRLF expected (`\r\n` vs `\n`) → 14 pre-existing failures in export-base.test.js, unrelated to the move (engine behavior is byte-identical)
- **Fix:** Normalized the 9 working-tree golden files to LF (`sed -i 's/\r$//'`). Verified each is blob-identical to HEAD (`git hash-object` == `git rev-parse HEAD:path`). These are NOT staged/committed — the git-status `M` on goldens is a phantom autocrlf artifact identical to what the main repo already shows for its LF golden working copies
- **Files modified:** none at the commit level (working-tree normalization only)
- **Verification:** all 4 engine test files pass (85 tests, fail 0) after normalization
- **Committed in:** none (no committed golden change)

---

**Total deviations:** 2 auto-fixed (1 blocking import, 1 line-ending verification artifact)
**Impact on plan:** Both were necessary for the plan's stated verification ("full suite still green"); no scope creep — the require re-point is a mechanical path update and the golden normalization changes zero committed bytes.

## Issues Encountered

- **Pre-existing CRLF artifact in tests/entity-templates.test.js (out of scope):** 4 tests fail (`Character/Location/Quest/Item template`, incl. golden expected-*.md comparisons) with the identical `\r\n` vs `\n` mismatch — the test's template literals were checked out CRLF while template output is LF. This file is explicitly assigned to Plan 05-02 and do-not-touch in this plan, so it was NOT modified. Logged as deferred: Plan 05-02 should normalize these literals (or the repo should adopt eol=lf handling) when it touches entity-templates.
- **05-CONTEXT.md absent:** the plan references `.planning/phases/05-plugin-merge-bug-fixes/05-CONTEXT.md` (D-02/D-03 details) but the file does not exist in the phase directory; the plan's embedded decision descriptions were sufficient to execute.
- **Plan acceptance wording "pass count >= 130":** the 4 engine test files contain 85 tests at this commit (77 engine tests + 8 purity tests); 130+ refers to the broader suite estimate. All run files report fail 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Engine/ is the single source of truth for the export pipeline; Plan 05-02 can move shared/schema/ into the merged plugin and re-point flow tests (entity-templates/canvas-templates/schema) without touching engine code
- The entity-templates CRLF failure (4 tests) needs addressing in Plan 05-02's file — flagged as deferred
- narrative-project (auto-export/batch-export) already consumes the new engine path, so Plans 05-03/05-04 bug fixes can build on it

---
*Phase: 05-plugin-merge-bug-fixes*
*Completed: 2026-08-06*

## Self-Check: PASSED

- All 6 created files verified present (5 engine modules + engine-purity.test.js + SUMMARY)
- All 4 commits verified in `git log`: 8c95c24, 2d121f3, cf30b80, b28bf2e
- Engine suite: 85/85 pass (4 files + purity test), full suite 244 tests / 240 pass (4 pre-existing out-of-scope entity-templates CRLF failures deferred to Plan 05-02)

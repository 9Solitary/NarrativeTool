---
phase: 05-plugin-merge-bug-fixes
plan: 02
subsystem: testing
tags: [flow-templates, schema, git-mv, line-endings, node-test]

# Dependency graph
requires:
  - phase: 05-plugin-merge-bug-fixes (05-01)
    provides: engine/ layer (export-engine, gd-format, med-format, constants) merged into plugins/narrative-tool/src/engine/, eol=lf pin for tests/golden/*.dialogue
provides:
  - flow/ layer (entity-templates, canvas-templates, canvas-utils, navigation) in plugins/narrative-tool/src/flow/ importing engine/schema
  - shared/schema/* relocated to plugins/narrative-tool/src/engine/schema/ (D-03), shared/ removed from repo
  - createQuestMd + expected-quest.md golden + quest tests verified restored and green (BUG-01)
  - tests/fixtures/*.md pinned to eol=lf (Windows autocrlf fix)
affects: [05-03, 05-04, 05-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layer rule: flow/ imports engine/schema via ../engine/schema/* (D-03)"
    - "Golden fixture line endings pinned via .gitattributes eol=lf (extends tests/golden/*.dialogue pattern to tests/fixtures/*.md)"

key-files:
  created:
    - plugins/narrative-tool/src/flow/entity-templates.js
    - plugins/narrative-tool/src/flow/canvas-templates.js
    - plugins/narrative-tool/src/flow/canvas-utils.js
    - plugins/narrative-tool/src/flow/navigation.js
    - plugins/narrative-tool/src/engine/schema/character.js
    - plugins/narrative-tool/src/engine/schema/location.js
    - plugins/narrative-tool/src/engine/schema/quest.js
    - plugins/narrative-tool/src/engine/schema/item.js
  modified:
    - tests/entity-templates.test.js
    - tests/canvas-templates.test.js
    - tests/schema.test.js
    - .gitattributes

key-decisions:
  - "Re-pointed all 4 schema requires in entity-templates.js during Task 1 (committed state already contained the quest import that the plan expected to add in Task 2)"
  - "Pinned tests/fixtures/*.md to eol=lf via .gitattributes to resolve 4 pre-existing CRLF golden-match failures — same pattern as the prior wave's tests/golden/*.dialogue pin"
  - "Updated schema.test.js describe() labels and header comments to engine/schema/ paths — required to satisfy the zero-match grep acceptance criterion (display text only, no assertion changes)"

patterns-established:
  - "Golden .md fixtures pinned to LF so template \\n output matches byte-for-byte"

requirements-completed: [ENG-01, BUG-01]

# Metrics
duration: 31min
completed: 2026-08-06
---

# Phase 05 Plan 02: Flow Layer + Schema Relocation Summary

**flow-tools modules moved into plugins/narrative-tool/src/flow/ with schema relocated to engine/schema/ (D-03, shared/ removed), and BUG-01 Quest template regression verified restored with golden fixture and all 38 flow/schema tests green**

## Performance

- **Duration:** 31 min
- **Started:** 2026-08-06T13:07:00Z (approx)
- **Completed:** 2026-08-06T13:38:02Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- All 4 flow modules relocated via `git mv` (history preserved) to plugins/narrative-tool/src/flow/; all 4 schema files moved to plugins/narrative-tool/src/engine/schema/; shared/ directory fully removed from the repo
- entity-templates.js imports re-pointed to `../engine/schema/*` (character, location, quest, item); canvas-utils sibling require and navigation.js obsidian require verified untouched
- BUG-01: createQuestMd verified byte-identical to the 4deaef8 reference (git diff empty), expected-quest.md fixture restored on disk matching the HEAD blob, and all quest test blocks (golden match, tags, exports, quoted-name) present and green; 14 test require sites re-pointed to the new module location
- schema.test.js and canvas-templates.test.js re-pointed; zero stale `plugins/flow-tools` / `shared/schema` references remain in the three plan test files
- 4 pre-existing golden-match failures (CRLF on disk vs LF template output) resolved by pinning tests/fixtures/*.md to eol=lf — full suite now 244/244 pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Move flow modules and schema into the merged layout** - `2c0a62e` (refactor) + `2c4a8b7` (fix)
2. **Task 2: BUG-01 — restore createQuestMd, golden fixture, and tests** - `84028ab` (fix)
3. **Task 3: Re-point flow and schema test imports** - `59c622a` (refactor)

## Files Created/Modified
- `plugins/narrative-tool/src/flow/entity-templates.js` - Entity .md templates (createCharacterMd/LocationMd/QuestMd/ItemMd), imports engine/schema; createQuestMd restored verbatim (BUG-01)
- `plugins/narrative-tool/src/flow/canvas-templates.js` - Flow Canvas/Fragment .canvas templates (moved, unchanged)
- `plugins/narrative-tool/src/flow/canvas-utils.js` - Canvas JSON utils (moved, unchanged)
- `plugins/narrative-tool/src/flow/navigation.js` - Cross-file navigation, obsidian-coupled (moved, unchanged)
- `plugins/narrative-tool/src/engine/schema/{character,location,quest,item}.js` - Entity schemas (moved from shared/schema/)
- `tests/entity-templates.test.js` - 14 require sites re-pointed to ../plugins/narrative-tool/src/flow/entity-templates
- `tests/canvas-templates.test.js` - 2 requires re-pointed to flow/canvas-utils and flow/canvas-templates
- `tests/schema.test.js` - 4 path constants + 4 assertHasJSDoc args + 4 describe labels + 2 header comments re-pointed to engine/schema (repo-relative, no leading ../ on JSDoc args)
- `.gitattributes` - Added `tests/fixtures/*.md text eol=lf`

## Decisions Made
- Re-pointed the quest schema require in Task 1 instead of adding it in Task 2 (see deviation 1)
- Extended the LF line-ending pin to tests/fixtures/*.md (see deviation 2)
- Updated schema.test.js display labels/comments to new paths (see deviation 3)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] entity-templates.js committed state differs from plan premise — quest import already present**
- **Found during:** Task 1 (move + import fix)
- **Issue:** The plan assumed the regressed working-tree state (3 schema requires, no quest import until Task 2). The worktree starts from committed HEAD where createQuestMd and its quest import already exist (the regression only existed in the main repo's uncommitted working tree). Re-pointing only 3 imports would leave the quest require pointing at the deleted shared/schema/quest, breaking module load.
- **Fix:** Re-pointed all 4 schema requires (character, location, quest, item) to `../engine/schema/*` in Task 1. Task 2's restoration steps became verification: createQuestMd confirmed byte-identical to 4deaef8 (empty git diff), fixture on disk matches HEAD blob, quest test blocks present.
- **Files modified:** plugins/narrative-tool/src/flow/entity-templates.js
- **Verification:** smoke require of all 5 modules passes; grep `require('../engine/schema/` = 4; entity-templates tests 14/14 pass
- **Committed in:** 2c4a8b7 (Task 1)

**2. [Rule 1 - Bug] 4 pre-existing golden-match failures: CRLF fixtures vs LF template output**
- **Found during:** Task 2 (test run)
- **Issue:** tests/fixtures/*.md are stored LF in git blobs but rendered CRLF on disk under core.autocrlf=true (no eol attribute), while template functions join with `\n` — all 4 golden-match tests (character/location/quest/item) failed before any of this plan's changes.
- **Fix:** Pinned `tests/fixtures/*.md text eol=lf` in .gitattributes (same pattern the prior wave applied to tests/golden/*.dialogue), then re-materialized the 4 fixture files via rm --cached + checkout (content-neutral). 6 stale-CRLF golden .dialogue working copies from the pre-attribute checkout were likewise re-checked out (blobs untouched, byte-identical).
- **Files modified:** .gitattributes
- **Verification:** entity-templates 14/14, canvas-templates 9/9, schema 15/15, engine spot-check 25/25, full suite 244/244 — all green; `git diff --stat tests/golden` empty
- **Committed in:** 84028ab (Task 2)

**3. [Rule 1 - Bug] schema.test.js acceptance grep would fail on describe labels and comments**
- **Found during:** Task 3 (path re-pointing)
- **Issue:** The acceptance criterion greps for zero occurrences of `shared/schema/` across the three test files; schema.test.js's 4 describe() labels ('shared/schema/character.js — Character entity'), header comment line (FND-03) and validation comment still contained that substring. Plan text said "only paths" but the criterion is authoritative.
- **Fix:** Updated the 4 describe labels, header comments, and the FND-03 comment to engine/schema/ paths. No assertion bodies or expectations changed.
- **Files modified:** tests/schema.test.js
- **Verification:** zero-match grep returns exit 1 (no matches); schema tests 15/15 pass
- **Committed in:** 59c622a (Task 3)

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3)
**Impact on plan:** All auto-fixes were necessary to meet the plan's own acceptance criteria in the actual committed state. No scope creep; no architectural changes.

## Issues Encountered
- 05-CONTEXT.md referenced by the plan does not exist in the worktree (not in git history) — D-02/D-03 decision content is inline in the plan, so execution was unaffected.
- entity-templates.test.js has 14 require sites, not the 12 the plan estimated — the whole-file sweep handled all occurrences regardless.
- The Task 1 import edit was initially left unstaged (git commit captured only the rename); caught via `git show HEAD` verification and committed separately as 2c4a8b7.
- `git checkout HEAD -- <file>` alone does not re-apply changed eol attributes to an existing working tree (files stayed CRLF); the rm --cached + checkout sequence was required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- flow/ layer (4 modules) and engine/schema/ (4 schemas) in place per D-03; shared/ gone
- BUG-01 closed: Quest template, golden fixture, and tests verified green at their new locations
- Test suite fully green (244/244) with fixture line endings pinned — ready for Plans 05-03 (canvas template wiring), 05-04 (main.js merge), 05-05

## Self-Check: PASSED

- SUMMARY.md exists at .planning/phases/05-plugin-merge-bug-fixes/05-02-SUMMARY.md
- plugins/narrative-tool/src/flow/entity-templates.js exists (with createQuestMd exported)
- plugins/narrative-tool/src/engine/schema/quest.js exists
- tests/fixtures/expected-quest.md exists (matches HEAD blob)
- shared/ removed from disk and repo
- Commits verified in git log: 2c0a62e, 2c4a8b7, 84028ab, 59c622a
- Full test suite: 244/244 pass

---
*Phase: 05-plugin-merge-bug-fixes*
*Completed: 2026-08-06*

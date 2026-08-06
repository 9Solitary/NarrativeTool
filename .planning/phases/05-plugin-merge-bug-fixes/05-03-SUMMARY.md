---
phase: 05-plugin-merge-bug-fixes
plan: 03
subsystem: plugin-merge
tags: [git-mv, export-path, node-fs, vault-api, ui-layer, bug-fixes, dedup]
requires:
  - phase: 05-01
    provides: engine/ layer (export-engine, gd-format, med-format, constants) inside narrative-tool; consumers re-pointed
  - phase: 04-02
    provides: narrative-project batch-export + status-bar modules (moved here)
  - phase: 04-03
    provides: narrative-project auto-export + reference-validator modules (moved here)
provides:
  - plugins/narrative-tool/src/commands/ populated: batch-export, auto-export, reference-validator (git mv), export-current (deduped), paths (shared write module)
  - plugins/narrative-tool/src/ui/ populated: modals (deduped), notify, nc-bridge, settings (NarrativeToolSettingTab), status-bar (narrative-tool-status)
  - BUG-02 closed: batch export writes into configured Export Path (flat <exportPath>/<basename>.dialogue), absolute paths via node fs
  - BUG-03 closed: auto export writes into configured Export Path instead of alongside source
affects: 05-04 (merged main.js consumes commands/ui layers), 05-05 (esbuild bundle), Phase 8 (Chinese string sweep)
tech-stack:
  added: []
  patterns:
    - "Shared path decision module: paths.js is the single absolute→fs / vault-relative→vault API / empty→alongside-source decision point used by batch-export, auto-export, and export-current (kills the 3-copy duplication behind B1/B2)"
    - "Flat basename output layout: every export lands at <exportPath>/<basename>.dialogue; batch-export disambiguates collisions by prefixing the parent dir name"
key-files:
  created:
    - plugins/narrative-tool/src/commands/paths.js
    - plugins/narrative-tool/src/commands/export-current.js
    - plugins/narrative-tool/src/ui/modals.js
    - plugins/narrative-tool/src/ui/notify.js
    - plugins/narrative-tool/src/ui/nc-bridge.js
    - tests/paths.test.js
  modified:
    - plugins/narrative-tool/src/commands/batch-export.js (moved + BUG-02 fix)
    - plugins/narrative-tool/src/commands/auto-export.js (moved + BUG-03 fix)
    - plugins/narrative-tool/src/commands/reference-validator.js (moved, content unchanged)
    - plugins/narrative-tool/src/ui/settings.js (moved + class rename)
    - plugins/narrative-tool/src/ui/status-bar.js (moved + CSS class rename)
    - plugins/narrative-project/src/main.js (requires re-pointed — Rule 3)
    - tests/mocks/obsidian.js (Modal/SuggestModal/Notice stubs — Rule 3)
    - tests/batch-export.test.js, tests/auto-export.test.js, tests/reference-validator.test.js, tests/settings.test.js, tests/status-bar.test.js (imports + assertions re-pointed)
key-decisions:
  - "Flat basename output (<exportPath>/<basename>.dialogue) per plan's repeated spec — replaces structure-mirroring layout in batch/auto export"
  - "Duplicate-basename prefix rule implemented as '<parentDirName>-<basename>' (flat prefix) — plan specified the rule but not the separator"
  - "FolderSuggestModal created in ui/modals.js per artifact contract but NOT imported into ui/settings.js — the plan assumed a local FolderSuggestModal in settings.js that never existed; an unused import would be dead code (audit W5)"
  - "narrative-project/src/main.js kept alive via require re-points (Rule 3) until Plan 05-04 rewrites it as the merged plugin entry"
requirements-completed: [ENG-01, BUG-02, BUG-03]

# Metrics
duration: 8min
completed: 2026-08-06
---

# Phase 05 Plan 03: Command/UI Layers + Shared Export-Path Module Summary

**Shared paths.js export-path decision module (absolute→fs, vault-relative→vault API, empty→alongside source) wired into batch-export/auto-export/export-current, commands/ + ui/ layers populated via git mv with deduped modals, notify wrapper, and nc-bridge — closing BUG-02 and BUG-03 with 67 tests green across the 6 touched test files**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-06T21:22:00Z
- **Completed:** 2026-08-06T21:30:53Z
- **Tasks:** 3
- **Files modified:** 15 (5 moved via git mv, 10 created/edited)

## Accomplishments

- `plugins/narrative-tool/src/commands/paths.js` — the single shared export-path decision + write module (zero obsidian imports; pure node:fs/node:path): `isAbsoluteExportPath` (path.isAbsolute || /^[A-Z]:[/\\]/i, drive-relative 'D:foo' deliberately NOT absolute) and `writeDialogueFile` (empty → alongside source via vault API; absolute → fs.mkdirSync recursive + writeFileSync; vault-relative → vault API with per-segment folder creation). Replaces the 3 divergent copies that caused the v0.1 B1/B2 bugs
- BUG-02 fixed: batch-export now writes flat `<exportPath>/<basename>.dialogue` through `writeDialogueFile` (was: output ignored the configured Export Path semantics); duplicate-basename prefix rule implemented ('Sub-child.dialogue' on collision)
- BUG-03 fixed: auto-export `exportSingleFile` writes through `writeDialogueFile` (was: wrote alongside source, ignoring exportPath)
- `commands/export-current.js` — deduped single-file export merging the two divergent implementations (Phase 2 plugin + narrative-project inline command): status-bar feedback, .ncanvas picker via FileSuggesterModal when active file isn't .ncanvas, all user messages via notify (D-14)
- `ui/` layer: modals.js (canonical FileSuggesterModal/StringSuggesterModal/promptForInput verbatim from flow-tools + FolderSuggestModal; old NcanvasFileSuggester NOT recreated — T-05-07), notify.js (D-14), nc-bridge.js (optional-chained read-only bridge, D-12/D-13, never assigns window.NarrativeCanvasHost — T-05-08), settings.js (NarrativeProjectSettingTab → NarrativeToolSettingTab), status-bar.js (CSS class → narrative-tool-status)
- `tests/paths.test.js` proves all four behaviors: absolute (fs, file ON DISK with content readback), vault-relative (folder creation incl. nested), empty→alongside-source, and Windows drive-path detection; batch/auto tests assert flat `<exportPath>/<basename>.dialogue` output

## Task Commits

Each task was committed atomically:

1. **Task 1: commands/ layer + paths.js + BUG-02/BUG-03 + export-current dedupe** - `e750cf9` (feat)
2. **Task 2: ui/ layer (modals dedup, notify, nc-bridge, renames)** - `c0cd939` (feat)
3. **Task 3: re-point test imports + paths.test.js** - `73c35d3` (test)

**Rule fixes (separate commits):** `b365b98` (fix: main.js require depth), `89cd4d9` (fix: trailing-slash exportPath)

## Files Created/Modified

- `plugins/narrative-tool/src/commands/paths.js` - Created: shared export-path decision + write module (isAbsoluteExportPath, writeDialogueFile)
- `plugins/narrative-tool/src/commands/batch-export.js` - Moved from narrative-project/src via git mv; engine require → ../engine/export-engine; output → writeDialogueFile with flat outBasename + duplicate-prefix rule (BUG-02)
- `plugins/narrative-tool/src/commands/auto-export.js` - Moved; exportSingleFile → writeDialogueFile (BUG-03); dead local path helpers removed (now in paths.js)
- `plugins/narrative-tool/src/commands/reference-validator.js` - Moved, zero content change
- `plugins/narrative-tool/src/commands/export-current.js` - Created: deduped exportCurrentDialogue(plugin) with status-bar feedback + FileSuggesterModal picker
- `plugins/narrative-tool/src/ui/modals.js` - Created: FileSuggesterModal/StringSuggesterModal/promptForInput (verbatim) + FolderSuggestModal
- `plugins/narrative-tool/src/ui/notify.js` - Created: notify(message, type) Notice wrapper (D-14)
- `plugins/narrative-tool/src/ui/nc-bridge.js` - Created: optional-chained read-only NC bridge (D-12/D-13)
- `plugins/narrative-tool/src/ui/settings.js` - Moved; NarrativeProjectSettingTab → NarrativeToolSettingTab; DEFAULT_SETTINGS unchanged
- `plugins/narrative-tool/src/ui/status-bar.js` - Moved; 'narrative-project-status' → 'narrative-tool-status'
- `plugins/narrative-project/src/main.js` - Requires re-pointed to ../../narrative-tool/src/{ui,commands} (Rule 3; rewritten by Plan 05-04)
- `tests/mocks/obsidian.js` - Added Modal/SuggestModal/Notice stubs (Rule 3)
- `tests/paths.test.js` - Created: 13 tests covering groups A-E
- `tests/batch-export.test.js` - Import re-pointed; flat output assertions; new duplicate-prefix rule test
- `tests/auto-export.test.js` - Imports re-pointed; asserts path === 'Exports/test.dialogue'
- `tests/reference-validator.test.js` - Import re-pointed only
- `tests/settings.test.js` - Imports re-pointed to ui/settings; class assertions → NarrativeToolSettingTab
- `tests/status-bar.test.js` - Import re-pointed to ui/status-bar; CSS class assertion → narrative-tool-status

## Decisions Made

- **Flat basename output:** plan specifies `<exportPath>/<basename>.dialogue` in five places (Task 1 Steps 3-4, Task 3 items 1-2, verification section) — batch/auto export no longer mirror source subdirectories. Existing structure-mirroring test updated accordingly.
- **Duplicate-prefix format:** plan says "prefix parent dir name" without a separator; implemented as `<parentDirName>-<basename>.dialogue` (flat prefix, keeps outFilename a plain basename so writeDialogueFile always writes at `<dir>/<basename>`).
- **FolderSuggestModal not imported into settings.js:** plan's Step 5 assumed a local FolderSuggestModal class in settings.js (lines 17-33) that does not exist in any commit of this repo. The class is exported from ui/modals.js per the artifact contract (05-04 may consume it), but settings.js has no folder-picker UI today — importing unused would be dead code (audit W5).
- **Old plugin entry kept alive:** narrative-project/src/main.js re-pointed to the merged modules (same Rule 3 pattern as 05-01's b28bf2e) so tests/settings.test.js Tests 5-7 keep passing until 05-04 replaces main.js.
- **No new dependencies:** paths.js uses only node:fs/node:path; esbuild install deferred to 05-05 per threat register T-05-SC.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's "current state" line references describe code that never existed**
- **Found during:** Task 1 (read_first review)
- **Issue:** The plan cites dialogue-export/src/main.js exportDir logic (lines 57-156), NcanvasFileSuggester (lines 16-32), batch-export writing `outBasename` at vault root (lines 125-139), a "legacy-format upgrade block", and a FolderSuggestModal in settings.js (lines 17-33). `git log -S` across all commits confirms none of these ever existed — the plan's line references were written from the v0.1 audit's root-cause description (REQUIREMENTS-NEXT.md §6: "batch-export 写入 file.basename + '.dialogue'（vault 根目录）") rather than the actual code (which already computed `${outDir}/${dialogueRelPath}`).
- **Fix:** Executed against the plan's must_haves/acceptance-criteria/verification contract instead of the fictional line references: created the shared paths.js module, flat `<exportPath>/<basename>.dialogue` output in both exporters via writeDialogueFile, outBasename + duplicate-prefix rule per Step 3's explicit wording, export-current deduped, FolderSuggestModal created fresh in modals.js.
- **Files modified:** paths.js, batch-export.js, auto-export.js, export-current.js, modals.js (effectively the whole plan)
- **Verification:** All acceptance grep gates pass; 67/67 tests green on the 6 touched files
- **Committed in:** e750cf9, c0cd939 (part of task commits)

**2. [Rule 3 - Blocking] narrative-project/src/main.js broke when its 5 modules moved**
- **Found during:** Task 1 (post-move smoke load)
- **Issue:** main.js requires ./settings, ./status-bar, ./batch-export, ./auto-export, ./reference-validator — all moved out; tests/settings.test.js (Tests 5-7) loads main.js and crashed with MODULE_NOT_FOUND.
- **Fix:** Re-pointed requires to ../../narrative-tool/src/{ui,commands}/... and NarrativeProjectSettingTab → NarrativeToolSettingTab in main.js. Initial fix used wrong depth ('../narrative-tool' → resolved to narrative-project/narrative-tool); corrected to '../../narrative-tool' after Task 3's first verify run failed.
- **Files modified:** plugins/narrative-project/src/main.js
- **Verification:** settings.test.js passes (14 assertions on NarrativeToolSettingTab); full suite green
- **Committed in:** e750cf9 (part of Task 1) + b365b98 (depth correction)

**3. [Rule 3 - Blocking] tests/mocks/obsidian.js lacks Modal/SuggestModal/Notice**
- **Found during:** Task 2 (verify smoke-load)
- **Issue:** ui/modals.js extends SuggestModal and uses Modal; ui/notify.js needs Notice; export-current.js transitively requires both. The mock exported only Plugin/PluginSettingTab/Setting → TypeError at class definition.
- **Fix:** Added minimal Modal, SuggestModal, Notice stubs to tests/mocks/obsidian.js (chainable classList on noticeEl, titleEl/contentEl for promptForInput).
- **Files modified:** tests/mocks/obsidian.js
- **Verification:** Task 2 verify command prints all 7 function types; all test files load
- **Committed in:** c0cd939 (Task 2 commit)

**4. [Rule 1 - Bug] Trailing-slash exportPath produced double-separator vault paths**
- **Found during:** Task 3 (verify run)
- **Issue:** batch test used exportPath 'Exports/'; writeDialogueFile vault-relative branch built 'Exports//Root.dialogue' → create() threw (parent folder 'Exports/' not found) → exported 0.
- **Fix:** writeDialogueFile now strips trailing [\\/]+ after trim. Absolute detection unaffected ('D:\dir\' still absolute; '/' collapses to the empty branch → alongside source).
- **Files modified:** plugins/narrative-tool/src/commands/paths.js
- **Verification:** 67/67 tests green incl. the trailing-slash test
- **Committed in:** 89cd4d9

### Documented Interpretations (not auto-fixes)

- **"narrative-project/src" grep gate:** acceptance requires zero matches across the 6 test files; 5 remaining matches are `require('../plugins/narrative-project/src/main')` in settings.test.js — the plugin ENTRY module, which is not one of the 5 moved modules and still legitimately lives there until 05-04. The gate is satisfied for every moved module.
- **Golden working-tree normalization:** all 9 tests/golden/*.dialogue materialized as CRLF in the fresh worktree despite the .gitattributes LF pin (core.autocrlf=true wins — same environment issue 05-01 documented). Normalized to LF with sed; each file verified blob-identical to HEAD (`git hash-object` == `git rev-parse HEAD:path`); the resulting git-status M is the phantom autocrlf artifact, NOT committed.

---

**Total deviations:** 4 auto-fixed (2 blocking requires/loads, 1 missing mock surface, 1 path bug) + 2 documented interpretations
**Impact on plan:** All auto-fixes were required to keep the plan's own verification commands green. No scope creep — no new features, no package installs.

## Issues Encountered

- **Pre-existing golden CRLF artifact:** 6 golden .dialogue comparisons failed before any of my changes (working-tree CRLF vs engine LF output). Resolved via working-tree LF normalization (blob-identical, not committed). Same root cause and handling as 05-01's deviation #2.
- **Pre-existing entity-templates CRLF failures (4 tests, out of scope):** Character/Location/Quest/Item golden .md comparisons still fail on the 05-02-assigned test file — explicitly deferred to Plan 05-02 (per 05-01 SUMMARY); not touched per scope boundary. Full suite: 258 tests, 254 pass, 4 fail (all 4 pre-existing).
- **05-CONTEXT.md absent:** plan references it for D-12/13/14 context; the plan's task text fully specifies all three decisions, so execution was unaffected (same situation 05-01 documented).

## Known Stubs

None. nc-bridge.js has zero callers by design (D-13 future-proofing, documented in the plan), and FolderSuggestModal is exported but unused until 05-04 — both intentional, not stubs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-04 can import the merged layers exactly as its plan specifies: `./ui/settings` (DEFAULT_SETTINGS + NarrativeToolSettingTab), `./ui/status-bar` (StatusBarManager), `./ui/notify` (notify), `./ui/modals` (FileSuggesterModal/StringSuggesterModal/promptForInput + FolderSuggestModal available), `./commands/batch-export` (exportAllDialogues), `./commands/auto-export` (setupAutoExport/teardownAutoExport), `./commands/reference-validator` (validateReferences), `./commands/export-current` (exportCurrentDialogue(plugin))
- All interfaces verified compatible with 05-04's interface list (grep cross-checked during execution)
- 05-04's migration reads legacy data.json — the paths.js write module is ready for the merged settings wiring

---
*Phase: 05-plugin-merge-bug-fixes*
*Completed: 2026-08-06*

## Self-Check: PASSED

- All 11 plan output files verified present (5 commands/, 5 ui/, tests/paths.test.js) + SUMMARY.md
- All 5 commits verified in `git log`: e750cf9, c0cd939, 73c35d3, b365b98, 89cd4d9
- 6 touched test files: 67/67 pass; full suite 258 tests, 254 pass, 4 fail (all 4 pre-existing entity-templates CRLF, deferred to 05-02)
- No golden .dialogue file committed as modified (working-tree LF normalization only; blob-identical to HEAD)

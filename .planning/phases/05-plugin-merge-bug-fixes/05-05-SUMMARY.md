---
phase: 05-plugin-merge-bug-fixes
plan: 05
subsystem: plugin-merge
tags: [cleanup, build, verification, release-gate]
dependency_graph:
  requires: [05-04]
  provides: [ENG-01 final gate]
  affects: []
tech-stack:
  added: [esbuild@0.28.1 (devDependency, pinned in package-lock.json)]
  patterns: []
key-files:
  created:
    - plugins/narrative-tool/package-lock.json
    - plugins/narrative-tool/main.js (gitignored build artifact)
  modified:
    - plugins/narrative-tool/src/main.js
    - tests/settings.test.js
  deleted:
    - plugins/dialogue-export/ (whole dir)
    - plugins/narrative-project/ (whole dir)
    - plugins/flow-tools/ (whole dir)
decisions:
  - "Golden files on Windows checkout as CRLF; strip CRs + git add to refresh stat (blobs stay LF — zero content churn)"
  - "tests/settings.test.js migrated from deleted narrative-project/src/main to merged narrative-tool/src/main"
metrics:
  duration: 18 min
  completed_date: 2026-08-06
---

# Phase 5 Plan 5: Legacy Plugin Cleanup + Release Verification Summary

Final ENG-01 gate: deleted all three legacy plugin directories, built the merged plugin as a single bundle, and verified the full release contract (266/266 tests green, goldens byte-identical, 10 command IDs in bundle).

## Completed Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Delete three legacy plugin directories | f9c1255 | plugins/dialogue-export/, plugins/narrative-project/, plugins/flow-tools/ (deleted); plugins/narrative-tool/src/main.js, tests/settings.test.js |
| 2 | Install esbuild, build merged plugin, run full release verification | 1fdeb4b | plugins/narrative-tool/package-lock.json (main.js gitignored) |

## Results

- `plugins/` contains exactly `narrative-tool/` (plus pre-existing tracked `plugins/.gitkeep` from phase 01 — intentional, keeps empty dir in git)
- esbuild@0.28.1 installed — matches legacy lockfile pin (T-05-15)
- `node esbuild.config.mjs` → exit 0, main.js (48 KB) contains all 10 unique `narrative-tool:` command IDs, zero legacy id prefixes
- Full suite: **266/266 pass, fail 0** (was 266/266 green at phase start — count preserved)
- `git status --porcelain tests/golden`: empty before and after — identical, goldens byte-identical
- Engine purity guard: 8/8 pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `saveSettings()` missing from merged NarrativeToolPlugin**
- **Found during:** Task 1 (after legacy deletion exposed it)
- **Issue:** `plugins/narrative-tool/src/ui/settings.js` calls `this.plugin.saveSettings()` at 3 call sites, but the merged main.js class never defined it — the settings tab would crash on save. Was masked by legacy dir presence; tests/settings.test.js still required the deleted `narrative-project/src/main` path (Pitfall 6.5 stale import).
- **Fix:** Restored `async saveSettings() { await this.saveData(this.settings); }` (faithful to legacy implementation); migrated 5 stale requires in tests/settings.test.js to `../plugins/narrative-tool/src/main` and renamed describe block to NarrativeToolPlugin; added `.css` require hook to settings.test.js (mirrors merge-smoke.test.js, needed since main.js does `require('./styles.css')`).
- **Files modified:** plugins/narrative-tool/src/main.js, tests/settings.test.js
- **Commit:** f9c1255

**2. [Rule 1 - Bug] Golden files on disk with CRLF line endings**
- **Found during:** Task 2 full-suite run (17 failures, all golden comparisons)
- **Issue:** Windows checkout wrote CRLF into tests/golden/*.dialogue and tests/fixtures/*.md despite .gitattributes LF pin; export output is LF, so comparisons failed. Known prior-wave pattern; blobs are LF — disk-only issue.
- **Fix:** `sed -i 's/\r$//'` on golden/fixture files + `git add` to refresh stat. Zero content churn (no staged diff).
- **Commit:** none (stat refresh only, folded into 1fdeb4b verification)

**3. [Note] plugins/ verify expectation**
- Plan's verify expected readdirSync to return exactly `['narrative-tool']`; actual is `['.gitkeep', 'narrative-tool']`. `.gitkeep` is tracked since phase 01 (commit 0186230) and intentionally keeps the plugins dir in git — not a plan violation.

## Threat Model Compliance

- T-05-13 (legacy dir deletion): tracked via `git rm -r` (20 files), untracked via `rm -rf`; post-check readdirSync + `git ls-files` = 0 remaining
- T-05-14 (stale test imports): grep sweep for `require(.*dialogue-export|narrative-project|flow-tools` in tests/ + plugins/narrative-tool/src → 0 matches after migrating settings.test.js
- T-05-15 / T-05-SC (esbuild install): esbuild@0.28.1 aligned with legacy pin; only devDependency installed

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary surface introduced.

## Self-Check: PASSED

- plugins/narrative-tool/package-lock.json exists
- plugins/narrative-tool/main.js exists (48 KB, non-empty)
- commits f9c1255, 1fdeb4b exist
- 266/266 tests pass; engine-purity 8/8; golden status identical pre/post

---
phase: 04-narrative-project
verified: 2026-08-07T05:05:00Z
status: verified
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  note: "Verified against the current v1.0 codebase (post Phase 5 merge, Phase 6 graph-analysis, Phase 8 UI localization). v0.1 audit gaps B1/B2 (exportPath ignored) were fixed in Phase 5 via commands/paths.js and are re-verified here."
gaps: []
human_verification:
  - test: "Open Obsidian Settings → Narrative Tool; inspect the settings tab; click 浏览… next to 导出路径"
    expected: "Three controls render: 导出路径 (text + 浏览… button), MED 扩展语法 (toggle), 导出范围目录 (text). 浏览… opens the Electron native folder picker; picking a folder fills the absolute path (forward slashes) and persists it"
    why_human: "PluginSettingTab rendering and Electron's dialog.showOpenDialog only exist inside the Obsidian desktop runtime; unit tests cover class shape and persistence delegation, not the live UI"
    uat_result: "PASSED 2026-08-07"
  - test: "Set Export Path to a vault-relative folder (Exports), then to an absolute path (D:/Godot/dialogues); run 'Batch Export All Dialogues' each time"
    expected: "All in-scope .ncanvas files export to .dialogue inside the configured path (vault API for relative, node fs for absolute); status bar shows live count/total progress; failures surface the first concrete file+message in the notice"
    why_human: "Real vault adapter + node fs writes against live settings; unit tests use MockVault/tmp dirs"
    uat_result: "PASSED 2026-08-07"
  - test: "Edit and save a .ncanvas file twice in quick succession; watch the status bar"
    expected: "A single .dialogue re-export fires ~2s after the last save (debounce dedups rapid saves); status bar shows ✓ success then auto-reverts to 叙事工具链 (pending) after 5s"
    why_human: "Real vault 'modify' events + real timers only fire in the live app; tests override setTimeout to capture the debounce callback"
    uat_result: "PASSED 2026-08-07"
  - test: "Observe the status bar across an export cycle (idle → batch export → result)"
    expected: "Four visual states: muted 叙事工具链 (pending), spinner 导出中 n/m (exporting), green ✓ (success), red ✗ (failure); nt-status-* CSS classes applied, no content accumulation"
    why_human: "CSS rendering (spinner @keyframes, colors) is Obsidian runtime DOM behavior"
    uat_result: "PASSED 2026-08-07"
  - test: "Delete a .ncanvas file referenced by a Flow .canvas, then run 'Validate Flow→Dialogue references'"
    expected: "Status bar shows red '✗ N 个引用失效'; error notice shown; console.warn logs details (canvasPath, nodeId, referencedFile, reason)"
    why_human: "Notice rendering + console output in a live vault are runtime behaviors"
    uat_result: "PASSED 2026-08-07"
  - test: "Upgrade scenario: with a legacy narrative-project data.json present and no narrative-tool data.json, load the plugin once"
    expected: "exportPath/medEnabled/exportScope migrate from the legacy data.json; '已迁移旧插件设置' notice shown; a second load does not re-run migration over user edits"
    why_human: "Real .obsidian/plugins data.json reads only occur in a real vault; merge-smoke test proves the logic against a mocked adapter"
    uat_result: "PASSED 2026-08-07"
---

# Phase 4: Narrative Project Verification Report

**Phase Goal:** Narrative designers can configure project-wide export settings, batch-export all dialogues, auto-export on save, and validate Flow→Dialogue references.
**Verified:** 2026-08-07T05:05:00Z
**Status:** verified (6/6 truths VERIFIED; Obsidian-runtime behaviors passed human UAT on 2026-08-07)
**Re-verification:** No — initial verification. Note: the verified object is the **current v1.0 codebase** (`plugins/narrative-tool/src/`), into which the v0.1 `plugins/narrative-project` code was merged in Phase 5. v0.1 audit BLOCKERs B1/B2 (batch/auto export ignoring Export Path) were fixed in Phase 5 via the shared `commands/paths.js` module and are re-verified below. Phase 8 later added per-file progress, error detail surfacing, a settings browse button, and full Chinese UI text — this report verifies current behavior and records the evolution.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PRJ-01 settings UI: frozen DEFAULT_SETTINGS with exactly 3 keys (exportPath `'Exports'`, medEnabled `true`, exportScope `'/'`), a settings tab with 3 controls (+ Phase 8 浏览… native folder picker), persistence via saveSettings→saveData, and D-06 legacy data.json migration on first load | ✓ VERIFIED | ui/settings.js:22-31 DEFAULT_SETTINGS (Object.freeze); NarrativeToolSettingTab (settings.js:68) with 3 Setting controls (80-132) + pickExportDirectory browse button (42-62, 93-109); main.js:95 addSettingTab; D-06 migration main.js:71-92 (legacy ids narrative-project/dialogue-export/flow-tools, own-data.json guard, migrated-only notify); tests/settings.test.js (22 tests) + merge-smoke D-06 tests green |
| 2 | PRJ-02 batch export: exportAllDialogues exports all in-scope .ncanvas → .dialogue **into the configured exportPath** (B1 fixed), filters by exportScope, soft-fails per file with an errors[] detail list, disambiguates basename collisions (CR-01), reports per-file progress (Phase 8 onProgress) | ✓ VERIFIED | commands/batch-export.js:44 exportAllDialogues; writeDialogueFile call at line 124 (honors exportPath — fixes B1); scope filter 46-72; errors list 76/95/129 returned at 135; CR-01 collision prefix 110-121; onProgress 82-84; command `narrative-tool:batch-export-all-dialogues` main.js:161 → batchExportAllDialogues (248) wiring progress→status bar (258) and first-error detail (263-268); tests/batch-export.test.js (12 tests) green |
| 3 | PRJ-03 auto export: vault.on('modify') listener batches rapid .ncanvas saves through a 2-second debounce with Set dedup, exports each via exportSingleFile **into the configured exportPath** (B2 fixed), soft-fails on parse/engine errors, teardown clears timer+queue | ✓ VERIFIED | commands/auto-export.js: exportSingleFile (39) writes via writeDialogueFile (59-65 — fixes B2); setupAutoExport (85) registers vault.on('modify') (90), Set dedup (95), 2000ms debounce (102-120); teardownAutoExport (138); main.js:101-117 wires onExported→status bar with 5s revert; teardown in onunload (main.js:133); tests/auto-export.test.js (7 tests) green |
| 4 | Shared path decision module: writeDialogueFile implements exactly three write branches — empty exportPath → alongside source (vault API), absolute → node fs (mkdirSync recursive + writeFileSync), vault-relative → vault API with folder creation — incl. Windows drive-letter detection; zero obsidian imports | ✓ VERIFIED | commands/paths.js: isAbsoluteExportPath (33, POSIX + `D:/` + `D:\` forms; drive-relative `D:foo` documented non-absolute); writeDialogueFile (71): empty→alongside-source (80-91), absolute→fs (94-101), vault-relative→ensureDirectory+create/modify (104-112); `grep "require('obsidian')" paths.js` = no match; tests/paths.test.js (14 tests incl. Windows variants) green |
| 5 | PRJ-04 status bar: StatusBarManager renders four states (pending/exporting/success/failure), consecutive setState calls replace content, destroy removes the element, and all success/failure states auto-revert to pending after 5s | ✓ VERIFIED | ui/status-bar.js: StatusBarManager (8), addStatusBarItem + narrative-tool-status class (11-12), setState 4-state switch (27-78, Chinese text: 叙事工具链 / 导出中 n/m / ✓ 已导出 / ✗); main.js:98 construction; 5s auto-revert timers main.js:108-110 (auto export), 275 (batch), 298 (validation); styles.css .narrative-tool-status + .nt-status-* rules (107-136); tests/status-bar.test.js (9 tests) green |
| 6 | PRJ-05 reference validation: validateReferences scans all .canvas files, checks every file-node .ncanvas reference for vault existence, reports broken refs with {canvasPath, nodeId, referencedFile, reason}, survives invalid canvas JSON; command wired with status bar + notice + console output | ✓ VERIFIED | commands/reference-validator.js:34 validateReferences; .ncanvas file-node filter (63-65); existence check (70-78); JSON-error detail + continue (48-58); command `narrative-tool:validate-references` main.js:168 → runReferenceValidation (290) with success/failure status bar, notify, console.warn (293-307); tests/reference-validator.test.js (7 tests) green |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `plugins/narrative-tool/src/ui/settings.js` (140 lines) | PRJ-01 settings tab | ✓ VERIFIED | DEFAULT_SETTINGS (frozen, 3 keys), NarrativeToolSettingTab, pickExportDirectory; Chinese UI text (Phase 8) |
| `plugins/narrative-tool/src/commands/paths.js` (115 lines) | Shared write-decision module (B1/B2 fix) | ✓ VERIFIED | isAbsoluteExportPath + writeDialogueFile, 3 branches, obsidian-free |
| `plugins/narrative-tool/src/commands/batch-export.js` (142 lines) | PRJ-02 batch export | ✓ VERIFIED | exportAllDialogues with onProgress + errors[] (Phase 8), CR-01 collision handling |
| `plugins/narrative-tool/src/commands/auto-export.js` (152 lines) | PRJ-03 debounced auto export | ✓ VERIFIED | exportSingleFile / setupAutoExport / teardownAutoExport; 2000ms debounce |
| `plugins/narrative-tool/src/ui/status-bar.js` (88 lines) | PRJ-04 status bar | ✓ VERIFIED | StatusBarManager, 4 states, Chinese text |
| `plugins/narrative-tool/src/commands/reference-validator.js` (102 lines) | PRJ-05 reference validation | ✓ VERIFIED | validateReferences, Flow→Dialogue direction only (documented scope) |
| `plugins/narrative-tool/src/main.js` (897 lines) | Plugin wiring | ✓ VERIFIED | D-06 migration (71-92), addSettingTab (95), StatusBarManager (98), setupAutoExport (101), commands batch-export-all-dialogues (161) + validate-references (168), teardown in onunload (133) |
| `plugins/narrative-tool/src/styles.css` | Status bar styles | ✓ VERIFIED | .narrative-tool-status (107), .nt-status-pending/exporting/success/failure (112-136), spinner keyframes |
| `tests/{settings,status-bar,batch-export,auto-export,reference-validator,paths}.test.js` + `tests/merge-smoke.test.js` | Phase-4 test coverage | ✓ VERIFIED | 75 tests across these 7 files, all pass (subset run); full suite 310/310 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| main.js | ui/settings.js | NarrativeToolSettingTab + DEFAULT_SETTINGS | ✓ WIRED | import line 20, addSettingTab line 95, defaults merge line 69 |
| main.js | ui/status-bar.js | StatusBarManager | ✓ WIRED | import line 21, construction line 98, setState calls 105/115/252/265/270/278/291/295/300/305 |
| main.js | commands/auto-export.js | setupAutoExport / teardownAutoExport | ✓ WIRED | import line 25, setup line 101, teardown line 133 |
| main.js | commands/reference-validator.js | validateReferences | ✓ WIRED | import line 26, call line 293 |
| main.js | commands/batch-export.js | exportAllDialogues | ✓ WIRED | call line 255 with settings + onProgress callback (258) |
| batch-export.js | commands/paths.js | writeDialogueFile | ✓ WIRED | import line 15, use line 124 (B1 fix) |
| auto-export.js | commands/paths.js | writeDialogueFile | ✓ WIRED | import line 20, use line 59 (B2 fix) |
| batch-export.js / auto-export.js | engine/export-engine.js | exportEngine | ✓ WIRED | batch-export.js:14/101, auto-export.js:19/56 |
| settings.js | ui/notify.js | notify (browse-button fallback) | ✓ WIRED | import line 16, use line 102 |
| main.js onload | legacy data.json | D-06 migration via vault.adapter.read | ✓ WIRED | lines 71-92; merge-smoke tests assert migration + guard |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite green | `node --test tests/*.test.js` | 310 pass / 0 fail (86 suites) | ✓ PASS |
| Phase-4 test subset green | `node --test tests/paths.test.js tests/settings.test.js tests/status-bar.test.js tests/batch-export.test.js tests/auto-export.test.js tests/reference-validator.test.js tests/merge-smoke.test.js` | 75 pass / 0 fail (19 suites) | ✓ PASS |
| Golden/fixture regression contract | `git diff HEAD -- tests/golden tests/fixtures` + `git status --porcelain` | empty — byte-identical | ✓ PASS |
| paths.js obsidian-free | `grep "require('obsidian')" src/commands/{paths,batch-export,auto-export,reference-validator}.js src/ui/status-bar.js` | no matches (exit 1) | ✓ PASS |
| Debounce constant | source inspection auto-export.js:120 | `}, 2000); // 2-second debounce` | ✓ PASS (code-level; tests override setTimeout, see Notes) |
| Status bar CSS classes present | grep `narrative-tool-status\|nt-status-` styles.css | 6 selectors (107-136) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PRJ-01 | 04-01 | 项目配置 UI — Export Path, MED toggle, Export Scope persisted to data.json | ✓ SATISFIED | settings.js DEFAULT_SETTINGS + NarrativeToolSettingTab (T1); 22 settings tests; merge-smoke 'wires the settings tab and status bar on load'; v0.1 audit note "exportPath 被忽略 (B1/B2)" → fixed Phase 5, see BUG-02/03 rows; runtime UAT PASSED 2026-08-07 |
| PRJ-02 | 04-02 | 批量导出命令 — all in-scope .ncanvas → .dialogue | ✓ SATISFIED | batch-export.js exportAllDialogues + main.js:161/248 wiring (T2); 12 batch-export tests; **v0.1 gap B1 (output ignored exportPath) → Phase 5 fix via paths.js:124 → currently verified** ('exports all .ncanvas files under scope to exportPath', 'writes flat basename output under the export path'); Phase 8 onProgress + errors[] recorded |
| PRJ-03 | 04-03 | 自动导出（文件变更监听）— 2s debounce on save | ✓ SATISFIED | auto-export.js setupAutoExport 2000ms debounce + Set dedup (T3); 7 auto-export tests; **v0.1 gap B2 → Phase 5 fix via paths.js:59 → currently verified** ('creates .dialogue file with exportEngine output in exportPath'); runtime save→export UAT PASSED 2026-08-07 |
| PRJ-04 | 04-02 | 导出状态指示 — 4-state status bar | ✓ SATISFIED | status-bar.js StatusBarManager 4 states (T5); 9 status-bar tests; 5s auto-revert wired in main.js (108-110/275/298) — runtime UAT PASSED 2026-08-07 |
| PRJ-05 | 04-03 | 跨文件引用验证 — Flow→Dialogue broken-link detection | ✓ SATISFIED | reference-validator.js validateReferences (T6); 7 reference-validator tests incl. broken-ref details + invalid-JSON resilience; command `narrative-tool:validate-references` (main.js:168); runtime UAT PASSED 2026-08-07 |
| BUG-02 (B1) | 05-03 | Batch export ignores Export Path | ✓ SATISFIED (fixed Phase 5) | writeDialogueFile in batch-export.js:124; paths.test.js + batch-export.test.js cover all branches |
| BUG-03 (B2) | 05-03 | Auto export ignores Export Path | ✓ SATISFIED (fixed Phase 5) | writeDialogueFile in auto-export.js:59; auto-export.test.js 'creates .dialogue file with exportEngine output in exportPath' |
| D-06 | 05-01 | Settings migration from legacy plugin data.json | ✓ SATISFIED | main.js:71-92; merge-smoke 'migrates legacy plugin settings on first load and notifies (D-06)' + 'skips migration when the plugin own data.json exists (D-06 guard)' |

No orphaned requirements: all 5 Phase-4-mapped requirements (PRJ-01..05) are claimed by plans 04-01..04-03 and verified above against the current merged codebase.

### Notes / Observations

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| tests/auto-export.test.js | 269 | Stale comment: "Test 5: 500ms debounce batches…" — implementation uses 2000ms (auto-export.js:120), matching ROADMAP SC #3 | ℹ️ Info | Comment only; no behavior impact. Recommend a one-word comment fix |
| tests/auto-export.test.js | 283-288 | Debounce timing (2000ms) is not asserted by any test — setTimeout is overridden to capture the callback; the constant is verified by source inspection + human UAT | ℹ️ Info | Acceptable: batching/dedup logic is fully tested; the literal delay is a one-line constant |
| tests/batch-export.test.js | — | No direct unit test invokes the onProgress callback (Phase 8 UX-03); status-bar count/total display IS tested (status-bar.test.js), and main.js:258 wiring passed runtime UAT | ℹ️ Info | Minor coverage gap on the progress-callback contract |
| main.js 5s auto-revert timers | 108-110, 275, 298 | Not unit-tested (timers inside plugin methods); verified by human UAT 2026-08-07 | ℹ️ Info | Runtime-verified |

### Human Verification Required

All Obsidian-runtime behaviors passed human UAT on **2026-08-07** (see frontmatter for full test/expected/why_human entries):

1. **Settings tab rendering** — 3 controls + 浏览… native folder picker in Obsidian Settings
2. **Batch export to configured path** — vault-relative and absolute, live progress count, error detail in notice
3. **Auto export on save** — ~2s debounce, single re-export after rapid saves, status bar success→pending
4. **Status bar visuals** — 4 states with spinner animation and colors, no content accumulation
5. **Validate references command** — broken refs surfaced via red status bar + notice + console.warn
6. **Settings migration on upgrade** — legacy data.json migrates once; no re-run over user edits

### Gaps Summary

No gaps found. All 5 PRJ requirements verified against the current codebase (not SUMMARY claims): settings UI with frozen 3-key defaults + D-06 migration, batch export honoring exportPath (B1 fixed), auto export honoring exportPath with 2s debounce (B2 fixed), 4-state status bar with 5s auto-revert, and Flow→Dialogue reference validation with broken-link details. The two v0.1 audit BLOCKERs affecting this phase (B1/B2) trace cleanly: v0.1 gap → Phase 5 paths.js fix → currently green tests. Full suite 310/310 pass; golden files byte-identical; phase-relevant modules are obsidian-free at the commands layer (settings/status-bar legitimately import obsidian as UI modules).

Status is `verified`: 6/6 truths confirmed programmatically and all 6 runtime behaviors passed human UAT on 2026-08-07.

---

_Verified: 2026-08-07T05:05:00Z_
_Verifier: Kimi Code (subagent)_

---
phase: 04-narrative-project
validated: 2026-08-07
coverage: 53/53 behavior claims covered (45 automated, 8 human-only — all human-only items passed UAT 2026-08-07)
---

# Phase 4: Narrative Project — Nyquist Validation

Every behavior claim of PRJ-01..05 is listed with concrete test evidence. Test names are copied verbatim from the current test sources (`tests/*.test.js`). Human-only claims are Obsidian-runtime behaviors; all passed manual UAT on **2026-08-07**.

Verification target: current v1.0 codebase (`plugins/narrative-tool/src/`). v0.1 audit BLOCKERs B1/B2 (exportPath ignored by batch/auto export) were fixed in Phase 5 via `commands/paths.js`; the claims below validate the fixed behavior.

## PRJ-01: 项目配置 UI（Export Path / MED 开关 / Export Scope）

| Behavior Claim | Test Evidence (file::test) | Status |
| -------------- | -------------------------- | ------ |
| DEFAULT_SETTINGS contains exportPath, medEnabled, exportScope | tests/settings.test.js::DEFAULT_SETTINGS > contains exportPath, medEnabled, and exportScope keys | ✓ automated |
| exportPath defaults to "Exports" | tests/settings.test.js::DEFAULT_SETTINGS > exportPath defaults to "Exports" | ✓ automated |
| medEnabled defaults to true | tests/settings.test.js::DEFAULT_SETTINGS > medEnabled defaults to true | ✓ automated |
| exportScope defaults to "/" | tests/settings.test.js::DEFAULT_SETTINGS > exportScope defaults to "/" | ✓ automated |
| Exactly three keys, no extras | tests/settings.test.js::DEFAULT_SETTINGS > has exactly three keys (no extras) | ✓ automated |
| Defaults object is frozen / read-only | tests/settings.test.js::DEFAULT_SETTINGS > is a frozen/safe read-only object | ✓ automated |
| Settings tab class instantiable with display() on prototype | tests/settings.test.js::NarrativeToolSettingTab > has display method on prototype | ✓ automated |
| Saved-data merge: empty/partial/full data handled | tests/settings.test.js::Settings merge behavior > Object.assign merge with empty data returns defaults unchanged; > Object.assign merge with partial data fills missing keys from defaults; > Object.assign merge with full data overrides all defaults | ✓ automated |
| Plugin init merges saved data with defaults; settings exposed on instance | tests/settings.test.js::Plugin settings initialization > merges empty saved data with DEFAULT_SETTINGS (first load); > fills missing keys from DEFAULT_SETTINGS when saved data is partial; > exposes settings as plain object on plugin instance for cross-plugin read | ✓ automated |
| Settings persist via saveData | tests/settings.test.js::Plugin saveSettings > saveSettings delegates to this.saveData with this.settings | ✓ automated |
| Settings tab + status bar wired on plugin load | tests/merge-smoke.test.js::NarrativeToolPlugin merge smoke test (05-04) > wires the settings tab and status bar on load | ✓ automated |
| Legacy settings migration on first load (D-06), guarded against re-run | tests/merge-smoke.test.js::NarrativeToolPlugin merge smoke test (05-04) > migrates legacy plugin settings on first load and notifies (D-06); > skips migration when the plugin own data.json exists (D-06 guard) | ✓ automated |
| Settings tab renders 3 controls in Obsidian Settings; 浏览… opens native folder picker and persists the chosen path (Phase 8 UX-01) | — (Electron dialog + PluginSettingTab rendering are runtime-only; pickExportDirectory at ui/settings.js:42, button wiring 93-109) | ⚠ human-only — UAT PASSED 2026-08-07 |

## PRJ-02: 批量导出命令

| Behavior Claim | Test Evidence (file::test) | Status |
| -------------- | -------------------------- | ------ |
| Exports all in-scope .ncanvas files into the configured exportPath (B1 fixed) | tests/batch-export.test.js::exportAllDialogues > exports all .ncanvas files under scope to exportPath | ✓ automated |
| Output lands flat under the export path as `<basename>.dialogue` | tests/batch-export.test.js::exportAllDialogues > writes flat basename output under the export path | ✓ automated |
| Returns zero counts when no .ncanvas in scope | tests/batch-export.test.js::exportAllDialogues > returns { exported: 0, failed: 0 } when no .ncanvas in scope | ✓ automated |
| exportScope limits discovery to the specified directory | tests/batch-export.test.js::exportAllDialogues > exportScope limits to specified directory | ✓ automated |
| JSON parse error fails soft and export continues | tests/batch-export.test.js::exportAllDialogues > continues exporting after JSON parse error | ✓ automated |
| exportEngine exception counts as failed, does not throw | tests/batch-export.test.js::exportAllDialogues > catches exportEngine errors and counts as failed | ✓ automated |
| medEnabled=false is passed through to the engine | tests/batch-export.test.js::exportAllDialogues > passes medEnabled=false to exportEngine when disabled | ✓ automated |
| Empty exportPath writes alongside the source file | tests/batch-export.test.js::exportAllDialogues > handles empty exportPath gracefully | ✓ automated |
| Basename collisions get parent-dir prefix (CR-01), incl. alongside-source and absolute-path modes | tests/batch-export.test.js::exportAllDialogues > prefixes parent dir name when basename collides inside the export dir; > does not silently overwrite a same-basename export from another folder (CR-01); > honors the disambiguated name in alongside-source mode (empty exportPath); > detects basename collisions on the filesystem for absolute export paths | ✓ automated |
| Batch command registered as narrative-tool:batch-export-all-dialogues | tests/merge-smoke.test.js::NarrativeToolPlugin merge smoke test (05-04) > registers exactly 10 commands with the narrative-tool: prefix (D-08) | ✓ automated |
| Per-file progress count/total shown on status bar during batch export (Phase 8 UX-03, onProgress wired main.js:258) | Partial: tests/status-bar.test.js::StatusBarManager > setState(exporting) with count/total shows progress (display side); the onProgress callback contract itself has no direct unit test — batch-export.js:82-84 + main.js:258 verified at runtime | ⚠ human-only — UAT PASSED 2026-08-07 |
| First concrete failure (file + message) surfaced in notice/status bar (Phase 8 errors[] detail, main.js:263-268) | — (notify + live vault runtime) | ⚠ human-only — UAT PASSED 2026-08-07 |

## PRJ-03: 自动导出（文件变更监听，2 秒防抖）

| Behavior Claim | Test Evidence (file::test) | Status |
| -------------- | -------------------------- | ------ |
| Single-file export writes engine output into the configured exportPath (B2 fixed) | tests/auto-export.test.js::exportSingleFile > creates .dialogue file with exportEngine output in exportPath | ✓ automated |
| Invalid JSON returns success:false with parse error, never throws | tests/auto-export.test.js::exportSingleFile > returns success:false with parse error on invalid JSON | ✓ automated |
| exportEngine exception returns success:false with error message | tests/auto-export.test.js::exportSingleFile > returns success:false with error message on exportEngine throw | ✓ automated |
| vault.on('modify') listener registered, filters to .ncanvas | tests/auto-export.test.js::setupAutoExport > registers vault.on(modify) listener for .ncanvas files | ✓ automated |
| Rapid successive saves batch into one debounced export (Set dedup) | tests/auto-export.test.js::setupAutoExport > batches multiple .ncanvas changes within debounce window | ✓ automated |
| Non-.ncanvas modifications ignored | tests/auto-export.test.js::setupAutoExport > ignores non-.ncanvas file modifications | ✓ automated |
| teardown clears timer and queue; no export after unload | tests/auto-export.test.js::teardownAutoExport > clears timer and queue; subsequent modify does not trigger export | ✓ automated |
| Debounce delay is exactly 2000ms | No automated assertion (tests override setTimeout to capture the callback); constant verified at commands/auto-export.js:120 (`}, 2000); // 2-second debounce`), timing observed live | ⚠ human-only — UAT PASSED 2026-08-07 |
| Saving a .ncanvas in Obsidian re-exports ~2s later; status bar shows success then reverts to pending after 5s (main.js:101-110) | — (real vault events + real timers) | ⚠ human-only — UAT PASSED 2026-08-07 |

## PRJ-04: 导出状态指示（四状态状态栏）

| Behavior Claim | Test Evidence (file::test) | Status |
| -------------- | -------------------------- | ------ |
| Status bar element created on construction | tests/status-bar.test.js::StatusBarManager > creates a status bar DOM element on construction | ✓ automated |
| pending state shows muted idle text (叙事工具链) | tests/status-bar.test.js::StatusBarManager > setState(pending) displays pending text with muted color | ✓ automated |
| exporting state shows loading text | tests/status-bar.test.js::StatusBarManager > setState(exporting) displays 导出中... with loading state | ✓ automated |
| exporting with count/total shows live progress | tests/status-bar.test.js::StatusBarManager > setState(exporting) with count/total shows progress | ✓ automated |
| success shows green check with exported count | tests/status-bar.test.js::StatusBarManager > setState(success) displays green check with exported count | ✓ automated |
| success with failures shows both exported and failed counts | tests/status-bar.test.js::StatusBarManager > setState(success) with failures shows both exported and failed counts | ✓ automated |
| failure shows red X with error message | tests/status-bar.test.js::StatusBarManager > setState(failure) displays red X with error message | ✓ automated |
| Consecutive setState calls replace content, never accumulate | tests/status-bar.test.js::StatusBarManager > consecutive setState calls replace content, not accumulate | ✓ automated |
| destroy() removes the element | tests/status-bar.test.js::StatusBarManager > destroy() removes the status bar element | ✓ automated |
| Success/failure states auto-revert to pending after 5s (main.js:108-110, 275, 298) | — (timers inside plugin methods, not unit-tested) | ⚠ human-only — UAT PASSED 2026-08-07 |
| Visual states in live Obsidian: spinner animation, green/red colors (styles.css .nt-status-* rules, lines 107-136) | — (CSS rendering is runtime DOM behavior) | ⚠ human-only — UAT PASSED 2026-08-07 |

## PRJ-05: 跨文件引用验证（Flow→Dialogue）

| Behavior Claim | Test Evidence (file::test) | Status |
| -------------- | -------------------------- | ------ |
| Scans .canvas files and extracts file-node .ncanvas references | tests/reference-validator.test.js::validateReferences > scans .canvas files and extracts file node .ncanvas references | ✓ automated |
| brokenRefs: 0 when all references valid | tests/reference-validator.test.js::validateReferences > reports brokenRefs: 0 when all .ncanvas references are valid | ✓ automated |
| Missing .ncanvas produces broken-ref details (canvasPath, nodeId, referencedFile, reason) | tests/reference-validator.test.js::validateReferences > reports brokenRefs with details for missing .ncanvas files | ✓ automated |
| Text and group nodes ignored | tests/reference-validator.test.js::validateReferences > ignores text and group type nodes | ✓ automated |
| File nodes pointing to .md/.canvas skipped | tests/reference-validator.test.js::validateReferences > skips file nodes pointing to .md or .canvas files | ✓ automated |
| Zero counts when vault has no .canvas files | tests/reference-validator.test.js::validateReferences > returns zero counts when vault has no .canvas files | ✓ automated |
| Invalid .canvas JSON reported and processing continues | tests/reference-validator.test.js::validateReferences > handles invalid .canvas JSON and continues processing others | ✓ automated |
| Validate command registered as narrative-tool:validate-references | tests/merge-smoke.test.js::NarrativeToolPlugin merge smoke test (05-04) > registers exactly 10 commands with the narrative-tool: prefix (D-08) | ✓ automated |
| Broken refs surfaced via red status bar + error notice + console.warn details (main.js:290-307) | — (notice/console rendering in live vault) | ⚠ human-only — UAT PASSED 2026-08-07 |

## Coverage Summary

| Requirement | Claims | Automated | Human-only |
| ----------- | ------ | --------- | ---------- |
| PRJ-01 | 13 | 12 | 1 |
| PRJ-02 | 12 | 10 | 2 |
| PRJ-03 | 9 | 7 | 2 |
| PRJ-04 | 11 | 9 | 2 |
| PRJ-05 | 9 | 8 | 1 |
| **Total** | **53** | **45** | **8** |

**Coverage: 53/53 behavior claims covered.** All 8 human-only claims passed manual UAT on 2026-08-07.

## Test Suite Results (actually run)

| Run | Command | Result |
| --- | ------- | ------ |
| Full suite | `node --test tests/*.test.js` | 310 pass / 0 fail (86 suites), 2026-08-07 |
| Phase-4 subset | `node --test tests/paths.test.js tests/settings.test.js tests/status-bar.test.js tests/batch-export.test.js tests/auto-export.test.js tests/reference-validator.test.js tests/merge-smoke.test.js` | 75 pass / 0 fail (19 suites) |
| Golden regression | `git diff HEAD -- tests/golden tests/fixtures` | empty — byte-identical |

## Known Validation Gaps (non-blocking)

- The literal 2000ms debounce constant and the 5000ms auto-revert timers are not asserted by any automated test (timers are overridden in tests / live inside plugin methods). Verified by source inspection (auto-export.js:120; main.js:108-110, 275, 298) and human UAT.
- The Phase 8 `onProgress(count, total)` callback contract of `exportAllDialogues` has no direct unit test; its display side is covered by status-bar tests and its wiring passed UAT.
- Stale comment at tests/auto-export.test.js:269 says "500ms debounce" while the implementation is 2000ms — comment-only discrepancy, no behavior impact.

---

_Validated: 2026-08-07_
_Validator: Kimi Code (subagent)_

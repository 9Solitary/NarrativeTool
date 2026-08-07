---
phase: 02-dialogue-export
verified: 2026-08-07T05:05:14Z
status: verified
score: 15/15 requirements verified
overrides_applied: 0
re_verification:
  previous_status: partial (v0.1 milestone audit — verification gap, no VERIFICATION.md existed)
gaps: []
human_verification:
  - test: "In Obsidian, open a .ncanvas dialogue file and run the '导出当前对话' (Export current dialogue, command ID narrative-tool:export-current-dialogue) command"
    expected: "A .dialogue file is written whose content is byte-identical to exportEngine() output for the same JSON (Godot DM syntax: ~ start cue, Character: text lines, - option branches with tab indentation)"
    why_human: "Command execution, active-file resolution and vault file writes only occur inside the Obsidian runtime; the engine itself is fully covered by golden/unit tests. Passed human UAT 2026-08-07."
  - test: "Toggle 'MED 状态系统' (medEnabled) in plugin settings and re-export a MED-using .ncanvas (e.g. one with res_/flag_ variables)"
    expected: "With MED on, output starts with 'using S' and res_/flag_ variables render as {{res(&\"name\")}}; with MED off, no header and variables resolve to literal values"
    why_human: "The settings toggle is Obsidian-runtime UI; the engine-level behavior of both branches is covered by export-med.test.js integration tests. Passed human UAT 2026-08-07."
---

# Phase 2: Dialogue Export Verification Report

**Phase Goal:** Narrative designers can export any .ncanvas dialogue file to Godot Dialogue Manager-compatible .dialogue format with full MED state system extension support.
**Verified:** 2026-08-07T05:05:14Z
**Status:** verified (15/15 requirements verified against current v1.0 codebase; EXP-06 redefined & closed by user decision 2026-08-07 — see Gaps Summary; runtime behaviors passed human UAT 2026-08-07)
**Re-verification:** Yes — v0.1 milestone audit status was "partial (verification gap)"; this is the first formal verification, performed against the current merged codebase (`plugins/narrative-tool/src/engine/`), not the deleted v0.1 `plugins/dialogue-export/`.

## Scope Note (v0.1 → v1.0 code mapping)

The v0.1 code (`plugins/dialogue-export/src/{export-engine,gd-format,med-format}.js`, importing `shared/gd-constants.js`) was merged in Phase 5 into the single plugin and extended in Phase 6:

| v0.1 artifact | Current artifact |
| ------------- | ---------------- |
| `plugins/dialogue-export/src/export-engine.js` | `plugins/narrative-tool/src/engine/export-engine.js` (419 lines; + Phase 6 graph pre-pass) |
| `plugins/dialogue-export/src/gd-format.js` | `plugins/narrative-tool/src/engine/gd-format.js` (493 lines; + `stripSpeakerPrefix`/`pushDialogLines` per-line speaker handling, loop/merge emission) |
| `plugins/dialogue-export/src/med-format.js` | `plugins/narrative-tool/src/engine/med-format.js` (386 lines) |
| `shared/gd-constants.js` / `shared/med-constants.js` | `plugins/narrative-tool/src/engine/gd-constants.js` / `med-constants.js` (D-03 relocation) |
| — (new in Phase 6) | `plugins/narrative-tool/src/engine/graph-analysis.js` (`analyzeGraph`, line 39: Choice loop `~ cue`/`=> cue` + merge dedup) |

Export behavior has evolved since v0.1 (per-line speaker-prefix normalization, multi-line body indentation, loop/merge jumps). Verification below is against the **current goldens**, which is the authoritative contract (`tests/golden/` ↔ `tests/fixtures/` byte-equality, enforced by the suite).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A single `.ncanvas` file exports to a Godot DM-compatible `.dialogue` string: `~ start` cue, `Character: text` dialog lines, `- option` branches, tab-indented nesting (EXP-01, EXP-02, EXP-03, EXP-04) | ✓ VERIFIED | `exportEngine()` at engine/export-engine.js:179; `formatDialogLine` ("Name: body") at gd-format.js:99; `formatChoiceNode` at gd-format.js:280; goldens basic-dialogue / characters-cast-chips / nested-choices / choice-link-branches byte-match via tests/export-base.test.js `Dialogue Export - Base DM > exports <name>.ncanvas to match golden .dialogue` (10 base fixtures, auto-discovered) |
| 2 | Cue/jump mapping: Marker/Entry/Event nodes emit `~ cue`; user-drawn Choice loops and branch convergences emit `=> cue` jumps with deduplicated shared sections (EXP-05) | ✓ VERIFIED | `formatMarkerNode`/`formatEventNode` gd-format.js:421/444; cues-and-jumps golden (byte-identical to its Phase-2 version, `git show 69f2fb0:` comparison); Phase 6 `analyzeGraph` (graph-analysis.js:39) + loop-edge jump in export-engine.js:323-325 and merge jump in gd-format.js:317-322; goldens choice-loop (`=> shopkeeper_question`), choice-merge / choice-merge-marker (`=> merge_01` / `=> shared_path`); tests/graph-analysis.test.js suites `analyzeGraph — loop detection (FEAT-01)` and `analyzeGraph — merge detection (FEAT-02)` |
| 3 | BBCode markup in body text passes through verbatim into the export (EXP-07) | ✓ VERIFIED | bbcode-formatting golden contains `[b]`, `[i]`, `[color=#ff0000]`, `[shake]`, `[wait=2]`, `[next=auto]`, `[[option1\|option2\|option3]]` unmodified; test `exports bbcode-formatting.ncanvas to match golden .dialogue`; body path = `resolveVariables` then verbatim emission (gd-format.js:165-182, 232-239) |
| 4 | MED header `using S` auto-inserted when MED constructs detected (flag_/res_ vars, set_flag/add_res/subtract actions, choiceOptions requires/effects); absent otherwise (MED-01) | ✓ VERIFIED | `detectMedState` med-format.js:87; `formatMedHeader` med-format.js:65; emit at export-engine.js:260-265; export-med.test.js `MED Detection` (10 tests), `MED Header > returns using S + blank line when MED detected / returns empty array when no MED detected`, `MED Export - Integration > exportEngine with medEnabled true includes using S when MED detected / ... medEnabled false excludes using S`; med-state-basic golden line 1 `using S` |
| 5 | State mutations export as `do set_flag <key> <value>` / `do add_res <key> <value>` (subtract → negative add), flag_/res_ prefixes stripped, emitted inline under the owning choice option at correct indent (MED-02, MED-03) | ✓ VERIFIED | `formatMutationsForEffects` med-format.js:195, per-option wiring gd-format.js:385-388; export-med.test.js `MED Format - State Mutations` (7 tests incl. `formats subtract as do add_res with negative value`, `strips flag_ prefix from key in do set_flag output`, `emits mutations at correct indentation depth`); med-state-basic golden (`do add_res coins -2`, `do set_flag watch_missing false`); WR-01 no-double-emission tests in `MED Export - Nested Choice (WR-01)` |
| 6 | Inline MED syntax in body text preserved/converted: `[#check=type:id:threshold]` (MED-04), `[term=id]` (MED-05), `{res_x}`/`{flag_x}` → `{{res(&"x")}}` when MED on, literal values when off (MED-06) | ✓ VERIFIED | med-checks golden (`Guard: [#check=flag:has_key:true] …`, `[term=old_reyes]`, `{{res(&"strength")}}`); export-med.test.js `MED Format - Checks and Terms`, `MED Export - Integration > #check syntax in body text is preserved verbatim / term syntax in body text is preserved verbatim`, `MED Export - Inline State Display (MED-06)` (5 tests); conversion at export-engine.js:146-163 |
| 7 | `~ direct_check <id>` emitted for Event nodes with check metadata (customFields.directCheck, else slugified title); never for non-Event nodes (MED-07) | ✓ VERIFIED | `emitDirectCheck` med-format.js:266; export-med.test.js `MED Format - Direct Check` (3 tests: `emits ~ direct_check for Event nodes with check metadata`, `emits ~ direct_check using title as fallback check id`, `does not emit direct_check for non-Event nodes`). Unit-test-only — no golden fixture exercises direct_check (noted, not a gap: behavior is deterministic string emission) |
| 8 | Choice options with `requires` get inline `[if condition /]` suffix and `[if]/[else]/[/if]` block wrapping at correct indentation; non-Choice nodes never emit conditional blocks (MED-08) | ✓ VERIFIED | Inline suffix gd-format.js:366-369; block emission `emitConditionalBlocks` med-format.js:329; export-med.test.js `MED Format - Conditional Branching` (5 tests); med-conditional-branch golden (`- Bribe the gatekeeper [if res_coins >= 5 /]`, `- Show your key [if flag_has_key == true /]`); med-nested-choice golden (nested `[if flag_honest == true /]`) |
| 9 | `[#...]` markup authored inline in body text passes through verbatim into the export (EXP-06 — redefined & closed by user decision 2026-08-07: requirement scope is inline `[#...]` passthrough, sharing the MED-04 implementation; node-level `tags` field export is out of scope, to be proposed as a new v1.1+ requirement if needed) | ✓ VERIFIED | med-checks golden (`Guard: [#check=flag:has_key:true] Halt! Show your papers.`); export-med.test.js `MED Export - Integration > #check syntax in body text is preserved verbatim`; body path = resolveVariables then verbatim emission (gd-format.js:165-182). Historical note: the original v0.1 wording (node tag field → `[#tag]` line) was never implemented — zero `.tags` reads in engine/, TAG_BRACKET_OPEN/CLOSE tokens (gd-constants.js:50-52) unused; 02-01-SUMMARY deferred it to 02-02 whose SUMMARY is missing. Closed by redefinition, not by new code. |
| 10 | Engine remains pure (zero Obsidian imports) after Phase 5 merge; golden contract byte-stable | ✓ VERIFIED | grep `require('obsidian')` over engine/ = 0 matches; tests/engine-purity.test.js `engine/ layer purity > contains no obsidian require, window., or document. anywhere in engine/`; `git diff HEAD -- tests/golden tests/fixtures` empty; full suite 310/310 green |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `plugins/narrative-tool/src/engine/export-engine.js` | `exportEngine()`, `topologicalSort()`, `resolveCharacter()` | ✓ VERIFIED | Exports at lines 415-419; `exportEngine` L179; pure, no obsidian import |
| `plugins/narrative-tool/src/engine/gd-format.js` | `formatNode()` dispatch over 6 node types | ✓ VERIFIED | FORMATTERS dispatch L461-468 (Entry/Dialog/Content/Choice/Marker/Event); `slugifyCueName` L119 |
| `plugins/narrative-tool/src/engine/med-format.js` | `detectMedState`, `formatMedHeader`, `formatMedNode`, `formatMutationsForEffects` | ✓ VERIFIED | Exports at lines 381-386 |
| `plugins/narrative-tool/src/engine/graph-analysis.js` | `analyzeGraph()` loop/merge pre-pass (Phase 6) | ✓ VERIFIED | `analyzeGraph` L39, returns `{ loops, loopEdges, merges, warnings }` (L168) |
| `plugins/narrative-tool/src/engine/gd-constants.js` / `med-constants.js` | TOKENS / MED_TOKENS vocabularies | ✓ VERIFIED | engine-purity.test.js `D-03 constants relocation sanity` (2 tests) |
| `tests/export-base.test.js` | Base DM golden + unit suites | ✓ VERIFIED | 10 auto-discovered golden tests + 16 unit tests (Topological Sort / Character Resolution / Robustness / Embedded speaker prefixes) |
| `tests/export-med.test.js` | MED unit + integration + golden suites | ✓ VERIFIED | 40 tests across 9 suites incl. `MED Export - Golden Fixtures` (4 med-* fixtures, medEnabled: true) |
| `tests/export-plugin.test.js` | Pipeline/edge-case/roundtrip suites | ✓ VERIFIED | 14 tests across 4 suites (Path Derivation, Export Pipeline, Edge Cases, Roundtrip Consistency) |
| `tests/export.test.js` | Master suite import check | ✓ VERIFIED | `Dialogue Export — Master Suite > all sub-suites are importable` |
| `tests/graph-analysis.test.js` | Loop/merge analysis + warning tests | ✓ VERIFIED | 11 tests across 4 suites |
| `tests/fixtures/*.ncanvas` ↔ `tests/golden/*.dialogue` | 14 fixture/golden pairs | ✓ VERIFIED | 10 base + 4 med; byte-equality asserted by golden tests; `git diff HEAD` empty |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| export-engine.js | gd-format.js | `formatNode` | ✓ WIRED | require line 9; dispatch via ctx.formatNode (L278-292) and walkNode (L355-384) |
| export-engine.js | med-format.js | `detectMedState` / `formatMedHeader` / `formatMedNode` / `formatMutationsForEffects` | ✓ WIRED | require line 10; uses L254, L261, L288/362/371/380, L299 |
| export-engine.js | graph-analysis.js | `analyzeGraph` | ✓ WIRED | require line 11; pre-pass L242; loop jump L323-325; merge jump L329-334; shared sections L397-406 |
| gd-format.js | gd-constants.js | `TOKENS` | ✓ WIRED | require line 9; TOKENS.OPTION_PREFIX used L364/395 |
| med-format.js | med-constants.js + gd-constants.js | `MED_TOKENS` / `TOKENS` | ✓ WIRED | requires lines 19-20; MED_TOKENS.USING_STATE/SET_FLAG/ADD_RES/DIRECT_CHECK, TOKENS.IF_BLOCK_* |
| tests/export-base.test.js | engine/export-engine.js | `require('../plugins/narrative-tool/src/engine/export-engine')` | ✓ WIRED | import line 8 — tests exercise the current merged engine, not legacy paths |
| commands (export-current / batch-export / auto-export) | engine/export-engine.js | `exportEngine` | ✓ WIRED | Verified in Phase 5 verification (05-VERIFICATION.md, Key Link table); out of scope to re-derive here |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite green | `node --test tests/*.test.js` | 310 pass / 0 fail (86 suites) | ✓ PASS |
| Phase-2-relevant suites green | `node --test tests/export-base.test.js tests/export-med.test.js tests/export-plugin.test.js tests/export.test.js tests/graph-analysis.test.js tests/engine-purity.test.js` | 184 pass / 0 fail (46 suites) | ✓ PASS |
| Golden/fixture byte-stability | `git diff HEAD --stat -- tests/golden tests/fixtures` + `git status --porcelain` | empty / clean | ✓ PASS |
| cues-and-jumps golden unchanged since Phase 2 | `git show 69f2fb0:tests/golden/cues-and-jumps.dialogue` vs working tree | identical (5 lines) | ✓ PASS |
| Engine purity | `grep -rn "require('obsidian')" plugins/narrative-tool/src/engine/` | no matches (exit 1) | ✓ PASS |
| EXP-06 original-definition probe (historical record) | `git grep "\.tags" -- plugins/narrative-tool/src/engine/` | zero hits — node-tags emission never existed; EXP-06 closed by redefinition (user decision 2026-08-07), not by code | ℹ️ N/A (documented) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| EXP-01 | 02-01 | 单个 .ncanvas 导出为 .dialogue，兼容 Godot DM 基础语法 | ✓ SATISFIED | Golden tests `exports basic-dialogue.ncanvas …` (+9 more base fixtures); `Plugin - Export Pipeline > exports all fixtures without throwing` / `every exported output starts with a valid DM construct` (T1) |
| EXP-02 | 02-01 | 角色名映射 — `Character: text` | ✓ SATISFIED | characters-cast-chips golden (`Mara: The ledger is missing.`); `Export Engine - Character Resolution` (3 tests); `Export Engine - Embedded speaker prefixes` (5 tests, post-v0.1 evolution) (T1) |
| EXP-03 | 02-01 | 分支选项输出 `- option text` | ✓ SATISFIED | nested-choices + choice-link-branches goldens; `formatChoiceNode` gd-format.js:280 (T1) |
| EXP-04 | 02-01 | 嵌套分支缩进 | ✓ SATISFIED | nested-choices golden (3 levels of tab indent); `… keeps continuation lines indented inside Choice subtrees` (T1) |
| EXP-05 | 02-01 | Cue/Jump 映射 `~ cue` / `=> jump` | ✓ SATISFIED | cues-and-jumps golden (`~` cues, byte-stable since Phase 2); `=>` half landed in Phase 6: choice-loop/choice-merge/choice-merge-marker goldens + graph-analysis.test.js loop/merge suites (T2). Honest note: in v0.1 the `=>` emission path did not exist; current evidence is the Phase 6 implementation. |
| EXP-06 | 02-01→02-02 | Tags 导出为 `[#tag]`（2026-08-07 用户决策重新界定：正文内联 `[#...]` 标记逐字透传） | ✓ SATISFIED (redefined & closed by user decision 2026-08-07) | Inline `[#...]` in body text passes through verbatim: med-checks golden (`[#check=flag:has_key:true]`) + `… #check syntax in body text is preserved verbatim` (T9). Original node-tags-field definition was never implemented (zero `.tags` reads, no fixture/test); node-level tag export deferred to a future v1.1+ requirement if needed |
| EXP-07 | 02-01 | BBCode 透传 | ✓ SATISFIED | bbcode-formatting golden (7 BBCode constructs verbatim) (T3) |
| MED-01 | 02-02 | `using S` 声明自动插入 | ✓ SATISFIED | `MED Detection` (10) + `MED Header` (2) + Integration tests; med-state-basic golden line 1 (T4) |
| MED-02 | 02-02 | `do set_flag(id, value)` | ✓ SATISFIED | `MED Format - State Mutations > formats set_flag effect for a Choice node / strips flag_ prefix…`; med-state-basic golden (T5) |
| MED-03 | 02-02 | `do add_res(id, delta)` 等资源修改 | ✓ SATISFIED | `… formats add_res effect / formats subtract as do add_res with negative value / strips res_ prefix…`; med-state-basic golden (T5) |
| MED-04 | 02-02 | `[#check=type:id:threshold]` 检定语法 | ✓ SATISFIED | `MED Format - Checks and Terms`; `… #check syntax in body text is preserved verbatim`; med-checks golden (T6) |
| MED-05 | 02-02 | `[term=id]` 说明词 | ✓ SATISFIED | `… term syntax in body text is preserved verbatim`; med-checks golden (T6) |
| MED-06 | 02-02 | `{{res(&"id")}}` 内联状态显示 | ✓ SATISFIED | `MED Export - Inline State Display (MED-06)` (5 tests); med-state-basic + med-checks goldens (T6) |
| MED-07 | 02-02 | `~ direct_check` 直接检定 | ✓ SATISFIED | `MED Format - Direct Check` (3 tests); emitDirectCheck med-format.js:266 (T7) |
| MED-08 | 02-02 | `[if condition]` 选项条件 | ✓ SATISFIED | `MED Format - Conditional Branching` (5 tests); med-conditional-branch + med-nested-choice goldens (T8) |

No orphaned requirements: all 15 Phase-2 requirements (EXP-01~07, MED-01~08) are covered above. 15/15 SATISFIED (EXP-06 via redefinition & closure by user decision 2026-08-07).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers | none found | none — engine sources are debt-marker-free |
| plugins/narrative-tool/src/engine/gd-constants.js | 50-52 | TAG_BRACKET_OPEN/CLOSE tokens defined but unused by any formatter (remnant of the original EXP-06 node-tag definition) | ℹ️ Info | Dead vocabulary; harmless. EXP-06 was redefined to inline `[#...]` passthrough (user decision 2026-08-07); if node-level tags are ever proposed for v1.1+, these tokens are the natural starting point |

### Human Verification Required

Phase-2 engine behavior is fully covered by automated tests; only the Obsidian-runtime entry points needed human UAT (passed 2026-08-07, detailed format in frontmatter):

1. **Export current dialogue command** — running it on a .ncanvas file in Obsidian writes a .dialogue file matching engine output
2. **MED toggle end-to-end** — settings toggle visibly changes exported output (`using S` header, `{{res()}}` vs literal values)

### Gaps Summary

**No open gaps.** All 15 Phase-2 requirements are satisfied against the current codebase.

**EXP-06 closure record (redefinition, user decision 2026-08-07).** The original v0.1 wording — "Narrative Canvas 节点 tag 导出为 `[#tag]` 格式" (node `tags` field → `[#tag]` line emission) — was never implemented: zero `.tags` reads anywhere in `engine/`, no fixture with a `tags` field, no test asserting `[#tag]` emission; the `TAG_BRACKET_OPEN`/`TAG_BRACKET_CLOSE` tokens in gd-constants.js:50-52 are defined but unused. This was a v0.1-inherited gap, not a Phase 5-8 regression: 02-01-SUMMARY explicitly deferred EXP-06 to Plan 02-02, 02-02's SUMMARY was never written (missing from `.planning/phases/02-dialogue-export/`), and the v0.1 milestone audit marked EXP-06 "partial (verification gap)". On 2026-08-07 the user redefined EXP-06 as "**inline `[#...]` markup in body text passes through verbatim**" — sharing the MED-04 implementation and already proven by the med-checks golden (`Guard: [#check=flag:has_key:true] Halt! Show your papers.`) and the `… #check syntax in body text is preserved verbatim` test — and closed it. Node-level tags export, if ever wanted, will be proposed as a new v1.1+ requirement.

All 15 requirements verified against the current codebase with golden + unit test evidence: full suite 310/310 green, 184/184 in the six Phase-2-relevant test files, golden/fixture trees byte-identical to git HEAD, engine purity enforced.

---

_Verified: 2026-08-07T05:05:14Z_
_Verifier: Kimi Code (subagent — Phase 9 verification)_

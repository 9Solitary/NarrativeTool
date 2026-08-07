---
phase: 02-dialogue-export
validated: 2026-08-07
coverage: 51/51 behavior claims covered (50 automated, 1 human-only)
---

# Phase 2: Dialogue Export — Nyquist Validation

Every behavior claim implied by the 15 v0.1 requirements (EXP-01~07, MED-01~08) is mapped to concrete test evidence in the current suite (`file :: describe > it`). Test names below were copied from the test sources. Suite run on 2026-08-07: `node --test tests/*.test.js` → **310 pass / 0 fail (86 suites)**; Phase-2-relevant files only → **184 pass / 0 fail (46 suites)**.

## EXP-01 — 单个 .ncanvas 导出为 .dialogue（Godot DM 基础语法）

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| Every fixture exports without throwing | tests/export-plugin.test.js :: Plugin - Export Pipeline > exports all fixtures without throwing | ✓ automated |
| Output starts with a valid DM construct (`~ cue` / `using S`) | tests/export-plugin.test.js :: Plugin - Export Pipeline > every exported output starts with a valid DM construct | ✓ automated |
| Output is byte-identical to the golden contract | tests/export-base.test.js :: Dialogue Export - Base DM > exports basic-dialogue.ncanvas to match golden .dialogue (+ 9 more auto-discovered base fixtures) | ✓ automated |
| Empty/invalid input handled (empty string; clear throw) | tests/export-base.test.js :: Export Engine - Robustness > returns empty string for empty nodes array / throws for missing project.nodes | ✓ automated |
| Running "Export current dialogue" in Obsidian writes the .dialogue file to the vault | — (Obsidian runtime; engine output contract proven above) | ⚠ human-only — UAT passed 2026-08-07 |

## EXP-02 — 角色名映射 `Character: text`

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| cast[] Speaker name becomes `Name: text` | tests/export-base.test.js :: Export Engine - Character Resolution > resolves character from cast[0] with role Speaker; golden: exports characters-cast-chips.ncanvas to match golden .dialogue (`Mara: The ledger is missing.`) | ✓ automated |
| Falls back to node.title when no cast | tests/export-base.test.js :: Export Engine - Character Resolution > falls back to node.title when no cast | ✓ automated |
| No cast/title → narrator line (no prefix) | tests/export-base.test.js :: Export Engine - Character Resolution > returns null for narrator/Content nodes | ✓ automated |
| Known speaker prefix already in body is not duplicated | tests/export-base.test.js :: Export Engine - Embedded speaker prefixes > does not duplicate a known speaker prefix already in the body | ✓ automated |
| Full-width colon (U+FF1A) normalized to half-width | tests/export-base.test.js :: Export Engine - Embedded speaker prefixes > recognizes full-width colon (U+FF1A) and normalizes to half-width | ✓ automated |
| Multi-line bodies get per-line prefixes; unknown "Name:"-shaped text untouched | tests/export-base.test.js :: Export Engine - Embedded speaker prefixes > handles multi-line bodies: per-line prefixes, no doubling / does not treat unknown "Name:"-shaped text as a speaker prefix | ✓ automated |

## EXP-03 — 分支选项输出 `- option text`

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| Choice options emit as `- label` lines | tests/export-base.test.js :: Dialogue Export - Base DM > exports nested-choices.ncanvas to match golden .dialogue; exports choice-link-branches.ncanvas to match golden .dialogue | ✓ automated |

## EXP-04 — 嵌套分支缩进

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| Nested choices indent with tabs, 3+ levels | tests/export-base.test.js :: Dialogue Export - Base DM > exports nested-choices.ncanvas to match golden .dialogue (golden shows 3 indentation levels) | ✓ automated |
| Continuation lines stay indented inside Choice subtrees | tests/export-base.test.js :: Export Engine - Embedded speaker prefixes > keeps continuation lines indented inside Choice subtrees | ✓ automated |

## EXP-05 — Cue/Jump 映射 `~ cue` / `=> jump`

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| Marker nodes emit `~ cue_name` (slugified) | tests/export-base.test.js :: Dialogue Export - Base DM > exports cues-and-jumps.ncanvas to match golden .dialogue (`~ chapter_two`, `~ ending`; golden byte-identical to its Phase-2 version) | ✓ automated |
| Choice loop back-edge emits `=> cue` and the loop target gets a `~ cue` header | tests/graph-analysis.test.js :: analyzeGraph — loop detection (FEAT-01) > detects a back-edge to an ancestor Choice node; golden: exports choice-loop.ncanvas to match golden .dialogue (`=> shopkeeper_question`) | ✓ automated |
| Branch convergence emits `=> cue` with the shared section emitted once | tests/graph-analysis.test.js :: analyzeGraph — merge detection (FEAT-02) > detects convergence of two branches with an auto-generated cue; golden: exports choice-merge.ncanvas to match golden .dialogue (`=> merge_01` + single `~ merge_01` section) | ✓ automated |
| Merge cue is named after a Marker at the merge point | tests/graph-analysis.test.js :: analyzeGraph — merge detection (FEAT-02) > names the cue after a Marker at the merge point (D3 hybrid); golden: exports choice-merge-marker.ncanvas to match golden .dialogue (`=> shared_path`) | ✓ automated |
| Ambiguous merge (subtree contains a Choice) warns and duplicates content | tests/graph-analysis.test.js :: exportEngine — ambiguity warnings (FEAT-02) > pushes a warning and duplicates content for an ambiguous merge; golden: exports choice-merge-ambiguous.ncanvas to match golden .dialogue | ✓ automated |

Honest note: the `=>` emission path is the Phase 6 implementation (graph-analysis.js); in v0.1 only `~ cue` existed. Current evidence is authoritative per the golden contract.

## EXP-06 — Tags 导出为 `[#tag]`（2026-08-07 用户决策重新界定：正文内联 `[#...]` 标记逐字透传）

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| `[#...]` tokens written inline in body text pass through verbatim into the export | tests/export-med.test.js :: MED Export - Integration > #check syntax in body text is preserved verbatim; golden: exports med-checks.ncanvas to match golden .dialogue (`Guard: [#check=flag:has_key:true] Halt! Show your papers.`) | ✓ automated |
| Inline `[#...]` passthrough holds for arbitrary tag-like markup (shares the MED-04/MED-05 body-verbatim path — no parsing, no validation) | tests/export-med.test.js :: MED Export - Integration > term syntax in body text is preserved verbatim (same verbatim body path, gd-format.js:165-182) | ✓ automated |

Closure note: the original v0.1 definition (node `tags` field → `[#tag]` line) was never implemented (zero `.tags` reads in engine/, no fixture/test). Redefined & closed by user decision 2026-08-07; node-level tags export deferred to a future v1.1+ requirement if needed.

## EXP-07 — BBCode 透传

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| BBCode markup (`[b]`, `[i]`, `[color=]`, `[shake]`, `[wait=]`, `[next=]`, `[[a|b|c]]`) preserved verbatim | tests/export-base.test.js :: Dialogue Export - Base DM > exports bbcode-formatting.ncanvas to match golden .dialogue | ✓ automated |

## MED-01 — `using S` 声明自动插入

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| `using S` + blank line prepended when MED detected | tests/export-med.test.js :: MED Header > returns using S + blank line when MED detected | ✓ automated |
| No header when no MED constructs | tests/export-med.test.js :: MED Header > returns empty array when no MED detected | ✓ automated |
| Detection triggers: flag_/res_ vars, set_flag/add_res/subtract actions, choiceOptions requires/effects | tests/export-med.test.js :: MED Detection > detects MED state when varariables have flag_ prefix / when variables have res_ prefix / from script.actions with set_flag / with add_res / with subtract / from choiceOptions.requires (non-empty string) / from choiceOptions.effects with set_flag / with subtract / returns false for projects without MED constructs / returns false for truthy but empty requires strings (10 tests) | ✓ automated |
| End-to-end: header present with medEnabled true, absent with false | tests/export-med.test.js :: MED Export - Integration > exportEngine with medEnabled true includes using S when MED detected / exportEngine with medEnabled false excludes using S; golden: exports med-state-basic.ncanvas to match golden .dialogue (line 1 `using S`) | ✓ automated |

## MED-02 — `do set_flag(id, value)` 导出

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| set_flag effect emits `do set_flag <key> <value>` | tests/export-med.test.js :: MED Format - State Mutations > formats set_flag effect for a Choice node | ✓ automated |
| `flag_` prefix stripped from key | tests/export-med.test.js :: MED Format - State Mutations > strips flag_ prefix from key in do set_flag output | ✓ automated |
| Golden contract | tests/export-med.test.js :: MED Export - Golden Fixtures > exports med-state-basic.ncanvas to match golden .dialogue (`do set_flag watch_missing false`) | ✓ automated |

## MED-03 — `do add_res(id, delta)` 等资源修改导出

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| add_res effect emits `do add_res <key> <value>` | tests/export-med.test.js :: MED Format - State Mutations > formats add_res effect for a Choice node | ✓ automated |
| subtract emits as negative add_res | tests/export-med.test.js :: MED Format - State Mutations > formats subtract as do add_res with negative value | ✓ automated |
| `res_` prefix stripped from key | tests/export-med.test.js :: MED Format - State Mutations > strips res_ prefix from key in do add_res output | ✓ automated |
| Mutations emitted at correct indentation depth | tests/export-med.test.js :: MED Format - State Mutations > emits mutations at correct indentation depth | ✓ automated |
| Golden contract | tests/export-med.test.js :: MED Export - Golden Fixtures > exports med-state-basic.ncanvas to match golden .dialogue (`do add_res coins -2`) | ✓ automated |

## MED-04 — `[#check=type:id:threshold]` 检定语法导出

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| `[#check=...]` in body text preserved verbatim | tests/export-med.test.js :: MED Export - Integration > #check syntax in body text is preserved verbatim | ✓ automated |
| Node recognized as MED via `[#check]` in body | tests/export-med.test.js :: MED Format - Checks and Terms > recognizes nodes with [#check] in body via MED context; golden: exports med-checks.ncanvas to match golden .dialogue (`Guard: [#check=flag:has_key:true] Halt! …`) | ✓ automated |

## MED-05 — `[term=id]` 说明词导出

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| `[term=...]` in body text preserved verbatim | tests/export-med.test.js :: MED Export - Integration > term syntax in body text is preserved verbatim; golden: exports med-checks.ncanvas to match golden .dialogue (`[term=old_reyes]`) | ✓ automated |

## MED-06 — `{{res(&"id")}}` 内联状态显示导出

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| `{res_x}` in body converts to `{{res(&"x")}}` with medEnabled | tests/export-med.test.js :: MED Export - Inline State Display (MED-06) > res_ variable in body converts to {{res()}} display syntax with medEnabled | ✓ automated |
| `{flag_x}` converts to display syntax with medEnabled | tests/export-med.test.js :: MED Export - Inline State Display (MED-06) > flag_ variable in body converts to display syntax with medEnabled | ✓ automated |
| Non-prefixed variables resolve to literal values (MED on and off) | tests/export-med.test.js :: MED Export - Inline State Display (MED-06) > non-prefixed variables resolve to literal values with medEnabled / non-prefixed variables resolve to literal values with medEnabled false | ✓ automated |
| `{res_x}` resolves to literal value when medEnabled is false | tests/export-med.test.js :: MED Export - Inline State Display (MED-06) > res_ variable resolves to literal value when medEnabled is false; MED Export - Integration > exportEngine medEnabled false resolves all vars to literal values | ✓ automated |
| Golden contract | tests/export-med.test.js :: MED Export - Golden Fixtures > exports med-state-basic.ncanvas to match golden .dialogue (`Your coins: {{res(&"coins")}}.`) | ✓ automated |

## MED-07 — `~ direct_check` 直接检定导出

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| Event node with check metadata emits `~ direct_check <id>` | tests/export-med.test.js :: MED Format - Direct Check > emits ~ direct_check for Event nodes with check metadata | ✓ automated |
| Falls back to slugified title as check id | tests/export-med.test.js :: MED Format - Direct Check > emits ~ direct_check using title as fallback check id | ✓ automated |
| Non-Event nodes never emit direct_check | tests/export-med.test.js :: MED Format - Direct Check > does not emit direct_check for non-Event nodes | ✓ automated |

## MED-08 — `[if condition]` 选项条件导出

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| Option with `requires` gets inline `[if condition /]` suffix | tests/export-med.test.js :: MED Export - Golden Fixtures > exports med-conditional-branch.ncanvas to match golden .dialogue (`- Bribe the gatekeeper [if res_coins >= 5 /]`); code: gd-format.js:366-369 | ✓ automated |
| `[if]/[else]/[/if]` block lines emitted when some options have requires | tests/export-med.test.js :: MED Format - Conditional Branching > emits conditional blocks when some Choice options have requires | ✓ automated |
| No conditional blocks when all requires are empty | tests/export-med.test.js :: MED Format - Conditional Branching > emits only mutation lines (no conditional blocks) when all requires are empty | ✓ automated |
| Single conditional + one unconditional option emits `[if]` | tests/export-med.test.js :: MED Format - Conditional Branching > emits [if] for single conditional option with one unconditional option | ✓ automated |
| Conditional blocks at correct indentation | tests/export-med.test.js :: MED Format - Conditional Branching > emits conditional blocks at correct indentation | ✓ automated |
| Non-Choice nodes never emit conditional blocks | tests/export-med.test.js :: MED Format - Conditional Branching > does not emit conditional blocks for non-Choice nodes | ✓ automated |
| Nested choice: each option mutation emitted exactly once, no stray block lines (WR-01) | tests/export-med.test.js :: MED Export - Nested Choice (WR-01) > emits each option mutation exactly once (no merged re-emission) / emits no stray conditional block lines after the nested choice content; golden: exports med-nested-choice.ncanvas to match golden .dialogue | ✓ automated |

## Coverage Summary

- Requirements: 15 total (EXP-01~07, MED-01~08) — **15/15 covered** (EXP-06 redefined & closed by user decision 2026-08-07: inline `[#...]` passthrough, sharing the MED-04 implementation)
- Behavior claims: 51 total — **50 automated ✓, 1 human-only ⚠ (Obsidian export command, UAT passed 2026-08-07), 0 uncovered**
- Test suite runs (2026-08-07):
  - `node --test tests/*.test.js` → **310 pass / 0 fail (86 suites)**
  - `node --test tests/export-base.test.js tests/export-med.test.js tests/export-plugin.test.js tests/export.test.js tests/graph-analysis.test.js tests/engine-purity.test.js` → **184 pass / 0 fail (46 suites)**
- Golden contract: `git diff HEAD -- tests/golden tests/fixtures` → empty (14 fixture/golden pairs byte-stable)

## Known Gaps

None. EXP-06 was closed by redefinition (user decision 2026-08-07) — see the EXP-06 section closure note and 02-VERIFICATION.md Gaps Summary for the full history of the original node-tags definition.

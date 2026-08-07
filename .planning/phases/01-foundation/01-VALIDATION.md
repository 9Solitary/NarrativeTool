---
phase: 01-foundation
validated: 2026-08-07
coverage: 21/21 behavior claims covered
---

# Phase 1: Project Foundation — Nyquist Validation

Every behavior claim of the five Phase 1 requirements (FND-01..05) is listed with concrete test evidence. Test names below are copied verbatim from the test sources (confirmed by reading each file). Evidence chain: v0.1 requirement → current v1.0 code location → current test. `shared/` paths in the v0.1 requirement text resolve to `plugins/narrative-tool/src/engine/` after the Phase 5 merge (D-03).

## FND-01 — 项目工作区结构初始化（plugins/、shared/、obsidian-vault/ 目录）

| Behavior Claim | Test Evidence (file::test name) | Status |
| -------------- | ------------------------------- | ------ |
| `plugins/` workspace exists and contains the plugin source | Repo inspection: `git ls-files plugins/` → `plugins/narrative-tool/**` + `plugins/.gitkeep` only (legacy plugin dirs hold zero tracked files). Guarded indirectly by tests/engine-purity.test.js::engine/ layer purity::"scans at least 5 .js files in engine/" (fails if the engine tree is absent) | ✓ inspection (structure has no meaningful unit test; engine-tree presence is guarded) |
| `tests/` workspace with fixture/golden harness directories exists and is populated | tests/export-base.test.js::Dialogue Export - Base DM::"exports basic-dialogue.ncanvas to match golden .dialogue" (+ 9 sibling per-fixture tests auto-discovered from tests/fixtures/) — these tests throw "Missing golden file" if the harness dirs regress | ✓ automated |
| Shared modules location: v0.1 `shared/` → current `plugins/narrative-tool/src/engine/` (Phase 5 D-03 relocation) | tests/engine-purity.test.js::D-03 constants relocation sanity::"gd-constants.js exists in engine/ and exports TOKENS"; ::"med-constants.js exists in engine/ and exports MED_TOKENS" | ✓ automated |

## FND-02 — 共享模块 gd-constants.js：Godot DM + MED 全部 token 常量

Current location: `plugins/narrative-tool/src/engine/gd-constants.js` + `med-constants.js`.

| Behavior Claim | Test Evidence (file::test name) | Status |
| -------------- | ------------------------------- | ------ |
| All GD line-level tokens present (CHARACTER_PREFIX, OPTION_PREFIX, CUE_PREFIX, JUMP_PREFIX) | tests/constants.test.js::gd-constants.js — Godot Dialogue Manager Tokens::"contains all required line-level tokens" | ✓ automated |
| All GD inline tokens present (IF_BLOCK_OPEN/CLOSE, ELSE_BLOCK, TAG_BRACKET_OPEN/CLOSE) and the set is exact (9 keys, no extras) | tests/constants.test.js::gd-constants.js — Godot Dialogue Manager Tokens::"contains all required inline tokens"; ::"exports exactly 9 tokens (line-level + inline)" | ✓ automated |
| GD tokens immutable, non-empty strings | tests/constants.test.js::gd-constants.js — Godot Dialogue Manager Tokens::"TOKENS object is frozen (immutable)"; ::"every TOKENS property is a non-empty string" | ✓ automated |
| All 8 MED tokens present (USING_STATE, SET_FLAG, ADD_RES, CHECK_PATTERN, DIRECT_CHECK, TERM_PATTERN, RES_DISPLAY_PREFIX/SUFFIX), exact set, frozen, non-empty | tests/constants.test.js::med-constants.js — MED Extension Tokens::"contains all required MED tokens"; ::"exports exactly 8 MED tokens"; ::"MED_TOKENS object is frozen (immutable)"; ::"every MED_TOKENS property is a non-empty string" | ✓ automated |
| GD and MED constants live in separate files with distinct exports | tests/constants.test.js::GD and MED token separation::"gd-constants.js and med-constants.js are separate files with distinct exports" | ✓ automated |

## FND-03 — 共享模块 schema/：实体类型定义（Character, Location, Quest, Item）

Current location: `plugins/narrative-tool/src/engine/schema/{character,location,quest,item}.js`.

| Behavior Claim | Test Evidence (file::test name) | Status |
| -------------- | ------------------------------- | ------ |
| Character schema: frozen template, exact key set, Fields/Required arrays, `@typedef` JSDoc | tests/schema.test.js::plugins/narrative-tool/src/engine/schema/character.js — Character entity::"CharacterTemplate is frozen with correct keys"; ::"CharacterFields includes all template keys; CharacterRequired includes id, name"; ::"character.js has @typedef JSDoc annotation" | ✓ automated |
| Location schema: same three properties | tests/schema.test.js::plugins/narrative-tool/src/engine/schema/location.js — Location entity::"LocationTemplate is frozen with correct keys"; ::"LocationFields includes all template keys; LocationRequired includes id, name"; ::"location.js has @typedef JSDoc annotation" | ✓ automated |
| Quest schema: same three properties (the v0.1 "Quest schema orphaned" warning was a consumer-side gap, fixed in Phase 5 — schema itself intact and now consumed by flow/entity-templates.js:12) | tests/schema.test.js::plugins/narrative-tool/src/engine/schema/quest.js — Quest entity::"QuestTemplate is frozen with correct keys"; ::"QuestFields includes all template keys; QuestRequired includes id, name"; ::"quest.js has @typedef JSDoc annotation" | ✓ automated |
| Item schema: same three properties | tests/schema.test.js::plugins/narrative-tool/src/engine/schema/item.js — Item entity::"ItemTemplate is frozen with correct keys"; ::"ItemFields includes all template keys; ItemRequired includes id, name"; ::"item.js has @typedef JSDoc annotation" | ✓ automated |

## FND-04 — esbuild 构建配置：src/ 打包为单文件 main.js

Current state: single merged config `plugins/narrative-tool/esbuild.config.mjs` (three v0.1 per-plugin configs collapsed in Phase 5) + root one-step `scripts/build.mjs` (Phase 7).

| Behavior Claim | Test Evidence (file::test name) | Status |
| -------------- | ------------------------------- | ------ |
| `npm run build` produces the single-file bundle `plugins/narrative-tool/main.js` | Build probe run 2026-08-07: `npm run build` → "[narrative-tool] build complete -> main.js" (49,385 bytes). No unit test wraps esbuild itself — the build is the test | ✓ build probe (run during validation) |
| Bundle contains the full plugin surface (all 10 command IDs compiled in) | Probe: `grep -o '"narrative-tool:[a-z-]*"' plugins/narrative-tool/main.js \| sort -u` → 10/10 IDs; cross-checked by tests/merge-smoke.test.js::NarrativeToolPlugin merge smoke test (05-04)::"registers exactly 10 commands with the narrative-tool: prefix (D-08)" against the source | ✓ automated (source side) + probe (bundle side) |
| Build keeps obsidian/electron external and bundles engine without obsidian imports (cjs require resolution safe) | tests/engine-purity.test.js::engine/ layer purity::"contains no obsidian require, window., or document. anywhere in engine/"; ::"purity matcher positive control" (4 tests proving the scanner itself works); esbuild.config.mjs:19 `external: ['obsidian', 'electron']` | ✓ automated |
| Built bundle loads and runs inside Obsidian | Obsidian runtime load — cannot be automated outside the app | ⚠ human-only (runtime UAT PASSED 2026-08-07) |

## FND-05 — Node.js node:test 测试基础设施（fixture 文件驱动的导出测试）

| Behavior Claim | Test Evidence (file::test name) | Status |
| -------------- | ------------------------------- | ------ |
| Whole suite runnable via one `node --test` command (glob-driven, zero external test deps) | Suite run 2026-08-07: `node --test tests/*.test.js` → 310 pass / 0 fail / 86 suites; root package.json "test" script wires the glob. Meta-evidence: tests/export.test.js::Dialogue Export — Master Suite::"all sub-suites are importable" guards suite wiring | ✓ automated |
| Fixture auto-discovery: dropping a `.ncanvas` into tests/fixtures/ auto-creates a golden-comparison test | tests/export-base.test.js::Dialogue Export - Base DM — per-fixture `it("exports <name>.ncanvas to match golden .dialogue")` generated from `readdirSync(FIXTURES_DIR)` (export-base.test.js:19-24); 10 base + 4 MED fixtures currently discovered | ✓ automated |
| Golden comparison is byte-exact (strictEqual, no fuzzy matching) | tests/export-base.test.js::Dialogue Export - Base DM::"exports choice-link-branches.ncanvas to match golden .dialogue" (and all sibling fixture tests) — assertion is `assert.strictEqual(output, expected)` (export-base.test.js:34); regression contract confirmed: `git diff HEAD -- tests/golden tests/fixtures` empty | ✓ automated |
| Test harness survives engine evolution: Phase 1 stubExport replaced by real engine without harness redesign; engine purity guarded against Obsidian coupling | tests/engine-purity.test.js::engine/ layer purity (both tests) + tests/export-base.test.js::Export Engine - Robustness::"returns empty string for empty nodes array"; ::"throws for missing project.nodes" — the harness drives the pure engine directly with plain JSON | ✓ automated |

## Coverage Summary

- **21/21 behavior claims covered** — 17 ✓ automated (or automated + probe/inspection), 3 ✓ build-probe/inspection-backed, 1 ⚠ human-only (built bundle loading in Obsidian — runtime UAT PASSED 2026-08-07).
- **Suite result (run 2026-08-07):** `node --test tests/*.test.js` → **310 pass / 0 fail / 86 suites** (~3.2 s).
- **Golden regression contract:** `git diff HEAD -- tests/golden tests/fixtures` → empty.
- Phase-1-owned test files directly exercising FND-02/03/05: tests/constants.test.js (10 tests), tests/schema.test.js (12 tests), tests/engine-purity.test.js (8 tests) — all green.

---

_Validated: 2026-08-07_
_Validator: Kimi Code CLI (subagent)_

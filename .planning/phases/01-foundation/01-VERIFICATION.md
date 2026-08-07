---
phase: 01-foundation
verified: 2026-08-07T05:20:00Z
status: verified
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
gaps: []
human_verification:
  - test: "Copy output/narrative-tool/ (main.js + manifest.json + styles.css, produced by `npm run build`) into a vault's .obsidian/plugins/narrative-tool/ and enable the plugin"
    expected: "The esbuild bundle loads in Obsidian without errors; plugin 'Narrative Tool' appears enabled in Community Plugins"
    why_human: "The cjs bundle's compatibility with the real Obsidian runtime (require('obsidian') external resolution, CSS text-loader injection) can only be confirmed inside the app; the build itself and all module-level behavior are verified programmatically"
    uat_result: "PASSED 2026-08-07 (runtime UAT — plugin loaded and all commands exercised)"
---

# Phase 1: Project Foundation Verification Report

**Phase Goal:** The toolchain project structure is initialized with shared modules, esbuild build system, and node:test infrastructure.
**Verified:** 2026-08-07T05:20:00Z
**Status:** verified (5/5 truths VERIFIED against the current v1.0 codebase; one Obsidian-runtime item covered by human UAT 2026-08-07)
**Re-verification:** No — initial verification (phase predates the verification-doc practice; this report closes the v0.1 "All 4 phases lack VERIFICATION.md" gap for Phase 1)

> **Scope note (v0.1 → v1.0 evidence chain):** Phase 1 requirements were written against the original layout (`shared/` modules, three separate plugin builds). Phase 5 merged everything into the single `plugins/narrative-tool/` plugin (constants relocated to `src/engine/` per D-03; schemas to `src/engine/schema/`); Phase 7 added the root one-step build (`scripts/build.mjs`). This report verifies each v0.1 requirement at its **current** code location with **current** test evidence. No v0.1 milestone-audit gap (ENT-03, FLW-05, B1/B2) falls inside Phase 1 scope.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Workspace structure initialized: `plugins/` (single merged plugin), `tests/` (fixtures/golden/mocks), `scripts/`, root `package.json` with build/test scripts (FND-01) | ✓ VERIFIED | `git ls-files plugins/` = only `plugins/narrative-tool/**` + `plugins/.gitkeep` (legacy `dialogue-export`/`flow-tools`/`narrative-project` dirs on disk hold only gitignored `main.js`/`node_modules` build remnants — zero tracked files); `tests/` holds 21 `*.test.js` + `fixtures/` (18 files) + `golden/` (14 files) + `mocks/`; `scripts/build.mjs` present; root `package.json` defines `"build": "node scripts/build.mjs"` and `"test": "node --test \"tests/*.test.js\""`. v0.1 deviations, both intentional and later-phase-documented: `shared/` was merged into `plugins/narrative-tool/src/engine/` (Phase 5, D-03); `obsidian-vault/` was never created — `TestVault/CanvasTest/` serves as the test vault |
| 2 | Shared token constants complete: all Godot Dialogue Manager tokens (TOKENS, 9 keys, frozen) and MED state-system tokens (MED_TOKENS, 8 keys, frozen) in two separate modules (FND-02) | ✓ VERIFIED | `plugins/narrative-tool/src/engine/gd-constants.js:56-61` exports frozen `TOKENS` (4 line-level + 5 inline); `med-constants.js:77-85` exports frozen `MED_TOKENS` (declaration/mutation/check/term/display); tests/constants.test.js — 10 tests across 3 describe blocks (`gd-constants.js — Godot Dialogue Manager Tokens`, `med-constants.js — MED Extension Tokens`, `GD and MED token separation`) all pass, asserting frozen objects, exact key sets, non-empty string values, and file separation |
| 3 | Entity schemas defined for all four types: Character, Location, Quest, Item — each with frozen Template, Fields array, Required array, and `@typedef` JSDoc (FND-03) | ✓ VERIFIED | `plugins/narrative-tool/src/engine/schema/character.js:33`, `location.js:32`, `quest.js:38`, `item.js:34` each export `*Template/*Fields/*Required`; each file carries a `@typedef` (character.js:8, location.js:7, quest.js:7, item.js:7); tests/schema.test.js — 12 tests (4 entities × template/fields/JSDoc) all pass, asserting exact key sets and `Required` ⊇ {id, name} |
| 4 | esbuild build configuration bundles `src/` modules into a single-file `main.js`; root one-step build reproducible (FND-04) | ✓ VERIFIED | `plugins/narrative-tool/esbuild.config.mjs` — single entry `src/main.js`, `format: 'cjs'`, `external: ['obsidian','electron']`, `.css` text loader, minify; root `scripts/build.mjs` (Phase 7) runs esbuild then stages `output/narrative-tool/{main.js,manifest.json,styles.css}`. Probe: `npm run build` executed 2026-08-07 → `plugins/narrative-tool/main.js` (49,385 bytes) + staged output; `grep -o '"narrative-tool:[a-z-]*"' main.js | sort -u` = 10/10 command IDs present in bundle. v0.1 had three per-plugin builds; the single-plugin build is the Phase 5 merge outcome |
| 5 | `node:test` infrastructure with fixture/golden-driven export comparison; whole suite runnable via one command (FND-05) | ✓ VERIFIED | `node --test tests/*.test.js` → **310 pass / 0 fail, 86 suites** (run 2026-08-07); fixture auto-discovery + byte-exact golden comparison in tests/export-base.test.js:19-36 (`readdirSync(FIXTURES_DIR)` filter → per-fixture `it(...)` asserting `exportEngine` output `strictEqual` golden); 14 `.ncanvas` fixtures pair with 14 `.dialogue` goldens; `git diff HEAD -- tests/golden tests/fixtures` empty (golden regression contract intact) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `plugins/narrative-tool/src/engine/gd-constants.js` | GD DM token constants (v0.1: `shared/gd-constants.js`) | ✓ VERIFIED | 61 lines; frozen `TOKENS` with exact 9-key set; consumed by gd-format.js:9 and med-format.js:20 |
| `plugins/narrative-tool/src/engine/med-constants.js` | MED extension token constants (v0.1: `shared/gd-constants.js` MED section → split file) | ✓ VERIFIED | 85 lines; frozen `MED_TOKENS` with exact 8-key set; consumed by med-format.js:19 |
| `plugins/narrative-tool/src/engine/schema/{character,location,quest,item}.js` | Four entity schemas (v0.1: `shared/schema/`) | ✓ VERIFIED | 32–38 lines each; frozen Template + Fields + Required + `@typedef`; consumed by flow/entity-templates.js:10-13 |
| `plugins/narrative-tool/esbuild.config.mjs` | esbuild config (v0.1: one config per plugin ×3) | ✓ VERIFIED | Single entry, cjs, externals obsidian/electron, `.css` text loader; pinned esbuild ^0.28.1 via package-lock.json |
| `scripts/build.mjs` + root `package.json` | One-step root build (added Phase 7, ENG-02/03) | ✓ VERIFIED | `npm run build` → esbuild + stage `output/narrative-tool/`; fails fast with guidance if esbuild not installed |
| `tests/constants.test.js` | FND-02 token validation | ✓ VERIFIED | 10 tests / 3 describes; imports current engine paths (header comment documents D-03 relocation) |
| `tests/schema.test.js` | FND-03 schema validation | ✓ VERIFIED | 12 tests / 4 describes; asserts exact key sets, frozen templates, JSDoc presence |
| `tests/engine-purity.test.js` | Engine layer boundary guard (added Phase 5) | ✓ VERIFIED | 8 tests / 3 describes, incl. `D-03 constants relocation sanity` proving constants live in `engine/` with original export names |
| `tests/export-base.test.js` | Fixture/golden harness (FND-05; stubExport replaced by real engine in Phase 2) | ✓ VERIFIED | Auto-discovers `.ncanvas` fixtures, byte-compares against goldens via `assert.strictEqual` |
| `tests/fixtures/` + `tests/golden/` | Fixture/golden pairs | ✓ VERIFIED | 14 `.ncanvas` ↔ 14 `.dialogue` pairs (+ 4 `expected-*.md` entity goldens); byte-identical to HEAD |
| `plugins/narrative-tool/main.js` | Build output | ✓ VERIFIED (probe) | Rebuilt during verification: 49,385 bytes, 10 command IDs (gitignored artifact) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| engine/gd-format.js | engine/gd-constants.js | `require('./gd-constants')` | ✓ WIRED | gd-format.js:9 |
| engine/med-format.js | engine/med-constants.js + gd-constants.js | `require('./med-constants')` / `require('./gd-constants')` | ✓ WIRED | med-format.js:19-20 |
| flow/entity-templates.js | engine/schema/*.js | `require('../engine/schema/<type>')` | ✓ WIRED | entity-templates.js:10-13 — all four schemas consumed (incl. Quest) |
| scripts/build.mjs | plugins/narrative-tool/esbuild.config.mjs | `execFileSync(process.execPath, ['esbuild.config.mjs'], { cwd: pluginDir })` | ✓ WIRED | build.mjs:28; verified end-to-end by the build probe |
| tests/constants.test.js, schema.test.js | engine/ constants + schema modules | `require('../plugins/narrative-tool/src/engine/...')` | ✓ WIRED | constants.test.js:19,108; schema.test.js:92,127,160,196 — no legacy `shared/` imports remain anywhere in tests/ |
| root package.json | scripts/build.mjs + tests/ | npm scripts `build` / `test` | ✓ WIRED | package.json:6-9; both executed during verification |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite green | `node --test tests/*.test.js` | 310 pass / 0 fail / 86 suites (duration ~3.2s) | ✓ PASS |
| Golden files byte-identical | `git diff HEAD -- tests/golden tests/fixtures` | empty output (exit 0) | ✓ PASS |
| Build reproducible | `npm run build` | `[narrative-tool] build complete -> main.js`; `output/narrative-tool/` staged (main.js 49,385 B + manifest.json + styles.css) | ✓ PASS |
| All command IDs in bundle | `grep -o '"narrative-tool:[a-z-]*"' plugins/narrative-tool/main.js \| sort -u` | 10/10 IDs (batch-export-all-dialogues, create-character, create-flow-canvas, create-flow-fragment, create-item, create-location, create-quest, export-current-dialogue, open-flow-canvas, validate-references) | ✓ PASS |
| Engine purity (zero obsidian) | `grep -rn "require(['\"]obsidian['\"])" plugins/narrative-tool/src/engine/` | no matches (exit 1); also enforced by tests/engine-purity.test.js (incl. window./document. patterns) | ✓ PASS |
| No tracked legacy plugin code | `git ls-files plugins/` | only `plugins/.gitkeep` + `plugins/narrative-tool/**` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| FND-01 | 01-01 | 项目工作区结构初始化 — `plugins/`、`shared/`、`obsidian-vault/` 目录 | ✓ SATISFIED (with documented layout evolution) | Truth 1: `plugins/`, `tests/`, `scripts/` tracked and populated. `shared/` intentionally absorbed into `plugins/narrative-tool/src/engine/` by the Phase 5 merge (D-03); `obsidian-vault/` superseded by `TestVault/CanvasTest/`. Original v0.1 audit already marked FND-01 ✅ verified; the merge is a relocation, not a regression |
| FND-02 | 01-01 | 共享模块 `shared/gd-constants.js` — Godot Dialogue Manager + MED 状态系统所有 token 常量 | ✓ SATISFIED | Truth 2: `engine/gd-constants.js` (9 tokens) + `engine/med-constants.js` (8 tokens), both frozen, exact-key-set tested (constants.test.js, 10 tests green); relocation to `engine/` asserted by engine-purity.test.js `D-03 constants relocation sanity` |
| FND-03 | 01-01 | 共享模块 `shared/schema/` — 实体类型定义（Character, Location, Quest, Item） | ✓ SATISFIED | Truth 3: `engine/schema/*.js` ×4, all four export `*Template/*Fields/*Required` with `@typedef`; schema.test.js 12 tests green; all four consumed by flow/entity-templates.js:10-13 (v0.1 "Quest schema orphaned" warning resolved by Phase 5 BUG-01/BUG-07 fixes) |
| FND-04 | 01-02 | esbuild 构建配置 — 将 `src/` 模块打包为单文件 `main.js` | ✓ SATISFIED | Truth 4: single `esbuild.config.mjs` (three per-plugin configs collapsed by Phase 5 merge) + root `scripts/build.mjs` (Phase 7); `npm run build` probe rebuilt `main.js` with all 10 command IDs; bundle loads in Obsidian (human UAT 2026-08-07) |
| FND-05 | 01-03 | Node.js `node:test` 测试基础设施 — fixture 文件驱动的导出测试 | ✓ SATISFIED | Truth 5: `node --test tests/*.test.js` = 310/310 pass; fixture auto-discovery + byte-exact golden comparison (export-base.test.js:19-36); Phase 1 stubExport replaced by real `exportEngine` in Phase 2 exactly as the harness design intended; golden/fixtures byte-identical to HEAD |

No orphaned requirements: all 5 Phase-1-mapped requirements (FND-01..05) verified above against current code. Phase 1 scope has no v0.1 audit gap to carry forward — the milestone's ❌ items (ENT-03, FLW-05, B1/B2) belong to Phases 3/4 and were fixed in Phase 5.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers in Phase-1 artifacts (constants, schema, build config, build script, constants/schema/purity tests) | none found | none |
| plugins/{dialogue-export,flow-tools,narrative-project}/ | — | Gitignored build remnants (main.js, node_modules) from the pre-merge plugins still on disk | ℹ️ Info | Zero tracked files (`git ls-files` clean); cannot affect build or tests; optional manual cleanup, not a phase gap |

### Human Verification Required

Phase 1 artifacts are build-time/test-time concerns and are almost entirely machine-verifiable. One item touches the Obsidian runtime and was covered by human UAT on **2026-08-07** (PASSED):

1. **Built bundle loads in Obsidian** — `output/narrative-tool/` (main.js + manifest.json + styles.css from `npm run build`) copied into a vault loads without errors, proving the cjs bundle + external obsidian resolution + CSS text-loader path work against the real app.

### Gaps Summary

No gaps found. All 5 Phase 1 requirements verified against current codebase evidence (not SUMMARY claims): workspace structure intact post-merge, token constants complete and frozen with exact-key-set tests, four entity schemas defined and consumed, esbuild build reproducible end-to-end (`npm run build` probe executed during this verification), and the node:test fixture/golden infrastructure green at 310/310 with the golden regression contract (byte-identical `tests/golden` + `tests/fixtures` vs HEAD) holding. The two layout differences from the v0.1 text (absorbed `shared/`, single-plugin build) are documented Phase 5/Phase 7 decisions, not deficiencies.

---

_Verified: 2026-08-07T05:20:00Z_
_Verifier: Kimi Code CLI (subagent)_

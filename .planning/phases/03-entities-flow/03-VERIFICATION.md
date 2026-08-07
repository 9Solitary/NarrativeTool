---
phase: 03-entities-flow
verified: 2026-08-07T05:05:00Z
status: verified
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  note: "Retroactive verification against the current v1.0 codebase (post Phase 5 merge, Phase 6 engine features, Phase 8 UX). v0.1 audit gaps ENT-03 / FLW-01 / FLW-02 / FLW-05 / FLW-06-partial were fixed in Phase 5; FLW-01/02 were then redesigned articy-style by user decision on 2026-08-07."
gaps: []
human_verification:
  - test: "Run '创建角色/创建地点/创建任务/创建物品' (create-character/location/quest/item) from the command palette, enter ID + name"
    expected: "Entity .md created under Characters/ Locations/ Quests/ Items/ with correct YAML frontmatter (incl. tags) and body matching the golden template; file opens automatically; non-slug IDs are normalized with a notice"
    why_human: "Modal flow + vault file creation only happen inside the Obsidian runtime; unit tests prove template content matches golden fixtures byte-for-byte, not the live modal workflow. Runtime UAT passed 2026-08-07."
  - test: "Run '创建 Flow' (create-flow-canvas) and enter a name"
    expected: "Flows/<name>.canvas created with a single title node, plus a same-name folder Flows/<name>/; canvas opens in Canvas view"
    why_human: "Requires real Obsidian vault + Canvas rendering. Runtime UAT passed 2026-08-07."
  - test: "Run '创建 Flow 片段' (create-flow-fragment); pick a parent Flow canvas, enter a name"
    expected: "Fragment .canvas created under <parent dir>/<parent basename>/<name>.canvas and a file node referencing the fragment is appended to the parent canvas JSON"
    why_human: "Parent picker modal + canvas write-back only occur in the Obsidian runtime. Runtime UAT passed 2026-08-07."
  - test: "Right-click a .canvas file in the file explorer"
    expected: "Menu offers 6 items + separator: 添加对话节点 / 添加角色节点 / 添加地点节点 / 添加物品节点 / 添加任务节点, separator, 打开关联对话"
    why_human: "File-menu rendering is Obsidian runtime UI; code path verified in main.js _registerFileMenuHooks but menu appearance cannot be verified programmatically. Runtime UAT passed 2026-08-07."
  - test: "Open a Flow canvas containing .ncanvas and entity .md file nodes"
    expected: "Dialogue nodes show a blue left border, entity .md nodes show a cyan left border (data-nt-type visual distinction); <style id=\"narrative-tool-styles\"> present in DOM"
    why_human: "DOM annotation (observer) + CSS injection are runtime behaviors against Obsidian's live Canvas DOM. Runtime UAT passed 2026-08-07."
  - test: "Right-click a .canvas with dialogue nodes and choose '打开关联对话'; then open a .ncanvas and run '打开 Flow 画布' plus right-click the .ncanvas in the explorer"
    expected: "Flow→Dialogue: the referenced .ncanvas opens (picker when multiple). Dialogue→Flow: the referencing .canvas opens (picker when multiple, notice when none)"
    why_human: "Bidirectional navigation depends on live vault content and workspace.openLinkText in Obsidian. Runtime UAT passed 2026-08-07."
---

# Phase 3: Entities + Flow Tools Verification Report

**Phase Goal:** Narrative designers can create structured Character, Location, Quest, and Item entities from templates, build Flow canvases, and navigate bidirectionally between Flow and Dialogue.
**Verified:** 2026-08-07T05:05:00Z
**Status:** verified (8/8 truths VERIFIED against the current v1.0 codebase; runtime behaviors confirmed by human UAT on 2026-08-07)
**Re-verification:** No — initial verification (retroactive, post-merge)

## Scope Note (v0.1 requirement → v1.0 code mapping)

This phase was originally implemented across `plugins/flow-tools/` (v0.1). Phase 5 merged all code into the single plugin `plugins/narrative-tool/src/` and deleted the legacy directories. All line references below are to the **current** merged codebase. The v0.1 milestone audit found four gaps in this phase's scope; each is recorded with its fix:

| v0.1 Gap | Fix | Current State |
|----------|-----|---------------|
| ENT-03: `createQuestMd` deleted after commit `11005f8`; golden file removed | Phase 5 (BUG-01/BUG-07) restored the generator, golden fixture, command, and menu item | `entity-templates.js:173`, `main.js:200-207`, golden test green |
| FLW-05: `openFlowCanvas` existed but was never wired into main.js | Phase 5 (BUG-05) added the `open-flow-canvas` command + .ncanvas file-menu entry backed by `findFlowCanvasForDialogue` | `main.js:233-237`, `main.js:630-639`, `navigation.js:92` |
| FLW-06: file menu had 5 items, missing "Add quest node" | Phase 5 (BUG-07) added the quest node menu item | `main.js:601-613` |
| FLW-01/02: template module existed but commands produced minimal title-only canvases | Phase 5 (BUG-04) wired the templates; **then 2026-08-07 user decision** redesigned creation articy-style and deleted the template module entirely (see below) | `main.js:419-460`, `main.js:466-534` |

**FLW-01/02 implementation change (must be read before the tables below):** on 2026-08-07 the user decided to redesign Flow creation articy-style (recorded in `.planning/STATE.md:66` and `main.js:11-13`): creation asks for a **name only**; a Flow is `Flows/<name>.canvas` (single title node) plus a same-name folder `Flows/<name>/`; a Fragment must be attached to a parent Flow, lives under the parent's folder, and a reference file node is written back into the parent canvas. The original template-based module `flow/canvas-templates.js` (5 templates, 12 golden tests) was **deleted in full** — verified absent from `plugins/narrative-tool/src/flow/` and from `tests/`. The requirement intent (fast creation of Flow canvases and fragments) is satisfied by this simpler, user-chosen design; the user requirement decision takes precedence over the original template plan.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Four entity Markdown template generators (Character/Location/Quest/Item) produce YAML-frontmatter Markdown that matches golden fixtures byte-for-byte (ENT-01~04; ENT-03 restored after v0.1 deletion) | ✓ VERIFIED | `plugins/narrative-tool/src/flow/entity-templates.js` exports `createCharacterMd` (line 75), `createLocationMd` (119), `createQuestMd` (173), `createItemMd` (233); `tests/entity-templates.test.js` describes `Character template (ENT-01)` / `Location template (ENT-02)` / `Quest template (ENT-03)` / `Item template (ENT-04)` each assert `strictEqual` against `tests/fixtures/expected-{character,location,quest,item}.md`; all 4 fixtures present; suite green |
| 2 | Graph View tags embedded in every template's frontmatter: `tags: [character|location|quest|item]` (ENT-05) | ✓ VERIFIED | `buildFrontmatter` writes `tags: [${tag}]` (entity-templates.js:47-57, tag line 52); `tests/entity-templates.test.js` describe `Graph View tags (ENT-05)` — 4 sub-tests assert each tag string; Graph View indexing itself is Obsidian runtime behavior (human UAT 2026-08-07) |
| 3 | All 4 entity creation commands registered and routed to the correct template + default folder, incl. the restored Quest command (ENT-01~04 wiring) | ✓ VERIFIED | `main.js:175-216` entities array → `_createEntityFromCommand` (314-406); create-quest entry `main.js:200-207`; `tests/merge-smoke.test.js` it `registers exactly 10 commands with the narrative-tool: prefix (D-08)` asserts the exact ID set incl. `narrative-tool:create-quest`; `tests/entity-create.test.js` describe `NarrativeToolPlugin - _createEntityFromCommand (WR-03)` proves the workflow writes slugified-ID frontmatter to `Characters/bob-smith.md` via a mock vault |
| 4 | Flow Canvas creation: name-only prompt → `Flows/<name>.canvas` (single title node) + `Flows/<name>/` fragment folder, path-traversal guarded (FLW-01, articy-style redesign) | ✓ VERIFIED | `main.js:219-223` command → `_createFlowCanvasFromCommand` (419-460): slugify + `..`/slash sanitization (429), prefix guard (433), duplicate check (437), `createCanvas`+title node (443-448), folder+file+fragment-folder creation (451-457), open (459); command ID asserted in merge-smoke exact-10 test; end-to-end runtime confirmed by human UAT 2026-08-07 |
| 5 | Flow Fragment creation: parent Flow picker (mandatory), fragment created under `<parent dir>/<parent basename>/`, reference file node written back into parent canvas JSON (FLW-02, articy-style redesign) | ✓ VERIFIED | `main.js:226-230` command → `_createFlowFragmentFromCommand` (466-534): canvas-file picker via `FileSuggesterModal` (468-480, aborts with notice when no Flow exists 470-473), fragment path under parent folder (491-494), tab-indented write (515), parent write-back via `addNodeToCanvas` + `vault.modify` (517-530, failure surfaces error notice 528-530); `tests/modals.test.js` describe `FileSuggesterModal` proves choose/null-on-cancel/no-double-fire/A4-race behavior of the picker; runtime UAT 2026-08-07 |
| 6 | Canvas node type visual distinction: `data-nt-type` CSS (dialogue blue, entity cyan) injected at runtime + DOM observer annotates `.canvas-node` elements (FLW-03; v0.1 partial "dialogue-only" gap fixed in Phase 5 BUG-06) | ✓ VERIFIED (code) / ⚠ runtime | `src/styles.css:34-41` dialogue/entity rules (+ forward-compatible per-type rules 45-62); `main.js:31` `require('./styles.css')` → `_injectCanvasStyles` (816-825, id `narrative-tool-styles`); observer `_setupCanvasNodeTypeObserver` (831-861) + `_annotateAllCanvasViews` (863-896) sets `data-nt-type="dialogue"` for .ncanvas labels and `"entity"` for .md labels; entity nodes also get Obsidian Canvas `color` at creation (`ENTITY_COLORS`, main.js:52, applied 698-707); visual rendering verified by human UAT 2026-08-07 |
| 7 | Bidirectional navigation: Flow→Dialogue via file-menu "打开关联对话" + `openDialogueFile` (FLW-04); Dialogue→Flow via `open-flow-canvas` command AND .ncanvas right-click entry, backed by `findFlowCanvasForDialogue` vault scan (FLW-05 — v0.1 unwired gap fixed in Phase 5 BUG-05) | ✓ VERIFIED | FLW-04: menu item `main.js:618-625` → `_openLinkedDialogueFromCanvas` (714-755, single→direct open, multiple→picker) → `openDialogueFile` (navigation.js:28). FLW-05: command `main.js:233-237` → `_openFlowCanvasFromCommand` (778-797, incl. NC custom-view file resolution 780-791) and .ncanvas menu `main.js:630-639` → `_openFlowCanvasForFile` (799-810) → `findFlowCanvasForDialogue` (navigation.js:92-110); `tests/navigation.test.js` describe `findFlowCanvasForDialogue (BUG-05 reverse navigation)` — 4 tests: found / multiple / none / unparseable-canvas-skipped, all green |
| 8 | File-menu integration complete: .canvas right-click offers 6 items + separator (Add dialogue/character/location/item/quest node + 打开关联对话); .ncanvas right-click offers 打开 Flow 画布 (FLW-06 — v0.1 missing-quest gap fixed in Phase 5 BUG-07) | ✓ VERIFIED (code) / ⚠ runtime | `_registerFileMenuHooks` `main.js:540-642`: dialogue node item 546-553, character 556-568, location 571-583, item 585-598, quest 601-613, separator 615, open linked dialogue 618-625, .ncanvas reverse-nav entry 630-639; entity pickers list vault .md files per default folder via `_getEntityFiles` (762-772) with empty-folder notices; menu appearance verified by human UAT 2026-08-07 |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `plugins/narrative-tool/src/flow/entity-templates.js` (274 lines) | 4 entity template generators | ✓ VERIFIED | createCharacterMd (75), createLocationMd (119), createQuestMd (173), createItemMd (233); schema fields sourced from `engine/schema/*` (imports lines 10-13); YAML-injection-safe `yamlStr`/`yamlArr` (25-38) |
| `plugins/narrative-tool/src/flow/canvas-utils.js` (77 lines) | Canvas JSON utilities | ✓ VERIFIED | `generateNodeId` 16-hex (22-24), `createCanvas` (30), `addNodeToCanvas` spread-preserving (41-46), `addDialogueNodeToCanvas` (57-70); used by main.js flow-creation and menu handlers |
| `plugins/narrative-tool/src/flow/navigation.js` (117 lines) | Navigation helpers | ✓ VERIFIED | `openDialogueFile` (28), `openFlowCanvas` (49), `openFileInSplit` (70), `findFlowCanvasForDialogue` (92); app-parameterized for mock-based testing |
| `plugins/narrative-tool/src/main.js` (897 lines) | All Phase-3 wiring in merged plugin | ✓ VERIFIED | Entity commands 175-216, flow commands 218-237, entity workflow 314-406, flow/fragment workflows 419-534, file-menu hooks 540-642, reverse navigation 778-810, CSS injection 816-825, DOM observer 831-896 |
| `plugins/narrative-tool/src/styles.css` | data-nt-type canvas rules | ✓ VERIFIED | Dialogue rule 34-36, entity rule 39-41, forward-compatible per-entity rules 45-62; injected at runtime (main.js:816-825) |
| `plugins/narrative-tool/src/ui/modals.js` | Pickers/input for creation flows | ✓ VERIFIED | `FileSuggesterModal` (line 63) used by fragment parent picker + entity/dialogue node pickers; `promptForInput` (line 152) used by all name/ID prompts; null-on-cancel behavior tested in modals.test.js |
| `tests/entity-templates.test.js` + `tests/fixtures/expected-*.md` | Golden tests for ENT-01~05 | ✓ VERIFIED | 14 tests; all 4 golden fixtures present and matched byte-for-byte |
| `tests/entity-create.test.js` | Entity creation workflow test | ✓ VERIFIED | 3 tests (WR-03 slug-frontmatter consistency) against main.js via mock vault |
| `tests/navigation.test.js` | Reverse navigation tests | ✓ VERIFIED | 4 tests for `findFlowCanvasForDialogue` |
| `tests/modals.test.js` | Picker cancel/choose contracts | ✓ VERIFIED | 8 tests (FileSuggesterModal ×4, StringSuggesterModal ×2, FolderSuggestModal ×1, promptForInput ×1) |
| `tests/merge-smoke.test.js` | Command inventory incl. Phase-3 commands | ✓ VERIFIED | Exact-10-command assertion covers create-character/location/item/quest, create-flow-canvas, create-flow-fragment, open-flow-canvas |
| `plugins/narrative-tool/src/flow/canvas-templates.js` | (v0.1 artifact) Flow/Fragment template module | ✗ REMOVED — intentional | Deleted per 2026-08-07 user decision (articy-style redesign, STATE.md:66); `tests/canvas-templates.test.js` and the 5 `.canvas` golden fixtures removed with it; verified absent |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| main.js | flow/entity-templates.js | createCharacterMd/createLocationMd/createQuestMd/createItemMd | ✓ WIRED | import line 28; routed in entities array (175-216); invoked at 374 |
| main.js | flow/canvas-utils.js | generateNodeId/createCanvas/addNodeToCanvas/addDialogueNodeToCanvas | ✓ WIRED | import line 29; uses at 443, 506, 521, 673, 698-708 |
| main.js | flow/navigation.js | openDialogueFile/openFlowCanvas/findFlowCanvasForDialogue | ✓ WIRED | import line 30; uses at 735, 754, 800, 804, 807 |
| main.js | ui/modals.js | FileSuggesterModal/promptForInput | ✓ WIRED | import line 23; uses at 317, 324, 475, 658, 683, 749, 806 |
| main.js | src/styles.css | require('./styles.css') + runtime injection | ✓ WIRED | import line 31; `_injectCanvasStyles` 816-825 |
| command `narrative-tool:create-quest` | createQuestMd | entities array entry | ✓ WIRED | main.js:200-207 (v0.1 gap ENT-03 → fixed Phase 5) |
| command `narrative-tool:open-flow-canvas` + .ncanvas file-menu | findFlowCanvasForDialogue | _openFlowCanvasFromCommand / _openFlowCanvasForFile | ✓ WIRED | command 233-237, menu 630-639, lookup 800 (v0.1 gap FLW-05 → fixed Phase 5) |
| .canvas file-menu "添加任务节点" | _addFileNodeToCanvasFile('quest') | menu item | ✓ WIRED | main.js:601-613 (v0.1 gap FLW-06 → fixed Phase 5) |
| main.js | flow/canvas-templates.js | createFlowCanvas/createFlowFragment (template-based) | ✗ REMOVED — intentional | v0.1 template module deleted per 2026-08-07 user decision; replaced by articy-style name-only creation (main.js:419-534). Requirement intent preserved — see Scope Note |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite green | `node --test tests/*.test.js` | 310 pass / 0 fail (86 suites) | ✓ PASS |
| Phase-3-relevant suites green | `node --test tests/entity-templates.test.js tests/entity-create.test.js tests/navigation.test.js tests/modals.test.js tests/merge-smoke.test.js` | 33 pass / 0 fail (15 suites) | ✓ PASS |
| Golden/fixture contract byte-identical | `git diff HEAD --stat -- tests/golden tests/fixtures` | empty (no changes) | ✓ PASS |
| canvas-templates module fully removed (2026-08-07 decision) | `ls plugins/narrative-tool/src/flow/` + grep `canvas-templates` in src | only canvas-utils/entity-templates/navigation remain; zero references | ✓ PASS |
| Entity commands incl. quest in command inventory | merge-smoke it `registers exactly 10 commands with the narrative-tool: prefix (D-08)` | exact ID set asserted incl. create-quest / create-flow-canvas / create-flow-fragment / open-flow-canvas | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| ENT-01 | 03-01 | Character Markdown 模板 | ✓ SATISFIED | entity-templates.js:75; golden test `Character template (ENT-01)` vs expected-character.md; command main.js:177-183 (T1, T3) |
| ENT-02 | 03-01 | Location Markdown 模板 | ✓ SATISFIED | entity-templates.js:119; golden test `Location template (ENT-02)` vs expected-location.md; command main.js:184-190 (T1, T3) |
| ENT-03 | 03-01 | Quest Markdown 模板 | ✓ SATISFIED (v0.1 gap → Phase 5 fix → verified) | v0.1 audit: `createQuestMd` deleted after `11005f8`. Restored: entity-templates.js:173, fixture expected-quest.md, golden test `Quest template (ENT-03)`, command main.js:200-207, menu item main.js:601-613 (T1, T3, T8) |
| ENT-04 | 03-01 | Item Markdown 模板 | ✓ SATISFIED | entity-templates.js:233; golden test `Item template (ENT-04)` vs expected-item.md; command main.js:192-198 (T1, T3) |
| ENT-05 | 03-01 | 实体在 Obsidian Graph View 中正确索引和显示 | ✓ SATISFIED | `tags: [...]` in frontmatter via buildFrontmatter (entity-templates.js:52); 4 sub-tests in `Graph View tags (ENT-05)`; wikilinks `[[id]]` between entities in templates (e.g. 142, 203, 255); Graph View rendering itself is Obsidian runtime — human UAT 2026-08-07 (T2) |
| FLW-01 | 03-02/03 | 从模板快速创建 Flow Canvas | ✓ SATISFIED — implementation changed | Original template approach deleted; articy-style name-only creation per 2026-08-07 user decision: command main.js:219-223 → `_createFlowCanvasFromCommand` (419-460) creates Flows/<name>.canvas + Flows/<name>/ folder and opens it; UAT 2026-08-07 (T4) |
| FLW-02 | 03-02/03 | 从模板创建 Flow Fragment Canvas | ✓ SATISFIED — implementation changed | Articy-style: command main.js:226-230 → `_createFlowFragmentFromCommand` (466-534): mandatory parent Flow picker, fragment under parent folder, reference node written back to parent canvas; picker contract tested in modals.test.js `FileSuggesterModal`; UAT 2026-08-07 (T5) |
| FLW-03 | 03-03 | Canvas 节点类型识别 | ✓ SATISFIED (v0.1 partial → Phase 5 fix → verified) | v0.1: dialogue-only blue border. Now: styles.css:34-41 dialogue+entity rules, runtime injection main.js:816-825, observer annotation main.js:863-896, plus Obsidian Canvas `color` per entity type (main.js:52, 698-707); visuals are runtime-only — human UAT 2026-08-07 (T6) |
| FLW-04 | 03-03 | Flow → Dialogue 导航 | ✓ SATISFIED | File-menu "打开关联对话" main.js:618-625 → `_openLinkedDialogueFromCanvas` (714-755) → `openDialogueFile` (navigation.js:28); single→direct open, multiple→picker; runtime navigation UAT 2026-08-07 (T7, T8) |
| FLW-05 | 03-03 | Dialogue → Flow 导航 | ✓ SATISFIED (v0.1 gap → Phase 5 fix → verified) | v0.1 audit: unwired. Now: command main.js:233-237 + .ncanvas menu main.js:630-639 → `_openFlowCanvasForFile` (799-810) → `findFlowCanvasForDialogue` (navigation.js:92); 4 automated tests in navigation.test.js; runtime UAT 2026-08-07 (T7) |
| FLW-06 | 03-03 | Flow 文件菜单集成 | ✓ SATISFIED (v0.1 partial → Phase 5 fix → verified) | v0.1: 5 items, no quest. Now: 6 items + separator on .canvas (main.js:546-625, incl. 添加任务节点 601-613) + 1 item on .ncanvas (630-639); menu rendering is runtime-only — human UAT 2026-08-07 (T8) |

No orphaned requirements: all 11 Phase-3 requirements (ENT-01~05, FLW-01~06) are covered above against the current codebase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers in flow/ + Phase-3 sections of main.js | none found | none |
| styles.css | 45-62 | Forward-compatible per-entity-type CSS rules (character/location/quest/item) not yet activated — observer only sets dialogue/entity | ℹ️ Info | Documented in the CSS file itself (lines 43-54) and in the styles.css header comment; entity nodes are already visually distinguished via the `entity` rule + Obsidian Canvas `color`; not a stub |

### Human Verification Required

All Obsidian-runtime behaviors for this phase were verified by human UAT on **2026-08-07** (status: passed — see `.planning/STATE.md:65`). Six items (detailed format in frontmatter):

1. **Entity creation via palette** — all 4 types create correct .md files with golden-matching content
2. **Create Flow** — name-only → canvas + same-name folder
3. **Create Flow Fragment** — parent picker, fragment under parent folder, parent canvas write-back
4. **File menu on .canvas** — 6 items + separator incl. 添加任务节点
5. **data-nt-type visuals** — dialogue blue border, entity cyan border on canvas
6. **Bidirectional navigation** — 打开关联对话 (Flow→Dialogue) and 打开 Flow 画布 command + right-click (Dialogue→Flow)

### Gaps Summary

No gaps found against the current requirement wording. All 8 must-have truths verified against codebase evidence (not SUMMARY claims): four golden-matching entity templates (ENT-03 restored after its v0.1 deletion), Graph tags, all four entity commands plus the three flow/navigation commands in the exact-10-command smoke test, articy-style Flow/Fragment creation with parent write-back, data-nt-type CSS + observer, bidirectional navigation with 4 automated reverse-lookup tests, and the complete 6+1 file menu (quest node restored). Full suite 310/310 green; golden/fixture contract byte-identical to HEAD.

One intentional implementation change is on record rather than a gap: FLW-01/02 no longer use the v0.1 template module (`flow/canvas-templates.js`, deleted with its 12 golden tests) — the 2026-08-07 user decision replaced template pre-configuration with articy-style name-only creation (`.planning/STATE.md:66`, `main.js:11-13`). The requirement intent — fast creation of Flow canvases and fragments — is satisfied and was UAT-verified on 2026-08-07.

---

_Verified: 2026-08-07T05:05:00Z_
_Verifier: Claude (gsd-verifier)_

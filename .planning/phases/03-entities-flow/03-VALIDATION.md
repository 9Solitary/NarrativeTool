---
phase: 03-entities-flow
validated: 2026-08-07
coverage: 55/55 behavior claims covered (35 automated, 17 human-only, 3 mixed)
requirements: 11/11 (ENT-01~05, FLW-01~06)
test_command: "node --test tests/*.test.js"
test_result: "310 pass / 0 fail (86 suites)"
notes: "Validation against the current v1.0 codebase (post Phase 5 merge). v0.1 gaps ENT-03 / FLW-05 / FLW-06-partial fixed in Phase 5; FLW-01/02 redesigned articy-style per 2026-08-07 user decision (.planning/STATE.md:66). All human-only claims covered by the 2026-08-07 runtime UAT, which passed (.planning/STATE.md:65)."
---

# Phase 3: Entities + Flow Tools — Nyquist Validation

Every behavior claim for each requirement is listed with its concrete test evidence.
Test names were copied verbatim from the test sources. `文件::测试名` uses
`describe > it` naming.

## ENT-01 — Character Markdown 模板

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| `createCharacterMd` output matches golden `tests/fixtures/expected-character.md` byte-for-byte | tests/entity-templates.test.js::Character template (ENT-01) > should match golden file expected-character.md | ✓ automated |
| Frontmatter contains `id` and `name` fields | tests/entity-templates.test.js::Frontmatter required fields > all templates should include id and name in YAML frontmatter | ✓ automated |
| Frontmatter contains `tags: [character]` (Graph View tag) | tests/entity-templates.test.js::Graph View tags (ENT-05) > character template should contain tags: [character] | ✓ automated |
| Double quotes in user values are escaped (`\"`) — YAML injection safety | tests/entity-templates.test.js::YAML injection safety > should escape double quotes in name values | ✓ automated |
| Colons inside values do not break YAML | tests/entity-templates.test.js::YAML injection safety > should handle colons in string values without breaking YAML | ✓ automated |
| Empty `appearanceScenes` renders as `appearance_scenes: []`, not an empty value | tests/entity-templates.test.js::Empty optional fields > should not produce empty appearance_scenes value | ✓ automated |
| Command palette "创建角色" creates `Characters/<slug>.md` and opens it; non-slug IDs are normalized into frontmatter with a notice | tests/entity-create.test.js::NarrativeToolPlugin - _createEntityFromCommand (WR-03) > writes the slugified id into the frontmatter when the raw id has spaces (WR-03); ... > notifies when the id was normalized to a filename-safe slug; modal/open portion ⚠ human-only | ✓ automated (slug/frontmatter) + ⚠ human-only (modal workflow, UAT 2026-08-07) |

## ENT-02 — Location Markdown 模板

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| `createLocationMd` output matches golden `expected-location.md` byte-for-byte | tests/entity-templates.test.js::Location template (ENT-02) > should match golden file expected-location.md | ✓ automated |
| Frontmatter contains `id` and `name` | tests/entity-templates.test.js::Frontmatter required fields > all templates should include id and name in YAML frontmatter | ✓ automated |
| Frontmatter contains `tags: [location]` | tests/entity-templates.test.js::Graph View tags (ENT-05) > location template should contain tags: [location] | ✓ automated |
| Double quotes escaped (Location assertion within the shared injection test) | tests/entity-templates.test.js::YAML injection safety > should escape double quotes in name values | ✓ automated |
| Empty `connectedLocations` renders as `connected_locations: []` | tests/entity-templates.test.js::Empty optional fields > should not produce invalid YAML for empty arrays | ✓ automated |
| Command palette "创建地点" creates `Locations/<slug>.md` and opens it | Command registered + routed (main.js:184-190); live modal flow ⚠ human-only | ⚠ human-only (UAT 2026-08-07) |

## ENT-03 — Quest Markdown 模板

v0.1 audit: **gap** — `createQuestMd` deleted after commit `11005f8`, golden file removed.
Phase 5 (BUG-01/BUG-07) restored generator + fixture + command + menu item. Current state verified:

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| `createQuestMd` exists and output matches golden `expected-quest.md` byte-for-byte | tests/entity-templates.test.js::Quest template (ENT-03) > should match golden file expected-quest.md | ✓ automated |
| Frontmatter contains `id` and `name` | tests/entity-templates.test.js::Frontmatter required fields > all templates should include id and name in YAML frontmatter | ✓ automated |
| Frontmatter contains `tags: [quest]` | tests/entity-templates.test.js::Graph View tags (ENT-05) > quest template should contain tags: [quest] | ✓ automated |
| Double quotes escaped (Quest assertion within the shared injection test) | tests/entity-templates.test.js::YAML injection safety > should escape double quotes in name values | ✓ automated |
| Command `narrative-tool:create-quest` is registered | tests/merge-smoke.test.js::NarrativeToolPlugin merge smoke test (05-04) > registers exactly 10 commands with the narrative-tool: prefix (D-08) | ✓ automated |
| Command palette "创建任务" creates `Quests/<slug>.md` with correct frontmatter (quest_type, prerequisites, stages, giver_character_id, involved_location_ids) and opens it | Live modal flow ⚠ human-only | ⚠ human-only (UAT 2026-08-07) |

## ENT-04 — Item Markdown 模板

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| `createItemMd` output matches golden `expected-item.md` byte-for-byte | tests/entity-templates.test.js::Item template (ENT-04) > should match golden file expected-item.md | ✓ automated |
| Frontmatter contains `id` and `name` | tests/entity-templates.test.js::Frontmatter required fields > all templates should include id and name in YAML frontmatter | ✓ automated |
| Frontmatter contains `tags: [item]` | tests/entity-templates.test.js::Graph View tags (ENT-05) > item template should contain tags: [item] | ✓ automated |
| Double quotes escaped (Item assertion within the shared injection test) | tests/entity-templates.test.js::YAML injection safety > should escape double quotes in name values | ✓ automated |
| Empty `relatedQuestId`/`ownerCharacterId` render as `""`, not missing keys | tests/entity-templates.test.js::Empty optional fields > should produce valid YAML for empty strings | ✓ automated |
| Command palette "创建物品" creates `Items/<slug>.md` and opens it | Command registered + routed (main.js:192-198); live modal flow ⚠ human-only | ⚠ human-only (UAT 2026-08-07) |

## ENT-05 — 实体在 Obsidian Graph View 中正确索引和显示

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| Character template embeds `tags: [character]` | tests/entity-templates.test.js::Graph View tags (ENT-05) > character template should contain tags: [character] | ✓ automated |
| Location template embeds `tags: [location]` | tests/entity-templates.test.js::Graph View tags (ENT-05) > location template should contain tags: [location] | ✓ automated |
| Quest template embeds `tags: [quest]` | tests/entity-templates.test.js::Graph View tags (ENT-05) > quest template should contain tags: [quest] | ✓ automated |
| Item template embeds `tags: [item]` | tests/entity-templates.test.js::Graph View tags (ENT-05) > item template should contain tags: [item] | ✓ automated |
| Inter-entity references use `[[id]]` wikilinks (Graph edges) in template bodies | Covered by the four golden matches above (fixtures contain `[[...]]` links, e.g. expected-location.md / expected-quest.md / expected-item.md) | ✓ automated |
| Created entities actually appear/index in Obsidian Graph View via tags + wikilinks | Graph View rendering is Obsidian runtime behavior | ⚠ human-only (UAT 2026-08-07) |

## FLW-01 — 从模板快速创建 Flow Canvas

**Implementation change on record:** v0.1 planned template-based creation; the template module existed but was unwired (v0.1 gap), was wired in Phase 5, and was then **deleted in full** per the 2026-08-07 user decision — Flow creation is now articy-style: name-only, `Flows/<name>.canvas` (single title node) + same-name folder `Flows/<name>/` (`.planning/STATE.md:66`, main.js:11-13, `_createFlowCanvasFromCommand` main.js:419-460).

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| Command `narrative-tool:create-flow-canvas` is registered | tests/merge-smoke.test.js::NarrativeToolPlugin merge smoke test (05-04) > registers exactly 10 commands with the narrative-tool: prefix (D-08) | ✓ automated |
| Name-only prompt creates `Flows/<name>.canvas` with a single title node plus the `Flows/<name>/` folder; canvas opens; cancel aborts cleanly | Name prompt via `promptForInput`; cancel-resolution contract: tests/modals.test.js::promptForInput > registers an onClose handler that resolves the promise; file/folder creation + Canvas rendering ⚠ human-only | ✓ automated (prompt contract) + ⚠ human-only (UAT 2026-08-07) |
| Path-traversal and duplicate-name guards reject unsafe/existing names with an error notice | Guard code main.js:429-440; no automated test — exercised during UAT | ⚠ human-only (UAT 2026-08-07) |

## FLW-02 — 从模板创建 Flow Fragment Canvas

Same implementation change as FLW-01: articy-style — a Fragment must belong to a parent Flow, lives under `<parent dir>/<parent basename>/`, and a reference file node is written back into the parent canvas (`_createFlowFragmentFromCommand` main.js:466-534).

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| Command `narrative-tool:create-flow-fragment` is registered | tests/merge-smoke.test.js::NarrativeToolPlugin merge smoke test (05-04) > registers exactly 10 commands with the narrative-tool: prefix (D-08) | ✓ automated |
| Parent Flow picker resolves the chosen file on selection | tests/modals.test.js::FileSuggesterModal > invokes onChoose with the chosen file on selection | ✓ automated |
| Cancelling the picker resolves null (command aborts, never hangs) | tests/modals.test.js::FileSuggesterModal > invokes onChoose with null when dismissed without a choice (WR-02); ... > does not double-fire onClose after a choice was made; ... > selection wins when onClose fires before onChooseSuggestion (A4 race) | ✓ automated |
| Fragment created under the parent folder, reference node appended to parent canvas JSON; write-back failure surfaces an error notice; "no Flow exists" aborts with an error notice | End-to-end vault write-back ⚠ human-only | ⚠ human-only (UAT 2026-08-07) |

## FLW-03 — Canvas 节点类型识别（视觉区分）

v0.1 audit: **partial** — dialogue nodes only. Phase 5 (BUG-06) added runtime CSS injection + entity annotation. All claims are DOM/runtime behaviors.

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| Dialogue (.ncanvas) nodes show a blue left border via `data-nt-type="dialogue"` | CSS rule styles.css:34-36; annotation main.js:876-879; DOM behavior | ⚠ human-only (UAT 2026-08-07) |
| Entity (.md) nodes show a cyan left border via `data-nt-type="entity"` | CSS rule styles.css:39-41; annotation main.js:880-883; DOM behavior | ⚠ human-only (UAT 2026-08-07) |
| Entity nodes added via the file menu also carry an Obsidian Canvas `color` per type (character green / location orange / item red / quest purple) | `ENTITY_COLORS` main.js:52, applied main.js:698-707; canvas rendering | ⚠ human-only (UAT 2026-08-07) |
| Styles are injected at runtime as `<style id="narrative-tool-styles">` and the observer annotates nodes on poll/layout-change | `_injectCanvasStyles` main.js:816-825; `_setupCanvasNodeTypeObserver`/`_annotateAllCanvasViews` main.js:831-896; runtime DOM | ⚠ human-only (UAT 2026-08-07) |

## FLW-04 — Flow → Dialogue 导航

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| .canvas right-click "打开关联对话" opens the referenced .ncanvas (directly when exactly one) | Menu item main.js:618-625 → `_openLinkedDialogueFromCanvas` (714-755) → `openDialogueFile` (navigation.js:28); runtime navigation | ⚠ human-only (UAT 2026-08-07) |
| Multiple dialogue nodes on one canvas → file picker, chosen file opens | Picker branch main.js:739-754; picker contract covered by tests/modals.test.js::FileSuggesterModal > invokes onChoose with the chosen file on selection; runtime flow ⚠ human-only | ✓ automated (picker contract) + ⚠ human-only (UAT 2026-08-07) |
| Canvas without dialogue nodes → notice, no crash | Branch main.js:728-731; runtime | ⚠ human-only (UAT 2026-08-07) |

## FLW-05 — Dialogue → Flow 导航（反向）

v0.1 audit: **gap** — `openFlowCanvas` existed but was never wired. Phase 5 (BUG-05) wired the command + right-click entry + vault-scan lookup.

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| `findFlowCanvasForDialogue` finds the .canvas whose file node references the dialogue | tests/navigation.test.js::findFlowCanvasForDialogue (BUG-05 reverse navigation) > finds the canvas whose file node references the dialogue | ✓ automated |
| Multiple referencing canvases are all returned | tests/navigation.test.js::... > returns all canvases when several reference the dialogue | ✓ automated |
| No referencing canvas → empty array (caller shows notice) | tests/navigation.test.js::... > returns an empty array when nothing references the dialogue | ✓ automated |
| Unparseable .canvas files are skipped without throwing | tests/navigation.test.js::... > skips unparseable canvases and does not throw | ✓ automated |
| Command `narrative-tool:open-flow-canvas` is registered | tests/merge-smoke.test.js::NarrativeToolPlugin merge smoke test (05-04) > registers exactly 10 commands with the narrative-tool: prefix (D-08) | ✓ automated |
| From an open .ncanvas, the command AND the right-click "打开 Flow 画布" open the referencing canvas (picker when multiple, notice when none) | Command main.js:233-237 + menu main.js:630-639 → `_openFlowCanvasForFile` (799-810); runtime navigation incl. NC custom-view file resolution (main.js:780-791) | ⚠ human-only (UAT 2026-08-07) |

## FLW-06 — Flow 文件菜单集成

v0.1 audit: **partial** — 5 items, missing "Add quest node". Phase 5 (BUG-07) completed the set: 6 items + separator on .canvas, 1 item on .ncanvas (`_registerFileMenuHooks` main.js:540-642).

| Behavior Claim | Test Evidence | Status |
| -------------- | ------------- | ------ |
| .canvas right-click shows 添加对话节点 / 添加角色节点 / 添加地点节点 / 添加物品节点 / 添加任务节点 + separator + 打开关联对话 | Menu items main.js:546-625; menu rendering is Obsidian runtime UI | ⚠ human-only (UAT 2026-08-07) |
| "添加对话节点" appends a file node for the chosen .ncanvas to the canvas JSON | `_createDialogueNodeOnCanvas` main.js:648-678 via `addDialogueNodeToCanvas` (canvas-utils.js:57); canvas write-back is runtime | ⚠ human-only (UAT 2026-08-07) |
| "添加角色/地点/物品/任务节点" appends a colored file node for the chosen entity .md | `_addFileNodeToCanvasFile` main.js:680-712 with `ENTITY_COLORS`; runtime | ⚠ human-only (UAT 2026-08-07) |
| Empty entity folder → notice, no picker shown | Branches main.js:562-565, 577-580, 592-595, 607-610; runtime | ⚠ human-only (UAT 2026-08-07) |

## Coverage Summary

| Requirement | Claims | Automated | Human-only | Mixed (auto + human) |
| ----------- | ------ | --------- | ---------- | -------------------- |
| ENT-01 | 7 | 6 | 0 | 1 |
| ENT-02 | 6 | 5 | 1 | 0 |
| ENT-03 | 6 | 5 | 1 | 0 |
| ENT-04 | 6 | 5 | 1 | 0 |
| ENT-05 | 6 | 5 | 1 | 0 |
| FLW-01 | 3 | 1 | 1 | 1 |
| FLW-02 | 4 | 3 | 1 | 0 |
| FLW-03 | 4 | 0 | 4 | 0 |
| FLW-04 | 3 | 0 | 2 | 1 |
| FLW-05 | 6 | 5 | 1 | 0 |
| FLW-06 | 4 | 0 | 4 | 0 |
| **Total** | **55** | **35** | **17** | **3** |

> Counting note: 3 claims are mixed (an automated contract test plus a human-only runtime
> portion); they are counted once in the 55 total. Effective coverage:
> **55/55 behavior claims covered** — every claim has either automated test evidence or a
> passed 2026-08-07 human UAT entry.

## Test Suite Run

```
$ node --test tests/*.test.js
ℹ tests 310
ℹ suites 86
ℹ pass 310
ℹ fail 0
```

Phase-3-relevant subset (entity-templates, entity-create, navigation, modals, merge-smoke):

```
$ node --test tests/entity-templates.test.js tests/entity-create.test.js tests/navigation.test.js tests/modals.test.js tests/merge-smoke.test.js
ℹ tests 33
ℹ suites 15
ℹ pass 33
ℹ fail 0
```

Golden contract: `git diff HEAD -- tests/golden tests/fixtures` → empty (byte-identical).

---

_Validated: 2026-08-07_
_Validator: Claude (gsd-verifier)_

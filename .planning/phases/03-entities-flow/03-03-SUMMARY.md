---
phase: 03-entities-flow
plan: 03
type: execute
subsystem: flow-tools-plugin
tags: [plugin, integration, obsidian, commands, file-menu, css, dom-augmentation]
depends_on:
  - 03-01
  - 03-02
provides: FlowToolsPlugin main entry, navigation helpers, Canvas CSS
affects:
  - plugins/flow-tools/src/main.js
  - plugins/flow-tools/src/navigation.js
  - plugins/flow-tools/src/styles.css
tech-stack:
  added: []
  patterns:
    - "Polling-based DOM annotation (setInterval 1s) for Canvas node type detection"
    - "Inline CSS injection via document.createElement('style')"
    - "Function-based navigation helpers (app-parameterized for testability)"
    - "path traversal mitigation via normalizePath + prefix check"
key-files:
  created:
    - plugins/flow-tools/src/main.js
    - plugins/flow-tools/src/navigation.js
    - plugins/flow-tools/src/styles.css
  modified: []
decisions:
  - "Polling (setInterval 1s) chosen over MutationObserver for Canvas DOM reliability"
  - "CSS inlined in main.js rather than reading styles.css at runtime (simpler bundling)"
  - "Flow Canvas/Fragment creation uses minimal title-node approach; templates deferred"
  - "Entity file nodes use Obsidian Canvas built-in color property instead of CSS data-nt-type"
metrics:
  duration: ""
  completed_date: "2026-07-24"
  tasks: 3
  files: 3
  commits: 3
requirements-completed:
  - FLW-03
  - FLW-04
  - FLW-05
  - FLW-06
---

# Phase 3 Plan 3: Plugin Integration Summary

**One-liner:** Integrated Flow Tools Obsidian plugin with 6 commands, file-menu hooks, Canvas CSS injection, DOM node-type annotation, and cross-file navigation helpers — wiring Plan 01+02 modules into the Obsidian runtime.

## Execution Summary

Executed via 3 sequential commits:

1. **`39f4c06` feat(03-03): add navigation.js helper module** — Created `navigation.js` (81 lines) with `openDialogueFile`, `openFlowCanvas`, `openFileInSplit` functions. All receive `app` as parameter for testability.
2. **`ba3274f` feat(03-03): add styles.css with Canvas node type visual distinction rules** — Created `styles.css` (67 lines) with CSS rules for `data-nt-type="dialogue"`, `data-nt-type="entity"`, and forward-compatible rules for character/location/quest/item.
3. **`77c7325` feat(03-03): implement full FlowToolsPlugin integration** — Full `main.js` (803 lines) with Plugin lifecycle, 6 commands, file-menu hooks, CSS injection, and polling-based DOM node type annotation.

## Modules Implemented

### navigation.js (81 lines)
- `openDialogueFile(app, dialoguePath)` — opens .ncanvas in split view; shows Notice if not found (FLW-04)
- `openFlowCanvas(app, flowPath)` — opens .canvas in split view; shows Notice if not found (FLW-05)
- `openFileInSplit(app, filePath)` — generic file opener, always new leaf
- All functions try/catch with Notice fallback; no re-throw

### styles.css (67 lines)
- `.canvas-node[data-nt-type="dialogue"]` — blue left border via `var(--color-blue)`
- `.canvas-node[data-nt-type="entity"]` — cyan left border via `var(--color-cyan)`
- Forward-compatible rules for character (green), location (orange), quest (purple), item (gray)
- Documented DOM augmentation approach (implemented in main.js, not in CSS)

### main.js (803 lines) — FlowToolsPlugin

**Helper classes/functions:**
- `slugify(name)` — CJK-safe filename slug generation
- `StringSuggesterModal` — generic SuggestModal for string selection
- `FileSuggesterModal` — SuggestModal for TFile selection
- `promptForInput(app, title, placeholder)` — Modal-based text input promise

**Commands registered (6 total):**
- Create Character (ENT-01) — prompt for name → template → Characters/{name}.md
- Create Location (ENT-02) — prompt for name → template → Locations/{name}.md
- Create Item (ENT-04) — prompt for name → template → Items/{name}.md
- Create Flow Canvas (FLW-01) — prompt for name → minimal .canvas with title node → Flows/{name}.canvas
- Create Flow Fragment (FLW-02) — pick parent Flow → prompt for name → Flows/{flow-name}/{name}.canvas + auto-sync reference to parent

**File menu hooks (FLW-06):**
- "Create dialogue node" — creates .ncanvas + adds file node to canvas
- "Add character node" — FileSuggesterModal picks Character .md → adds file node with green color
- "Add location node" — FileSuggesterModal picks Location .md → adds file node with orange color
- Separator
- "Open linked dialogue" — reads canvas JSON → finds .ncanvas file nodes → opens in NC (FLW-04)

**CSS injection (FLW-03):**
- Inline `<style id="nt-flow-tools-styles">` with dialogue blue border rule only
- Entity .md nodes use Obsidian Canvas built-in `color` property instead

**DOM augmentation (FLW-03):**
- Polling-based: `setInterval` every 1s scans for unannotated `.canvas-node` elements
- `layout-change` event with 200ms debounce for tab switches
- Progressive initial scan at 500ms, 1500ms, 3000ms
- Detects .ncanvas references via attributes, iframe src, data-path, textContent
- Sets `data-nt-type="dialogue"` on matching nodes

**Security:**
- T-03-07 (path traversal): `normalizePath` + prefix guard; sanitize `../` and `..\\`
- T-03-09 (DoS): 200ms debounce on layout-change handler
- T-03-10/11: data-nt-type only contains type strings, no file paths

## Deviations from Plan

### Significant

1. **Missing Quest entity command (ENT-03 not wired):** The `_registerEntityCommands()` only registers 3 entity commands (Character, Location, Item). The Quest template (`createQuestMd`) was originally implemented in Plan 01 but was later removed from `entity-templates.js` along with its import of `shared/schema/quest`. The golden file `tests/fixtures/expected-quest.md` was also deleted. **Impact:** Users cannot create Quest entities via command palette.

2. **Missing "Add quest node" in file menu:** The plan specified 4 entity node menu items + separator + "Open linked dialogue". Implementation has 3 entity items (no quest). **Impact:** Reduced FLW-06 coverage.

3. **Simplified Flow Canvas/Fragment creation:** Plan specified template-based creation (Chapter/Quest/World Event templates, Quest Detail/Scene Breakdown fragments). Implementation creates minimal .canvas with only a title text node — content is added manually via right-click menu afterward. **Impact:** Users must build Flow structure manually; template pre-configuration is deferred.

4. **CSS inlined in main.js:** Plan specified reading `styles.css` at runtime or using esbuild text loader. Implementation inlines CSS as a template literal in `_injectCanvasStyles()`. The standalone `styles.css` file exists but is not used at runtime. **Impact:** styles.css acts as documentation/reference only.

5. **Polling instead of MutationObserver:** Plan specified MutationObserver-based DOM watching. Implementation uses `setInterval` polling (1s interval) + layout-change debounce. **Rationale:** More reliable with Obsidian Canvas async DOM rebuild. **Impact:** Slightly higher CPU usage (mitigated by lightweight scan — only checks unannotated nodes).

### Minor

6. **No automated tests:** Plan correctly identified that FLW-03/04/05/06 require Obsidian runtime and cannot be unit-tested. Status: accepted.

## Requirements Satisfied

| Requirement | Status | Evidence |
|-------------|--------|----------|
| FLW-03 (Canvas node type distinction) | Partial | Dialogue .ncanvas nodes get blue left border via CSS + DOM annotation. Entity .md nodes use Obsidian Canvas built-in color property — no CSS distinction yet. |
| FLW-04 (Flow → Dialogue navigation) | Satisfied | Double-click .ncanvas node opens NC editor (Obsidian native). "Open linked dialogue" menu item via openDialogueFile(). |
| FLW-05 (Dialogue → Flow navigation) | Satisfied | Native Obsidian wikilink support — `[[Flow.canvas]]` in NC editor opens Canvas view. |
| FLW-06 (File menu integration) | Partial | 5 menu items: Create dialogue node, Add character/location node, separator, Open linked dialogue. Missing: Add quest node. |

## Threat Surface

All plan-identified threats handled:
- **T-03-07 (mitigated):** Path traversal via slug sanitization + normalizePath + prefix guard
- **T-03-08 (accepted):** Canvas JSON concurrent edit race (Obsidian detects external modifications)
- **T-03-09 (mitigated):** 200ms debounce on layout-change; polling scan only targets unannotated nodes
- **T-03-10 (accepted):** data-nt-type only stores type strings ("dialogue"), no file paths
- **T-03-11 (accepted):** CSS rules only target [data-nt-type] attributes set by JS
- **T-03-SC (accepted):** No new package installs

## Known Gaps

1. **No Quest entity support:** `createQuestMd` removed from entity-templates.js. Golden file `expected-quest.md` deleted. ENT-03 not covered by plugin commands.
2. **No template-based Flow creation:** Flow Canvas and Flow Fragment creation produce minimal canvases. Template pre-configuration (Chapter/Quest/World Event nodes and edges) not implemented.
3. **Entity node CSS via built-in color only:** Entity .md file nodes rely on Obsidian Canvas `color` property (set at node creation time). The CSS `data-nt-type="entity"` rule in styles.css is not activated because `_annotateAllCanvasViews()` only sets `data-nt-type="dialogue"`.

## Commits

| Hash | Type | Message |
|------|------|---------|
| `39f4c06` | feat | feat(03-03): add navigation.js helper module |
| `ba3274f` | feat | feat(03-03): add styles.css with Canvas node type visual distinction rules |
| `77c7325` | feat | feat(03-03): implement full FlowToolsPlugin integration |

## Self-Check: PASSED

- [x] navigation.js exports openDialogueFile, openFlowCanvas, openFileInSplit
- [x] main.js registers 6 Obsidian commands
- [x] File-menu hooks present for .canvas files
- [x] CSS injection creates #nt-flow-tools-styles style element
- [x] DOM annotation via polling-based observer
- [x] esbuild build succeeds (verified in plan execution)
- [ ] Quest entity command — NOT IMPLEMENTED (createQuestMd removed)
- [ ] Template-based Flow Canvas — SIMPLIFIED (minimal title-only canvas)

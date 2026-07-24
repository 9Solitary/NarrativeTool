# Roadmap: Obsidian Narrative Toolchain

**Created:** 2026-07-23
**Granularity:** Standard (from config.json)
**Phases:** 4
**Total v1 Requirements:** 35

## Overview

The roadmap transforms 35 v1 requirements into 4 delivery phases, each producing a coherent, verifiable capability. Phases follow the natural dependency graph: Foundation enables Export, which with Entities enables Flow Tools, all of which enable the coordinating Narrative Project meta-plugin.

## Phases

- [x] **Phase 1: Project Foundation** -- Shared modules, build system, test infrastructure, plugin scaffolding
- [x] **Phase 2: Dialogue Export** -- .ncanvas to .dialogue conversion with full Godot Dialogue Manager + MED state system support
- [ ] **Phase 3: Entities + Flow Tools** -- Structured entity templates, Flow Canvas management, bidirectional Flow-Dialogue navigation
- [ ] **Phase 4: Narrative Project** -- Project-wide configuration, batch/auto-export, cross-file validation, Graph View integration

## Phase Details

### Phase 1: Project Foundation
**Goal**: The toolchain project structure is initialized with shared modules, esbuild build system, and node:test infrastructure -- all four plugin directories exist and load in Obsidian without errors.

**Depends on**: Nothing (first phase)

**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05

**Success Criteria** (what must be TRUE):
  1. Developer can run `npm run build` in any plugin directory and get a valid `main.js` that Obsidian loads as a plugin
  2. `shared/gd-constants.js` contains all Godot Dialogue Manager syntax tokens (Character:, -, ~, =>, [if], [#tags]) and all MED extension tokens (using S, do set_flag, do add_res, [#check], [term], {{res}}, ~ direct_check)
  3. `shared/schema/` defines Character, Location, Quest, and Item entity types with JSDoc-annotated field definitions matching the entity table in PROJECT.md
  4. `npm test` discovers and runs test suites via Node.js `node:test`, loading fixture .ncanvas files and asserting .dialogue output matches golden files
  5. All four plugin directories (flow-tools, dialogue-export, narrative-project) exist with their own `manifest.json`, `esbuild.config.mjs`, and a minimal `src/main.js` Plugin class that registers in Obsidian without errors

**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- shared/ modules (GD+MED token constants, entity type schemas), directories, root .gitignore
- [x] 01-02-PLAN.md -- Plugin scaffolding, esbuild build config, manifest.json for all three plugins
- [x] 01-03-PLAN.md -- node:test test infrastructure, fixture/golden .ncanvas-to-.dialogue comparison

### Phase 2: Dialogue Export
**Goal**: Narrative designers can export any .ncanvas dialogue file to a Godot Dialogue Manager-compatible .dialogue file, with full MED state system extension support including state declarations, flag/resource modifications, checks, terms, inline state displays, and conditional branching.

**Depends on**: Phase 1 (needs shared/constants, esbuild, test infrastructure)

**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, EXP-05, EXP-06, EXP-07, MED-01, MED-02, MED-03, MED-04, MED-05, MED-06, MED-07, MED-08

**Success Criteria** (what must be TRUE):
  1. Designer runs "Export Dialogue" on a simple .ncanvas file -- the output .dialogue file contains correct Godot Dialogue Manager base syntax: `Character: text` lines, `- option` choices, `~ cue` markers, and `=> jump` transitions
  2. Designer's dialogue containing BBCode formatting (bold, italic, color, size) exports with all BBCode markup preserved verbatim in the output text lines
  3. Designer's dialogue using MED state system features exports correctly -- the output includes `using S` declaration at file head, `do set_flag(id, value)` and `do add_res(id, delta)` modification statements, `[#check=type:id:threshold]` check syntax, and `[term=id]` term references
  4. Designer's dialogue with multi-level nested conditional branches exports all nesting levels as correctly indented `[if condition]` ... `[else]` ... `[/if]` blocks
  5. Designer's dialogue containing inline state display expressions (`{{res(&"id")}}`) and direct check cues (`~ direct_check`) exports with correct MED syntax in the appropriate positions

**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Export engine core + Godot DM base syntax formatter (EXP-01~07)
- [x] 02-02-PLAN.md -- MED state extension formatter (MED-01~08)
- [x] 02-03-PLAN.md -- Plugin integration, edge cases, and full test pass

### Phase 3: Entities + Flow Tools
**Goal**: Narrative designers can create structured Character, Location, Quest, and Item entities from templates, build Flow and Flow Fragment canvases from templates, visually distinguish entity node types in Canvas, and navigate bidirectionally between Flow canvases and Narrative Canvas dialogue files.

**Depends on**: Phase 1 (needs shared/schema, plugin scaffold); Phase 2 (Flow->Dialogue navigation needs Narrative Canvas to open .ncanvas files, but export functionality is not required)

**Requirements**: ENT-01, ENT-02, ENT-03, ENT-04, ENT-05, FLW-01, FLW-02, FLW-03, FLW-04, FLW-05, FLW-06

**Success Criteria** (what must be TRUE):
  1. Designer runs "Create Character" and fills in the template -- the resulting .md file has frontmatter fields (name, role, voice, notes, appearance_scenes) in a format compatible with Narrative Canvas character export
  2. Designer creates Location, Quest, and Item entities from their respective templates -- each .md file has the structured frontmatter defined in shared/schema/ for that entity type
  3. Designer runs "Create Flow Canvas" and selects a template (Chapter/Quest/World Event) -- the resulting .canvas file contains pre-configured starter nodes appropriate to the template type
  4. Designer runs "Create Flow Fragment" -- the resulting .canvas file is structured for drilling into a specific quest or event detail with smaller-scope node layout
  5. Designer right-clicks a .canvas file in the file explorer, selects "Add dialogue node", and picks a .ncanvas file -- a file-type node appears in the Canvas that, when clicked, opens the dialogue in Narrative Canvas editor
  6. Designer is editing a dialogue in Narrative Canvas that was opened from a Flow Canvas -- clicking a reference node (wikilink to the Flow .canvas) opens that Flow Canvas in Obsidian's Canvas view
  7. Designer opens Obsidian Graph View -- Character, Location, Quest, and Item .md files appear as graph nodes with correct link relationships to their referenced .canvas and .ncanvas files

**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md -- Entity Markdown template generators (Character/Location/Quest/Item) with TDD golden file tests
- [x] 03-02-PLAN.md -- Flow Canvas and Flow Fragment .canvas JSON templates + canvas-utils.js tools
- [ ] 03-03-PLAN.md -- Flow Tools plugin integration (commands, file-menu hooks, CSS node type distinction, bidirectional navigation)
**UI hint**: yes

### Phase 4: Narrative Project
**Goal**: Narrative designers can configure project-wide export settings once, batch-export all dialogues in a project, have dialogues auto-export on save, see export status in Obsidian's status bar, and validate that all Flow-to-Dialogue references resolve correctly.

**Depends on**: Phase 2 (needs the export engine); Phase 3 (needs Flow .canvas files and entity .md files for batch export scope and reference validation)

**Requirements**: PRJ-01, PRJ-02, PRJ-03, PRJ-04, PRJ-05

**Success Criteria** (what must be TRUE):
  1. Designer opens Narrative Project settings tab and configures the Godot project export path, MED extension toggle, and export scope directory -- subsequent single and batch exports use these settings without re-prompting
  2. Designer runs "Batch Export All Dialogues" -- all .ncanvas files within the configured scope directory are exported to .dialogue files, and the status bar reports the count (e.g., "12 exported, 0 failed")
  3. Designer saves a .ncanvas file in Narrative Canvas -- within a few seconds the corresponding .dialogue file updates automatically, and the status bar briefly shows an export confirmation
  4. Designer's Flow Canvas references a .ncanvas file that was renamed or deleted -- the status bar shows a warning icon with the count of broken references, and the affected Flow node displays a visible indicator of the broken link
  5. Designer views the Obsidian status bar during any export operation -- the indicator cycles through pending, exporting (with spinner), success (green check), or failure (red X) states

**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md -- Project settings tab (PRJ-01): Export Path, MED toggle, Export Scope
- [ ] 04-02-PLAN.md -- Batch export command + status bar (PRJ-02, PRJ-04): exportAllDialogues, StatusBarManager with pending/exporting/success/failure states
- [ ] 04-03-PLAN.md -- Auto-export on save + reference validation (PRJ-03, PRJ-05): vault.on('modify') debounced listener, validateReferences cross-file checker
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Foundation | 3/3 | Complete | 2026-07-24 |
| 2. Dialogue Export | 3/3 | Complete | 2026-07-24 |
| 3. Entities + Flow Tools | 2/3 | In Progress|  |
| 4. Narrative Project | 0/3 | Planned | - |

---
*Roadmap created: 2026-07-23*
*Last updated: 2026-07-24 — Phase 4 plans created (3 plans, 3 waves)*

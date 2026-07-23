# Codebase Structure

**Analysis Date:** 2026-07-23

## Directory Layout

```
NarrativeTool/
├── .planning/                                  # GSD planning artifacts
│   └── codebase/                               # Codebase analysis documents (this file)
├── NarrativeCanvas/                            # Primary code -- forked Obsidian plugin
│   ├── main.js                                 # Obsidian plugin entry (~29K lines, bundled)
│   ├── app.js                                  # Canvas application logic (~27K lines)
│   ├── index.html                              # Static HTML shell (inlined into main.js)
│   ├── manifest.json                           # Obsidian plugin manifest (id, version, etc.)
│   ├── styles.css                              # Full CSS for Obsidian plugin context
│   ├── plugin.css                              # Minimal CSS overrides for Obsidian
│   ├── canvas.css                              # Full dark-theme CSS for standalone browser
│   ├── site.webmanifest                        # PWA manifest for standalone browser mode
│   ├── .gitignore                              # Git ignore rules
│   ├── LICENSE                                 # License file
│   ├── README.md                               # English documentation
│   ├── README-zh.md                            # Chinese documentation
│   ├── RELEASE_NOTES.md                        # Release history
│   ├── acceptance/                             # Acceptance test specifications
│   │   └── project-story-template/             # Template for project story acceptance tests
│   │       ├── layout.json                     # Expected layout
│   │       ├── routes.json                     # Expected routes
│   │       ├── state.schema.json               # Expected state schema
│   │       ├── story.md                        # Story specification
│   │       └── README.md                       # Template docs
│   ├── assets/                                 # Static assets
│   │   ├── icons/                              # App icons (favicon, PWA icons, plugin icon)
│   │   ├── screenshots/                        # Documentation screenshots (EN + ZH)
│   │   └── videos/                             # Demo videos
│   ├── docs/                                   # Technical documentation
│   │   ├── export-portability.md               # Export portability spec
│   │   ├── export-profile.schema.json          # Export profile schema
│   │   ├── portable-acceptance-summary.schema.json
│   │   ├── portable-route-cases.schema.json
│   │   ├── runtime-json-loader.md              # Runtime JSON loader docs
│   │   ├── runtime-json.schema.json            # Runtime JSON schema
│   │   ├── state-schema.schema.json            # Project state schema
│   │   ├── story-layout.schema.json            # Story layout schema
│   │   ├── story-markdown-format.md            # Story markdown format docs
│   │   └── story-source-acceptance.md          # Story source acceptance docs
│   ├── examples/                               # Integration examples
│   │   ├── custom-runtime-loader/              # Custom runtime JSON runner (Node.js)
│   │   │   ├── runtime-json-runner.cjs
│   │   │   └── README.md
│   │   └── godot-runtime-loader/               # Godot runtime integration
│   │       ├── NarrativeCanvasRuntime.gd
│   │       ├── RuntimeRouteDemo.gd
│   │       └── README.md
│   ├── scripts/                                # Build and test scripts
│   │   ├── build-plugin-bundle.cjs             # Core build: bundles index.html + app.js into main.js
│   │   ├── build-plugin-styles.cjs             # Builds styles.css
│   │   ├── verify-plugin-artifacts.cjs         # CI artifact verification
│   │   ├── run-browser-test.cjs                # Browser test runner
│   │   ├── fixture-test.ps1                    # Fixture test script
│   │   ├── large-acceptance-test.ps1           # Large project acceptance test
│   │   ├── perf-test.ps1                       # Performance test script
│   │   ├── portable-export-acceptance.cjs      # Export portability acceptance
│   │   ├── release-check.ps1                   # Release validation
│   │   └── smoke-test.ps1                      # Smoke test script
│   ├── tests/                                  # Browser-based test suite
│   │   ├── smoke.html                          # Smoke tests
│   │   ├── fixture-roundtrip.html              # Fixture roundtrip tests
│   │   ├── gui-regression.html                 # GUI regression tests
│   │   ├── perf.html                           # Performance tests
│   │   ├── large-project-acceptance.html       # Large project tests
│   │   └── fixtures/                           # Test fixture data (12 .ncanvas files + supporting files)
│   ├── .github/                                # GitHub CI configuration
│   │   └── workflows/
│   │       ├── plugin-artifacts.yml            # PR/push artifact verification + smoke/fixture/GUI tests
│   │       ├── publish-plugin-release.yml      # Publish release workflow
│   │       └── verify-release-assets.yml       # Release asset verification
│   └── .claude/                                # Claude agent skills directory
├── TestVault/                                  # Obsidian test vault
│   └── CanvasTest/                             # Test vault root
│       ├── .obsidian/                          # Obsidian config
│       │   ├── app.json                        # Obsidian app config
│       │   ├── appearance.json                 # Theme/appearance config
│       │   ├── community-plugins.json          # Enabled community plugins (narrative-canvas)
│       │   ├── core-plugins.json               # Core plugin settings
│       │   ├── graph.json                      # Graph view settings
│       │   ├── workspace.json                  # Workspace layout
│       │   └── plugins/
│       │       └── narrative-canvas/           # Symlinked/copied plugin files
│       │           ├── main.js                 # Plugin bundle
│       │           ├── manifest.json           # Plugin manifest
│       │           ├── styles.css              # Plugin styles
│       │           └── data.json               # Plugin local data (settings)
│       ├── 欢迎.md                              # Welcome markdown
│       ├── 未命名.md                            # Test markdown file
│       └── 未命名.canvas                        # Obsidian Canvas file (empty -- test for Flow layer)
└── ObsidianNarrativeToolchain.md               # Project planning document (Chinese)
```

## Directory Purposes

**`NarrativeCanvas/`:**
- Purpose: The core Obsidian plugin codebase. A fork of `ringeringeraja33/narrative-canvas` (v1.2.9)
- Contains: Plugin entry, canvas application logic, HTML shell, CSS styles, build scripts, tests, documentation, assets, CI config
- Key files: `main.js` (plugin entry + bundled app), `app.js` (canvas application source), `index.html` (UI structure), `manifest.json` (plugin identity), `scripts/build-plugin-bundle.cjs` (build step)

**`TestVault/CanvasTest/`:**
- Purpose: Obsidian test vault for plugin development and testing
- Contains: Obsidian configuration files, test markdown notes, a test `.canvas` file, and the installed narrative-canvas plugin
- Key files: `community-plugins.json` (enables narrative-canvas), `.obsidian/plugins/narrative-canvas/` (plugin installation)

**`NarrativeCanvas/tests/`:**
- Purpose: Browser-based test suite (HTML pages that load the app and exercise it)
- Contains: Smoke tests, fixture roundtrip tests, GUI regression tests, performance tests, large project tests
- Key files: `smoke.html`, `fixture-roundtrip.html`, `gui-regression.html`, `perf.html`, `fixtures/*.ncanvas`

**`NarrativeCanvas/scripts/`:**
- Purpose: Build tooling and test automation
- Contains: Build bundle script, style compiler, CI verification, browser test runner, PowerShell test scripts
- Key files: `build-plugin-bundle.cjs` (inlines HTML + app.js into main.js), `verify-plugin-artifacts.cjs`, `run-browser-test.cjs`

**`NarrativeCanvas/docs/`:**
- Purpose: Technical specification documents (schema definitions, format docs, portability specs)
- Contains: JSON schemas for export, runtime, state, and layout formats; markdown docs for formats and acceptance criteria

**`NarrativeCanvas/examples/`:**
- Purpose: External runtime integration examples (Node.js, Godot)
- Contains: Custom runtime JSON loader in Node.js, Godot NarrativeCanvasRuntime GDScript loader

**`NarrativeCanvas/assets/`:**
- Purpose: Static media assets
- Contains: Icons for PWA and plugin, screenshots for documentation, demo videos
- Generated: No
- Committed: Yes

**`NarrativeCanvas/acceptance/`:**
- Purpose: Project story template for acceptance testing
- Contains: Layout, routes, state schema, and story markdown files defining expected behavior

**`.planning/`:**
- Purpose: GSD (Goal-System-Deliver) planning artifacts produced by codebase analysis and phase planning
- Contains: Codebase analysis documents (this file, ARCHITECTURE.md, STACK.md, etc.)
- Generated: Yes (by /gsd-map-codebase commands)
- Committed: Intended to be committed

## Key File Locations

**Entry Points:**
- `NarrativeCanvas/main.js` (line 95): Obsidian plugin class `NarrativeCanvasPlugin` -- the entry point loaded by Obsidian
- `NarrativeCanvas/app.js` (lines 2226-2242): `window.NarrativeCanvasApp` object -- the application API surface
- `NarrativeCanvas/app.js` (line 2328): `initNarrativeCanvas()` -- application initialization
- `NarrativeCanvas/index.html`: Static HTML shell defining all UI structure

**Configuration:**
- `NarrativeCanvas/manifest.json`: Plugin identity (id, name, version, minAppVersion, isDesktopOnly)
- `NarrativeCanvas/.gitignore`: Excludes .DS_Store, .claude, dist, logs, tmp, zip, and acceptance outputs
- `TestVault/CanvasTest/.obsidian/app.json`: Obsidian app configuration for the test vault
- `TestVault/CanvasTest/.obsidian/community-plugins.json`: Lists enabled community plugins (just `narrative-canvas`)

**Core Logic:**
- `NarrativeCanvas/app.js` (lines 2065-2224): `createInitialRuntimeState()` + `state` object -- entire application state
- `NarrativeCanvas/app.js` (lines 2226-2242): `window.NarrativeCanvasApp` -- public API surface
- `NarrativeCanvas/app.js`: Rendering functions (~200 functions starting around line 3700)
- `NarrativeCanvas/main.js` (lines 95-946): Plugin class + View class for Obsidian integration
- `NarrativeCanvas/main.js` (lines 2076+): `installNarrativeCanvasApp()` -- inlined bundled app.js

**Testing:**
- `NarrativeCanvas/tests/smoke.html`: Basic smoke test
- `NarrativeCanvas/tests/fixture-roundtrip.html`: Load/save fixture tests
- `NarrativeCanvas/tests/gui-regression.html`: GUI interaction tests
- `NarrativeCanvas/tests/perf.html`: Performance benchmarks
- `NarrativeCanvas/tests/fixtures/`: 12 `.ncanvas` fixture files covering various scenarios

**Build:**
- `NarrativeCanvas/scripts/build-plugin-bundle.cjs`: Inlines `index.html` and `app.js` into `main.js`, replaces web-only functions with plugin stubs
- `NarrativeCanvas/scripts/build-plugin-styles.cjs`: Compiles styles for plugin context
- `NarrativeCanvas/.github/workflows/plugin-artifacts.yml`: CI workflow running verify, smoke, fixture, and GUI tests

**Documentation:**
- `NarrativeCanvas/README.md`: English user documentation
- `NarrativeCanvas/README-zh.md`: Chinese user documentation
- `NarrativeCanvas/RELEASE_NOTES.md`: Release notes
- `ObsidianNarrativeToolchain.md`: Project planning document describing the broader toolchain vision

## Naming Conventions

**Files:**
- Plugin entry: `main.js` (standard for Obsidian plugins)
- Application logic: `app.js`
- Stylesheets: `styles.css` (plugin), `plugin.css` (minimal overrides), `canvas.css` (standalone)
- HTML: `index.html`
- Test HTML files: kebab-case hyphenated (`fixture-roundtrip.html`, `gui-regression.html`, `large-project-acceptance.html`)
- Fixture data: kebab-case hyphenated `.ncanvas` files (`characters-cast-chips.ncanvas`, `choice-link-branches.ncanvas`)
- Build scripts: `.cjs` extension for Node.js CommonJS, `.ps1` for PowerShell
- Docs/schemas: kebab-case hyphenated `.md` and `.json` files

**Directories:**
- Lowercase with hyphens for multi-word names: `acceptance/`, `fixtures/`
- PascalCase for root directories: `NarrativeCanvas/`, `TestVault/`
- `.obsidian/` for Obsidian config (convention)
- `.github/` for GitHub CI config (convention)
- `.claude/` for Claude agent skills (convention)

**Function names (in app.js):**
- camelCase for most functions: `initNarrativeCanvas`, `bindDom`, `renderAll`, `getSampleProject`
- Prefix pattern by responsibility:
  - `get*`: Pure getters (`getNode`, `getSampleProjectFilename`)
  - `render*`: Rendering functions (`renderCanvasSurface`, `renderCharactersPage`, `renderPlaybookGatesSection`)
  - `handle*`: Event handlers (`handleWindowResize`, `handleAction`, `handleFloatingWindowPointerDown`)
  - `bind*`: Event binding setup (`bindDom`, `bindEvents`, `bindDocumentEditor`)
  - `normalize*`: Validation/normalization (`normalizeSettings`, `normalizeUiLanguage`, `normalizeNodeType`)
  - `format*`: String formatting (`formatPlaybookEffectSummary`, `formatStateReportValue`)
  - `build*`: Complex construction (`buildDocumentSource`, `buildStateReport`, `buildCharacterDocumentModel`)
  - `parse*`: Parsing (`parsePlaybookEffectsText`, `parsePlaybookEffectLine`)
  - `create*`: Factory functions (`createInitialRuntimeState`, `createSampleProject`)
  - `set*` / `clear*` / `toggle*` / `update*` / `mark*` / `invalidate*`: Mutators

**Constants:**
- `SCREAMING_SNAKE_CASE` for all module-level constants: `BOARD_WIDTH`, `HISTORY_LIMIT`, `SAVED_STATE_VERSION`, `DEFAULT_CANVAS_ZOOM`

**Variables (in state object):**
- camelCase: `selectedNodeId`, `hasUnsavedChanges`, `immersiveFullscreen`
- Boolean flags often prefixed with `is`, `has`, or status-like names: `isSaving`, `hasUnsavedChanges`, `initialized`
- Collections: plural or Set-suffixed: `playVisitedNodeIds`, `characterBacklinkExpandedIds`

## Where to Add New Code

**New Obsidian Plugin (e.g., Flow Tools, Dialogue Export):**
- Primary code: Create a new directory at project root level (e.g., `NarrativeTool/flow-tools/`) with its own `main.js`, `manifest.json`, etc.
- Tests: Within the new plugin's own test directory
- Follow the pattern from `ObsidianNarrativeToolchain.md`: keep plugins separate with single responsibilities

**New Feature within NarrativeCanvas:**
- App logic: `NarrativeCanvas/app.js` (new functions in the relevant function group)
- UI structure: `NarrativeCanvas/index.html` (add DOM elements for new panels/menus/dialogs)
- Plugin integration: `NarrativeCanvas/main.js` (register new commands, settings, or view types)
- Tests: `NarrativeCanvas/tests/` (new HTML test page or fixture file)

**New Export Format (e.g., Godot Dialogue Manager .dialogue):**
- Primary code: `NarrativeCanvas/app.js` -- add export function near existing export logic
- Consider: A separate export plugin per `ObsidianNarrativeToolchain.md` (Plugin 3: Dialogue Export)
- Schema docs: `NarrativeCanvas/docs/` -- add new schema and documentation files

**New Integration Example:**
- Implementation: `NarrativeCanvas/examples/` -- create new subdirectory following `godot-runtime-loader/` pattern with runner + README

**New Test Fixtures:**
- Fixture data: `NarrativeCanvas/tests/fixtures/` -- add `.ncanvas` files with descriptive kebab-case names
- Test runner: `NarrativeCanvas/tests/` -- create or extend HTML test pages

**Build/CI changes:**
- Build scripts: `NarrativeCanvas/scripts/` -- `.cjs` for Node.js, `.ps1` for PowerShell
- CI workflows: `NarrativeCanvas/.github/workflows/` -- `.yml` files

**Shared types/schemas (future):**
- Per `ObsidianNarrativeToolchain.md`: `NarrativeTool/shared/` directory with `schema/`, `utils/`, `types/` subdirectories (not yet created)

## Special Directories

**`NarrativeCanvas/.claude/`:**
- Purpose: Claude Code agent skills configuration
- Generated: Partially (by Claude Code)
- Committed: No (listed in .gitignore)

**`TestVault/CanvasTest/.obsidian/`:**
- Purpose: Obsidian configuration for the test vault
- Generated: Yes (by Obsidian)
- Committed: Yes (needed for reproducible test environment)
- Note: Contains `workspace.json` and `data.json` which may include user-specific state

**`NarrativeCanvas/tests/fixtures/`:**
- Purpose: Test fixture data files (.ncanvas, .routes.json, .layout.json, .md)
- Generated: Partially (created for testing)
- Committed: Yes (required for CI test suite)

**`NarrativeCanvas/acceptance/`:**
- Purpose: Acceptance test specifications
- Generated: No (hand-authored specifications)
- Committed: Yes (but `acceptance/**/output/` is gitignored)

---

*Structure analysis: 2026-07-23*

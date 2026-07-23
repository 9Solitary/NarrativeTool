<!-- refreshed: 2026-07-23 -->
# Architecture

**Analysis Date:** 2026-07-23

## System Overview

```text
+-------------------------------------------------------------------+
|                       Obsidian Host Process                        |
|  NarrativeCanvasPlugin  (Obsidian Plugin class)                    |
|  `NarrativeCanvas/main.js`                                         |
+-------------------------------------+-----------------------------+
|         Plugin Layer (main.js)      |     App Layer (app.js)      |
|                                     |                             |
|  NarrativeCanvasView (ItemView)     |  window.NarrativeCanvasApp  |
|  NarrativeCanvasSettingTab          |  Module-level singleton     |
|  NarrativeCanvasProjectSuggestModal |  Vanilla JS, no framework   |
|  FolderSuggest                      |  Direct DOM manipulation    |
|                                     |                             |
|  Responsibilities:                  |  Responsibilities:          |
|  - Obsidian lifecycle (onload/      |  - Canvas rendering         |
|    onunload)                        |  - Node/link editing        |
|  - File I/O (vault read/write)     |  - State management         |
|  - Settings persistence             |  - History (undo/redo)      |
|  - Command registration             |  - Play preview runtime     |
|  - View instantiation               |  - Export (PNG, formats)    |
|  - AI proxy (requestUrl/fetch)      |  - Characters/Events/       |
|                                     |    Playbook panels          |
+-------------------+-----------------+----------+------------------+
                    |                            |
   Host API Bridge  |   window.NarrativeCanvasHost|
                    |                            |
   loadState()      |   saveState()              |
   loadProject()    |   saveProject()            |
   getLanguage()    |   aiChat() / aiChatStream()|
                    |                            |
+-------------------+----------------------------+
|               Obsidian Vault Filesystem         |
|  .ncanvas / .narrativecanvas  (JSON project)    |
|  data.json  (persisted settings + session)      |
+-------------------------------------------------+
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `NarrativeCanvasPlugin` | Obsidian plugin lifecycle, command registration, settings, file I/O, view management, AI API proxying, tab deduplication | `NarrativeCanvas/main.js` (lines 95-800) |
| `NarrativeCanvasView` | Obsidian ItemView subclass; mounts the canvas app HTML, creates Host bridge, installs `window.NarrativeCanvasApp` | `NarrativeCanvas/main.js` (lines 798-946) |
| `NarrativeCanvasSettingTab` | Plugin settings UI (language, font, AI config, save interval, project folder) | `NarrativeCanvas/main.js` (lines 1015-1155) |
| `NarrativeCanvasApp` (global) | Canvas application singleton; exposes `init`, `destroy`, `save`, `getSavedState`, `canExecuteCommand`, `executeCommand`, `configureAutoSave`, `setLanguage`, `createSampleProjectFile`, `loadVaultProject`, import functions | `NarrativeCanvas/app.js` (lines 2226-2242) |
| Rendering System | ~200 functions handling DOM rendering: canvas nodes, links, frames, character cards, events sheet, playbook, document editor, sidebars, floating windows | `NarrativeCanvas/app.js` (lines 3700-7000+) |
| State Management | Single mutable `state` object with undo/redo history stack (80-entry limit) | `NarrativeCanvas/app.js` (lines 2065-2224) |
| Event System | DOM event binding via `bindEvents()`, using `data-action` attributes for delegation | `NarrativeCanvas/app.js` (lines 2512+) |
| Build Script | Bundles index.html into main.js as string constant, inlines app.js into `installNarrativeCanvasApp()` | `NarrativeCanvas/scripts/build-plugin-bundle.cjs` |

## Pattern Overview

**Overall:** Obsidian Plugin Wrapper + Singleton Vanilla JS Application

The project is a fork of an Obsidian plugin (`ringeringeraja33/narrative-canvas`) providing a node-based narrative editor. It follows a **two-tier architecture**:

1. **Plugin Layer** (`main.js`, ~29,000 lines) - Obsidian integration, file I/O, settings, commands, and lifecycle management. Uses Obsidian's `Plugin`, `ItemView`, and `PluginSettingTab` APIs.

2. **Application Layer** (`app.js`, ~27,000 lines) - The actual canvas editor application. Written in vanilla JavaScript with no framework dependencies. Uses direct DOM manipulation, a single mutable global `state` object, and event delegation.

**Key Characteristics:**
- The app layer is a **self-contained singleton** installed on `window.NarrativeCanvasApp`
- Communication between plugin and app layers uses a **Host API bridge** (`window.NarrativeCanvasHost`) that abstracts vault I/O, AI communication, and project file operations
- No bundler used in development; `scripts/build-plugin-bundle.cjs` concatenates `index.html` and `app.js` into `main.js` at build time
- No package.json, npm dependencies, or node_modules -- all code is hand-written vanilla JS plus Obsidian standard library
- The app can run standalone in a browser (with localStorage) or inside Obsidian (with vault persistence)
- **Bilingual (EN/ZH)**: Full i18n support with runtime language switching via a translation function `t(key, replacements)`

## Layers

**Plugin Layer (`NarrativeCanvas/main.js`):**
- Purpose: Obsidian integration, lifecycle management, vault file I/O, command registration, settings UI
- Location: `NarrativeCanvas/main.js`
- Contains: `NarrativeCanvasPlugin` class, `NarrativeCanvasView` class, `NarrativeCanvasSettingTab` class, `NarrativeCanvasProjectSuggestModal`, `FolderSuggest`, and the `installNarrativeCanvasApp()` function that inlines the bundled app.js
- Depends on: Obsidian API (`require("obsidian")`), `NarrativeCanvas/index.html` (inlined at build time), `NarrativeCanvas/app.js` (inlined at build time)
- Used by: Obsidian's plugin loader

**Application Layer (`NarrativeCanvas/app.js`):**
- Purpose: Canvas editor, rendering, state management, play preview, export, characters, events sheet, playbook, document editor
- Location: `NarrativeCanvas/app.js`, inlined into `NarrativeCanvas/main.js` at build time
- Contains: All rendering functions (~200+), state management (single `state` object), event delegation, history/undo system, floating windows, AI copilot UI
- Depends on: DOM (index.html structure), Host API (`window.NarrativeCanvasHost`), no external frameworks
- Used by: Plugin layer via `window.NarrativeCanvasApp`

**Presentation Layer (`NarrativeCanvas/index.html`):**
- Purpose: Static HTML shell defining the UI structure
- Location: `NarrativeCanvas/index.html`
- Contains: Two sidebars (left: project file, node library; right: inspector panels), main workspace with canvas viewport and sub-file panels (events, characters, document, playbook), floating windows (AI copilot, play preview, inspector float), dialogs (export report, confirm, column delete, etc.), context/radial menus
- Inlined into `main.js` as a JavaScript string constant `CANVAS_INDEX_HTML` by the build script

**Styling Layers:**
- `NarrativeCanvas/canvas.css` - Full dark-theme styling for standalone browser mode (~variable declarations, ~layout, ~components)
- `NarrativeCanvas/plugin.css` - Minimal overrides for the Obsidian plugin context
- `NarrativeCanvas/styles.css` - Full styles for Obsidian plugin (mirrors and extends canvas.css)

**Test Layer (`NarrativeCanvas/tests/`):**
- Purpose: HTML-based browser tests and .ncanvas fixture files
- Contains: `smoke.html`, `fixture-roundtrip.html`, `gui-regression.html`, `perf.html`, `large-project-acceptance.html`, and ~15 `.ncanvas`/supporting fixture files

## Data Flow

### Primary Load Path (Opening a project in Obsidian)

1. User clicks ribbon icon or runs command -> `NarrativeCanvasPlugin.openCanvas()` (`NarrativeCanvas/main.js:275`)
2. Plugin prepares vault file path via `prepareProjectForOpen()` -> registers view
3. `NarrativeCanvasView.onOpen()` called by Obsidian (`NarrativeCanvas/main.js:878`)
4. Sets up Host bridge on `window.NarrativeCanvasHost` with vault I/O callbacks
5. Calls `installNarrativeCanvasApp()` -> injects bundled app.js into scope (`NarrativeCanvas/main.js:2076`)
6. Calls `window.NarrativeCanvasApp.init()` -> `initNarrativeCanvas()` (`NarrativeCanvas/app.js:2328`)
7. `initNarrativeCanvas` binds DOM, loads saved state, resets history, renders all (`NarrativeCanvas/app.js:2328-2355`)
8. Maps to: `bindDom()` -> `loadSavedState()` -> `resetHistory()` -> `renderAll()` -> `bindEvents()`

### Save Path

1. Trigger: auto-save timer, manual save, or view close
2. `NarrativeCanvasApp.save()` -> `saveCurrentState()` in app.js
3. Calls `window.NarrativeCanvasHost.saveProject(savedStateJson)` (bridge to plugin)
4. Plugin writes to vault via Obsidian's `app.vault` API (`NarrativeCanvas/main.js`)
5. Also persists settings + session state to `data.json` via `savePluginData()`

### Command Dispatch Path

1. Obsidian keyboard shortcut or palette command triggers registered command callback
2. Plugin command callback delegates to `window.NarrativeCanvasApp.executeCommand(commandId)` (`NarrativeCanvas/main.js:156-178`)
3. `executeCanvasCommand()` in app.js maps command IDs to action handlers (`NarrativeCanvas/app.js:2267-2301`)
4. Most actions route through `handleAction()` which dispatches based on `data-action` DOM attribute pattern
5. Actions modify the `state` object and trigger re-renders via `renderAll()` or targeted render functions

### Play Preview Path

1. User clicks "Play" button -> `handleAction(actionTarget("play"))`
2. Sets `state.playNodeId` to entry node, builds `state.playSteps` via traversal
3. Renders current step content into `#playBody` dialog
4. Choice selection triggers path navigation and Playbook variable manipulation
5. State tracked in `state.playVariables`, `state.playVisitedNodeIds`, `state.playPath`, etc.

**State Management:**
- Single mutable global `state` object (`NarrativeCanvas/app.js:2220`)
- History stack: `state.history` with `undo[]` and `redo[]` arrays, max 80 entries
- Snapshot-based undo: `getHistorySnapshot()` captures state, `commitHistoryFromSnapshot()` stores it
- Derived state computed lazily: `state.derived` holds cached indices (flowOrder, displayId, nodeSearchText, etc.)
- Dirty tracking: `state.hasUnsavedChanges`, `state.dirtyVersion`

## Key Abstractions

**Host API Bridge (`window.NarrativeCanvasHost`):**
- Purpose: Abstract vault I/O and platform capabilities, enabling the app layer to be platform-agnostic
- Defined at: `NarrativeCanvas/main.js:892-911` (set during view onOpen)
- Methods: `loadState()`, `saveState(savedState)`, `loadProject()`, `saveProject(savedStateJson)`, `getAutoSaveIntervalMs()`, `getLanguage()`, `aiChat(payload)`, `aiChatStream(payload, onDelta, signal)`, `ensureProjectFile()`, `createProjectFile()`, `previewNewProjectFile()`, `chooseProjectFile()`, `getProjectFile()`, `showNotice(text)`, `stateFile`, `legacyProjectFile`
- Pattern: Dependency injection / adapter pattern

**Project Model:**
- Nodes: `{ id, type, title, body, x, y, width, ...fields, choices, links }` 
- Links: `{ id, from, to, label?, conditions? }`
- Variables: `{ key: value }` playbook state variables
- Characters: `{ id, name, role, description, tags }`
- Node types: Built-in (Entry, Content, Dialog, Choice, Marker, Event) + user-defined custom types
- Frames: Visual frames and Event frames that contain nodes
- File format: `.ncanvas` / `.narrativecanvas` JSON files with a defined schema version

**Rendering System:**
- Purpose: Templates and incremental DOM updates for the entire UI
- Pattern: Template literal string generation + `innerHTML` assignment, with targeted DOM queries for incremental updates
- Key functions: `renderAll()` (full re-render), `renderCanvasSurface()`, `renderCharactersPage()`, `renderVariablesPage()`, `renderProjectDocumentPage()`, `renderShellState()`

**Floating Window System:**
- Purpose: Draggable, resizable, pinnable floating windows for Play preview, Inspector, and AI Copilot
- Pattern: Direct pointer event handling with geometry persistence in `state.floatingWindowGeometry`
- Examples: `#playDialog`, `#inspectorFloatOverlay`, `#aiFloatingWindow`

## Entry Points

**Obsidian Plugin Entry:**
- Location: `NarrativeCanvas/main.js:95` (`module.exports = class NarrativeCanvasPlugin extends Plugin`)
- Triggers: Obsidian plugin loader discovers `manifest.json` with `id: "narrative-canvas"`
- Responsibilities: Register view, commands, ribbon icon, settings tab, file event listeners

**Standalone Browser Entry:**
- Location: `NarrativeCanvas/app.js:2320-2325` (auto-init check at the bottom of app.js)
- Triggers: DOMContentLoaded event or immediate if `.app-shell` exists
- Responsibilities: Start app without any Obsidian dependencies, use localStorage/web API

**Canvas Command Entry:**
- Location: `NarrativeCanvas/app.js` -- `CANVAS_COMMAND_DEFINITIONS` array in main.js:70-91 defines 20 commands
- Triggers: Obsidian command palette, keyboard shortcuts, ribbon icon, or direct function calls
- Responsibilities: Route to appropriate action handler

**Build Entry:**
- Location: `NarrativeCanvas/scripts/build-plugin-bundle.cjs`
- Triggers: Manual execution or CI (GitHub Actions)
- Responsibilities: Bundle `index.html` and `app.js` into `main.js`, replace web-only functions with plugin stubs

## Architectural Constraints

- **Single-threaded:** All logic runs on the main JS thread. Async I/O uses Obsidian's file API and `fetch`/`requestUrl` for AI calls
- **Global state:** The entire application state lives in a single mutable `state` object (`NarrativeCanvas/app.js:2220`) and is shared across all functions
- **No framework:** Zero framework dependencies. All UI rendering is manual DOM manipulation with innerHTML templates
- **Singleton canvas:** Only one active `NarrativeCanvasApp` instance at a time. Multi-tab support is handled by deduplication logic (`NarrativeCanvas/main.js:129-153, 837-861`)
- **Bundle as build step:** Development works on separate `app.js` + `index.html` files. The build script (`build-plugin-bundle.cjs`) concatenates them into `main.js` for Obsidian consumption
- **Plugin + Web dual target:** The app.js can run standalone in a browser or inside Obsidian, with platform-specific functions replaced during the build

## Anti-Patterns

### Monolithic Script Files

**What happens:** The entire application logic is split across two massive files: `main.js` (~29,000 lines) and `app.js` (~27,000 lines). No module system, no code splitting.
**Why it's wrong:** Hard to navigate, impossible to unit-test in isolation, merge conflicts are painful, cognitive overhead to understand any part of the system.
**Do this instead:** No change planned -- this is upstream architecture. When extending, add new functionality in separate plugin files (e.g., `/flow-tools/`, `/export-dialogue/`) per the project planning document.

### Mutable Global State

**What happens:** All application state lives in one mutable object `state` (`app.js:2220`). Every rendering function reads from and writes to this object freely. Derived state is cached manually in `state.derived`.
**Why it's wrong:** Impossible to reason about state changes. Any function can mutate anything. Makes debugging, testing, and feature development significantly harder.
**Do this instead:** Add new functionality that reads from the project model through well-defined accessors. Do not introduce new patterns of global mutation when adding export/linking features.

### Direct innerHTML Rendering

**What happens:** UI rendering uses template string generation assigned to `innerHTML` properties. Functions like `renderCanvasSurface()` rebuild entire DOM subtrees.
**Why it's wrong:** Destroys event listeners, loses focus/scroll state, causes layout thrashing, no diff-based updates.
**Do this instead:** When adding new UI panels or views, consider using the existing panel pattern (e.g., `#charactersPanel`, `#variablesPanel`) as self-contained regions with their own render functions.

## Error Handling

**Strategy:** Try/catch at major lifecycle boundary points (view onOpen, command callbacks) with user-facing Notice messages

**Patterns:**
- Plugin lifecycle errors shown via `new Notice()` in Obsidian
- App startup errors rendered inline in `.app-shell` via `showStartupError()`
- AI request failures fall back from streaming to non-streaming, with exponential backoff implied
- File I/O errors caught in plugin layer and reported to user

## Cross-Cutting Concerns

**Logging:** `console.error()` for developer diagnostics, `new Notice()` for user-facing messages, `setStatus()` for temporary status bar messages (auto-clears after 1.8s)
**Validation:** Project data validated against schema version (`SAVED_STATE_VERSION = 1`), node types validated against known sets, condition expressions validated syntactically
**Authentication:** AI API key stored in Obsidian's `data.json` (plugin local data); no external auth providers
**i18n:** Full bilingual support (English/Chinese) via translation function `t(key, replacements)`, language resolved from plugin settings or Obsidian interface language, runtime switching via `setLanguage()`

---

*Architecture analysis: 2026-07-23*

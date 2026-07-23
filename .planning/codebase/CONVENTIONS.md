# Coding Conventions

**Analysis Date:** 2026-07-23

## Project Overview

This is an Obsidian plugin called "Narrative Canvas" -- a node-based writing workspace for complex narratives, branching stories, and game plots. The codebase consists of two primary JavaScript files totaling ~56,000 lines, plus CSS and HTML. The code is written in vanilla JavaScript (ES2022+ target) with no transpilation, no TypeScript, and no build tooling other than the custom bundler scripts.

**Primary code files:**
- `NarrativeCanvas/main.js` (29,033 lines) -- Obsidian plugin wrapper; bundled release artifact
- `NarrativeCanvas/app.js` (27,009 lines) -- Standalone web application (the canvas UI)
- `NarrativeCanvas/canvas.css` (8,102 lines) -- Canvas styling
- `NarrativeCanvas/styles.css` (8,046 lines) -- Obsidian plugin-scoped styles (bundled from `canvas.css` + `plugin.css`)
- `NarrativeCanvas/plugin.css` (232 lines) -- Plugin-specific style overrides
- `NarrativeCanvas/index.html` (35,300 lines) -- Standalone web HTML shell

**Primary source language:** JavaScript (ES2022+)
**No TypeScript.** No static type system. No JSDoc annotations.

## Naming Patterns

### Files

- **JavaScript:** `kebab-case.js` for primary source files (`main.js`, `app.js`), `kebab-case.cjs` for Node.js build/test scripts (`build-plugin-bundle.cjs`, `run-browser-test.cjs`).
- **CSS:** `kebab-case.css` (`canvas.css`, `plugin.css`, `styles.css`).
- **Markdown:** `UPPERCASE.md` for readme/docs, `kebab-case.md` for technical docs (`story-markdown-format.md`, `export-portability.md`).
- **JSON/YAML:** `kebab-case.json` for config/data, `kebab-case.yml` for GitHub Actions workflows.
- **Test HTML:** `kebab-case.html` and `kebab-case-specialized.html` (`smoke.html`, `fixture-roundtrip.html`, `gui-regression.html`, `large-project-acceptance.html`, `perf.html`).
- **Fixture files:** `kebab-case.ncanvas` (binary/JSON project files under `tests/fixtures/`).

### Directories

- **Top level:** `PascalCase` for root folders (`NarrativeCanvas/`, `TestVault/`).
- **Source subdirectories:** `lowercase` or `kebab-case` (`scripts/`, `tests/`, `docs/`, `acceptance/`, `assets/`, `examples/`).
- **Nested test subdirectories:** `lowercase` (`tests/fixtures/`, `acceptance/project-story-template/`).

### Constants

Constants are `UPPER_SNAKE_CASE` and declared at module scope with `const`:

```js
const BOARD_WIDTH = 4000;
const DEFAULT_CANVAS_ZOOM = 0.5;
const HISTORY_LIMIT = 80;
const SAVED_STATE_VERSION = 1;
const WEB_STORAGE_KEY = "narrative-canvas-state-v1";
```

All configuration constants live at the top of each file. `main.js` defines ~50 constants at lines 3-42. `app.js` defines ~200 constants at lines 1-350.

### Functions

Functions use `camelCase` and are declared as regular function declarations (not arrow functions for top-level):

```js
function normalizeSettings(rawSettings) { /* ... */ }
function getVaultAbstractFile(app, path) { /* ... */ }
function formatAutoSaveIntervalSeconds(seconds) { /* ... */ }
```

Arrow functions are used only for inline callbacks (event handlers, array methods):

```js
this.registerEvent(this.app.vault.on("delete", (file) => {
  this.handleVaultFileDelete(file).catch((error) => console.error(error));
}));
```

**Naming prefixes:**
- `get` prefix: pure accessor/query -- `getVaultFile()`, `getObsidianInterfaceLanguage()`
- `is` prefix: boolean check -- `isNarrativeCanvasLeaf()`, `isChineseLocale()`, `isVaultPathInProjectSaveFolder()`
- `has` prefix: boolean existence check -- `hasUnsavedChanges`, `hasHiddenBorder()`
- `set` prefix: state mutation -- `setCurrentProjectPath()`, `setLanguage()`
- `normalize` prefix: input sanitization -- `normalizeSettings()`, `normalizeAutoSaveIntervalSeconds()`
- `render` prefix: DOM output -- `renderAll()`, `renderCanvasSurface()`, `renderHistoryButtons()`
- `handle` prefix: event handler -- `handleWindowResize()`, `handleAiFloatingControlClick()`
- `bind` prefix: event binding setup -- `bindDom()`, `bindEvents()`
- `find` prefix: search/query -- `findClickablePort()`, `findVisibleFrameCanvasCase()`
- `read` prefix: async I/O -- `readVaultText()`, `readObsidianConfigValue()`
- `format` prefix: string conversion -- `formatAutoSaveIntervalSeconds()`
- `create` prefix: factory -- `createBlankSavedState()`, `createSampleProject()`
- `sanitize` prefix: string sanitization -- `sanitizeProjectName()`, `sanitizeFileName()`
- `escape` prefix: output encoding -- `escapeHtml()`, `escapeAttr()`, `escapeRegExp()`

### Variables

- **Local variables:** `camelCase` (`savedStateJson`, `activeLeaf`, `canvasApp`)
- **Loop variables:** Single letters or short names (`index`, `i`, `col`, `row`, `key`, `value`)
- **Unused parameters:** `_error`, `_item`, `_match` (underscore prefix)
- **Temporary/intermediate:** Descriptive names in `camelCase` (`normalized`, `candidates`, `replacements`)

### Classes

Classes use `PascalCase` (`NarrativeCanvasPlugin`, `NarrativeCanvasView`, `NarrativeCanvasSettingTab`, `NarrativeCanvasProjectSuggestModal`, `FolderSuggest`).

Instance methods on classes use `camelCase`.
Class-exposed async hooks follow Obsidian conventions: `onload()`, `onunload()`.

## Code Style

### Formatting

**No formatter configured.** There is no `.prettierrc`, `eslint.config.*`, `.editorconfig`, or any formatting configuration file. The codebase uses consistent hand-formatting:

- **Indentation:** 2 spaces (consistent throughout both JS files)
- **Curly braces:** Same-line opening brace (K&R/1TBS style):
  ```js
  try {
    this.registerExtensions(PROJECT_EXTENSIONS, VIEW_TYPE);
  } catch (error) {
    console.error(error);
  }
  ```
- **Semicolons:** Always used; no ASI reliance
- **Line length:** Wide lines permitted; no hard line-length limit. Single-line object literals with many properties are common
- **Quotes:** Double quotes for strings by convention, with single quotes used only when containing double quotes
- **Template literals:** Used for interpolation and multi-line strings, not for simple strings

### Linting

**No linter configured.** No ESLint, Biome, or other lint tooling configuration exists.

### Comments

Comments are sparing and purposeful. When present, they explain *why* rather than *what*:

```js
// Duplicate-tab handling lives in View.onOpen -- when Obsidian creates a fresh leaf for a
// file we already have open, that leaf's onOpen detects the survivor and detaches itself
// before the canvas singleton is touched.
```

```js
/* Pointer capture is optional in embedded hosts. */
```

```js
// Operator fallback: browsers map the native range control's input event onto the hidden
// <input>, so the custom thumb only needs to read its value synchronously.
```

**No JSDoc or TSDoc comments.** The codebase uses zero `/** */` block comments.

**No TODO/FIXME/HACK/XXX markers** were found in either `main.js` or `app.js`.

### Block Organization

Each file follows this structure:
1. Constants (top of file)
2. Configuration objects and lookup tables
3. Function declarations (no particular ordering -- functions are defined before use)
4. Functions appear in rough thematic groups (plugin lifecycle, settings, vault I/O, AI networking, canvas rendering, etc.)

## Module Design

### Exports

`main.js` is a CommonJS module (`require("obsidian")` at line 1, `module.exports` at line 95). It exports a single class:

```js
module.exports = class NarrativeCanvasPlugin extends Plugin {
```

`app.js` has no module exports. It is designed to run in a browser context and attaches itself to `window.NarrativeCanvasApp` via `installNarrativeCanvasApp()` (line 2076 of `main.js`). The app is self-contained as a closure.

### Dependency Model

- `main.js` depends on the Obsidian API (`obsidian` module) and bundles `app.js` (lines 2077-29033) using the pattern:
  ```js
  // BEGIN bundled app.js
  // ... app.js contents ...
  // END bundled app.js
  ```
- `app.js` has zero external dependencies. It is pure vanilla JS.
- No barrel files, no index re-exports, no secondary modules.

### Global State

The application uses a single mutable global state object (`state`) accessed by most functions in `app.js`. This is a module-level mutable object initialized by `createInitialRuntimeState()` (line 2065 of `app.js`). All render functions read from this shared state directly rather than receiving state as parameters.

## Import Organization

**`main.js` uses a single CommonJS `require()` call:**
```js
const { AbstractInputSuggest, ItemView, Notice, Plugin, PluginSettingTab, Setting, SuggestModal, TFile, TFolder, normalizePath, requestUrl } = require("obsidian");
```

**`app.js` has no imports.** Everything is inline -- no `require()`, no `import`, no dynamic module loading.

## Error Handling

### Strategy

Error handling combines `try/catch` with thrown `Error` objects and `.catch()` chains on promises.

**Patterns observed:**

1. **Async methods catch and log:**
   ```js
   async openCanvas() {
     // ...
   }
   // called with:
   this.openCanvas().catch((error) => this.reportOpenError(error));
   ```

2. **User-facing errors use Obsidian `Notice` notifications:**
   ```js
   reportOpenError(error) {
     console.error(error);
     const message = error?.message || String(error || "Unknown error");
     new Notice(`Narrative Canvas could not open: ${message}`);
   }
   ```

3. **Validation throws early:**
   ```js
   if (!endpoint || !apiKey || !model) throw new Error("Configure AI endpoint...");
   if (response.status < 200 || response.status >= 300) throw new Error(...);
   ```

4. **Optional operations silently catch:**
   ```js
   try { event.target?.setPointerCapture?.(event.pointerId); } catch (_error) {
     /* Pointer capture is optional in embedded hosts. */
   }
   ```

5. **Promise chains use `.catch()` for logging, not re-throwing:**
   ```js
   void this.savePluginData().catch((error) => console.error(error));
   ```

6. **Errors from `console.error` are used as the sole observability mechanism** -- there is no centralized error reporting, error aggregation, or error state recovery beyond logging.

### Common error object patterns:
- `throw new Error("message")` -- used for user-facing validation errors
- `throw error` -- re-throw for upstream handling (network errors, abort signals)
- `console.error(error)` -- log-and-continue for non-critical failures
- `try/catch` with `_error` variable name and inline `/* */` comment -- explicitly ignored errors

## Logging

**Framework:** `console.error` for errors, nothing else for info/debug/warn.

There are ~35 `console.error()` calls in `main.js` and ~25 in `app.js`. No `console.log`, `console.warn`, `console.info`, or `console.debug` calls exist in either file.

## Function Design

### Size

Functions are generally small and focused. Typical functions are 5-30 lines. Larger functions (50-100+ lines) exist for complex UI rendering (e.g., `renderNode()`, `renderEventSheet()`) but are the exception.

### Parameters

- Functions take explicit parameters rather than reading from global state where practical
- Default parameter values are used: `function createSampleProject(language = "en")`
- Destructured objects used for options: `function setLanguage(language, options = {})`
- Optional parameters use falsy coalescing: `function resolveDomScope(scopeOverride = null)`

### Return Values

- Pure/query functions return values
- Mutation functions (renderers, setters) often return `undefined`
- Async functions return Promises, which are chained with `.catch()` by callers
- Some async functions return boolean success indicators (`true`/`false`)

## Consistency Patterns

### Deduplication

The codebase follows DRY principles for utility functions. Helper functions like `escapeHtml()`, `slugify()`, `clamp()`, `wait()`, `escapeRegExp()` appear in both `main.js` and `app.js` (duplicated, not shared, because `app.js` is bundled into `main.js` as a self-contained unit).

### Defensive Programming

Extensive use of optional chaining (`?.`) and nullish coalescing (`??`):
```js
const viewType = leaf.view?.getViewType?.() || leaf.getViewState?.()?.type;
return String(value ?? "").replaceAll(...);
```

### Input Validation

Normalizer functions validate and coerce inputs:
```js
function normalizeAutoSaveIntervalSeconds(value) {
  if (value === "" || value == null) return DEFAULT_AUTO_SAVE_INTERVAL_SECONDS;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_AUTO_SAVE_INTERVAL_SECONDS;
  return Math.round(Math.max(MIN_AUTO_SAVE_INTERVAL_SECONDS, Math.min(MAX_AUTO_SAVE_INTERVAL_SECONDS, numeric)));
}
```

## CSS Conventions

- Class names use `kebab-case` (`narrative-canvas-plugin-host`, `sidebar-toggle-button`)
- Host-scoping prefix: `.narrative-canvas-plugin-host` used on all rules targeting plugin UI
- App-internal prefix: `.nc-` used for custom UI primitives (`.nc-checkbox-box`, `.nc-range-track`)
- Custom properties not used; colors are hardcoded hex/rgb values
- Selectors use attribute selectors for state: `[data-theme="light"]`, `[data-play-panel="open"]`

---

*Convention analysis: 2026-07-23*

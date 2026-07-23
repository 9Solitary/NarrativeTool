# Technology Stack

**Analysis Date:** 2026-07-23

## Languages

**Primary:**
- JavaScript (ES2022+) - All application code; no transpilation or TypeScript used
  - `NarrativeCanvas/main.js` (29,033 lines) - Obsidian plugin entry point and bundled web app
  - `NarrativeCanvas/app.js` (27,009 lines) - Standalone browser web app (bundled into main.js for plugin builds)

**Secondary:**
- CSS 3 - All styling; three separate style files
  - `NarrativeCanvas/canvas.css` (8,102 lines) - Main web app styles
  - `NarrativeCanvas/plugin.css` (232 lines) - Obsidian plugin-host scoping preamble
  - `NarrativeCanvas/styles.css` (8,046 lines) - Generated: plugin.css + scoped canvas.css
- GDScript (Godot 4) - Example runtime loader
  - `NarrativeCanvas/examples/godot-runtime-loader/NarrativeCanvasRuntime.gd` (439 lines)
  - `NarrativeCanvas/examples/godot-runtime-loader/RuntimeRouteDemo.gd`
- HTML - Web app shell
  - `NarrativeCanvas/index.html` (559 lines) - Bundled into main.js at build time
- PowerShell - Build/test scripts
  - `NarrativeCanvas/scripts/fixture-test.ps1`, `smoke-test.ps1`, `perf-test.ps1`, `large-acceptance-test.ps1`, `release-check.ps1`

## Runtime

**Environment:**
- Obsidian Desktop (minAppVersion: 1.5.0 as declared in `NarrativeCanvas/manifest.json`)
  - Plugin runs as an Obsidian Plugin (CommonJS module via `require("obsidian")`)
  - `isDesktopOnly: true` -- no mobile support
- Browser (standalone mode) -- `NarrativeCanvas/index.html` + `NarrativeCanvas/app.js` load directly in any modern browser with localStorage for persistence
- Node.js 22 -- CI/CD and build scripts

**Package Manager:**
- No package.json detected. This is a zero-dependency project.
- Lockfile: Not applicable (no package manager used)

## Frameworks

**Core:**
- Obsidian Plugin API (CommonJS-based) - The plugin extends Obsidian's `Plugin`, `ItemView`, `PluginSettingTab`, `SuggestModal`, and `AbstractInputSuggest` classes
- No UI framework -- pure vanilla DOM manipulation using `document.createElement`, `el.createEl`, `el.addClass`, etc.
- No bundler -- the build scripts (`scripts/build-plugin-bundle.cjs`, `scripts/build-plugin-styles.cjs`) are hand-written Node.js scripts that:
  1. Inline `index.html` as a JavaScript string constant into `main.js`
  2. Inline `app.js` (with plugin-specific rewrites) into `main.js`
  3. Scope `canvas.css` selectors under `.narrative-canvas-plugin-host` for use as `styles.css`

**Testing:**
- Headless browser testing via Chrome/Chromium/Edge (`scripts/run-browser-test.cjs`)
  - Uses Chrome DevTools Protocol with `--virtual-time-budget` for deterministic test runs
  - Tests are HTML files with embedded assertions (smoke, fixture roundtrip, GUI regression)
- PowerShell scripts for fixture, smoke, performance, and acceptance tests
- No Jest, Vitest, Mocha, or other test framework

**Build/Dev:**
- Node.js (v22 in CI) for build and verification scripts
- GitHub Actions for CI/CD (3 workflows: `plugin-artifacts.yml`, `publish-plugin-release.yml`, `verify-release-assets.yml`)

## Key Dependencies

**Critical:**
- `obsidian` (Obsidian Plugin API) - The only runtime dependency; used via `require("obsidian")` in `NarrativeCanvas/main.js`. Provides `Plugin`, `ItemView`, `Notice`, `PluginSettingTab`, `Setting`, `SuggestModal`, `TFile`, `TFolder`, `normalizePath`, `requestUrl`, and `AbstractInputSuggest`
- This is a pure plugin -- it ships exactly three files: `main.js`, `manifest.json`, `styles.css`

**Infrastructure:**
- None -- no npm packages, no CDN scripts, no external runtime dependencies. The web app (`NarrativeCanvas/app.js`) is fully self-contained with no imports or script tags for external libraries.

## Configuration

**Environment:**
- Plugin settings stored in Obsidian's `data.json` (per-plugin persistent storage)
- Settings managed via `NarrativeCanvasPluginSettingTab` in `NarrativeCanvas/main.js` (lines 1047-1154)
- Key settings:
  - `saveFolder` -- vault-relative folder for project files
  - `filenameTemplate` -- template for new project filenames
  - `autoSaveIntervalSeconds` -- auto-save cadence (default: 0 = off, fallback: 2s)
  - `language` -- UI language ("auto", "en", "zh")
  - `contentFont` -- font for narrative content ("obsidian", "system", "cascadia", "serif")
  - `aiEndpoint` -- OpenAI-compatible chat completions URL
  - `aiApiKey` -- API key (stored in plugin's local data.json)
  - `aiModel` -- model name string
  - `currentProjectPath` / `lastProjectPath` -- session state
- Web app persistence:
  - `localStorage` key: `narrative-canvas-state-v1` -- project state in browser mode
  - `localStorage` key: `narrative-canvas-ai-config` -- AI config in browser mode

**Build:**
- `NarrativeCanvas/manifest.json` -- Obsidian plugin manifest (id, name, version, minAppVersion, description, author)
- `NarrativeCanvas/versions.json` -- version-to-minAppVersion compatibility map
- `NarrativeCanvas/site.webmanifest` -- PWA manifest for browser standalone mode
- No tsconfig, no ESLint config, no Prettier config

## Platform Requirements

**Development:**
- Node.js 22
- Chrome, Chromium, or Edge for headless browser tests
- Obsidian Desktop 1.5.0+ for plugin development/testing
- Any modern browser for standalone web app development

**Production:**
- Obsidian Desktop 1.5.0+ (plugin deployment)
- Obsidian Community Plugins directory (distribution via GitHub Releases)
- Standalone: any modern browser with localStorage enabled

---

*Stack analysis: 2026-07-23*

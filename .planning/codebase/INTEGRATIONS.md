# External Integrations

**Analysis Date:** 2026-07-23

## APIs & External Services

**AI / LLM (OpenAI-compatible Chat Completions):**
- Narrative Canvas includes an optional "AI copilot" feature that sends prompts to any OpenAI-compatible chat completions endpoint
- SDK/Client: None -- raw `requestUrl()` (Obsidian API) and `fetch()` (browser) are used directly
- Configuration (plugin settings, `NarrativeCanvas/main.js` lines 37-39, 1150-1152):
  - `aiEndpoint` -- Full URL to a chat completions endpoint (e.g., `https://api.example.com/v1/chat/completions`)
  - `aiApiKey` -- Bearer token for the API; stored in Obsidian plugin's `data.json` (input field uses `type="password"`)
  - `aiModel` -- Model name string to pass in the request body
- Request flow:
  - Obsidian plugin: `NarrativeCanvasPlugin.requestAi()` and `requestAiStream()` in `NarrativeCanvas/main.js` (lines 186-252)
    - Non-streaming: uses `requestUrl()` from Obsidian API
    - Streaming: uses `fetch()` directly with SSE parsing (handles `text/event-stream` Content-Type)
    - Requests are proxied through the `NarrativeCanvasHost` bridge object (line 892) exposed on `window`
  - Browser standalone: `requestWebAiCompletion()` in `NarrativeCanvas/app.js` (line 9914)
    - Uses `fetch()` with `Authorization: Bearer ${config.apiKey}` header
    - Config stored in `localStorage` under key `narrative-canvas-ai-config`
- The AI panel is marked "Beta" in the UI and is considered an experimental feature
- No specific provider is hardcoded -- any OpenAI-format compatible endpoint works

## Data Storage

**Databases:**
- None -- no relational, document, or graph database used

**File Storage:**
- Obsidian Vault filesystem (plugin mode):
  - Project files stored as JSON with `.ncanvas` or `.narrativecanvas` extension
  - Uses Obsidian's `vault` API (`TFile`, `TFolder`, `read`, `write`, `delete`, `rename` events)
  - File operations in `NarrativeCanvas/main.js` via helper functions like `readVaultText`, `writeVaultText`, `vaultFileExists`, `getVaultFolder`, `joinVaultPath`, `isVaultPathInProjectSaveFolder`
  - Legacy support: reads `NarrativeCanvas/project.json` as fallback
  - Companion files: `Playbook.json` (variables/stats sheet), Events Sheet CSV, Characters Markdown, Document Markdown
- Browser localStorage (standalone mode):
  - `localStorage` key: `narrative-canvas-state-v1` -- serialized project state
  - Manually cleared via "Clear storage" button in the web UI
  - These storage functions are stubbed out in the plugin bundle build (`scripts/build-plugin-bundle.cjs`)

**Caching:**
- None -- no server-side caching layer. The app is entirely client-side.

## Authentication & Identity

**Auth Provider:**
- None -- no user authentication system. All data lives in the Obsidian vault (plugin mode) or the browser's localStorage (standalone mode)
- AI API key is the only credential and is stored locally (plugin `data.json` or browser `localStorage`)

## Monitoring & Observability

**Error Tracking:**
- None -- no external error tracking service (no Sentry, no Datadog, etc.)
- Errors are logged to `console.error` and may trigger Obsidian `Notice` toasts
- CI pipeline verifies build artifacts but does not run monitoring

**Logs:**
- `console.error` and `console.log` -- standard browser/Node.js console output
- No structured logging framework
- Browser test output captured as HTML DOM dumps via `--dump-dom` in headless Chrome

## CI/CD & Deployment

**Hosting:**
- Obsidian Community Plugins -- distributed via GitHub Releases
- Release assets: `main.js`, `manifest.json`, `styles.css` (exactly 3 files)
- Release process (`NarrativeCanvas/.github/workflows/publish-plugin-release.yml`):
  - Manual trigger (`workflow_dispatch`) with version tag input
  - Verifies plugin artifacts (build freshness, UTF-8 validity, translations, CSS scoping)
  - Runs smoke, fixture, and GUI regression tests
  - Validates tag matches `manifest.json` version
  - Creates GitHub Release with build provenance attestation
  - Verifies uploaded assets match local files

**CI Pipeline:**
- GitHub Actions (3 workflow files in `NarrativeCanvas/.github/workflows/`):
  - `plugin-artifacts.yml` -- Runs on PRs, pushes to main, and manual dispatch. Runs `verify-plugin-artifacts.cjs`, smoke tests, fixture roundtrip tests, and GUI regression tests
  - `publish-plugin-release.yml` -- Manual release workflow (see above)
  - `verify-release-assets.yml` -- Runs on `release.published` event to verify published release assets match the tag
- All workflows run on `ubuntu-latest` with Node.js 22
- Build provenance attestation via `actions/attest-build-provenance@v2`

## Environment Configuration

**Required env vars:**
- CI only:
  - `GH_TOKEN` -- GitHub token for release creation and asset download (auto-provided by `${{ github.token }}`)
  - `BROWSER_PATH` -- Path to Chrome/Chromium/Edge executable for browser tests (optional; auto-detected)
  - `NARRATIVE_CANVAS_BROWSER_TEST_RETRY` -- Internal retry flag for browser tests
  - `RELEASE_TAG` -- Version tag passed to publish workflow

**Secrets location:**
- AI API key stored in Obsidian plugin's `data.json` (vault `.obsidian/plugins/narrative-canvas/data.json`) -- local only
- Browser AI config stored in `localStorage` under key `narrative-canvas-ai-config`
- GitHub Actions secrets managed through GitHub's secrets system (no explicit secret references in workflow files beyond `github.token`)

## Webhooks & Callbacks

**Incoming:**
- None -- no HTTP server endpoints. The app is entirely client-side with no inbound webhooks.

**Outgoing:**
- AI chat completions endpoint (user-configured, optional) -- non-streaming and streaming (SSE) POST requests
- No other outbound HTTP calls. The export system generates local downloadable files only.

## Export Formats (File-Based Output)

Narrative Canvas generates multiple output formats for integration with external game engines and narrative tools. These are local file downloads, not API calls:

**Runtime JSON:**
- Schema: `NarrativeCanvas/docs/runtime-json.schema.json`
- Format identifier: `narrative-canvas-runtime` v1
- Contains: full node graph, variables, characters, playbook actions, conditions, effects, routing, and an export report with warnings
- Consumed by custom runtime loaders (e.g., `NarrativeCanvas/examples/godot-runtime-loader/NarrativeCanvasRuntime.gd`, `NarrativeCanvas/examples/custom-runtime-loader/runtime-json-runner.cjs`)

**Export Profile:**
- Schema: `NarrativeCanvas/docs/export-profile.schema.json`
- Format identifier: `narrative-canvas-export-profile` v1
- Contains: file manifest, target format mappings, variable/node name mappings, warnings

**Text-Based Exports (generated from Runtime JSON):**
- **Twee (SugarCube 2.30.0):** `TWEE_SUGARCUBE_FORMAT_VERSION = "2.30.0"` in `NarrativeCanvas/app.js` line 31
- **Yarn Spinner** -- narrative scripting language used by Yarn Spinner game engine
- **Ink** -- narrative scripting language by Inkle Studios
- **Markdown** -- plain formatted story export
- **Characters export:** Markdown and JSON formats
- **Events Sheet:** CSV format
- **Canvas PNG:** image export at configurable resolutions (4096x4096, 6144x6144, 8192x8192, 12000x12000)

Each export format has dedicated formatting functions in `NarrativeCanvas/app.js` (e.g., `formatTweeEffect`, `formatYarnEffect`, `formatInkEffect`, `formatTweePassageName`, `formatRuntimeExpressionForFormat`)

---

*Integration audit: 2026-07-23*

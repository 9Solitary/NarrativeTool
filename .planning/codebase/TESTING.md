# Testing Patterns

**Analysis Date:** 2026-07-23

## Test Framework

**Runner:** Custom headless browser testing infrastructure -- no Jest, Mocha, Vitest, or other test framework.

**Browser:** Chromium-based browser (Chrome or Edge) run in headless mode via PowerShell or Node.js driver scripts. The browser is spawned with `--headless=new`, `--dump-dom`, and optionally `--virtual-time-budget` for deterministic timing.

**No assertion library.** Tests use custom assertion helpers (`assert()`, `pass()`, `fail()`) defined inline in each test HTML file.

**No test framework configuration files exist.** There is no `jest.config.*`, `vitest.config.*`, `.mocharc.*`, or similar.

### Test Drivers

Five test driver scripts orchestrate browser execution:

| Script | Language | Purpose |
|--------|----------|---------|
| `NarrativeCanvas/scripts/run-browser-test.cjs` | Node.js CJS | Generic headless browser test runner (used in CI for smoke, fixture, GUI regression) |
| `NarrativeCanvas/scripts/smoke-test.ps1` | PowerShell | Local smoke test driver |
| `NarrativeCanvas/scripts/fixture-test.ps1` | PowerShell | Local fixture roundtrip test driver |
| `NarrativeCanvas/scripts/perf-test.ps1` | PowerShell | Performance benchmark driver with TCP beacon |
| `NarrativeCanvas/scripts/large-acceptance-test.ps1` | PowerShell | Large project acceptance driver with TCP beacon |

### Additional Verification Scripts

| Script | Language | Purpose |
|--------|----------|---------|
| `NarrativeCanvas/scripts/verify-plugin-artifacts.cjs` | Node.js CJS | Static validation of `main.js`, `styles.css`, `manifest.json` (UTF-8, JSON validity, selector scoping, translation completeness, command registration) |
| `NarrativeCanvas/scripts/build-plugin-bundle.cjs` | Node.js CJS | Bundles `app.js` + `index.html` into `main.js`; supports `--check` for CI parity checks |
| `NarrativeCanvas/scripts/build-plugin-styles.cjs` | Node.js CJS | Bundles `canvas.css` + `plugin.css` into `styles.css`; supports `--check` |
| `NarrativeCanvas/scripts/portable-export-acceptance.cjs` | Node.js CJS | Export format compliance testing (schema validation, roundtrip checks) |
| `NarrativeCanvas/scripts/release-check.ps1` | PowerShell | Pre-release validation orchestrator |

### Run Commands

```powershell
# Run smoke tests (Windows PowerShell)
pwsh scripts/smoke-test.ps1

# Run fixture roundtrip tests
pwsh scripts/fixture-test.ps1

# Run GUI regression tests
pwsh scripts/run-browser-test.cjs tests/gui-regression.html gui 45000

# Run all tests (CI) -- via node
node scripts/run-browser-test.cjs tests/smoke.html smoke 30000
node scripts/run-browser-test.cjs tests/fixture-roundtrip.html fixture 60000
node scripts/run-browser-test.cjs tests/gui-regression.html gui 45000

# Performance benchmarks
pwsh scripts/perf-test.ps1 -Sizes "30,3000,30000" -Reps 12

# Large project acceptance
pwsh scripts/large-acceptance-test.ps1 -Sizes "30000,100000"

# Verify release artifacts
node scripts/verify-plugin-artifacts.cjs
```

## Test File Organization

### Location

All test files live in `NarrativeCanvas/tests/`. This directory contains:

| File | Lines | Type |
|------|-------|------|
| `tests/smoke.html` | 2,213 | Core functional smoke tests |
| `tests/fixture-roundtrip.html` | 918 | Fixture load/save/export roundtrip |
| `tests/gui-regression.html` | 997 | GUI layout and interaction regression |
| `tests/large-project-acceptance.html` | 424 | Large project performance acceptance |
| `tests/perf.html` | 304 | Performance benchmarking |
| `tests/fixtures/*.ncanvas` | -- | Pre-built project fixture files |
| `tests/fixtures/*.json` | -- | Schema/layout/routes fixture sidecars |

### Naming

- **Test files:** `kebab-case.html` with `<body data-{type}-status="running">` attribute for the driver to detect completion
- **Fixture files:** `kebab-case.ncanvas` under `tests/fixtures/`
- **Status identifier:** Each test HTML reports status via a named data attribute matching the driver's `statusName` parameter (e.g., `data-smoke-status="pass"`, `data-fixture-status="pass"`, `data-gui-status="pass"`)

### Structure

```
tests/
├── smoke.html                    # Core smoke tests (web + plugin host modes)
├── fixture-roundtrip.html        # Fixture load/save/export roundtrip tests
├── gui-regression.html           # GUI layout regression tests
├── large-project-acceptance.html # Large scale acceptance
├── perf.html                     # Performance benchmarks
├── fixtures/
│   ├── characters-cast-chips.ncanvas
│   ├── choice-link-branches.ncanvas
│   ├── custom-node-types.ncanvas
│   ├── export-large-canvas.ncanvas
│   ├── export-outside-viewport.ncanvas
│   ├── legacy-events-columns.ncanvas
│   ├── legacy-no-ui-sidebar.ncanvas
│   ├── state-runtime-key-play.ncanvas
│   ├── state-runtime-key-play.routes.json
│   ├── story-source-acceptance.layout.json
│   ├── story-source-acceptance.routes.json
│   ├── story-source-acceptance.state.schema.json
│   └── story-source-acceptance.story.md
```

## Test Structure

### Suite Organization

Each test HTML file is a self-contained test suite. Tests are structured as:

1. **HTML shell** with a `<body>` element carrying a `data-{name}-status` attribute set to `"running"` at page load
2. **Report object** (`const report = { startedAt, tests: [], failures: [] }`) that accumulates results
3. **Test helper functions** (`assert()`, `pass()`, `fail()`, `waitFor()`, `click()`, etc.)
4. **Host loading functions** that create iframes containing the Narrative Canvas app in either "web" or "plugin" simulation mode
5. **Test scenario functions** organized by feature area
6. **`run()` function** that orchestrates test execution and writes final JSON report to a `<pre>` element
7. **`window.addEventListener("load", run, { once: true })`** to start tests on page load

### Typical Test Pattern

```js
// 1. Report state
const report = { startedAt: new Date().toISOString(), tests: [], failures: [] };

// 2. Helpers
function record(name, status, detail = "") {
  report.tests.push({ name, status, detail });
}

function pass(name, detail = "") {
  record(name, "pass", detail);
}

function fail(name, detail = "") {
  record(name, "fail", detail);
  report.failures.push({ name, detail });
}

function assert(name, condition, detail = "") {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(name, predicate, timeout = 4000, getDetail = null) {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    if (predicate()) {
      pass(name);
      return true;
    }
    await wait(50);
  }
  const detail = typeof getDetail === "function" ? getDetail() : "";
  fail(name, detail ? `Timed out; ${detail}` : "Timed out");
  return false;
}

// 3. Test scenario
async function runFeatureCheck(hostLabel, target) {
  const { win, doc } = target;

  // Interactive testing via DOM manipulation
  const input = doc.querySelector("[data-node-field='title']");
  input.value = "New Title";
  input.dispatchEvent(new win.Event("input", { bubbles: true }));

  // State verification
  const savedState = win.NarrativeCanvasApp.getSavedState?.();
  assert(`${hostLabel}: title updated`, savedState?.project?.title === "New Title");
}

// 4. Runner with final report
async function run() {
  try {
    const web = await loadWebFrame();
    await runFeatureCheck("web", web);
    // ... more tests
  } catch (error) {
    fail("runner crashed", error && error.stack ? error.stack : String(error));
  } finally {
    report.finishedAt = new Date().toISOString();
    report.status = report.failures.length ? "fail" : "pass";
    document.body.setAttribute("data-smoke-status", report.status);
    document.querySelector("#smoke-report").textContent = JSON.stringify(report, null, 2);
  }
}

window.addEventListener("load", run, { once: true });
```

## Host Simulation

Tests simulate two environments by loading the app in an iframe:

### Plugin Mode (Obsidian simulation)
```js
win.NarrativeCanvasHost = {
  root,                                       // host DOM root
  loadProject: async () => savedJson,         // vault read simulation
  saveProject: async (nextSavedJson) => {     // vault write simulation
    savedJson = nextSavedJson;
    return "Project.ncanvas";
  },
  getAutoSaveIntervalMs: () => 1000000,       // disable auto-save
  ensureProjectFile: async () => "...",
  createProjectFile: async () => "...",
  previewNewProjectFile: async () => "...",
  getProjectFile: () => "..."
};
```

### Web Mode (standalone browser)
```js
win.NarrativeCanvasHost = {
  loadState: async () => savedJson,
  saveState: async (nextSavedState) => { savedJson = JSON.stringify(nextSavedState); return true; },
  stateFile: "Acceptance browser state"
};
```

CSS is scoped for plugin-host tests via a `scopeCanvasCss()` function that prefixes selectors with `.narrative-canvas-plugin-host`. Web mode tests use raw CSS.

## Mocking

### No Mocking Framework

There is no mocking library (no `sinon`, `jest.mock`, or `vi.mock`). Tests mock browser APIs and the host bridge through direct object replacement:

**Download capture:**
```js
function installDownloadCapture(win) {
  win.__downloads = [];
  let lastDownload = null;
  win.URL.createObjectURL = (blob) => {
    lastDownload = { size: blob?.size || 0, type: blob?.type || "", filename: "" };
    win.__downloads.push(lastDownload);
    return `blob:narrative-canvas-${win.__downloads.length}`;
  };
  win.URL.revokeObjectURL = () => {};
  const originalClick = win.HTMLAnchorElement.prototype.click;
  win.HTMLAnchorElement.prototype.click = function() {
    if (lastDownload) lastDownload.filename = this.download || "";
    if (!String(this.href || "").startsWith("blob:narrative-canvas-")) {
      return originalClick.call(this);
    }
  };
}
```

**Pointer event simulation:**
```js
function makePointer(win, type, target, clientX, clientY, extra = {}) {
  return target.dispatchEvent(new win.PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true, view: win,
    pointerId: 7, pointerType: "mouse", isPrimary: true,
    button: 0, buttons: type === "pointerup" ? 0 : 1,
    clientX, clientY, ...extra
  }));
}
```

**Click simulation:**
```js
function click(element) {
  if (!element) return;
  element.dispatchEvent(new MouseEvent("click", {
    bubbles: true, cancelable: true, view: element.ownerDocument.defaultView
  }));
}
```

**Control value setting:**
```js
function setControlValue(win, element, value) {
  element.focus();
  element.value = value;
  element.dispatchEvent(new win.Event("input", { bubbles: true }));
  element.dispatchEvent(new win.Event("change", { bubbles: true }));
}
```

### What is Mocked

- Browser download APIs (`URL.createObjectURL`, `anchor.click`)
- Obsidian vault via `NarrativeCanvasHost` bridge object
- Auto-save timers (set to ~17 minutes to prevent interference)
- Storage APIs are NOT mocked; browsers provide real `localStorage`

### What is NOT Mocked

- DOM rendering (real iframe-based rendering)
- Event system (real `dispatchEvent`)
- CSS layout (real computed styles are queried)
- Canvas state management (full app initialization in sandboxed iframe)

## Fixtures

### Pre-built Fixtures

Fixture files are `.ncanvas` JSON project files stored in `NarrativeCanvas/tests/fixtures/`. Each fixture represents a specific project state used for roundtrip testing:

| Fixture | Tests |
|---------|-------|
| `legacy-no-ui-sidebar.ncanvas` | Legacy sidebar migration, export download |
| `legacy-events-columns.ncanvas` | Event column migration, CSV/JSON export |
| `custom-node-types.ncanvas` | Custom node type persistence, runtime export |
| `characters-cast-chips.ncanvas` | Character cast entries, backlinks, MD/JSON export |
| `choice-link-branches.ncanvas` | Branching choice links and labels |
| `state-runtime-key-play.ncanvas` | State variables, condition evaluation, Story Markdown export |
| `export-large-canvas.ncanvas` | Large canvas export correctness |
| `export-outside-viewport.ncanvas` | Export with nodes outside the visible viewport |

### Programmatic Fixtures

Performance and acceptance tests generate project data programmatically using factory functions:

```js
function generateProject(nodeCount) {
  const types = ["Content", "Dialog", "Choice", "Clue", "InterviewNote", "Jump", "Marker"];
  const columns = Math.max(1, Math.round(Math.sqrt(nodeCount)));
  const nodes = [];
  for (let index = 0; index < nodeCount; index += 1) {
    const type = index === 0 ? "Entry" : types[index % types.length];
    nodes.push({
      id: `n${index}`, type,
      title: `Node ${index}`,
      body: `Body text for node ${index}.`,
      x: 120 + (index % columns) * 320,
      y: 120 + Math.floor(index / columns) * 200
    });
  }
  return { version: 1, savedAt: new Date().toISOString(),
    project: { title: `Generated ${nodeCount}`, nodes, links: [...] },
    ui: { ... } };
}
```

### Fixture Location

- `NarrativeCanvas/tests/fixtures/` -- pre-built `.ncanvas` files and JSON sidecars

## Test Result Reporting

Each test HTML page writes results to a `<pre>` element with a specific ID (e.g., `#smoke-report`, `#fixture-report`) as a JSON-serialized report object:

```json
{
  "startedAt": "2026-07-23T...",
  "finishedAt": "2026-07-23T...",
  "status": "pass",
  "tests": [
    { "name": "web: app initializes", "status": "pass" },
    { "name": "web: node created", "status": "pass" }
  ],
  "failures": []
}
```

The body element's `data-{name}-status` attribute is set to either `"pass"` or `"fail"`. The test driver reads this attribute to determine pass/fail:

```js
const passStatus = `data-${statusName}-status="pass"`;
// in node runner:
if (!html.includes(passStatus)) {
  console.error(`[fail] ${relativeTestPath} did not report ${passStatus}`);
  process.exitCode = 1;
}
```

## Coverage

**No code coverage tooling.** There is no `nyc`, `c8`, `istanbul`, or similar coverage instrumentation. No coverage thresholds are enforced.

## Test Types

### Smoke Tests (`tests/smoke.html`)

**Scope:** Core functional correctness across web and plugin host environments.
**Run time:** ~30 seconds (virtual time budget).
**Tests:** App initialization, node creation, editing, linking, canvas interactions, language switching, theme toggling, export verification, immersive fullscreen, sample project creation.

### Fixture Roundtrip Tests (`tests/fixture-roundtrip.html`)

**Scope:** Load/save/export roundtrip for pre-built fixtures.
**Run time:** ~60 seconds.
**Tests:** Each fixture is loaded, saved, and exported. Assertions verify that:
- Project data survives save/load cycle
- UI state (sidebar, search, viewport) is preserved
- Export files are generated with correct content
- Migration code paths handle legacy formats correctly

### GUI Regression Tests (`tests/gui-regression.html`)

**Scope:** GUI layout and interaction correctness.
**Run time:** ~45 seconds.
**Tests:** Node sizing, rendering, dialog ratios, search filtering, context menus, keyboard shortcuts, sidebar collapse/expand, element visibility, contrast accessibility.

### Performance Benchmarks (`tests/perf.html`)

**Scope:** Real wall-clock performance measurement.
**Run time:** Variable (depends on sizes and repetitions).
**Tests:** Measures `openMs` (init time), `dragAvgMs` (pointer move latency), `inputAvgMs` (editing latency), `commitMs` (commit time) for project sizes 30, 3000, 30000+ nodes.
**NOTE:** Must run WITHOUT `--virtual-time-budget` since that virtualizes `performance.now()`.

### Large Project Acceptance (`tests/large-project-acceptance.html`)

**Scope:** Correctness at scale (30,000-100,000+ nodes).
**Run time:** Up to 15 minutes.
**Tests:** Open time, render correctness, document export validity, route traversal completeness at project scale.

## CI Integration

Tests run in GitHub Actions via `NarrativeCanvas/.github/workflows/verify-release-assets.yml`:

```yaml
- name: Verify tagged root artifacts
  run: node scripts/verify-plugin-artifacts.cjs
- name: Run smoke tests
  run: node scripts/run-browser-test.cjs tests/smoke.html smoke 30000
- name: Run fixture tests
  run: node scripts/run-browser-test.cjs tests/fixture-roundtrip.html fixture 60000
- name: Run GUI regression tests
  run: node scripts/run-browser-test.cjs tests/gui-regression.html gui 45000
```

The CI also validates release asset integrity by comparing tagged files with release downloads.

### Retry Logic

The Node.js test runner (`run-browser-test.cjs`) includes automatic retry logic:

```js
if (incomplete && process.env[retryEnvironmentKey] !== "1") {
  const retryBudget = Math.max(60000, virtualTimeBudget * 2);
  console.warn(`[retry] ${relativeTestPath} remained incomplete after ${virtualTimeBudget} ms`);
  const retry = spawnSync(process.execPath, [
    __filename, relativeTestPath, statusName, String(retryBudget)
  ], {
    cwd: projectRoot,
    env: { ...process.env, [retryEnvironmentKey]: "1" },
    stdio: "inherit"
  });
  process.exitCode = retry.status === 0 ? 0 : 1;
  return;
}
```

Only one retry is attempted. The retry doubles the virtual time budget.

## Common Test Patterns

### Async Waiting

Tests use a polling-based `waitFor()` pattern rather than listeners or callbacks:

```js
async function waitFor(name, predicate, timeout = 4000, getDetail = null) {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    if (predicate()) {
      pass(name);
      return true;
    }
    await wait(50);
  }
  fail(name, ...);
  return false;
}
```

### DOM Interaction Testing

Tests simulate user interactions by dispatching synthetic events:

```js
// Click
element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: win }));

// Input
element.focus();
element.value = "new text";
element.dispatchEvent(new win.Event("input", { bubbles: true }));

// Drag
element.dispatchEvent(new win.PointerEvent("pointerdown", {
  bubbles: true, cancelable: true, pointerId: 7, clientX, clientY, ...
}));
viewport.dispatchEvent(new win.PointerEvent("pointermove", { ... }));
viewport.dispatchEvent(new win.PointerEvent("pointerup", { ... }));
```

### State Verification

Tests verify state by accessing the app's internal state via a public API:

```js
const savedState = win.NarrativeCanvasApp.getSavedState();
assert("title updated", savedState?.project?.title === "Expected Title");
```

### Visual/Contrast Testing

Tests compute WCAG contrast ratios from computed styles:

```js
function contrastRatio(colorA, colorB) {
  const rgbA = parseRgb(colorA);
  const rgbB = parseRgb(colorB);
  if (!rgbA || !rgbB) return 0;
  const light = Math.max(relativeLuminance(rgbA), relativeLuminance(rgbB));
  const dark = Math.min(relativeLuminance(rgbA), relativeLuminance(rgbB));
  return (light + 0.05) / (dark + 0.05);
}

assert("toggle is readable on light background", contrastRatio >= 4.5 && isLightBackground);
```

## Test Coverage Gaps

**Areas not covered by automated tests:**
- **Unit tests:** No unit tests exist. All tests are integration-level browser tests.
- **Obsidian API integration:** Tests mock `NarrativeCanvasHost` rather than running inside Obsidian. Real Obsidian interaction (vault operations, file events, settings persistence) is not tested in CI.
- **AI networking:** AI endpoint calls are not tested. The `requestAi()` and `requestAiStream()` methods in `main.js` (lines 186-252) have no test coverage.
- **Cross-platform rendering:** Tests run on Ubuntu (CI) and Windows (PowerShell scripts) but Mac-specific rendering is not verified.
- **Mobile/narrow layout:** The GUI regression test includes compact viewport testing (520px width) but comprehensive mobile interaction testing is absent.

---

*Testing analysis: 2026-07-23*

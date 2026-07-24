---
phase: 03-entities-flow
plan: 02
subsystem: flow-tools
tags: [canvas, templates, flow, fragment, tdd]
dependency_graph:
  requires: []
  provides: [canvas-utils, canvas-templates, flow-canvas-creator]
  affects: [FLW-01, FLW-02]
tech-stack:
  added: []
  patterns: [TDD, golden-file-testing, tab-indented-JSON, crypto-node-id, spread-preservation]
key-files:
  created:
    - plugins/flow-tools/src/canvas-utils.js
    - plugins/flow-tools/src/canvas-templates.js
    - tests/canvas-templates.test.js
    - tests/fixtures/expected-flow-chapter.canvas
    - tests/fixtures/expected-flow-quest.canvas
    - tests/fixtures/expected-flow-world-event.canvas
    - tests/fixtures/expected-fragment-quest-detail.canvas
    - tests/fixtures/expected-fragment-scene.canvas
  modified: []
decisions:
  - "Node ID format: 16-char hex lowercase via crypto.randomBytes(8).toString('hex')"
  - "Edge ID format: edge-NNNNNNNNNNNN prefix to avoid collision with node IDs"
  - "Template functions accept optional idGenerator/edgeIdGenerator for test determinism"
  - "addNodeToCanvas uses spread (...) to preserve unknown fields in canvas JSON"
  - "JSON indentation uses tabs to match Obsidian Canvas format"
  - "All 5 template types produce structured canvas JSON with pre-configured nodes and edges"
metrics:
  duration: ""
  completed_date: "2026-07-24"
---

# Phase 3 Plan 2: Canvas Templates Summary

**One-liner:** Flow Canvas and Flow Fragment .canvas JSON template generators with deterministic golden-file testing, producing Obsidian-compatible Canvas JSON from Chapter/Quest/World Event/Quest Detail/Scene Breakdown templates.

## Execution Summary

Executed via TDD (RED -> GREEN) cycle with 2 commits. All 12 tests pass with 0 failures.

### Task 1: RED — Golden files + failing test suite

Created 5 golden fixture files containing expected .canvas JSON output for each template type, plus a comprehensive test suite with 12 tests covering:
- JSON structure validation (nodes[] and edges[] presence)
- Golden file match verification for all 5 templates
- generateNodeId format and uniqueness (1000 consecutive calls, 0 collisions)
- addNodeToCanvas node appending and edge non-modification
- addDialogueNodeToCanvas file node creation
- Unknown field preservation in canvas JSON
- Tab indentation enforcement

**Commit:** `4557837` — All tests RED (modules not yet implemented)

### Task 2: GREEN — Implement canvas-utils.js and canvas-templates.js

Implemented two source modules:

**canvas-utils.js** (77 lines) — .canvas JSON manipulation utilities:
- `generateNodeId()` — 16-char hex lowercase via `crypto.randomBytes(8).toString('hex')`
- `createCanvas()` — returns `{ nodes: [], edges: [] }`
- `addNodeToCanvas(canvas, node)` — appends node while preserving unknown fields (spread pattern), returns new object without mutating original
- `addDialogueNodeToCanvas(canvas, path, position, idGenerator)` — convenience wrapper creating `type: "file"` nodes

**canvas-templates.js** (324 lines) — Flow Canvas and Flow Fragment template generators:
- `createFlowCanvas(templateType, params, options)` — supports `chapter`, `quest`, `world-event`
- `createFlowFragment(templateType, params, options)` — supports `quest-detail`, `scene-breakdown`
- `FLOW_TEMPLATES` and `FRAGMENT_TEMPLATES` constant exports
- Each template produces structured nodes with appropriate colors, positions, and edges
- Accepts optional `generateNodeId` and `generateEdgeId` for test determinism
- Unknown template types throw descriptive errors
- JSON output uses tab (`\t`) indentation matching Obsidian Canvas format

**Commit:** `e6dfa88` — All 12 tests GREEN, 0 failures

### Test Results

```
tests 12
suites 11
pass 12
fail 0
duration_ms 71.995
```

## Deviations from Plan

None — plan executed exactly as written. All 5 golden fixtures, 12 tests, and 2 source modules implemented precisely to specification.

## Known Stubs

None. All template functions produce complete, exportable .canvas JSON with correctly positioned nodes, colors, and edges. No placeholder text, no hardcoded empty values, no mock data paths.

## Threat Flags

None. Template functions do not validate file paths (by design — see T-03-04 in plan threat model). Path validation is the responsibility of the Plugin layer (Plan 03-03+), which uses Obsidian's `normalizePath()` and vault API.

## Commits

| Hash | Type | Message |
|------|------|---------|
| `4557837` | test | test(03-02): add failing test suite and golden files for canvas templates |
| `e6dfa88` | feat | feat(03-02): implement canvas-utils and canvas-templates modules |

## Requirements Satisfied

- **FLW-01:** Flow Canvas templates (Chapter, Quest, World Event) — 3 templates with pre-configured nodes, correct colors, vault-relative file paths
- **FLW-02:** Flow Fragment templates (Quest Detail, Scene Breakdown) — 2 templates with branching nodes, dialogue references, beat chains

## Self-Check: PASSED

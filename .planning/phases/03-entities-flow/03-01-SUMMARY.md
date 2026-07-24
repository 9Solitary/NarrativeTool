---
phase: 03-entities-flow
plan: 01
type: tdd
subsystem: entity-templates
tags: [entities, markdown, templates, yaml, frontmatter, golden-test]
depends_on: []
provides: 4 entity Markdown template generators with YAML frontmatter
affects: plugins/flow-tools/src/entity-templates.js, tests/entity-templates.test.js, tests/fixtures/expected-*.md
tech-stack:
  added: []
  patterns:
    - "Golden file testing with strictEqual comparison"
    - "YAML frontmatter generation with injection-safe string escaping"
    - "snake_case field name convention for Obsidian frontmatter compatibility"
key-files:
  created:
    - plugins/flow-tools/src/entity-templates.js
    - tests/entity-templates.test.js
    - tests/fixtures/expected-character.md
    - tests/fixtures/expected-location.md
    - tests/fixtures/expected-quest.md
    - tests/fixtures/expected-item.md
  modified: []
decisions:
  - "YAML frontmatter field names use snake_case (appearance_scenes, connected_locations) for Obsidian compatibility"
  - "Golden file testing approach: exact strictEqual match between template output and pre-committed .md fixtures"
  - "All string values in YAML frontmatter are double-quoted with internal quote escaping for injection safety"
metrics:
  duration: ""
  completed_date: "2026-07-24"
  tasks: 2
  files: 6
---

# Phase 3 Plan 1: Entity Templates Summary

**One-liner:** Implemented 4 entity Markdown template generators (Character, Location, Quest, Item) with YAML injection-safe frontmatter, Graph View tags, and golden file test verification.

## Execution Summary

Executed via TDD RED-GREEN cycle:

- **Task 1 (RED):** Created 4 golden file fixtures and a 14-test test suite. All tests expected to FAIL (entity-templates.js did not exist). Commit: `b0f003d`
- **Task 2 (GREEN):** Implemented `plugins/flow-tools/src/entity-templates.js` with 4 template generator functions. All 14 tests PASS. Full suite: 183 tests, 0 failures, 59 suites. Commit: `11005f8`

## Entities Implemented

| Entity | Generator | Golden File | Graph Tag | Body Sections |
|--------|-----------|-------------|-----------|---------------|
| Character | `createCharacterMd()` | `expected-character.md` | `[character]` | Role, Voice, Notes, Speaker Scenes |
| Location | `createLocationMd()` | `expected-location.md` | `[location]` | Description, Region, Related Locations (wikilinks), Notes |
| Quest | `createQuestMd()` | `expected-quest.md` | `[quest]` | Description, Type, Stages (numbered), Related Characters, Related Locations |
| Item | `createItemMd()` | `expected-item.md` | `[item]` | Description, Type, Related Quest (wikilink) |

## Key Implementation Details

### YAML Frontmatter Generation
- Field names use snake_case (`appearance_scenes`, `connected_locations`, `quest_type`, `giver_character_id`, `related_quest_id`, etc.) for Obsidian metadataCache compatibility
- All string values wrapped in double quotes; internal double quotes escaped as `\"`
- Array values use bracket syntax: `["a", "b"]`
- Tags field: `tags: [character]`, `tags: [location]`, `tags: [quest]`, `tags: [item]`

### Body Format
- H1 title using `# Name`
- Structured sections with CCJK section headers (Chinese) matching NC Characters.md export format
- Wikilinks use `[[id]]` format for inter-entity references
- Conditional sections: Notes, Speaker Scenes, related entities only rendered when data is present

### YAML Injection Safety
- Escapes double quotes in user-provided string values
- Handles colons in values by wrapping in double quotes (colon inside quotes is YAML-safe)
- Newline characters in values remain escaped by the double-quote wrapping

## Test Coverage

14 tests across 8 suites (all passing):

1. Character template golden match (ENT-01)
2. Location template golden match (ENT-02)
3. Quest template golden match (ENT-03)
4. Item template golden match (ENT-04)
5. Graph View tags verification (ENT-05) -- 4 sub-tests
6. Frontmatter required fields (id, name)
7. YAML injection safety -- 2 sub-tests (double quotes, colons)
8. Empty optional fields -- 3 sub-tests (empty arrays, empty strings, appearance_scenes)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed require path for shared/schema modules**
- **Found during:** Task 2 (GREEN)
- **Issue:** The plan specified `require('../../../../shared/schema/character')` but from `plugins/flow-tools/src/`, the correct path is `../../../shared/schema/character` (3 levels up, not 4)
- **Fix:** Corrected all four require paths from `../../../../` to `../../../`
- **Files modified:** `plugins/flow-tools/src/entity-templates.js`
- **Commit:** `11005f8`

**2. [Rule 1 - Bug] Missing blank line between YAML frontmatter closing `---` and body H1**
- **Found during:** Task 2 (GREEN)
- **Issue:** `buildFrontmatter()` produced `---\n# Bob` but golden files expected `---\n\n# Bob` (blank line between frontmatter close delimiter and body content)
- **Fix:** Added extra `''` entry in `buildFrontmatter()` parts array to produce the blank line
- **Files modified:** `plugins/flow-tools/src/entity-templates.js`
- **Commit:** `11005f8`

**3. [Rule 1 - Bug] Missing trailing newline in generated Markdown output**
- **Found during:** Task 2 (GREEN)
- **Issue:** Template output did not end with a trailing `\n`, but golden files (written as standard text files) end with `\n`
- **Fix:** Added `+ '\n'` to all four function return statements
- **Files modified:** `plugins/flow-tools/src/entity-templates.js`
- **Commit:** `11005f8`

**4. [Rule 1 - Bug] Extra trailing blank line after last wikilink section in Quest and Item templates**
- **Found during:** Task 2 (GREEN)
- **Issue:** `body.push('')` after the involved location IDs loop and related quest section added an unwanted blank line. The golden files do not have a blank line after the last wikilink in the file.
- **Fix:** Removed trailing `''` entries from the quest involved location section and item related quest/owner character sections
- **Files modified:** `plugins/flow-tools/src/entity-templates.js`
- **Commit:** `11005f8`

## Threat Surface

The plan's `<threat_model>` identified T-03-01 (YAML frontmatter injection), T-03-02 (path traversal via id), T-03-03 (error message info disclosure), and T-03-SC (package install). All applicable mitigations are implemented:

- **T-03-01 (mitigated):** `yamlStr()` wraps all string values in double quotes and escapes internal `"` as `\"`. Verified by Test 7 (YAML injection safety).
- **T-03-02 (deferred):** Path traversal is handled by the Plugin layer (future plan). Template generators are pure data transformation.
- **T-03-03 (accepted):** Error messages only expose fixtures directory paths, not sensitive paths.
- **T-03-SC (accepted):** No new packages installed.

No new threat surfaces introduced beyond what the plan anticipated.

## Known Stubs

None. All four template generators produce complete, valid Markdown with all fields rendered. Empty optional sections (Notes, Speaker Scenes, related locations) produce valid but empty sections that designers populate manually.

## Compliance Check

### TDD Gate Compliance

The plan is `type: tdd`. Git log confirms the required gate sequence:

1. `test(03-01)` commit (`b0f003d`) -- RED gate: PASS
2. `feat(03-01)` commit (`11005f8`) -- GREEN gate: PASS

Both gate commits exist in the correct order. No REFACTOR commit needed (the implementation was clean on the first GREEN pass).

### Requirement Verification

- **ENT-01** (Character template): Verified by Test 1 golden match + Test 5 character tag + Test 6 required fields
- **ENT-02** (Location template): Verified by Test 2 golden match + Test 5 location tag + Test 6 required fields
- **ENT-03** (Quest template): Verified by Test 3 golden match + Test 5 quest tag + Test 6 required fields
- **ENT-04** (Item template): Verified by Test 4 golden match + Test 5 item tag + Test 6 required fields
- **ENT-05** (Graph View tags): Verified by Test 5 (4 sub-tests checking all four entity type tags)

## Self-Check

```bash
# Verify golden files exist
[ -f "tests/fixtures/expected-character.md" ] && echo "FOUND: expected-character.md" || echo "MISSING: expected-character.md"
[ -f "tests/fixtures/expected-location.md" ] && echo "FOUND: expected-location.md" || echo "MISSING: expected-location.md"
[ -f "tests/fixtures/expected-quest.md" ] && echo "FOUND: expected-quest.md" || echo "MISSING: expected-quest.md"
[ -f "tests/fixtures/expected-item.md" ] && echo "FOUND: expected-item.md" || echo "MISSING: expected-item.md"

# Verify source files exist
[ -f "plugins/flow-tools/src/entity-templates.js" ] && echo "FOUND: entity-templates.js" || echo "MISSING: entity-templates.js"
[ -f "tests/entity-templates.test.js" ] && echo "FOUND: entity-templates.test.js" || echo "MISSING: entity-templates.test.js"

# Verify commits exist
git log --oneline | grep -q "b0f003d" && echo "FOUND: RED commit b0f003d" || echo "MISSING: RED commit b0f003d"
git log --oneline | grep -q "11005f8" && echo "FOUND: GREEN commit 11005f8" || echo "MISSING: GREEN commit 11005f8"

# Verify tests pass
node --test tests/entity-templates.test.js && echo "PASS: All 14 entity template tests"
```

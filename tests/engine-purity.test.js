// engine-purity.test.js — Layer boundary guard for plugins/narrative-tool/src/engine/
//
// Enforces the engine/ purity rule (ARCHITECTURE.md): engine modules are pure
// data-transformation code with zero Obsidian runtime dependencies. This guards
// against the duplicate-engine-copy drift that motivated ENG-01 — any future
// copy of the engine that sneaks an obsidian import or window/document access
// into engine/ fails here.
//
// D-03 sanity: also asserts the shared constants relocated into engine/ with
// their original export names (TOKENS, MED_TOKENS) preserved.

const { describe, it } = require("node:test");
const assert = require("node:assert");
const { readFileSync, readdirSync, existsSync } = require("node:fs");
const { join, relative } = require("node:path");

const ENGINE_DIR = join(__dirname, "..", "plugins", "narrative-tool", "src", "engine");

const FORBIDDEN_PATTERNS = [
  { name: "obsidian require", regex: /require\(\s*['"]obsidian['"]\s*\)/ },
  { name: "window access", regex: /window\s*\./ },
  { name: "document access", regex: /document\s*\./ },
];

/**
 * Recursively collect every .js file under a directory.
 *
 * @param {string} dir - Directory to walk
 * @returns {Array<string>} Absolute paths of .js files
 */
function listJsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Scan one file's content for all forbidden patterns.
 *
 * @param {string} file - Absolute path to the file to scan
 * @returns {Array<string>} Human-readable violation descriptions
 */
function scanForViolations(file) {
  const content = readFileSync(file, "utf-8");
  const matches = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    const re = new RegExp(pattern.regex.source, "g");
    let match;
    while ((match = re.exec(content)) !== null) {
      matches.push(`${pattern.name}: ${match[0]}`);
    }
  }
  return matches;
}

describe("engine/ layer purity", () => {
  it("scans at least 5 .js files in engine/", () => {
    const files = listJsFiles(ENGINE_DIR);
    assert.ok(
      files.length >= 5,
      `Expected at least 5 engine files (export-engine, gd-format, med-format, gd-constants, med-constants), found ${files.length}`
    );
  });

  it("contains no obsidian require, window., or document. anywhere in engine/", () => {
    const files = listJsFiles(ENGINE_DIR);
    const violations = [];
    for (const file of files) {
      const matches = scanForViolations(file);
      if (matches.length > 0) {
        violations.push({ file: relative(process.cwd(), file), matches });
      }
    }
    assert.deepStrictEqual(
      violations,
      [],
      "engine/ modules must not import obsidian or touch window/document"
    );
  });
});

describe("purity matcher positive control", () => {
  it("detects require('obsidian') in a synthetic string", () => {
    const sample = "const plugin = require('obsidian');";
    assert.ok(
      FORBIDDEN_PATTERNS[0].regex.test(sample),
      "matcher must detect require('obsidian')"
    );
  });

  it("detects require(\"obsidian\") with double quotes", () => {
    const sample = 'const plugin = require("obsidian");';
    assert.ok(
      FORBIDDEN_PATTERNS[0].regex.test(sample),
      "matcher must detect require(\"obsidian\")"
    );
  });

  it("detects window. and document. access", () => {
    assert.ok(/window\s*\./.test("window.activeLeaf"), "matcher must detect window.");
    assert.ok(/document\s*\./.test("document.createElement"), "matcher must detect document.");
  });

  it("does not flag benign code", () => {
    const benign = "const path = require('./gd-constants');\nconst windowSize = { width: 800 };";
    assert.ok(!FORBIDDEN_PATTERNS[0].regex.test(benign), "benign requires must not match");
    assert.ok(!/window\s*\./.test("const windowSize = { width: 800 };"), "windowSize must not match window.");
    assert.ok(!/document\s*\./.test("const doc = documentation"), "plain word must not match document.");
  });
});

describe("D-03 constants relocation sanity", () => {
  it("gd-constants.js exists in engine/ and exports TOKENS", () => {
    const gdPath = join(ENGINE_DIR, "gd-constants.js");
    assert.ok(existsSync(gdPath), "gd-constants.js should live in engine/ per D-03");
    const { TOKENS } = require(gdPath);
    assert.ok(
      TOKENS && typeof TOKENS.OPTION_PREFIX === "string",
      "TOKENS should be exported with DM line tokens preserved"
    );
  });

  it("med-constants.js exists in engine/ and exports MED_TOKENS", () => {
    const medPath = join(ENGINE_DIR, "med-constants.js");
    assert.ok(existsSync(medPath), "med-constants.js should live in engine/ per D-03");
    const { MED_TOKENS } = require(medPath);
    assert.ok(
      MED_TOKENS && typeof MED_TOKENS.USING_STATE === "string",
      "MED_TOKENS should be exported with MED tokens preserved"
    );
  });
});

// export.test.js — Master test suite for Dialogue Export (Phase 2)
//
// Imports all sub-suites:
//   - export-base.test.js   (EXP-01 through EXP-07: base Godot DM)
//   - export-med.test.js    (MED-01 through MED-08: MED state extensions) — from Plan 02-02
//   - export-plugin.test.js (Plugin integration and edge cases)
//
// Run with: node --test tests/export.test.js
// Or run full suite: node --test tests/

const { describe, it } = require('node:test');

describe('Dialogue Export — Master Suite', () => {
  it('all sub-suites are importable', () => {
    // These requires verify the test files exist and are syntactically valid.
    // node:test auto-discovers and runs them.
    require('./export-base.test.js');
    // export-med.test.js imported below (may not exist if only 02-01 executed)
    require('./export-plugin.test.js');
  });
});

// Import MED tests if they exist (created by Plan 02-02)
try {
  require('./export-med.test.js');
} catch (e) {
  // MED tests not yet created — this is OK during partial execution.
  // The full suite will include them after Plan 02-02 completes.
  console.log('[export.test.js] MED tests not found — run Plan 02-02 first');
}

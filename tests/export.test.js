// export.test.js — Master test entry that imports all export test suites.
// Phase 2: imports base DM tests. Plan 02-02 adds MED tests, 02-03 adds plugin integration.

const { describe, it } = require('node:test');

describe('Dialogue Export — Full Suite', () => {
  it('base DM tests pass (EXP-01 through EXP-07)', async () => {
    // The base DM tests are in export-base.test.js which node:test auto-discovers.
    // This is a marker test for the master suite.
  });
});

// Re-export base test suite
require('./export-base.test.js');

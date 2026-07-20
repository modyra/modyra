// Benchmarks run on demand only (npm run test:perf): same environment as
// the unit suite, but matching just the perf specs.
const base = require("./jest.config.cjs");

module.exports = {
  ...base,
  testMatch: ["<rootDir>/src/**/benchmarks.spec.ts"],
  testPathIgnorePatterns: [],
};

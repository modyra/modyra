// Standalone Jest config for the Angular package — no Angular CLI workspace
// involved. Run from the repo root: jest -c packages/angular/jest.config.cjs
// (wired as `npm run test:angular`).
module.exports = {
  preset: "jest-preset-angular",
  rootDir: __dirname,
  // Must be setupFilesAfterEnv: Angular core registers its global cleanup
  // hook via globalThis.afterEach at import time — only defined after the
  // test framework is installed.
  setupFilesAfterEnv: ["<rootDir>/test/setup-jest.cjs"],
  testMatch: ["<rootDir>/src/**/*.spec.ts", "<rootDir>/zod/**/*.spec.ts"],
  // Secondary entry points import "@modyra/angular/*" — resolve to sources
  // (mirrors the tsconfig paths the CLI builder used to apply).
  moduleNameMapper: {
    "^@modyra/angular$": "<rootDir>/src/public-api.ts",
    "^@modyra/angular/(adapter|ui|zod|interop)$":
      "<rootDir>/$1/src/public-api.ts",
  },
  // The built dist/ carries its own package.json — keep it out of the
  // Haste module map or "@modyra/angular" resolves ambiguously.
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  // Benchmarks run on demand only: npm run test:perf
  testPathIgnorePatterns: ["/benchmarks\\.spec\\.ts$"],
};

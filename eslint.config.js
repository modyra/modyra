// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    // Build artifacts, bundled output and generated/copied assets are not
    // lint targets. bundle-test is a tree-shaking probe app, not product
    // code; packages/styles previews are static HTML, not templates.
    ignores: [
      "**/dist/**",
      "dist/**",
      ".angular/**",
      "**/.styles/**",
      "**/bundle-test/**",
      "packages/styles/src/*.html",
      "**/stackblitz/**",
      "benchmarks/*.html",
      // The battle host page, bundled from published output by battle:browser.
      "battle-tests/.tmp-browser/**",
      // Astro's own content cache and the Studio bundle it copies in. Both are
      // written by a build and both are gitignored, so a finding in them is a
      // report about output nobody edits — and one that cannot be repaired at
      // the source, because the source is a generator.
      "site/.astro/**",
      "site/public/studio-app/**",
    ],
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // The codebase deliberately uses ReadonlyArray<T> for readonly public
      // API surfaces (see CONTRACTS.md); don't fight the convention.
      "@typescript-eslint/array-type": "off",
      // Interface implementations/overrides often can't drop a parameter:
      // the leading-underscore convention marks them as intentionally unused.
      //
      // All four forms it takes here, because for a while it covered two. A name
      // is marked unused the same way whether it is an argument, a caught error,
      // a binding or an inferred type parameter — `infer _K` where only the other
      // half of the pair is wanted — and a rule that honoured the convention for
      // arguments alone reported the others as defects while the sentence above
      // said they were deliberate.
      //
      // `ignoreRestSiblings` is the same intention in the shape the codebase
      // actually writes it: `const { role: _role, ...withoutRole } = projected`
      // omits a key by naming it, and the name it gives is the point.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
    },
  },
  {
    files: ["**/*.spec.ts"],
    rules: {
      // Compile-time type tests reference properties purely so that
      // @ts-expect-error can assert they don't typecheck.
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // Loose equality is deliberate in option comparisons: native <option>
      // values are always strings while model values may be numbers.
      "@angular-eslint/template/eqeqeq": "off",
      // The select/multiselect follow the combobox pattern: options are
      // intentionally non-focusable and keyboard interaction lives on the
      // trigger/input (see the widget keyboard contract). Backdrop click-to-
      // dismiss is likewise keyboard-covered by Escape. Kept as warnings so
      // genuinely new interactive elements still surface.
      "@angular-eslint/template/click-events-have-key-events": "warn",
      "@angular-eslint/template/interactive-supports-focus": "warn",
    },
  }
]);

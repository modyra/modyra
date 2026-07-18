// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    // Build artifacts and bundled output are not lint targets.
    ignores: ["**/dist/**", "dist/**", ".angular/**"],
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

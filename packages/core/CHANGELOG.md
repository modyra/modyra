# @modyra/core

## 0.3.0

### Minor Changes

- c7dadfb: Whole-entry slimming (roadmap phase J). The root entry `@modyra/core` now re-exports only the form engine (typed forms, validation, security, dynamic config, reactivity): **10.7 KB min+gzip** measured, down from 17.2 KB (−38%). Satellite utilities are no longer re-exported from the root — they remain in the package via their curated subpath entries: `@modyra/core/datetime`, `/localization`, `/ui` (icons, keyboard, options-utils, overlay-position), `/serialize`, `/devtools`, `/i18n`, `/dynamic-config`. **Migration:** change e.g. `import { formatDate } from "@modyra/core"` to `import { formatDate } from "@modyra/core/datetime"`. The framework adapters (`@modyra/react`, `/vue`, `/lit`) re-export the core surface via `export *`, so the same migration applies to satellite names previously reached through them (e.g. `mountMdyDevtools` now comes from `@modyra/core/devtools`). Also new: compile-time `__MDY_DEV__=false` define strips dev warnings in production builds (esbuild/rollup/vite), and a CI guard (`test:core-bundle`) now budgets the whole entry (11 KB) and the realistic surface (10 KB) so the comparison-doc numbers can't silently regress.
- 7554cc8: Injection prevention at the engine's write choke point. New `security` form option: sanitization profiles (`"text"` strips control/bidi/zero-width characters, `"strict"` also strips markup characters), per-field overrides and custom sanitizer functions via `field(..., { sanitize })`, `maxValueLength` string caps, and an `onViolation` telemetry hook. Always-on structural checks: restored draft entries are shape-validated against the declared field type, and submit-returned errors with prototype-polluting paths are dropped. Sanitization is opt-in in 0.x (`"off"` by default) and covers every write path — user input, `patch`/`setValue`, draft restore, array operations. See `docs/guides/security.md`.
- fc22197: Option whitelisting (client-side anti-tampering). New `oneOf`/`eachOneOf` validators: a select offering "one"/"two" now rejects a scripted `set("three")`. Option-based dynamic fields get the whitelist automatically — `buildDynamicFieldValidators()` constrains `select`/`radio`/`segmented` values and every `multiselect` element to the declared `options`, and `<mdy-dynamic-form>` uses it, so CMS/LLM-generated configs are tamper-resistant with zero extra code. `docs/guides/security.md` gains a trust-model section: client checks are defense-in-depth, and the same schema can gate the API server-side (isomorphic pattern with `@modyra/zod`).

## 0.2.0

### Minor Changes

- fd1e9d8: Add typed field arrays via `array()` — repeatable rows with
  `push`/`insert`/`remove`/`move`/`setAll`, wired through
  `@modyra/angular/adapter` and `@modyra/zod` (`z.array()`).

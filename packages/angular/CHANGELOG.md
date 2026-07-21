# @modyra/angular

## 0.3.0

### Minor Changes

- 7554cc8: Injection prevention at the engine's write choke point. New `security` form option: sanitization profiles (`"text"` strips control/bidi/zero-width characters, `"strict"` also strips markup characters), per-field overrides and custom sanitizer functions via `field(..., { sanitize })`, `maxValueLength` string caps, and an `onViolation` telemetry hook. Always-on structural checks: restored draft entries are shape-validated against the declared field type, and submit-returned errors with prototype-polluting paths are dropped. Sanitization is opt-in in 0.x (`"off"` by default) and covers every write path — user input, `patch`/`setValue`, draft restore, array operations. See `docs/guides/security.md`.
- fc22197: Option whitelisting (client-side anti-tampering). New `oneOf`/`eachOneOf` validators: a select offering "one"/"two" now rejects a scripted `set("three")`. Option-based dynamic fields get the whitelist automatically — `buildDynamicFieldValidators()` constrains `select`/`radio`/`segmented` values and every `multiselect` element to the declared `options`, and `<mdy-dynamic-form>` uses it, so CMS/LLM-generated configs are tamper-resistant with zero extra code. `docs/guides/security.md` gains a trust-model section: client checks are defense-in-depth, and the same schema can gate the API server-side (isomorphic pattern with `@modyra/zod`).

### Patch Changes

- f0c8697: Fix invalid `aria-expanded` on datepicker, daterange and timepicker text inputs (axe `aria-allowed-attr`, critical): the expanded state now lives on the toggle button that controls the overlay, matching the APG date-picker-dialog pattern. Adds axe-core accessibility tests over the main renderers and a Playwright browser smoke test over the packaged demo.
- Updated dependencies [c7dadfb]
- Updated dependencies [7554cc8]
- Updated dependencies [fc22197]
  - @modyra/core@0.3.0
  - @modyra/widgets@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [fd1e9d8]
  - @modyra/core@0.2.0
  - @modyra/widgets@0.2.0

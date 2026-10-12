---
"@modyra/core": patch
---

The Java reader answers document versions the way the TypeScript reader does

`sdk/java/modyra-contract` now reads a document's version with the TypeScript reader's codes and
messages:

- a declared `version` this contract does not have (1, 6, `2.5`, `"2"`, `null`) is refused with one
  `MDY_DYNAMIC_UNSUPPORTED_VERSION` diagnostic at `/version`, `version` null and nothing read. This
  applies to either envelope, and to an object with neither `fields` nor `schema`. Version 1 used to
  be read as a flat field list, and a version the reader did not know was refused with no
  diagnostic;
- a flat `{ "version": 5, "fields": [...] }` envelope is read. It used to be refused;
- `validators.integer` in a document older than version 5, a bare array included, is refused with
  `MDY_DYNAMIC_UNSUPPORTED_VERSION` at `/fields/<name>/validators/integer`;
- a whole number written with a fraction (`2.0`) counts as that number for the version, a row's
  track counts and a slot's column, as it does in TypeScript.

The shared-corpus documents `v2/g-integer-before-v5.json`, `v2/i-version-one-envelope.json` and
`v5/m-flat-v5-envelope.json` now get the same verdict from the Java reader as from the TypeScript one,
so they leave the Java disagreement ledger.

**Migration for Java consumers.** A version 1 document is refused: set `"version": 2`, which reads
the same fields. A document of version 2 to 4 that declares `integer` keeps its field in lenient mode
with a diagnostic, and is refused in strict mode: set `"version": 5`. The `@modyra/core` header
carries the note into a release; the npm package itself does not change.

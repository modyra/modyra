---
"@modyra/core": patch
---

The Java reader refuses a field member of the wrong JSON type, as TS does

`sdk/java/modyra-contract` now judges a field's members as written, before anything is converted,
and drops the field with `MDY_DYNAMIC_INVALID_FIELD` and the TypeScript reader's sentence when:

- `label` or `placeholder` is not a string, or `sensitive` is not a boolean;
- `validators` is not an object; `validators.required`, `email` or `integer` is not a boolean;
  `validators.min`, `max`, `minLength` or `maxLength` is not a number;
- `validators.minLength` is greater than `validators.maxLength`.

Codes, paths and sentences are the TypeScript reader's. An explicit `null` counts as a value of the wrong type, not as an absent member.

**Migration for Java consumers.** Such a document used to come back `ok`, with `null` read as no
rule, `"3"` read as `3` and `"true"` read as `true`. It now comes back not `ok` and names the field
and member, which is what the TypeScript reader already answered. Write the member with its JSON
type, or leave it out. The `@modyra/core` header carries the note into a release; the npm package
itself does not change.

---
"@modyra/core": patch
---

The Java and Rust readers refuse a field member of the wrong JSON type, as TS does

`sdk/java/modyra-contract` and `sdk/rust/modyra-contract` now judge a field's members as written,
before anything is converted, and refuse the field with `MDY_DYNAMIC_INVALID_FIELD` when:

- `label` or `placeholder` is not a string, or `sensitive` is not a boolean;
- `validators` is not an object; `validators.required`, `email` or `integer` is not a boolean;
  `validators.min`, `max`, `minLength` or `maxLength` is not a number (in Java, not a finite
  number: `1e400` is refused as the TypeScript reader refuses it);
- `validators.minLength` is greater than `validators.maxLength`.

An explicit `null` counts as a value of the wrong type, not as an absent member. Java reports at the
TypeScript reader's paths with its full message; Rust reports at the field as written (`/fields/N`
or `/schema/…/field`) with the rule alone, such as `label must be a string.`, in the style of its
other messages. A field already refused for its name or its kind carries that diagnostic alone, in
both, as it does in TypeScript.

**Migration for Java consumers.** Such a document used to come back `ok`, with `null` read as no
rule, `"3"` read as `3` and `"true"` read as `true`. It now comes back not `ok`.

**Migration for Rust consumers.** `parse_v2` used to return `Err` for most of these documents (a
deserialization error naming a Rust type) and a valid result for the rest (`null` rules, `sensitive`
of any type, `minLength` above `maxLength`). It now returns `Ok` with the diagnostic. A field's own
`min`, `max` or `step` of the wrong type, outside `validators`, still returns `Err`.

In both, the answer is now the one the TypeScript reader already gave: write the member with its
JSON type, or leave it out. The `@modyra/core` header carries the note into a release; the npm
package itself does not change.

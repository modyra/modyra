---
"@modyra/core": patch
---

The Java reader grades and counts a refused field as the TypeScript reader does

`sdk/java/modyra-contract` now reports every refusal of a flat field with the TypeScript reader's
code, severity, path and sentence, and answers `ok`, `fields`, `acceptedCount` and `rejectedCount`
as it does:

- a dropped field is an **error**, in either mode. It used to be a `warning`, so a lenient parse that
  lost a field answered `ok: true`; it now answers `ok: false` and still carries the fields it read;
- **strict mode withholds the document on an error**, and only on an error. It used to withhold it
  on any diagnostic. The Java reader emits no warning today, so nothing observable changes until it
  does;
- the codes are the TypeScript reader's: `MDY_DYNAMIC_MISSING_NAME` and the non-object entry are
  `MDY_DYNAMIC_INVALID_FIELD`; `MDY_DYNAMIC_RESERVED_NAME` is `MDY_DYNAMIC_UNSAFE_NAME`;
  `MDY_DYNAMIC_MISSING_OPTIONS` is `MDY_DYNAMIC_OPTIONS_REQUIRED`; `MDY_DYNAMIC_UNKNOWN_PROPERTY` is
  `MDY_DYNAMIC_UNKNOWN_MEMBER`, one error per field (and one per validators block and per option)
  listing every member, instead of one warning per member. A kind nobody has is
  `MDY_DYNAMIC_UNKNOWN_KIND` with the kind spelled as JavaScript's `String()` spells it; a field the
  mapper cannot build for another reason is `MDY_DYNAMIC_INVALID_FIELD`;
- the sentences are the TypeScript reader's, quoting the entry as `JSON.stringify` writes it
  (`Dropped non-object dynamic field: null`, `Dropped dynamic field without a name: {"kind":"text"}`);
- `validators.messages` is read: a message that names no rule, or that is not a string, or that
  ECMAScript `trim` leaves empty, drops the field with `MDY_DYNAMIC_INVALID_FIELD` at `/fields`. The
  mapper alone kept all three;
- an options kind needs a **valid** options array — every entry an object with a `value` that is
  neither `null` nor a list, a textual `label`, and a boolean `disabled` when written — and an
  **empty array is valid**, as it is to the TypeScript reader. `options: []` used to be refused, and
  an entry without a label used to be read with a null label.

**Migration for Java consumers.** Code matching on `MDY_DYNAMIC_MISSING_NAME`,
`MDY_DYNAMIC_RESERVED_NAME`, `MDY_DYNAMIC_MISSING_OPTIONS` or `MDY_DYNAMIC_UNKNOWN_PROPERTY` must
match on the codes above; code reading `severity` to tell a dropped field from a refused document
should read `path` instead, because a dropped field is now an error too. A lenient caller that read
`ok` as "something was parsed" should read `fields.isEmpty()` for that and `ok` for "nothing was
lost", which is what the TypeScript reader has always meant by it. A caller publishing `options: []`
as a refusal must refuse it itself. The `@modyra/core` header carries the note into a release; the
npm package itself does not change.

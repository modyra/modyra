---
"@modyra/core": patch
---

The Java reader says why it read no fields, with the TypeScript reader's codes

`sdk/java/modyra-contract` now answers a document it cannot read a field list from the way the
TypeScript reader does:

- an envelope with `fields` and no `version` is refused with `MDY_DYNAMIC_UNSUPPORTED_VERSION` at
  `/fields`, every listed entry counted as rejected, plus one `MDY_DYNAMIC_UNSUPPORTED_VERSION` at
  `/layout`, `/rules` or `/validations` for each of those it carries. It used to be refused with no
  diagnostic at all;
- a document with no field list (a scalar, `null`, `{}`, a `schema` without a `version`, or a
  supported `version` whose `fields` is missing or not an array) is refused with
  `MDY_DYNAMIC_INVALID_FIELD` at `/fields`. It used to get `MDY_DYNAMIC_INVALID_INPUT` at `/` or
  `MDY_DYNAMIC_INVALID_FIELDS` at `/fields`, two codes no other reader of this contract emits. A
  supported version is now reported as the result's `version`, and its `layout` and `rules` are
  still read;
- `ok` is false whenever an error diagnostic is reported, in lenient mode too. A lenient result
  still carries the fields it could read.

**Migration for Java consumers.** Code that matches `MDY_DYNAMIC_INVALID_INPUT` or
`MDY_DYNAMIC_INVALID_FIELDS` matches `MDY_DYNAMIC_INVALID_FIELD` instead. Code that treated a lenient
`ok: true` as "usable despite errors" reads the fields and the diagnostics instead: `ok` now means
that nothing graded an error was lost. The `@modyra/core` header carries the note into a release; the
npm package itself does not change.

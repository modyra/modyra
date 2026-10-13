---
"@modyra/core": patch
---

A finding's path points at the member it names

`parseDynamicForm` reports each finding at a `path` that is now a JSON Pointer resolving in the
document as written, in the TypeScript reader, `sdk/java/modyra-contract` and
`sdk/rust/modyra-contract` alike:

- A child key containing `/` or `~` is escaped as RFC 6901 escapes it: key `a/b` is reported at
  `…/children/a~1b`, not `…/children/a/b`; key `x~y` at `…/children/x~0y`.
- `MDY_DYNAMIC_UNSUPPORTED_VERSION` for `integer` in an older document points at the field's entry,
  `/fields/<index>/validators/integer`, or in a `schema` tree at the leaf,
  `/schema/children/…/field/validators/integer`, reported once per collection template. It used to
  say `/fields/<name>/validators/integer`, which addresses nothing.

**Migration.** A host matching paths as strings for keys with `/` or `~`, or for the `integer`
version finding, matches the new spelling. Codes, messages and verdicts are unchanged.

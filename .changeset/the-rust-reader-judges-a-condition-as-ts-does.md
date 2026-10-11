---
"@modyra/core": patch
---

The Rust reader judges conditions, versions and layout by the same rules as the TypeScript one

`modyra-contract` now refuses what `@modyra/core` refuses, with the same code:

- a condition nested deeper than 32 levels, one with no operands, an operand naming two things or
  naming one with the wrong type, a list or an undeclared object as an operand, a `matches` pattern
  that is not a literal string of at most 256 characters, and a `{path}` the enclosing group does not
  declare (`INVALID_CONDITION`, `UNKNOWN_FIELD_REFERENCE`);
- `validators.integer` below version 5, and a v3 slot or section placement below version 3
  (`UNSUPPORTED_VERSION`);
- a layout deeper than 32 levels (`INVALID_LAYOUT`, where it said `UNKNOWN_FIELD_REFERENCE` at 6);
- a rule whose `value` its operator cannot read: membership against a non-list, ordering against a
  non-scalar, or a date kind ordered against text that is not a full ISO date (`INVALID_RULE`);
- a `validations` entry with no message, an unknown target, an invalid condition or a condition
  reading an unknown field (`INVALID_VALIDATION`, `UNKNOWN_FIELD_REFERENCE`).

It accepts `daterange`, `file` and `colors`, and counts a pattern's length in UTF-16 units, so a
200-character pattern of accented letters is no longer refused as too long.

**Migration (Rust).** `DynamicFormV2` gains a public `validations: Vec<Validation>` member, so a
struct literal must add `validations: vec![]`. The crate is not published; the two literals in this
repository are updated.

The shared corpus gains fifteen documents, one per rule, judged by the TypeScript, Rust and eslint
readers alike.

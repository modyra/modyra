---
"@modyra/core": patch
---

v5 reaches a tree document, and the Java mirror catches up

Two defects the v5 fixture found, both in v5's own first draft:

**A v5 document in the tree form was refused.** Adding a version means widening a list, and the
lists are in more places than the one being edited. Four were widened and two were not, so a
document identical to a working v4 one but for its number fell through to the flat-form reader and
came back "neither a field array nor a config envelope". The per-slot layout vocabulary had the same
gap.

**The Java mirror was two members behind and did not know v5.** `MdyDynamicValidators` there now
carries `integer` and `messages` — the second was already missing before this release — and
`MdyDynamicValidatorMessages` is new. The parser accepts v5.

`spec/fixtures/dynamic-form/v5/whole-number-rule.json` is read by three readers: the schema audit,
the TypeScript parser, and the Java test. A version list left unswept in any of them now fails
somebody's suite.

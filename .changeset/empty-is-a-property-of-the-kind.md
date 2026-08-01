---
"@modyra/core": minor
"@modyra/plain": minor
"@modyra/angular": minor
---

What a field holds when it holds nothing is now the contract's answer, not a renderer's.
`mdyEmptyValueFor` moves the per-kind table into `@modyra/core`, where `required` already lives —
two adapters answering the question separately is how one form validates differently in each.

Two defects were sitting in the old table, both measured:

- **A required number field could never fail.** It defaulted to `0`, and zero is a number the user
  may well mean, so `required` accepted a field nobody had filled in. It is now `null`.
- **A slider started outside its own range.** It defaulted to `0` whatever its `min`, so a slider
  bounded 10–20 sat at 0 until the first drag. It now starts at its minimum.

The slider is the one kind whose empty value is a real one, and deliberately so: a thumb is always
somewhere, so an untouched slider reads as filled. Every other kind is now rejected by `required` at
its empty value, and a test asserts exactly that across the whole kind list — which is the check that
would have caught the `0`.

`<mdy-dynamic-form>` used the same function instead of spelling the defaults per kind in its
template — a third table, which defaulted only checkbox, toggle and multiselect and left a number
field `undefined`.

**Breaking for `@modyra/plain`**: a `number` field with no `initialValue` starts `null` rather than
`0`, and a `slider` starts at `min`. Set `initialValue` to keep the old behaviour. The same applies to `<mdy-dynamic-form>`, where a
number field previously started `undefined` and a slider ignored its `min`.

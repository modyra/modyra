---
"@modyra/core": patch
---

Both SDKs read Contract v3

Studio emits `version: 3` the moment a layout places a slot per breakpoint. Neither SDK could read
the result:

- **Rust** refused it on the version alone — `expected contract version 2`, before a field was
  read — and its untagged `LayoutChild` could not deserialize a `{ref, at}` slot at all, so even an
  accepted version would have failed the whole document.
- **Java** fell through every branch of `parse`'s envelope check and returned a failed result, and
  `validLayoutNode` rejected a slot object as an invalid shape.

A form authored responsively therefore exported to something neither server could parse.

Both now accept v3 as what it is: v2 plus per-slot placement, with every other envelope member read
exactly the same way. Both refuse placement where no column can honour it — outside a `columns` row,
or naming a track the row does not have — matching the TypeScript parser rule for rule, and both
still refuse a version they have never heard of.

Rust also gains two things it was quietly dropping: `at` on a `columns` row (v2's own track counts,
absent from the struct, so a responsively-authored row round-tripped back to one arrangement) and
`at` on a section.

The guarantee is a shared fixture, `spec/fixtures/dynamic-form/v3/placement.json`, parsed by all
three implementations in their own suites — the same arrangement this repo already uses for v2, and
what stops the three drifting apart again.

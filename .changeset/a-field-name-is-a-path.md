---
"@modyra/core": patch
"@modyra/plain": patch
"@modyra/react": patch
"@modyra/angular": patch
---

A field name is a path in a schema, so a flattened document mounts into a readable form.

The dynamic contract carries a nested form as a flat list of fields named by path: a group becomes
`shipping.city`, a keyed collection becomes `lines.12.name`. A schema built from those names keyed
them literally, which described a form one level deep against a value two levels deep — so the form
rendered, accepted typing, and threw `Flat value does not match schema shape` at the first
`getValue()` or submit. Every nested document mounted with `@modyra/plain` or React's dynamic form
was unreadable; Angular was unaffected, its dynamic component registering declarative controls where
a name has always been a path.

A schema key that spells a path now declares the structure it describes — at the root, inside a
group, and inside a collection's item — and two declarations of the same group are one group in
either order. A name that would be both a field and a group is refused by name instead of resolved
in silence. Only groups are reconstructed: a path cannot say whether `lines.0` was an array row or
the record key `"0"`, so a form that must round-trip a list declares `array()` or `record()` itself.

`assertSafeDynamicFieldNames` is now exported from `@modyra/core`: the rules a name must satisfy —
no empty segment, no prototype key, no id delimiter, no name twice — are checked where a field list
is turned into a form, in one place rather than per adapter. `@modyra/react`'s dynamic form also
stops carrying its own table of empty values and reads the contract's, which is what made a number
field there start at `0`: a value `required` could never fail, where every other adapter started it
at `null`.

See ADR 0031.

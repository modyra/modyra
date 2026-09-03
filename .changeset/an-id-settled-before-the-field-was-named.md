---
"@modyra/angular": major
---

Take the caption's id from the contract, not from whichever author got there first

Two components spelled the caption's id in a field initializer, which runs before the host settles
`fieldId` — so the id was the one the component had before it was given a name: `mdy-control-8__label`
where the contract says `<field>__label`. Nothing looked wrong, because the caption and the reference
to it read the same stale value and agreed with each other. Two authors agreeing is still not the
contract.

The searchable select had the other half of the same shape: with no `widgetId` given, the caption's
id fell back to whichever control it points `for` at, producing `<field>__trigger__label` for a
reference the projection calls `<field>__label`.

Both now read the contract's id, computed where it is used rather than captured at construction.

**Migration.** `labelId` on `MdyRadioGroupComponent` and `MdySegmentedButtonComponent` is now a
`Signal<string>` rather than a `string`. Both are `protected`, so this reaches only a subclass, and
the change there is one pair of parentheses.

`contract:diff` classifies this `patch` — the widget contract's parts, relations, keyboard and shared
classes are untouched, and it is right about that. `test:type-surface` classifies it `major` on those
two lines, and that is the verdict this release takes: a subclass reading the old shape stops
compiling, and a release that called that `patch` would be lying to the one consumer who feels it.

`renderers/a-name-that-points-at-nothing.spec.ts` now requires every drawn caption to carry an id the
contract chose, and refuses both shapes this fixes. Putting either back turns it red by name.

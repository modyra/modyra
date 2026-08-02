---
"@modyra/widgets": minor
---

Either arrow opens a closed combobox.

`ArrowDown` on a collapsed overlay opened it; `ArrowUp` was declared by neither the keyboard table
nor the policy, so it did nothing on all six overlay kinds. The authoring practices specify both.

Unlike the `Tab` and `Space` gaps before it, **the two paths already agreed** — `widgetKeyIntent`
and `selectKeyboardAction` were both silent — so no user was getting different behaviour from
different renderers. This was a gap in the specification rather than a disagreement inside it, which
is why it waited: the open question was whether opening upwards should also move to the last option,
as the authoring practices have it.

It should, and it already does, one layer down. `listboxNavigationIndex` answers `ArrowUp` from
nothing-active with the **last** option and `ArrowDown` with the **first**. So opening with nothing
active and letting the next arrow resolve gives exactly the specified behaviour, and declaring a
move on the opening press would restate that where it can drift from it.

Both paths changed together and both are asserted, because the `Tab` defect was one path fixed and
not the other, twice.

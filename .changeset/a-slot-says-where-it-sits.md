---
"@modyra/core": minor
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/angular": minor
"@modyra/styles": minor
---

Contract v3: a slot says where it sits and whether it shows

v2 made a row's track count authorable per size. What it could not express is anything about one
child of that row: a field that moves to another column on a wide screen, or that is not shown on a
phone. Those are properties of the slot, not of the row, and there was nowhere to put them.

**Contract v3** adds one thing — a slot that says more than its name:

```json
{ "ref": "coupon", "at": { "base": { "hidden": true }, "md": { "column": 2, "hidden": false } } }
```

A bare string still means "this field, wherever the row puts it", and the two spellings mix freely
inside one row. `column` is 1-based and refused when it names a track the row does not have;
`hidden` is a boolean; a size that says neither is refused as the typo it usually is.

**The row's track count stays where v2 put it.** `at` on the columns node keeps meaning what it
means, rather than being respelled as `{ columns: n }`. One property, one spelling — a second way to
say the same thing would leave every reader deciding which wins, and would force a v2 row to be
rewritten to say what it already says. Everything else in a v3 document — `fields`, `schema`,
`layout`, `rules` — is v2's, unchanged, so **a v2 document is a v3 document with the version raised**,
and v2 keeps parsing exactly as before. A v3 slot inside a v2 document is refused: accepting it would
make this parser disagree with every other reader of the same bytes.

The placement lands on the **column**, not on a wrapper inside it, because the column is the grid
item — `grid-column` and `display` are properties of one, and nothing nested inside a cell can move
itself into a different track however it is styled. A column holding several slots takes the first
placement it is given, which is exactly how every row Studio authors is built.

`layoutSlotStyle` in `@modyra/widgets` turns `at` into custom properties, and the foundation reads
them through the same mobile-first cascade the track count already uses: what a size does not say, it
inherits from the next smaller one. Visibility is a `display` value rather than a class for that
reason — a class cannot be undone at a larger size without a second class saying the opposite, and
"hidden on a phone, shown from tablet" is the case worth having.

Both config-driven renderers honour it: `@modyra/plain` and `<mdy-dynamic-form>`.

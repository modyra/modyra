---
"@modyra/styles": minor
---

`--mdy-comp-field-*`: a field's tokens stop being Material's.

The foundation described what a field looks like in Material's vocabulary — `container-height`,
`active-indicator-color` and thirteen more, all spelled `--mdy-comp-filled-text-field-*`. *Filled* is
one of Material's two field variants, so a theme that is not Material still had to say "filled text
field" to change a border radius. `@modyra/styles/foundation.css` is a published entry point, which
made that vocabulary part of the contract a consumer theme reads.

Fifteen neutral tokens now carry the same values, and the foundation reads those instead. The Modern
theme, which had to override three Material-named tokens to restyle its fields, now names none.

**The old names keep working and are deprecated.** Each neutral token reads its Material predecessor
first and falls back to the same value:

```css
--mdy-comp-field-container-height: var(--mdy-comp-filled-text-field-container-height, 56px);
```

so a theme that still sets the old name is picked up, and a theme that sets the new one overrides the
declaration outright. Neither spelling is lost while both exist. The aliases are removed no earlier
than the next minor, and not in this change.

Nothing renders differently: every declared value is unchanged, and the only difference in what the
foundation reads is those eight names. `--mdy-comp-filled-text-field-*` is still declared, so a
consumer setting it sees the same result as before.

This closes the last place the foundation encoded a *variant* of one design system. Other component
families still carry Material's component names — `--mdy-comp-switch-*`, `--mdy-comp-filter-chip-*`
and others — but those name a widget rather than a Material variant of one, which is a different
question and a different batch.

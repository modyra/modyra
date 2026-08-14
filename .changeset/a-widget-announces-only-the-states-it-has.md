---
"@modyra/widgets": minor
---

A widget announces only the states it has

`MDY_WIDGET_STATE_SUPPORT` says a checkbox, a radio group and a range have no read-only rendering —
"either operable or disabled" — and three projections announced it anyway:

```
checkbox   aria-readonly="true" AND native readonly
radio      aria-readonly="true" on the group
daterange  native readonly on both controls
```

The checkbox is the one that cost something. HTML **ignores** `readonly` on a checkbox, so a renderer
binding it bound nothing and the box still toggled, while `aria-readonly="true"` told a screen-reader
user it could not be changed. The halves failed in opposite directions.

`readonly` is gone from those three, in both halves. The kinds whose contract declares it — text,
email, password, textarea, number — keep both, pinned so a later fix cannot sweep them in. A form that
means "this cannot be changed" on a checkbox says `disabled`.

**`aria-checked` now holds one of the three values the standard allows.** It was
`String(state.checked)`, so a state carrying `undefined` produced `aria-checked="undefined"` — a value
that maps to nothing in any assistive technology, on the single attribute that says whether the box is
ticked. `mixed` is deliberately not produced: `checked` is a boolean and no field in the engine has an
indeterminate value.

A theme selecting on `[aria-readonly]` for a checkbox, radio group or range will stop matching. The
widget contract itself is unchanged — 17 kinds, version 1.

Found by `battle-tests/adversarial/accessibility/undeclared-states.battle.test.mjs`. Recorded as
[ADR 0052](https://github.com/modyra/modyra/blob/main/docs/architecture/0052-a-widget-announces-only-the-states-it-has.md).

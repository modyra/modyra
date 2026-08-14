---
"@modyra/widgets": patch
---

A disabled widget can still be left, and is not left holding an overlay

`createCatalogWidgetController` guarded every intent behind `if (value.disabled) return []`. That is
right for intents that *start* something and wrong for `close`, which ends something already
happening:

```js
dispatch({ type: "open" });                      // open: true
dispatch({ type: "disable", disabled: true });   // open: true, disabled: true, no commands
dispatch({ type: "close" });                     // no commands — still open
```

Every route out of an overlay goes through `close` — Escape, a click away, choosing an option — so a
field disabled while its picker was open became a popup over a control that no longer responded,
unleavable until something re-enabled the field. Ordinary rather than contrived: a form disables a
field because a dependent value changed, and the user has the picker open at that moment because
that is what they were doing when it changed.

Two things change, which are one rule — a disabled widget is not operable and does not hold an
overlay:

- `close` passes the guard, whatever left the widget open;
- `disable` closes what is open, emitting `close-overlay`. Disabling a *closed* widget stays silent,
  so no renderer gets a command on every disable.

**A destroyed controller answers without acting**, the rule the form engine already holds: `destroy()`
was an explicit no-op, so a torn-down widget still handed its renderer `close-overlay` for elements
that were gone. State stays readable, like a destroyed form's value.

Found by `battle-tests/adversarial/lifecycle/catalog-controller.battle.test.mjs`.

---
"@modyra/widgets": patch
---

A widget that has handed focus back does not take it again

`createFocusCustodian` restores focus to what the widget borrowed it from. A widget that closes and
is then disposed calls `restore()` twice, and the second call found nothing remembered and fell
through to the first focusable inside the widget:

```js
custodian.remember();       // the trigger holds focus
inside.focus();             // the widget takes it
custodian.restore();        // → trigger, correctly
custodian.restore();        // → inside — focus pulled back into the closing widget
```

The custodian now tracks whether it is holding focus it borrowed, which is a different question from
whether it holds a remembered element: a widget that opened while nothing was focused has still
borrowed focus, and one that has already given it back owes nothing. A `restore(preferred)` naming an
element is always honoured — that is the caller placing focus, not asking for what was borrowed.

`release()` is unchanged: it forgets the recorded owner, and a restore after it still falls back
inside the widget, which `packages/widgets/test/focus.spec.mjs` states.

Found by `battle-tests/adversarial/lifecycle/focus-custodian.battle.test.mjs`.

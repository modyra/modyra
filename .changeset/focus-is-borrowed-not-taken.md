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

`release()` now ends the borrow rather than only forgetting the remembered element: a restore after
it places no focus and returns `null`. The workspace's one caller releases at destroy, which is what
the method is for. A consumer that released and relied on the next restore to place focus inside the
widget names the target instead — `restore(preferred)` is honoured whether anything is borrowed or
not.

While the borrow is live and the remembered owner has left the document, the fallback inside the
widget is unchanged: somewhere real beats nowhere, and that is the case it was written for.

Recorded as [ADR 0049](https://github.com/modyra/modyra/blob/main/docs/architecture/0049-a-released-custodian-owes-no-focus.md).

Found by `battle-tests/adversarial/lifecycle/focus-custodian.battle.test.mjs`.

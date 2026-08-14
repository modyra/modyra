---
"@modyra/widgets": patch
---

The state matrix drives the states a widget does not declare, and finds what they announce

`collectStateMatrix` drove each kind through `MDY_WIDGET_STATE_SUPPORT[kind]`, then made one more
pass — its own comment calls it "about the states a widget is *not* in" — that mounted a fresh
fixture and inspected it with **nothing driven**.

So the check caught a projection that emits a forbidden attribute unconditionally, and could not
catch the shape the defect actually has: `state.readonly ? "true" : null`, absent until a consumer
sets a state the kind does not declare — which is what a consumer does the moment a form has a
read-only mode. Three adapter suites asserted `matrix.unsupportedAria` was empty and all three were
green while a checkbox announced `aria-readonly`.

The pass now drives each kind into every state it does *not* declare, mounting fresh for each one so
an attribute left by an earlier drive cannot answer for the next.

**It found one immediately.** `@modyra/plain` exposed `aria-readonly` and native `readonly` on every
slider: a slider is structurally a numeric field and is drawn by `projectTextFieldA11y`, which
announced read-only because of the file it lives in rather than because of the kind it was drawing.
That projection now asks `widgetSupportsState` — the state belongs to the kind, not to the function.
A kind this contract does not know keeps what it had.

Found by `battle-tests/adversarial/accessibility/state-matrix-blind-spot.battle.test.mjs`.

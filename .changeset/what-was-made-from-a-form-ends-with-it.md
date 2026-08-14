---
"@modyra/core": minor
"@modyra/react": patch
"@modyra/preact": patch
---

A binding made from a form's handle ends when the form does

`createFieldStore` opens an effect over a handle's signals, and a component on `useSyncExternalStore`
subscribes to it. The store exposed its own `destroy` and that worked — but a component's cleanup and
the form's `destroy()` race on unmount, and the consumer does not get to order them. A store still
notifying after the form ended re-renders a component against a form that is gone:

```js
const store = createFieldStore(form.f.rows.cell("a", "code"));
store.subscribe(onChange);
form.destroy();
cell.set("anything");   // onChange fired again
```

`MdyTypedFormBase.onDestroy(teardown)` is the affordance a binding uses to say it belongs to a form:
teardowns run when the form is destroyed, in registration order, each isolated so one that throws
neither stops the others nor the engine. It returns a release function, and registering on a form
that is already destroyed runs the teardown at once — a binding built from a dead form's handle is
dead too.

`@modyra/react` and `@modyra/preact` register their field stores with it. Calling `store.destroy()`
yourself still works and releases the registration, so a store you ended is not held by the form.

Found by `battle-tests/adversarial/lifecycle/adapter-store-after-destroy.battle.test.mjs`. The other
adapters bind through their own framework primitives and were not measured; the same question applies
to any binding that outlives its form.

---
"@modyra/core": minor
---

A rule about a field the schema does not have is refused, not attached

One transposed letter made a working form unsendable:

```js
form.addValidators("emial", [required()]);
form.state.canSubmit();   // false — and submit() never calls its action
```

Nothing renders a control for a path the schema never declared, so the rule can never be satisfied.
The error sat on a path nothing was bound to: a filled-in form, a dead Submit button, and no message
anywhere, `devWarnings: true` included.

`addValidators`, `upsertValidators`, `upsertAsyncValidators` and `setInitialValue` now refuse a path
the form does not describe, naming it. A collection's cells still count as declared before their row
exists, because a control mounting ahead of its row is ordinary.

The check is the typed form's, not the engine's: `MdyFormEngine` has no schema, and a field coming
into being because something asked for it is how a declarative adapter builds a form.

`upsertValidators` on an undeclared path used to attach a rule that could be removed again by key.
That undo is withdrawn deliberately — the dead Submit is the same through either door, and an escape
hatch only helps someone who already knows what happened.

The three interactivity setters are unchanged: given a *group* path they do nothing rather than
reaching the fields inside it, and refusing an undeclared path without answering that would fix half
a door. Recorded as
[ADR 0064](../docs/architecture/0064-a-typed-form-refuses-a-path-it-does-not-declare.md).

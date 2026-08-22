---
"@modyra/plain": minor
---

A rule about two fields reaches the page

A document's `validations` — the cross-field rules, "start and end must differ" — were parsed, handed
back by `parseDynamicForm`, and dropped on the floor by the renderer. `mountMdyForm` had a slot for
`rules` and none for these, so a form built from a document that declares one behaved as though the
slot were empty: nothing on the page said so, and the pair submitted.

`mountMdyForm` takes `validations` now and builds them through `buildDynamicValidations`, which is the
same function Studio's preview already used. They are the form's own validators, because a rule about
two fields has no field to belong to — and the message reaches the field the rule targets.

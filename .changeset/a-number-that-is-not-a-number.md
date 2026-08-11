---
"@modyra/core": patch
---

A field holding `NaN` is no longer valid, and `valueShape` is public.

`NaN` is the value every comparison lets through: `NaN < 0` is false, `NaN > 9` is false, and it is
neither null nor blank. A number field holding one therefore reported itself **valid** — and
`JSON.stringify` writes `NaN` as `null`, so a form that declared `required()` said it was fine and
sent nothing at all. That is the worst of both answers, and it was reachable from a server response,
a restored draft or a scripted `set()`.

`required()` now refuses it — there is no answer there — and `min()`/`max()` refuse it too, because a
value that cannot be compared is within no bound. A field with no rule keeps whatever it is given:
the model is still not repaired behind anyone's back.

**`valueShape` is now exported.** A data-only document has always had it applied automatically, so a
`number` field refuses a string and a `text` field refuses `42`; a typed schema could not even ask
for it. TypeScript refuses the wrong type at compile time, but a value arriving from a server, a
draft or a cast does not pass through TypeScript — and this is the rule for that.

Also filed, not fixed: **a field the form is not asking about still paints as failing** (finding T in
`docs/contract-gaps.md`). A disabled field keeps its own verdict and every renderer shows it, while
the form reports itself valid — so a conditional section of required fields is a block of red boxes
for something nobody is being asked. `invalid` is a declared state of every kind, asserted by a
139-pair matrix and carried by the committed screenshots, so changing what it means beside `disabled`
is a contract change rather than a patch.

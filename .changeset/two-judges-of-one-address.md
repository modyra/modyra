---
"@modyra/core": minor
---

Two judges of one address

An `email` field is judged twice: by `<input type="email">`, which the kind renders, and by the form.
The two disagreed in both directions.

- `a@b` — the browser accepts it, the library refused it, so a person was told a valid address is
  wrong.
- `ünicode@example.com` — the browser refuses it, the library had no objection, so inside a native
  `<form>` the submission was blocked with nothing on the page to explain why.

**The `email` validator is the platform's rule now**, written out from the HTML standard: deliberately
permissive where the browser is permissive, deliberately ASCII because the browser refuses anything
else. A stricter rule is a rule the control does not enforce, and every difference between them is a
form that says one thing and submits another.

**And the kind carries it.** `kind: "email"` attaches the same rule through `kindValidators`, so a
document that declares the kind and no validators is no longer a field the browser judges alone. A
document that also writes `validators: { email: true }` adds the same rule and the same sentence,
which the engine already says once.

**If you relied on the old rule** — a required dot, non-ASCII accepted — that behaviour is gone; the
control never agreed with it.

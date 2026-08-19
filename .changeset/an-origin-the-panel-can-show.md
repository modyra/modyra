---
"@modyra/core": minor
---

An error says where it came from, and the panel prints that

The devtools panel promises each error is prefixed with its origin — `[validation]`, `[async]`,
`[cross-field]`, `[server]` — and printed the error's `kind` instead, which for a server refusal is
whatever the server chose. The ordinary shape, `{ path, message }`, arrived as **`[unknown]`** in the
one tool built to say where things come from; a refusal that called itself `validation` was printed
exactly like a rule this form had run.

`MdyFieldError.origin` is the form's own knowledge — which list the error arrived in — and the panel
prints it, falling back to `kind` only where nothing set one.

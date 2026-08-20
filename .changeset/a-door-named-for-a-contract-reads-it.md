---
"@modyra/angular": minor
---

`<mdy-dynamic-form [document]>` reads a document, instead of taking one already parsed

The component is named for the dynamic contract and took only its parsed half — `[fields]` and
`[layout]`, already typed — so the untrusted half stayed with the host, and an application rendering
one server document here and on `@modyra/plain` wrote the parse step twice. The cross-field rules
were the part that vanished quietly: a document saying "hide the VAT number unless the customer is a
business" parsed, was accepted in strict mode, and produced a form that showed it always.

`[document]` takes the document as it arrived and reads it here — `parseDynamicForm`, then the
fields, the layout and `applyDynamicRules`. `[parseMode]` chooses how: `strict` (the default) renders
nothing from a document carrying an error rather than the part of it that happened to be well formed,
`lenient` renders what parsed. `(diagnostics)` emits what reading found either way.

`[fields]` is no longer required — one of the two ways in is given. A template that forgot it used to
be a compile error and is now a form with no fields. See ADR 0106.

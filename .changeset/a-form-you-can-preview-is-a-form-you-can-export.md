---
"@modyra/core": minor
---

Cross-field validation is expressible in the Dynamic Form Contract, and a contract's tree can be built into a running form.

Two additions, both filling gaps that forced callers to work around the contract rather than through it.

**`validations`** — a new optional slot on `MdyDynamicFormConfigV2`, carrying `{ when, message, target? }`.
`rules` could only show, hide, enable and disable, and its predicate is flat: one field, one operator,
one value. A rule that *invalidates* has a message and needs a tree, so "shipping is required when the
country is not IT and the total is over 100" had nowhere to go. `when` is an `MdyExpression`, a
portable predicate over the form value with twelve enumerated operators, addressed by path — no
`eval`, no `new Function`, and `matches` takes its pattern only from a literal so a form's own data
cannot choose the regular expression. Malformed expressions are reported by `parseDynamicForm`
alongside calendar options and number bounds, never thrown at runtime. `buildDynamicValidations`
turns them into ordinary `crossField` validators, deriving each one's dependencies from the condition
so the two cannot disagree.

**`buildDynamicFormSchema`** — builds a form from the contract's schema *tree*, keeping its groups and
arrays. `flattenDynamicSchema` answers a different question: it produces one flat list of dotted names
for a renderer drawing a sequence of controls, and in doing so fixes each array at however many rows
its initial value happened to have. That is correct for drawing and wrong for running — a row the user
adds afterwards has no descriptor. Until now the contract could *describe* a nested form that nothing
could *instantiate*, so anything needing a live nested form had to read some other model instead.

Both are additive. A document that declares no `validations` parses exactly as before.

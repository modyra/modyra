---
"@modyra/core": minor
"@modyra/plain": minor
---

A rule a document writes is a rule the form keeps

The Dynamic Form Contract's `rules` array was read by the parser as behaviour — an undeclared effect,
an undeclared operator, a target that is not a field and a condition on a field that is not there are
each refused, and in strict mode the whole document goes with them — and then nothing applied one.
Every reference to a document's rules in the workspace was inside the parser.

The end of it is the payload. Same field, same value, same page, and the only difference is which path
disabled it: through the field handle the form sends `{"customerType":"person"}`; by the document's
rule it sends `{"customerType":"person","taxId":"SSN-123-45-6789"}`. A document saying "disable the tax
id for a private customer" produced a form that sent it.

**`applyDynamicRules(form, rules)`** is the sibling `buildDynamicValidations` already had.
`visible`/`hidden` take the field out of play — not asked for, not validated, not submitted;
`enabled`/`disabled` leave it in the form and stop it being answered. Two rules naming one field
compose rather than replace.

**`mountMdyForm` accepts `rules`** and applies them, so the documented path carries the whole document:
`mountMdyForm(container, result.fields, { layout: result.layout, rules: result.rules })`. A host that
does not pass them gets what it got before.

**`evaluateRuleCondition(when, value)`** is published beside `evaluateExpression`. The rule predicate is
flat and its vocabulary is wider than the expression tree's — `in`, `notIn` and the two "or equal"
comparisons exist only here — and a host rendering its own controls can now ask the question the
binding asks instead of reimplementing ten operators. An operator nobody declared answers `false`;
comparisons are between two numbers or two strings, so an ISO date rule works and nothing is coerced.

The generated-forms guide no longer says that no renderer applies rules.

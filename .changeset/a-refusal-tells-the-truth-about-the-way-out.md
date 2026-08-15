---
"@modyra/core": patch
---

An option value the published schema allows is one the parser takes, and a refusal's advice works

Three things a refusal or a schema said were not true.

**The published schemas allowed three scalar option values; the parser took an object, an array and
`null` as well.** An author whose editor underlined an option got a runtime that accepted it. ADR 0051
makes an object option deliberate — an option is keyed by what it holds — so the schemas now allow
`object` too, and the parser refuses `null` (which cannot be told apart from no choice) and arrays
(which the schemas do not allow). Both readers of a document now agree.

**`buildDynamicFormSchema` told the caller to write `parseDynamicForm(document).schema`.** There is no
`schema` on a parse result: following the instruction produced `undefined`, which produced the same
refusal again. It names the document's own `schema` now — which is what the caller had before parsing.
And the two shapes the refusal exists for, `{}` and `{ node: "group" }`, reached an internal instead
of it: a root group with no children is refused by name too.

**`setValue` said "Pass {} to empty the form deliberately".** `{}` returns every field to its
*initial*, which ADR 0057 decided on purpose and states in its own consequences — so the message and
the record disagreed about the same call, and the message is what a caller reads while deciding. It
now says what `{}` does.

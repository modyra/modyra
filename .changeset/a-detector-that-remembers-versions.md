---
"@modyra/eslint-plugin": patch
---

The rule sees a document at any version, and lets the parser judge it

`modyra/valid-dynamic-form` decided whether an object literal was a form document by comparing its
`version` against a list it held: `1 || 2 || 3`. A document at a version the contract had since
gained was not rejected — it was **unseen**. The rule returned before asking the parser anything, so
a duplicate field name, a select with no options, a kind that does not exist all went unreported.
Silence, from the tool that exists to break silence, arriving exactly when the contract moves.

It was wrong in both directions: blind to versions 4 and 5, and attentive to version 1, which the
parser refuses.

The list is gone rather than extended. A numeric `version` beside `fields` or `schema` is a document;
which versions the contract supports is the parser's answer, and it answers for the ones it does not
support too. Nothing here remembers a version, so nothing here can go stale.

A document at an unknown version is now reported as such instead of skipped.

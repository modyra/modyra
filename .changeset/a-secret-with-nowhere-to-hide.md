---
"@modyra/core": minor
---

A secret is excluded by the name a person writes

The draft guide instructs, in bold, to always `exclude` passwords, card numbers and tokens. `exclude`
matched an exact leaf path and nothing else — and a card number lives in a list, where the row key is
data. Of the four ways a consumer writes that intent, the only one that worked was `["cards.a.pan"]`:
the spelling nobody can write before the user has added the row. `["cards"]`, `["cards.*.pan"]` and
`["pan"]` all left the number in `localStorage` in plain text, and nothing about the form afterwards
looked wrong.

An entry is now matched four ways: the exact path; an **ancestor** (`cards` excludes the subtree); a
**pattern**, where `*` stands for exactly one segment (`cards.*.pan`); and a **bare name** with no dot,
which excludes any cell of that name wherever it sits.

The matching is deliberately generous, and that is the decision: an entry excluded by mistake costs a
convenience, an entry persisted by mistake is a card number that survives a logout. `exclude: ["name"]`
will keep `person.name` out too — write a full path when you need precision.

Both directions as always: the same matcher answers on save and on restore, so a tampered draft
carrying an excluded path still restores nothing.

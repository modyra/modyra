---
"@modyra/lit": minor
---

The element that draws a kind, published

A host rendering a document with this package keeps its own map from kind to element, and a copy needs
a fallback for the kind it does not find. The fallback every copy reaches for is a text field — so
`kind: "passwordd"`, one letter more than a real kind, renders as a visible box holding what the user
types: no error, and a page that looks finished.

`mdyLitTagFor(kind)` answers with the element, or `null` for a kind this package does not draw, which
is what lets a host refuse instead of guessing. A test holds it to every kind the contract publishes,
so a kind added upstream cannot quietly have no element here.

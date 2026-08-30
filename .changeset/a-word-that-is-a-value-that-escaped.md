---
"@modyra/angular": patch
---

A tooltip that said "null"

The checkbox's caption bound `[title]` rather than `[attr.title]`. The property is a DOMString, so
the absent value in the no-error branch — which is every checkbox that is not failing — was coerced
to the word `null` and shown as a tooltip to anyone who rested a pointer on the label.

The attribute binding removes the attribute instead. Property and attribute are not two spellings of
one thing: the property is what the element holds, and only the attribute can be absent.

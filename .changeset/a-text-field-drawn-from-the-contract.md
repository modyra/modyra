---
"@modyra/vue": minor
---

A text field, drawn from what the contract declares

`@modyra/vue` renders its first widget. Until now it was headless — composables over a form handle,
with no reference to the widget contract at all — and this is the first component in the package that
draws one.

Every element answers a question the catalogue already answers: `MDY_WIDGET_CONTRACTS.text` for the
anatomy and the classes, the field controller's view for the ids, the name and the ARIA relations,
and `controlType` for the native input type. Nothing in the component chooses a class or an attribute
on its own — a renderer that decided would be a fourth opinion about a widget three already agree on.

`partProps` is exported beside it: the translation from a contract part to a framework's props, so a
part that gains a member is honoured in one place rather than in each component that spelled the
three fields it happened to need.

Checked against the conformance kit rather than against itself: DOM anatomy and relationships, the
state matrix, renderer equivalence at rest and lifecycle all pass for `text`. Removing the required
`inputWrapper` makes the kit name it — `PART_MISSING required part inputWrapper was not rendered` —
which is the property that matters, since a skeleton that only satisfied its own test would prove
nothing about the contract.

The package's conformance config lists `text` and nothing else. A kind joins that list in the commit
that makes it mountable: a config naming a kind it cannot mount reports a renderer that is broken
rather than one that is unwritten, and those need opposite work.

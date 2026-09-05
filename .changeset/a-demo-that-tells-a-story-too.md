---
"@modyra/vue": patch
---

The Vue demo gains a story beside its catalogue

The page showed one of the two things a demo owes a reader: every kind the catalogue declares, on a
page nobody would ever fill in. What it did not show was a form somebody would actually complete.

`aDelivery` is declared in `examples/shared/scenarios`, where the fields, the words and the rules are
written once and every demo reads them — so the framework-free page and this one show the same
errand, and "the delivery example" means the same thing twice. What stays in the demo is the only
part that is genuinely the framework's: which component draws each kind.

The scenario also carries its rules rather than its decoration: an address and a day are `required`
because a delivery cannot proceed without them, and nothing else is, so the mark keeps meaning
something.

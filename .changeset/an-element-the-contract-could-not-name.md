---
"@modyra/widgets": minor
"@modyra/lit": patch
"@modyra/angular": patch
---

The companion input that carries `false` is an element the contract can name

A boolean field draws a hidden input so an unticked box still reaches a form: without it, a person who
said no and a form that never asked arrive identical at the other end. The submission table has always
declared that element as the `submitFalse` part, and the part had no class — so it was the one element
carrying the field's name that resolved to no part at all. Declared, present on the page, and
reachable from neither direction.

**No user-facing defect, measured before saying so.** Every renderer submits its `false` today, and
did before this change. What was missing was the contract's ability to name the element doing it.

The part now carries `mdy-submit-false`, declared once and shared by both kinds that draw it. The rest
of its declaration was already in place — the part, its parent, its optionality, its place in the
reading order, and a semantic that discriminates.

**Two consequences the class made visible, both repaired here.**

The part was projected from two places: `submitFalsePart`, which owns it, and the boolean field's own
a11y projection, which restated the same attributes with the same paragraph of reasoning beside them.
Two renderers read one and the third read the other, so a change to either reached two of the three.
The restatement now calls the projection that owns the element.

And an element nothing can find is an element whose declared position nothing checks. With a class,
the reading order became enforceable and two renderers disagreed with it: Lit and Angular drew the
companion after the caption where the contract places it between the control and the caption. Both
now match. The constraint each of them recorded — never ahead of the visible control, because the
first input in a field is the most obvious selector anybody writes — is unchanged and still honoured.

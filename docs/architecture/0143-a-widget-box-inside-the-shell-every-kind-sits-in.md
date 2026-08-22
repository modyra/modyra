# ADR 0143: A widget box inside the shell every kind sits in

Status: Accepted

## Context

Every field is drawn inside a shell — the element that carries the border, the state classes and the
field's own padding — and the contract names that part `inputWrapper`. One kind, the multiselect, also
draws a **second** box inside it, holding the chip strip and the opener, and the contract names that
`box`.

The reason `box` exists is recorded, in a comment beside the part's declaration and nowhere else:

> The widget's own layout box, inside the shell every kind sits in. Named rather than folded into
> `inputWrapper`, which means the *shell's* box for every other kind — one name for two different
> elements is how a height comparison came to be off by the border a theme draws on one of them.

That is a real reason with a measurement behind it, and it is the kind of reason that should survive
a rewrite. It has not been written anywhere a rewrite would look.

**The disagreement it leaves is now measurable.** The contract's structure tree declares `chips`,
`trigger`, `overflowCount`, `clearAll` and `announcement` as children of `inputWrapper`. Every
renderer draws them inside `box`. A check comparing the rendered tree against the declared one reports
all five, in all three renderers, and it is right to: the page and the contract describe different
shapes.

`box` is declared for the multiselect alone, and the only child the tree routes through it is
`chipTooltip`. So the part exists, is drawn, holds almost everything the field contains, and the tree
says it holds one tooltip.

## Decision

**`box` is the widget's own layout box, and the parts a widget lays out are declared as its children.**

For the multiselect, `chips`, `trigger`, `overflowCount`, `clearAll` and `announcement` are declared
under `box` rather than under `inputWrapper`, which is what every renderer already draws.

`inputWrapper` keeps its meaning unchanged: the shell every kind sits in, carrying the border and the
field's state. A kind that needs no second box declares none, and its parts stay children of the
shell — which is what the other kinds do today and why they are not affected.

The rule that makes this checkable, and the reason the two must not be merged: **one part name means
one element.** Where a kind draws two boxes it declares two parts, because a name shared by two
elements makes every measurement taken through it ambiguous.

## Consequences

The structure tree gains a level for one kind, and any consumer walking `parent` for a multiselect
sees `box` between the shell and the strip. Consumers with their own templates against these parts
are unaffected in what they draw — the change describes what is already drawn — but a consumer
*generating* markup from the tree will emit the extra element, which is the point.

**The alternative reading is that the renderers are wrong and should flatten**, and this record
forecloses it deliberately. That is worth stating, because it is the cheaper change: deleting `box`
from three renderers is smaller than amending a contract. It is rejected below, and if the measurement
behind the comment ever stops holding, this record is what tells the next reader what they would be
giving up.

What this does **not** settle: the eight other divergences the same check reports in plain —
`number`'s steppers inside an inliner, `slider`'s value inside a slider container, `select`'s arrow
inside the trigger, four `file` parts inside a content box, `colours`' control inside its picker.
Each may be the same shape as this one — a deliberate box the tree does not know about — or may be a
renderer improvising. They are not decided here, and a reader should not take this record as covering
them.

## Alternatives rejected

**Flatten the renderers: draw the strip and the opener directly in the shell.** Cheaper and it needs
no contract change. Rejected on the measurement the comment records: the shell carries a border a
theme may draw, and folding the widget's own layout box into it made a height comparison wrong by
exactly that border. The two elements have different boxes for a reason a theme controls, so one name
for both is ambiguous in a way no renderer can fix.

**Leave the tree as it is and exempt the multiselect from the containment check.** Rejected: an
exemption for the one kind that has the structure makes the check agree with whatever is drawn, which
is the failure the check exists to prevent. A rule with a hole shaped like its counterexample is not a
rule.

**Merge `box` into `inputWrapper` and give the shell a modifier class for kinds that need the second
box.** This keeps one name and expresses the difference as state. Rejected because state is not
structure: a modifier says how an element is drawn, not that a second element exists, and the two
boxes have independent geometry that a measurement has already been caught by.

## Verification

`battle-tests/browser/a-parent-the-contract-named.spec.ts` compares the rendered tree against the
declared one, per element, taking the **nearest ancestor that is itself a declared part** — so an
undeclared layout wrapper a renderer adds is stepped over, and a part placed inside a sibling is not.
It reports the five multiselect parts today and goes quiet on them when this lands.

That check is validated by a planted violation rather than by passing: moving a declared part under a
sibling turns it red. An earlier version asked only whether a part was *somewhere below* its declared
parent, which almost every arrangement satisfies — the planted violation could not fail it, and that
is how the weaker version was caught.

**What is not guarded:** nothing checks that a part name refers to one element rather than two. The
rule this record states is the reason `box` exists, and it is enforced only by the containment check
noticing the consequences.

## Security and privacy

None. This changes which element a part name refers to in a declaration read at build and test time.
No data crosses a boundary, no value is stored or transmitted differently, and nothing about the
rendered page changes — the decision describes markup that already ships.

# ADR 0176: A select is two shapes, and the contract says which

Status: Accepted

## Context

A select renders the platform's own `<select>` unless it filters, and the combobox when it does. The
catalogue said so **in prose** — in a comment explaining why `arrow` and `placeholder` are not in the
kind's required list — and said nothing an instrument could read.

Read as one anatomy, the contract owed every select the combobox's parts and its opener relation, so
a sweep across the three renderers reported six divergences that were not divergences:

```
select   aria-activedescendant · aria-controls · aria-expanded · aria-haspopup · aria-selected
select   the value element, the placeholder, the arrow
```

All of them say the same thing: one renderer draws a combobox and two hand the list to the platform.
Repairing any of them would mean giving a native `<select>` attributes it must not have — a `<select>`
claiming `aria-expanded` is lying about what it is — so they sat unfixable, and `select.value` was
carried as an open row for weeks.

The type that names variants had reserved this exact question: *"A second kind varying on something
else widens this union — and that is the moment to ask whether the two axes belong in one type."*

## Decision

**The two shapes are variants, and the catalogue declares both.**

```
custom   the combobox: a trigger holding the value, a mark that says it opens,
         a placeholder in place of the value, an overlay for the opener to point at
native   the platform's chooser: the trigger is the <select>, the placeholder is an <option>,
         the arrow is the platform's, and nothing carries the combobox relation
```

`custom` requires `arrow` and nothing else. That is not an oversight: a variant's `required` says
*must be there*, which **overrides** a presence condition rather than joining it, so listing `value`
would ask a custom select showing its placeholder for a value element it correctly does not draw.
`value` and `placeholder` keep their own conditions and simply do not exist in the native shape.

`native` describes what the platform makes of the two parts it does have — `trigger` is a `listbox`
element, `placeholder` is an `option` — because **a shape the contract does not describe is one every
check reports as broken**.

**Two axes now share one variant vocabulary**, which is the question the type reserved. They stay in
one type because a variant name is only meaningful for the kind that declares it: asking a select
about `multi` selects no anatomy rather than the wrong one. That property is what makes the shared
vocabulary safe and is the thing to keep if a third axis arrives — the union may grow, and a lookup
must stay a lookup.

**The conformance kit learns that a `<select>` is a combobox** (and a `<select multiple>` a listbox),
so the native shape carries the role its trigger promises without spelling it — the same rule that
already applies to `<input type="number">` and its spinbutton.

## Consequences

A checker must now say which shape it is looking at. That is the cost, and it is the point: measured
against its own variant each renderer is clean, and measured against the other each fails —

```
lit, not searchable   as native  clean      as custom  the placeholder is an <option>
lit, searchable       as custom  clean      as native  the placeholder is not an <option>
```

— which is what a variant is for, and what "one kind, two anatomies" could not say before.

The opener relation belongs to the custom shape. This record states that; the relation table is not
variant-aware, so nothing enforces it yet, and that is the weakest part of this decision.

## Alternatives rejected

**Gate the parts on a capability, as the reorder grip is gated.** Tried first. It needs a capability
word — `searchable` — named in one table and nowhere else, which is a second vocabulary for something
the catalogue already expresses. A capability says *whether the question applies*; this is two
anatomies, which is what a variant means.

**Make the renderers agree.** Two of them would have to draw a combobox where the platform's chooser
is better — its typeahead, its mobile picker — or one would have to abandon the combobox. The
difference is deliberate and the contract's own prose says so.

**Leave it in prose.** It had been, for as long as the comment existed, and it produced six findings
nobody could act on.

## Verification

`npm run test:conformance` runs each renderer against the contract; the variant is the caller's to
state. Measured while writing this: each shape conforms to its own variant and fails against the
other, in both directions, which is the check that the two are actually distinguishable.

`contract:diff` classified the two declarations as minor and they are accepted in the snapshot.

Not verified: that every renderer states the right variant to every checker. The kit takes it as an
option and no gate demands it, so a fixture that omits it is measured against the shared anatomy —
which is what happens today and is why this record does not claim the six findings are closed on the
browser tier until that tier passes the variant.

## Security and privacy

No impact. Anatomy and naming only.

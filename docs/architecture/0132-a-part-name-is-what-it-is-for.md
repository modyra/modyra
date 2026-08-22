# ADR 0132: A part's name says what it is for, its role says what it is

Status: Accepted

## Context

Two kinds offer a list of options behind a trigger and the catalogue calls that list two different
things:

```
select        parts.listbox    element listbox     parts.options  absent
multiselect   parts.options    element group       parts.listbox  absent
```

A consumer reading a part by name across kinds — which is what the catalogue is for — finds it under
one name here and another there, and gets `undefined` for the kind that spells it the other way.
`undefined` is indistinguishable from *this kind has no such part*, which is ADR 0121's shape, and it
is not hypothetical: a battle asked a multiselect for `listbox`, read the `undefined` as *declares no
semantics*, and reported an S1 against correct code.

The semantics differing is right and stays. A select's list **is** a listbox; a multiselect's chips are
a group of toggles, each independently on or off and all on screen at once, which is a pressed toggle
rather than a roving selection. That difference is deliberate and recorded. What is wrong is that one
of the two kinds took its *role* as its *part name*.

## Decision

**`select.listbox` is renamed to `select.options`. A part's name says what the element is for; its
role says what it is.**

`listbox` remains everywhere it is a role. It stops being a part name.

The rule generalises and is the reason this is a record rather than a rename: a part name that is also
a role name is a name that cannot survive the element's semantics changing. Multiselect's list already
proved it — when its chips stopped being a listbox, a part called `listbox` was left describing
something it was not, and the fix was to rename the part rather than to keep the wrong word.

## Consequences

**A part name is a stronger contract than it looks, and this is the fact the record exists to carry
forward.** Part names become ids in the page. Measured, with a select open:

```
plain      id `pick__listbox`, and `aria-controls` naming it
lit        no such id
angular    no such id
```

So the rename changes an id that is in a consumer's page today, and it does so **in one renderer of
three**, because the other two never published it. That asymmetry is a defect of its own and is filed
separately; it is not a reason to keep the name.

**Amendment, measured after the rename was done: the cost is narrower than the paragraph above first
claimed.** It said a stylesheet may select the id. No CSS class moved — `mdy-select__list` was already
the class under the old part name — so a consumer's stylesheet is untouched:

```
class           mdy-select__list       unchanged
id              pick__listbox    →     pick__options
aria-controls   follows the id, resolves
```

The migration is one line and it is narrower than *a part name changed*: **if you named
`<widget>__listbox` in your own `aria-*` or in a selector on the id, it is `<widget>__options`.**
Nothing about classes, and nothing at all for lit or Angular consumers.

The correction is here rather than silently applied because a record that overstates a cost makes the
next rename look more expensive than it is, and the next rename is the one this rule exists to make
cheap.

`contract:diff` will classify this, a changeset states the migration, and the standing authority in
the project instructions say to ship what the tool classifies. The migration a consumer needs is one line: the
part is `options`, the id is `<widget>__options`, and the role is unchanged.

Twenty files mention `listbox`; roughly half are the ARIA role and must not move. That is a batch to be
done in one pass rather than incrementally, because a half-renamed part is worse than either name.

## Alternatives rejected

**Rename multiselect's `options` to `listbox` instead**, for symmetry. Rejected outright: a
multiselect's list is not a listbox, and naming it so would be the same mistake in the other direction
— a part named after a role it does not have.

**Keep both names and add an accessor** — `optionListPartOf(kind)` — so a consumer can ask rather than
guess. It solves the reader's problem without breaking an id, and it was the closest call here. It
loses on the deciding principle: the smallest public surface wins. An accessor adds a function to learn
and to keep stable, and leaves the two names in place for anyone who does not know the accessor exists.
A rename removes the question.

**Keep both names and document the difference.** The cheapest option and the one the evidence rules
out: the difference *was* discoverable, and it still cost an S1 filed against correct code, because
what a reader meets is `undefined` rather than the documentation.

## Verification

`a-part-two-kinds-spell-differently.battle.test.mjs` derives the comparison rather than listing the
kinds — any kind declaring an `option` is asked what it calls the list its options sit in — and is red
today with `listbox` and `options`. It goes green on this decision and stays green when a kind is added
tomorrow.

Calendars are deliberately outside that comparison: a datepicker and a daterange call their popup's
contents `grid`, and a grid of days declares no `option`, is addressed by two axes, and is not an
option list. Naming it the way a select names its list would be this same defect in reverse.

The check that fails if this decision is violated quietly: a future kind introducing a third spelling.
The battle catches it without being edited.

## Security and privacy

No impact. A part name and an element id carry no data and grant no capability; the rename changes what
a selector matches, not what anything is permitted to do.

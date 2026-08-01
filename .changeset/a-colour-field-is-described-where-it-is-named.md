---
"@modyra/widgets": patch
"@modyra/angular": patch
---

A colour field is described on the element it is named on, and Angular's radio group is described at
all.

**The contract disagreed with itself about `colors`.** `LABEL_FOR` pointed the label at `hexInput`
and `DESCRIBED_BY_CARRIER` hung the description off `control` — the native picker, which two
renderers make unfocusable. One kind, two elements each claimed as the accessible control, so a
field's name and its description sat on different things. `DESCRIBED_BY_CARRIER` now names
`hexInput`, and the canonical snapshot counts `hexInput` among the elements a state can be expressed
on.

This was found by a renderer being marked wrong when it was right: Angular exposed the description
and the validity on the hex input the user types in, and the expectation — reading `control` — called
that nothing at all. Two of three renderers agreeing is not the same as two of three being correct.

The equivalence suite no longer restates the carrier either; it reads the relation from the contract.
A table beside a table is the shape of the defect this milestone keeps finding: two spellings that
agree today and diverge the moment one moves.

**Angular's radio group carried no `aria-describedby` and no `aria-invalid`.** The group is a
`radiogroup` with a name and nothing else, so an error was rendered, styled, and announced to no
assistive technology. It now binds the shared projection, as the segmented group already did.

Each `<input type="radio">` bound that same projection, so the error text was also attached to every
option — announced once per choice. The contract declares the relation from the group; the options no
longer restate it.

**Angular's multiselect described itself from the options container**, which the user never lands on,
rather than from the search button its label names. Moved.

---
"@modyra/lit": minor
"@modyra/styles": patch
---

Lit draws the contract's multiselect, and the switch travels evenly

Lit's multiselect showed a summary of what was already taken and kept its options in the popup. It
now draws the anatomy the catalog names and Angular established: every option is a chip in a grid in
the field, each in its wrapper, with the same grid in the popup under the filter. Its chips take
their classes and their parts from the contract, tick included — the single-mode chip had no
`mdy-chip__check`, which the cross-adapter audit reported the moment the literal was removed.

The switch's handle moved unevenly between its two states: the off track carries an outline, the on
track did not, and the handle is inset from the padding box — so it sat two pixels closer to the edge
when the switch turned on. The outline is now the same width in both states, transparent when on, and
the travel subtracts it. Measured off and on in all five themes: the gap at the left when off equals
the gap at the right when on.

A handle can also be a capsule now, through `--mdy-toggle-thumb-width`/`-height`. iOS's is 38×24,
measured from the platform, and it was getting that by re-implementing the thumb — which cost it the
contract's travel and the state layer. It sets the two tokens instead.

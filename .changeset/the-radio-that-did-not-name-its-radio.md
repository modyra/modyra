---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The radio names its radio

`radio` declared one part for a choice, `optionControl`, and it named the painted circle. The
`<input type="radio">` that a person operates — and that the submission table calls this kind's
submitted control — was covered by no part at all: no class, reachable from nothing. Its sibling
`segmented` has always declared both, with the reason written beside it: naming both is what lets the
rule bite, because a container alone can be anything.

**No user-facing defect, measured before saying so.** Every renderer submits a radio's value today and
did before this change, with the right `name` and `value` on the input. What was missing was the
contract's ability to name the element doing it — which is why nothing could check that the element
carrying the name was the one declared to carry it.

**Migration.** The circle keeps the class it has always had, `mdy-radio-circle`, so no theme moves;
what changed is which part carries it. A consumer resolving the circle through the contract asks for
`optionCheck` instead of `optionControl` — the same name its sibling uses for the same thing.
`optionControl` is now the input itself, carrying `mdy-radio-input`, declared as the `radio` semantic
and required. Parts after the insertion shift one place in the reading order.

This closes the check that arrived one commit before it, which found this defect standing rather than
having it planted: an element carrying a field's name that is not the part the submission table
declares. That check now passes for every kind, and the two statements about a radio — what the
anatomy says and what the payload says — describe the same element for the first time.

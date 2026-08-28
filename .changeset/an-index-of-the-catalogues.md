---
"@modyra/widgets": minor
---

The catalogues that make up the contract, in one place, each saying what shape it is

There was no such list. Fourteen vocabularies, fourteen separate exports, and nothing saying *these
are the ones* — so a tool built against "the contract" read whichever it reached first and looked
complete. Not hypothetical: an enumerator that knew one of them reported "41 properties declared,
none silent", then "eight undeclared conventions", and both were wrong, because the conventions were
declared in catalogues it was not reading.

`MDY_CONTRACT_VOCABULARIES` names each one, **the shape it has**, and the subpath it is published
from. The shape is declared rather than inferred because inference fails on a real case: a flat
dictionary is the degenerate form of a table with one column, so a rule asking "are all the values
objects?" gets `{ formErrors: "mdy-form__errors" }` wrong and stops covering it silently.

The door is recorded because it has already cost two mistakes: a vocabulary reachable only from
`./vocabulary` reads as unpublished to anybody grepping the barrel. Three of the fourteen entries
were found that way — by the check that says the index must be complete, after two people had counted
by hand and agreed on the wrong number.

Adding a vocabulary is a line in that file, and the check fails until it is there.

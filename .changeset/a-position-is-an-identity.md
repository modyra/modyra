---
"@modyra/core": minor
---

A positional collection's submitted value keeps the positions the form holds

`submitValue()` left out disabled fields, and a row whose fields were all disabled therefore
contributed no key at all — so the list built from what remained was shorter, and every row after the
missing one was sent at a position it does not occupy. A server reading `list[0]` after the first row
was locked read the row the person can see below it. Nothing in the payload said so and no type
moved.

A row that contributed nothing is now submitted as `{}` at the index it holds, so
`submitValue().list.length === getValue().list.length` for every array in the form. The field promise
is unchanged — a disabled field contributes no key, at any depth — and keyed collections are
untouched: an absent key stays absent.

A consumer that assumed every row in a submitted list was populated will now see `{}` for a row that
sent nothing. No API changes, so the type surface and the contract snapshot are unmoved; this is a
change to what a payload means and lands as a minor for that reason. See ADR 0100.

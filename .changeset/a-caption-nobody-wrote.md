---
"@modyra/plain": patch
---

A caption a document did not write stops standing where a caption stands

A field given a name and no caption still needs one: everything inside the shell is named by pointing
at the label, and a reference resolving to an empty element announces the role and nothing else. So
the label carries the field's own key, and `mdy-label--unwritten` is what keeps that key out of sight
— visually hidden rather than removed, so a reader can still follow a reference to it.

The class stopped being applied. `shellStateClasses` owns it and computes it from an `unwritten` input
this renderer was not passing, so the toggle turned off the class the shell had just switched on. A
form showed `rows.0.code` in the position and styling of a caption somebody meant.

That is worse than showing nothing, and the difference is the reason: nothing is legible as nothing,
while a leaked key and a real label are indistinguishable — a person reading the form cannot tell it
is incomplete.

Introduced by the change that moved the state classes into the contract, which added `unwritten` to
what that function owns without the one caller that knew the answer passing it. Guarded now, with a
control: a caption a document *did* write must not be marked as one nobody did, so the class cannot be
applied always and pass by hiding every label on every form.

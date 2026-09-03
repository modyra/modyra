---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The multiselect's projection names the option under the cursor

Where the keyboard is standing in an open list was announced by whichever renderer had remembered to
say so. Plain said it only on the filter box, so a field drawn without one had a cursor that moved
for everyone who could see the screen and for nobody else — in both modes, not only the counter one.
Lit and Angular each said it on the trigger and the box, from a private computation of their own.

The projection now carries `aria-activedescendant` on the `trigger` and `search` parts: the id of the
option under the cursor, and `null` when there is none — the same convention `aria-readonly` already
uses beside it, because an omitted key hands `undefined` to whoever reads the projection while `null`
is the contract saying "no attribute". Both parts carry it because the reference is read from
whichever element holds focus, and which one that is depends on whether the field drew a box to type
in; the one nobody is standing on is never consulted.

`projectMultiselectFieldA11y` gained an optional `activeDescendantId`. The projection is handed the
id rather than the format: the option id is already spelled where the option parts are built, and a
projection spelling it again would be the second copy that keeps answering after the first moves —
which is exactly what a dangling reference is made of.

Plain gets the repair by applying a part it already applied. Lit and Angular keep the attribute in
their own templates, because neither applies these parts, but both now read the projected value
instead of computing one.

Each renderer's bench presses a key and then asks the **element that holds focus** whether it is the
option under the cursor or names one — the disjunction, because this kind uses each of the two
patterns ARIA allows in a different configuration, and asserting either half alone would fail a
renderer that took the other road. The named reference is asserted to resolve to that option, never
merely to be present.

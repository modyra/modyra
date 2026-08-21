---
"@modyra/widgets": minor
"@modyra/angular": patch
"@modyra/plain": patch
"@modyra/lit": patch
---

The option grid says what it is, and a multiselect opens on an arrow again

**The chip grid declared no role at all.** It once claimed `listbox` semantics its chips did not have,
and the redesign removed the role rather than correcting it — so the container became an unlabelled
`div` and a screen reader was told nothing about the set. `null` is neither of the two published
answers; it is the one that says nothing.

`group`, declared by the contract rather than written into three renderers — which is what plain and
lit were already doing separately and Angular was not doing at all. Not `listbox`: a listbox's
children are options a person walks with the arrows, and these are chips that toggle, so the stronger
role would promise a keyboard model the grid does not have.

**And `ArrowDown` opens a closed multiselect again.** It is the APG's own behaviour for a combobox and
`select` still had it. The binding was conditional on a kind declaring a `listbox` part — and the
multiselect lost its arrows the day that part was retired, because its popup still held the same
options under a different part name. The condition asks about `option` now, which is the question it
was always trying to ask: a calendar, a clock face and a colour palette declare none, so they are
untouched.

One conflict closed with it: a focused chip was swallowing every key the contract declared, including
the ones it does not answer, so `ArrowDown` on a chip did nothing at all. A chip now stops only the
keys it handles.

---
"@modyra/lit": patch
---

The radio option's `aria-disabled` goes on the option

The radio group put the `option` part's `aria-disabled` on the `<input>` inside it. Both come from the
same projection call, but they are different parts: the input is `optionControl`, which declares no
states, while `option` declares `disabled` among its own — and the label carried none.

This was invisible until the contract could name the input. `optionControl` was the painted circle
until this release, so the attribute sat on an element no part covered and nothing could check it
against a declaration. Naming the input did not create the defect: it gave it a name, and a browser
bench read it.

The input keeps its native `disabled`, which is what conveys the state — `aria-disabled` belongs to
parts that are *not* natively disabled, which is why the contract's list of them is three names long.
Plain and Angular never put it there, so this also ends lit being the only one of the three out of
line.

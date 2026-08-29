---
"@modyra/widgets": minor
---

The second door, and what the contract declines to say

`MdyPopupOpener.alsoOpensFrom` names the part a pointer opens an overlay from beside the opener that
carries the relation: the calendar button next to a typeable date, the clock next to a typed time,
the box a multiselect's chips sit in, the swatch next to a colour. All three renderers answered a
press on these and none was asked to — the door worked everywhere, nothing declared it, and any of
them could have lost it with every suite green.

It carries no relation: `aria-expanded` and `aria-controls` stay on the part that holds the value,
because a second element claiming them announces two comboboxes for one list.

ADR 0177 also records two things the contract deliberately does not decide — whether a renderer draws
an optional part that declares no condition, and whether a control is named by a reference to its
caption or by the caption's words — so a check can read the reasoning instead of reporting the silence
as a defect.

---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A widget announces the refusal it makes

Twelve of the seventeen kinds refused every change while read-only and said nothing about it. The
control was focusable, submitted, counted for validity, looked exactly like an editable one, and the
only feedback was that nothing happened.

The previous decision — `readonly` declared only where a value is typed — was right when nothing
enforced it: an `aria-readonly` on a checkbox, next to a native attribute HTML ignores, is a claim the
DOM contradicts. Every kind's controller now asks `blocksValueChange` before carrying out an intent, so
the claim is true and the silence is the defect. `MDY_WIDGET_STATE_SUPPORT` declares `readonly` for
sixteen kinds and `ARIA_STATE_CARRIERS` names the carrier for each.

**The native attribute is bound only where the platform acts on it** — a text-entry input or a
textarea, never a range, a checkbox, a colour, a file input or a `<select>`. That half of the earlier
finding survives as a rule, and the conformance check no longer demands an attribute the browser drops.

`file` declares no read-only state: its picker is the browser's, its value is a `FileList` a page
cannot write, and its role has no `aria-readonly`. What is expressible there is that the affordance is
unavailable, so its browse control is disabled while the field stays in play.

Three controllers kept `readonly` in a local signal a host had to set, while reading `disabled` and
`interactivity` from the handle — a field the form had marked read-only refused through one path and
reported itself editable through the other. They derive it from the handle now.

`MdyFieldShellFlags` gains an optional `readonly`. A theme selecting on `[aria-readonly]` will match
kinds it did not before.

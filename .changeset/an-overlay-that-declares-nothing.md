---
"@modyra/widgets": patch
---

A canonical observation tells "no panel" from "a closed panel"

The canonical snapshot reads open-ness from `aria-expanded` on the opener the contract names, because
renderers hide a closed panel in ways a DOM inspection without layout cannot see. Read as a boolean,
an opener that says nothing answered the same as one saying "closed" — so a kind drawn in a variant
with no overlay of its own, such as a select with no search rendering the platform's chooser, was
reported as having a closed panel, and every check built on that reading passed on a widget it had
never seen.

`overlay` is now `"absent"` when nothing declares the state, `"closed"` and `"open"` when something
does. Kinds with no overlay capability answer `"absent"` as they always did.

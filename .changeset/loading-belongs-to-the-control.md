---
"@modyra/widgets": minor
"@modyra/lit": minor
---

A loading field says so without being opened. The `loading` part now hangs from the control rather
than the popup, so an indicator reachable only by opening the list no longer satisfies the loading
state. `empty` keeps its popup parentage: "no options match" is a statement about the list and has
nothing to say until there is a list on screen.

Lit's multiselect renders its loader on the search button, which is what its own select and the
contract already did.

**Breaking.** `loading` hangs from the control, so a renderer whose only loading indicator lives
inside the popup no longer satisfies the loading state. Move it to the control, as every first-party
renderer now does.

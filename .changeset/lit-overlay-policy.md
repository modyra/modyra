---
"@modyra/lit": minor
---

Route every Lit overlay through the widgets lifecycle policy: the dropdown, both pickers, the date
range and the colour palette open, close, answer Escape and dismiss on an outside pointer through
`overlayLifecycleTransition` rather than each element deciding locally.

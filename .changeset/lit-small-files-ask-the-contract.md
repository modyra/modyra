---
"@modyra/lit": patch
---

Eight renderers ask the contract for their class names

`datepicker`, `colors`, `file`, `segmented`, `select`, `checkbox`, `toggle` and `number` take forty
class names from `partClasses` and `presentationClass` rather than spelling them. The strings on the
element are unchanged.

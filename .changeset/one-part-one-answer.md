---
"@modyra/widgets": patch
---

`partClasses` and the contract record now agree about every part

Both are published, and they disagreed about five of them: `partClasses(kind, "control")` returned
`["mdy-input-wrapper__inliner"]` for text, email, password, textarea and number, while the record
said the part carries no class at all.

The record was right. That class belongs to the **box that holds** the control, not to the control —
measured in the page, the `<input>` does not carry it and its container does. The accessor fell back
to the shell's vocabulary by name, and the shell uses the word `control` for the box.

**If you selected a control with that class, you were selecting its container.** The selector found
an element, which is why nothing failed. `partClasses(kind, "control")` now returns `[]` for those
five kinds, and every part reads the same whichever surface you ask. See ADR 0154.

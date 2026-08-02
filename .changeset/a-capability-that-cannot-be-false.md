---
"@modyra/widgets": major
---

`capabilities.keyboard` and `capabilities.focus` are withdrawn, and the report that survives means something.

Both were `true` on all seventeen kinds. As per-kind flags they said nothing — a consumer branching
on one was branching on a constant — and `dismissOnOutsidePointer` was exactly `overlay` beside them.
A declared capability that cannot be false is a promise with no content, and leaving it as decoration
invites someone to write the branch. Nothing in this repository read either one.

`overlay` and `dismissOnOutsidePointer` stay. The second is kept deliberately even though it never
varies: a popup a click elsewhere cannot dismiss is a real design, and this is where it would be
declared. What it still does not say is **which event** delivers the dismissal, and that gap is
measured rather than theoretical — the renderers disagree, and a drag beginning outside an open popup
fires one binding and not the other.

**Two defects in the tool that classifies these changes, found by making one.**

`contract-diff` compared capabilities by iterating the *current* ones, so a capability that had been
removed was never visited — the one change `docs/contract-compatibility.md` calls major was the one
change the gate could not see. It now compares the union of both sides. And the keyboard comparison
recorded `Object.keys` of an array, so it held the *indices* `"0"`, `"1"`, `"2"`: it could tell that a
kind's key count had changed and never which key, and declaring `Tab` was reported as
`key declared: 8`. It now records each binding as `key@phase:intent`.

The snapshot format changes with it, which is why every kind reports its keyboard afresh once.

---
"@modyra/studio-model": minor
"@modyra/studio-contract": minor
---

Studio's model can hold a per-breakpoint layout, and compiles to the version that says it

`StudioLayoutColumns` had no `at`, so a row's track count could not be authored even though Contract
v2 had carried it for some time, and a slot had nowhere to say where it sits or whether it shows. The
model now holds both: `at` on the row, and `at` on the slot.

`StudioLayoutSlot` extends `NodeRef` rather than replacing it, so every `"nodeId" in child` reading
of a layout keeps working and a slot with nothing to say still serializes as the `{ nodeId }` it
always was.

**The compiled version is the lowest one that can say what the project says.** A row's track count is
v2's own feature and compiles to v2; only a slot that places or hides itself raises the document to
v3. A form that never touches a breakpoint produces the same v2 document it produced before — no
stored contract, SDK, or target has to change because v3 exists. `CompileResult.contract` widens to
`StudioContract`, the union of the two.

Placement that a row could not honour — a column past its tracks, a size that says neither `column`
nor `hidden` — is dropped rather than compiled, because a half-finished edit in the canvas is the
ordinary way to produce one and it must never cost the author their form.

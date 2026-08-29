---
"@modyra/angular": patch
---

Four kinds stop being announced as nothing when a document writes no caption

A `label` is optional and a form may omit it. What is not optional is that somebody using a screen
reader hears *which* field they are on: with no name, a text box is announced as "edit text" on a form
of them, and voice control has nothing to say to reach it at all. That criterion has no conditional
clause.

`slider`, `radio`, `segmented` and `file` had no name of any kind on such a document — no
`aria-label`, no `aria-labelledby`, no `label[for]`, no wrapping caption. Eleven other kinds fell back
correctly, so the gap was never the resolver that decides the fallback:

The two groups pointed `aria-labelledby` at a caption that was not rendered — `label() ? labelId :
null`, which is `null` exactly when a caption is missing, so the one case the fallback exists for is
the case nothing answered. They now point at the caption where there is one and carry a spoken name
where there is not.

The two inputs named themselves nowhere. In the file field only the clear button was named, which is
the button that empties a control nobody could hear the name of.

Guarded per kind: each of the four defects, replanted alone, turns exactly its own row red. The check
asserts the floor — that *something* is announced — because whether a raw field key should be shown
as a name, and how, is a separate decision that belongs in a record before anyone builds it. Its
control is a captioned field, so a renderer naming everything after its key would pass every row and
fail that one.

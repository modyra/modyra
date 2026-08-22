---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The button that takes a chip off says which chip it takes.

Every remove button in a multiselect's strip was named with the verb alone — `Remove`, `Rimuovi` — so
a field holding eight values offered eight controls with one name between them. Someone reading the
page one control at a time hears "Remove" and has to leave it, find the chip beside it, and come back
to know what they would be removing; someone listing the controls hears the same word eight times.

`chipRemoveName(verb, label)` is published from `@modyra/widgets`: the words stay with the renderer,
where the language lives, and the rule that the object belongs in the name lives in one place. All
three renderers now announce `Remove Alfa`.

**Migration**: a test or tool matching the old name exactly — `[aria-label="Remove"]` — matches
nothing now. Match the prefix, or the part class.

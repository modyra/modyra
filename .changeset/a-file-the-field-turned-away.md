---
"@modyra/core": major
"@modyra/widgets": major
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
"@modyra/styles": patch
---

A file the field turned away is something the page says

`fileSelectionTransition` reports what a pick refused. Nothing showed it: a field declaring
`accept="image/*"` given a `.txt` left the page unchanged in `@modyra/plain` — same text, no message,
no live region — and `@modyra/angular` emitted `filesRejected` for a host to catch and said nothing
itself. `@modyra/lit` was not applying the policy at all: it wrote the raw pick, so a refused file
appeared in the list as though it had been taken, and `accept`, `maxFileSize` and `maxFiles` meant
nothing there.

**`MDY_WIDGET_CONTRACTS.file` gains an optional `rejected` part**, `role="status"`, beside the file
list rather than inside it — the list is the value, and a refused file is what did not become part of
it. **`MdyI18nMessages` gains `fileRejected(names)`**, which takes the list and returns the sentence,
in all five published tables: the join is a locale's decision, not a renderer's.

**`MdyFormAdapter` gains `reportEntry(name, problem)`.** The previous release put `reportEntry` on the
field handle; a handle is built over an adapter, and Angular's could not implement the handle contract
without this. Both additions are required members — an implementer of either interface adds one.
Spreading over `MDY_I18N_MESSAGES_DEFAULT` is unaffected.

`@modyra/lit` and `@modyra/angular` now write what the transition answers rather than rebuilding a
shape beside it, so a single-file field holds a list in every renderer. A page relying on lit ignoring
`accept` will find that it no longer does.

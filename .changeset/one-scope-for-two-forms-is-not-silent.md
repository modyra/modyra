---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

One scope for two forms is not silent

Ids come from the field's path (ADR 0135), so two forms built from the same document claim the same
ones unless the host scopes them. The record rejects renaming the second form's ids — a
mount-order-dependent id is the counter's defect returned in a corner — which leaves the collision as
the design, and silent it was the worst of both: `aria-describedby` resolves into the other form and
the page looks exactly like one whose references are right.

`reportIdCollision` warns, in development, when a widget publishes an id another element on the page
already carries. It never renames. It is stateless — it asks the document rather than keeping a
registry of live ids — so nothing has to be released on teardown and a remount cannot report a
collision with its own former self.

The fact belongs to `@modyra/widgets` and the spelling belongs to whoever is being read: each renderer
passes the advice naming its own door — `idPrefix` when mounting Plain, `id-scope` on lit's controls,
`[idScope]` on Angular's.

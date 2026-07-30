---
"@modyra/studio-ui": patch
---

Hiding a column actually hides it, and stays undoable

Studio restated `display: grid` on `.mdy-layout-column`. That beat the foundation's own
`display: var(--mdy-layout-column-display, flex)`, so a column hidden at a breakpoint published
`none` and went on being displayed — the property was right the whole time and nothing happened. The
e2e could not catch it, because it asserted the custom property rather than the effect; it asserts
the effect now, the same lesson as the group-visibility bug before it.

Studio no longer restates `display` at all. A stacking column is a stacking column whether it is flex
or grid, and the one that decides is the foundation's.

That fix immediately produced a worse problem: with hiding working, hiding a node on the canvas took
the eye that would unhide it away with the node, and the edit could not be undone. **The canvas is an
editor, so it marks a hidden column instead of removing it** — dimmed, badged "hidden here", still
selectable and still editable. The shipped form hides it for real; only the canvas keeps it in reach.

*(An earlier draft of this note also claimed the Preview tab hid it for real. It did not: Preview
built its own arrangement and ignored every slot's placement. That is fixed separately, in "Preview
shows the arrangement it is previewing".)*

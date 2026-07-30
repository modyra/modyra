---
"@modyra/studio-ui": patch
---

The canvas draws the size you are authoring, not the size of your window

Choosing `base` narrowed the canvas to a phone and then drew the desktop's two-column row anyway. The
foundation's breakpoints are **viewport** queries, and the canvas is a frame inside a window that had
not changed width — so the frame shrank and the arrangement did not. The selector previewed the width
and nothing else, and the e2e could not tell, because it asserted the published custom properties
rather than the tracks the browser actually computed.

Studio is the only thing that knows which size is being authored, so Studio picks which of the counts
the renderer already published applies, and the canvas draws that row. The counts stay the
renderer's — this chooses among them rather than restating a grid, which is what made the canvas
drift from the form the last time tracks were written here — and with nothing selected it falls back
to exactly what the foundation would have done.

The test now counts the computed tracks. `base` stacks; `md` shows two; narrowing the row at `md`
stacks it there and leaves every other size alone.

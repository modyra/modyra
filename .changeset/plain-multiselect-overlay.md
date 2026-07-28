---
"@modyra/plain": minor
"@modyra/styles": minor
---

Multiselect opens an overlay, and the themes stop knowing which renderer drew the DOM

Plain's multiselect now renders a trigger with selection chips plus a portalled popup holding the
filter field and the option chips, instead of laying every option out inline — opening it no longer
resizes the field and pushes the rest of the form down the page. Its select renderer drops its
private positioning code for the shared `positionOverlay`/`trackOverlay` helpers.

`@modyra/styles` gains a foundation `.mdy-overlay` primitive: any popup portalled out of its own
subtree carries the class, the renderer writes `--mdy-overlay-*`, and the foundation owns the
positioning, clipping and `[hidden]` behaviour. Modern's `.mdy-plain-select__portal`,
`.mdy-plain-form` and `.mdy-plain-{date,time}picker` rules are gone with it, so no theme file
contains an adapter-specific selector any more.

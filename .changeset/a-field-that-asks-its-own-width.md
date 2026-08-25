---
"@modyra/styles": patch
---

The chip strip wraps by how wide the field is, not how wide the window is.

WCAG 1.4.10 asks content to reflow to 320 pixels without a second scroll direction, and the strip
answers by wrapping at that width. It asked the **viewport**, and the thing it is about is the strip:

```
viewport 1400, field 284   before: no wrap, 1067px of chips in 252px of view
                           after:  wraps
viewport  320, field 288   wraps, before and after
```

A multiselect in a narrow column inside a wide page was in exactly the state the rule exists to
prevent, and the query could not see it. **A component that asks the viewport is guessing about a page
it cannot see.**

The box already declares itself a container — the chip ceiling reads it — so this costs nothing but
the word. The threshold stays 320 and now means the field: at a 320px viewport the field measures
about 284 with the page's own padding, so it covers that case and the narrow-column one with it.

This was the sheet's only width media query. The other fifteen are preferences and capabilities —
`prefers-color-scheme`, `prefers-reduced-motion`, `forced-colors` — which are the window's to answer.

---
"@modyra/styles": patch
---

An icon in a popup has a size.

`.mdy-renderer svg` gives every icon one size, and a portalled popup is not a descendant of any
`.mdy-renderer` — it renders at the document root. So the rule could not reach the icons inside a
popup, and nothing else sized them.

An `<svg>` carrying only a `viewBox` then falls to each engine's default for a replaced element with
no intrinsic size, and they disagree. Measured on the multiselect's counter chips, popover open:

| engine | `+` / `−` icon |
| --- | --- |
| Blink | 32×32 — the space its flex line offered |
| WebKit | **0×0** |

On WebKit the increment and decrement buttons were empty boxes: a control a user cannot see is one
they cannot press. Four icons in the default example, and the same rule protects every other icon
that lives inside a popup.

`.mdy-popup` and `.mdy-overlay-panel` are now named beside `.mdy-renderer`. Every SVG on the page
measures identically across both engines afterwards.

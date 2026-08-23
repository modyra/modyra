---
"@modyra/styles": patch
---

Everything in a field's row shares its centre line.

A multiselect's chips sat 8px below the middle of their field and hung 3px past its bottom edge. The
cause was not the field's height: it is `--mdy-input-height`, which is already `control-2`.

**Three affordances were sized to a tap target instead of to a control step.** The caret, the clear-all
and the overflow button each took `--mdy-affordance-target` — 44px — as their *height*, inside a field
whose row is 36. The flex line became 44, so a 28px chip centred against it landed 8px low and its
lower edge fell outside the box.

A target is not a size. The caret takes the glyph's box, because it is `aria-hidden` decoration and the
opener is what a person presses; the clear-all and the overflow stretch to the row, as the opener now
does. Measured in the demo, every part of the row is 28px tall at the same offset:

```
before   chips 28h at 13   trigger 44h at 5   3px past the bottom
after    chips 28h at  5   trigger 28h at 5   inside, and on one centre line
```

The four per-theme centre-line checks pass in all four shipped themes.

---
"@modyra/styles": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The chips strip scrolls, and `searchable` decides whether there is a search

**`searchable` was ignored by every multiselect renderer.** The document has declared it all along and
all three built the filter box regardless, so a field that asked for no search got one — and a field
that asked for nothing got one too, which is what made the flag look like it worked. The slot was
never the problem; three renderers each dropped it.

**The strip scrolls now, and the reason it did not is worth recording.** Nothing overflowed because
the truncation was absorbing it: chips shrank until they fit, so `overflow-x` had nothing to do and
"scroll to see the rest" never happened — they just got narrower until nothing was legible. The chip
gains a floor width, which makes the overflow real, and the ellipsis then means *this one is clipped*
rather than *everything is*.

One layer up, the field's box was growing to fit its chips: a flex item's automatic minimum size is
its content, so the control was as wide as the value was long — the same expansion the inline option
list used to cause, one axis over. `.mdy-multiselect` takes `min-width: 0`.

Deliberately **not** `scroll-behavior: smooth`. A chip scrolled out of the strip is still
Tab-reachable and focusing it brings it back, but smooth makes that arrival take about half a second,
during which the focused chip is still off screen and anything reading the scroll position sees the
old one. A focus ring nobody can see yet is the same defect as a focus ring nowhere.

**The chip's controls draw their marks in CSS rather than writing them as text.** An accessible name
composed from an element's contents picks up a `×`, so the chip announced itself as "Opzione A 2 ×"
unless somebody remembered to exclude it. A mark that is never text cannot be read out by accident.
The caret at the trailing edge is drawn the same way, from the same glyph token as the select's.

A chip narrowed to an ellipsis carries its full name in `title`. That is the pointer's half; the
tooltip a theme draws on focus and long press is the half that reaches a keyboard and a touch.

---
"@modyra/styles": minor
---

A field's hover and focus tint is a state veil, not a fourth colour mixed from three derived ones.

`--mdy-input-bg-hover` is **removed**. It mixed the field's background with the text colour, and both
of those are themselves mixed from a primary a host may set at runtime — so what was finally painted
composed three levels deep and had a shape no declaration stated. A host that overrode it should
override `--mdy-state-veil` instead:

```css
:root { --mdy-state-veil: rgb(0 0 0 / 0.06); }
@media (prefers-color-scheme: dark) { :root { --mdy-state-veil: rgb(255 255 255 / 0.08); } }
```

The veil is laid over whatever the field is already painted, so it is one legible value per colour
scheme instead of a colour that depends on how deep the derivation beneath it goes. The appearance is
materially the same; the screenshot baselines, which capture widgets at rest, are unchanged.

It also fixes a crash. In WebKit, painting that nested value during hover or focus **ended the page** —
contract gap O, and the same cause as gap N one element over. Two `demo.spec.ts` rows quarantined
against it are un-quarantined and pass.

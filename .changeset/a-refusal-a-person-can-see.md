---
"@modyra/styles": patch
---

A toggle and a checkbox show their refusal to the eye, not only to a reader

A refusal is painted from `[aria-invalid="true"]`, and everywhere else that attribute sits on the
element that is drawn. On these two it belongs to the control — a native input the eye never meets,
because the track and the indicator are what is painted — so the rule landed on nothing.

The field announced itself refused to a screen reader and looked exactly like one that works. A
person who can see it tries it, gets nothing, and is told nothing.

Written through the control rather than on it, which is the shape the checked state already uses two
rules away: `.mdy-toggle:has(.mdy-toggle__control[aria-invalid="true"]) .mdy-toggle__track`. The edge
takes the error colour, which is what a refusal is drawn in everywhere else in this sheet.

Found by asking which element carries `aria-invalid` for each kind: four carry it on the surface a
person sees, and these two do not. No theme in this repository has a single `--invalid` class rule —
the refusal has always been drawn from the attribute — so the gap was exactly as wide as the two
kinds whose attribute is out of sight.

---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A colour palette a keyboard can reach

Three clauses of the contract could not all hold. `MDY_WIDGET_KEYBOARD` declares the arrows, `Home`
and `End` on an open colour field; the canonical observation said focus stays outside the widget when
the palette opens; and `Tab` is declared `cancel`, so it dismisses rather than enters. Together they
left the swatch row unreachable from the keyboard in every conforming renderer, and the four declared
keys undeliverable — the presets were a pointer's row.

The canonical now says what it already says for the calendars: the palette takes focus into the row
it just showed, because a list the keyboard cannot reach is a list only a mouse can use. All three
renderers do it, and all three walk the row with the keys the catalogue declares, in the direction
the binding gives rather than the one the key name suggests.

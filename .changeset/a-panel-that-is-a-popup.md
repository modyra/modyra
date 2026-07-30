---
"@modyra/styles": patch
---

A panel that is a popup keeps what a popup has

The reset that stops an overlay wrapper painting a surface of its own said, in its comment, that it
was for "an overlay wrapper that is a popover, but is not itself a popup". The selector did not say
it. Some renderers put the popup's own classes *on* the panel — the datepicker's panel is its popup,
via `panelClass` — and for those this rule out-specifies `.mdy-popup` and would strip the background,
border, padding and shadow the popup is supposed to draw.

Measured in the built demo, the datepicker's surface is intact today, which means something else is
currently winning the cascade. That is not a state to leave a rule in: it works until a rule moves.
`:not(.mdy-popup)` states the intent, and the measurement is unchanged before and after — surface
kept, still anchored, and the select's wrapper still draws nothing at all.

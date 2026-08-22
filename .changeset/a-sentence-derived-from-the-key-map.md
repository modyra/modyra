---
"@modyra/widgets": minor
---

A control can say how it is operated, in words derived from its keys

Nothing on a page tells anyone the key map exists. It is discoverable by guessing, and a person who
does not guess has a control they can see and cannot operate.

`widgetKeyGuide(kind, messages, options)` reads `MDY_WIDGET_KEYBOARD` and returns one sentence: what
opens the control, what moves in it, what changes its value, what confirms, what closes it. Derived
rather than written beside the table, because a phrase naming keys *is* a copy of the key map — it
goes stale the moment a binding moves, which is a shape this contract has now found five times. The
frames are `MdyI18nMessages`, so a locale that translates them translates the legend.

It stays quiet about what a person cannot do: a key needing a capability the field never asked for is
left out — a legend listing `reorderable`'s keys on a field without it is worse than none — and so is
a key answered on a part the control did not draw. It describes one state at a time, because a closed
control's keys and an open one's are different sets.

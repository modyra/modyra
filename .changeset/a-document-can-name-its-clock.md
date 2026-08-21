---
"@modyra/core": minor
"@modyra/widgets": patch
"@modyra/plain": patch
"@modyra/angular": patch
"@modyra/lit": patch
---

A timepicker in a document can name its clock

`MdyDynamicDateField` gains `format?: MdyTimeFormat` — `"12h"` or `"24h"`, `timepicker` only, absent
meaning the 24-hour clock ADR 0116 made every renderer's default. Until now the format was reachable
only as a renderer parameter, so a document-driven form had one clock available and no way to ask for
the other; the stored value is `HH:mm` either way, and this decides what is drawn and how typing is
read.

Plain's field dispatcher and Angular's dynamic form both forward it. A `format` on a kind that draws
no clock, or a value that is neither of the two, is reported as
`MDY_DYNAMIC_UNHONOURABLE_FORMAT` and dropped, leaving the field drawing the default.

Migration: none. A document that says nothing behaves exactly as before.

Two fixes travel with it. The hour segment's announced range is now taken from `timeFieldBounds`,
the same source its native `min`/`max` come from — a 24-hour face had been declaring `max="23"` to
the browser and `aria-valuemax="12"` to a screen reader. And a two-digit segment box no longer keeps
a third character: text wider than the field it holds is refused, while a two-digit value outside the
clock's range is still kept and marked, which is what ADR 0063 asks for.

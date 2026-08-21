---
"@modyra/core": minor
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/angular": minor
"@modyra/lit": minor
---

A picker can be told which view to open in

`MdyDynamicDateField` gains `viewMode?: "dial" | "input"` — timepicker only, absent opening on the
dial. The controller has honoured `viewMode` since 2.4.0 and restores it when the picker closes, so
this names the view the field *has* rather than the one it started on; what was missing was the route
from a document or an attribute down to it. Angular, Lit and Plain each gain the matching input, and
Angular's dynamic form forwards the document's value.

A view that is not one of the two is reported as `MDY_DYNAMIC_UNOPENABLE_VIEW` and dropped, leaving
the field opening on the dial.

`MDY_TIMEPICKER_DEFAULT_FORMAT` is published beside `MDY_TIMEPICKER_INITIAL_VIEW`, and the four
renderer sites that each spelled `"24h"` out now read it. Two copies of the *view* default had
already drifted past ADR 0116 — Lit's resting state and Angular's clock component still opened on the
twelve-hour clock — which is what a default written four times does and what tests cannot see, since
a default is only read when nothing else answers.

`timepickerPlaceholder(format)` is published for the same reason one field over: the hint was written
out in two renderers and absent in the third, so one document told a person what to type in two
adapters and nothing in the other. Plain now shows it.

Migration: none. A document that says nothing behaves exactly as before.

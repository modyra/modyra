---
"@modyra/widgets": minor
"@modyra/lit": patch
"@modyra/angular": patch
---

An id the projection emits is an id the renderer applies

ADR 0134: where a projection emits an id, the renderer applies it; where it does not, no renderer
invents one. Not *every part gets an id* — that would be DOM weight for no reader. The rule takes away
the freedom each renderer had to drop one the contract was already computing.

- **Calendar day cells** carry the id the field controllers compute for them. plain applied it; lit and
  Angular did not, so `<widget>__day__<iso>` existed in one renderer of three.
- **A timepicker's hour and minute controls** carry `<widget>__hour` and `<widget>__minute`, which the
  timepicker projection has always named.
- **`calendarDayId` is exported.** lit had been rebuilding `` `${fieldId}__day__${iso}` `` by hand — two
  places computing one id, which drifts the day the format changes. The controllers and any renderer
  that cannot reach the part table now ask the same function.

Angular's calendar and timepicker components gain optional `widgetId` inputs, and its cell and segment
components gain optional id inputs: a component two levels below the field cannot reach the field's
projection, so the id is passed down rather than reinvented at the leaf.

---
"@modyra/vue": patch
---

A select you opened and dismissed reports itself touched

`mark-touched` is a command like any other, and this renderer's command runner answered it with
nothing: the runner was wired with no-op handlers when it was written, so a field a person had
opened, looked at and dismissed still reported itself untouched. A form that shows its verdicts on
touched fields therefore stayed silent about one they had just been in.

The controller was asking all along — closing a select answers `close-overlay`, `mark-touched` and
`restore-focus` together — and only the first and third were being performed.

The runner now defaults to `fieldCommandHandlers`, the shared answer for what a command means for a
field, and a component passes its own only where a state is genuinely the component's. Measured
across the five kinds that open a panel, in three renderers: all fifteen now report touched after
Escape, where this renderer's select was the one cell that did not.

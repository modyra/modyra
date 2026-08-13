---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Out of play, no verdict — completed, and asked in one place

`shownErrors` and `showsAsInvalid` reached six of the seven field kinds. The timepicker kept its own
answer, so a disabled timepicker painted as failing while a disabled datepicker did not. It does not
any more.

Two additions finish the rule:

- `errorsVisible(flags, errors)` answers *is the error text on screen* — failing **and** touched.
  Three renderers each had their own spelling of it; one of them applied it to a single kind.
- `shownErrorsOf(handle)` asks the question of a field handle. Two renderers had written the same
  wrapper around `shownErrors` byte for byte; both now import this one.

`MdyFieldVerdictSource` names what a handle must offer to be asked.

Nothing about a form's model changes: a field out of play keeps its errors and its value, and both
come back the moment the form asks about it again.

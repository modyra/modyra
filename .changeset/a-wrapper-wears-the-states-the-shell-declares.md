---
"@modyra/lit": patch
---

A control's wrapper wears the states the shell declares for it

`MDY_FIELD_STATE_CLASSES.controlStates` names two — `disabled` and `error` — and seven controls
composed the wrapper's class list for themselves, every one of them writing only the first. A field
the form had refused looked exactly like a field it had not: the label said so, the box around the
control did not, and a theme styling `mdy-input-wrapper--error` styled nothing.

The class list is composed once, from the table that names the states, so a state added there reaches
every control instead of six of seven.

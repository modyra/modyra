---
"@modyra/widgets": patch
---

An intent a controller does not know does not take the host down

A controller handles the intents its kind has — a text field has no popup, a checkbox no step, a
select no cancel — and one it does not know answers with `undefined` rather than an empty list. The
headless recipe feeds `dispatch` straight into `execute`, in the two lines it calls *"the only two a
wrapper does for you"*, so `commands is not iterable` reached a host driving every widget from one
generic handler — which is the reason to go headless in the first place.

`execute` and `processWidgetCommands` now take nothing as nothing to do. An intent nobody declared is
the same class of input as an operator nobody declared, and gets the same answer: it decides nothing
instead of raising.

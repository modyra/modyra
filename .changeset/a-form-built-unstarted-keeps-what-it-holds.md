---
"@modyra/core": patch
---

A form built with `autoActivate: false` and hydrated before it is activated now writes its draft when
it starts. The draft baseline — "what the user has not changed" — was taken at the deferred start,
so everything written between construction and `activate()` became part of it and the first draft
waited for an unrelated edit. React and Preact construct with `autoActivate: false`, so a form filled
from a payload in the tick it was built kept nothing until the user typed, while a form that paused
and resumed wrote on resuming. The baseline is now taken when the start is deferred, which is where
the form's own value still is.

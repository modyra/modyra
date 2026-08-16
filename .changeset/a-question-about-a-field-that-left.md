---
"@modyra/core": patch
---

A field that leaves play abandons the question asked about it

A server run is abandoned when the value stops being acceptable. A field **leaving play** is the other
way the same thing happens, and it was not: the request stayed in flight, `pending` stayed true and
`canSubmit` stayed false — for a field that is neither validated nor submitted. The person had
switched a section off and was waiting for the answer to a question about a field they could no longer
see; with a server that never answers, permanently.

Leaving play now abandons the run, clears the pending state, and moves the run id so a late answer
lands on a run nobody is waiting for. Coming back into play asks again.

The watcher is a second effect rather than a condition inside the runner, and that is the point: a
field becoming **read-only** is still being asked about, and a runner that woke on every interactivity
change would cancel and restart a question the form never stopped asking.

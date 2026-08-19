---
"@modyra/core": patch
---

A run in flight when the form is paused still reaches a terminal state

`deactivate()` tore the async runner down, which aborted a run already in flight: the promise
resolved into a form nobody was listening to, `pending` never settled, and `canSubmit` stayed false —
so the submit button of a form the user had finished filling in never came back, and `activate()` did
not bring it back either. The environment the feature exists for is React Strict Mode's immediate
mount→unmount→remount, where a validator debounced at zero is in flight exactly then.

A pause now lets a run land: its answer is about a value a pause does not change, which is what
"resumes exactly where it left off" means. Resuming no longer re-asks a question already answered for
the same value and the same dependencies — and a dependency that changed is still a new question.

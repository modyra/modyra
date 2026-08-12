---
"@modyra/core": minor
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/react": patch
"@modyra/preact": patch
---

A handle is observed by the runtime that owns it

The defect had been diagnosed, fixed and documented once already — and the fix reached two callers
out of roughly seventeen. `CHANGELOG.md` records what it costs: a binding that builds a fresh
`vanillaReactivity()` to observe a handle works only because vanilla's tracking is global to the
module, and silently never re-renders for a handle owned by another form.

`observerFor(handle, requested?)` is the one place that reads the ownership registry, so a caller no
longer has to know it should. Every field controller and every field renderer now resolves through
it; a runtime passed in explicitly is honoured rather than replaced, because a host with its own
scheduling has a right to be believed.

`MdyCrossRuntimeObservationError` and `MDY_CROSS_RUNTIME_OBSERVATION` were declared when the defect
was first found and constructed by nothing, which is why the other fifteen went unnoticed. They are
now raised when a caller observes a handle through a runtime that does not own it.

The select hooks keep their own runtime, and say why: that controller takes options and a callback
rather than a field, so there is no form whose runtime it could observe through.

Also in this release, for the suites rather than the library:

- `settleFor(beat, hostFlush?)` and `MDY_PAINT_BEATS` — when a renderer's DOM catches up with a
  write, declared by the renderer instead of guessed per fixture. Plain's twenty milliseconds turn
  out to have been one task all along.
- Lit and Angular drive the lifecycle contract, which one renderer had been carrying alone.

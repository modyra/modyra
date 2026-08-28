---
"@modyra/widgets": minor
---

Three field controllers are importable, and a check says so when the next one is not

`createSelectFieldController`, `createColorsFieldController` and `createFileFieldController` were
written, tested, and behind no door. Their **types** were published and the functions that build them
were not — so a consumer could name a `MdySelectFieldController` and had no way to make one. No
renderer adopted them because no renderer could.

The one for `select` says in its own first line why it exists: the select was the single kind built
the other way round, driven by eight imperative setters where every other kind takes a field handle
and reads it, and this is *"the adapter that closes it"*. It has been closing nothing.

**Nothing said so, and four gates each had a reason not to.** Their suites import by deep path into
`dist`, which passes — and that is the house habit for controller specs, so it is not a signal.
`coverage-and-demo` counted them asserted, because a test does mention them. `audit-public-doors`
guards the opposite mistake: a name reachable from *two* subpaths, not from none. And
`audit-contract-adoption` reported `"none offered"` — correctly, and therefore silently.

A new check reads the barrel: every `src/field/*-field-controller.ts` must export a builder the
package publishes. It finds the module list itself rather than being given one, and it asserts the
counts agree, so a check looking in the wrong place fails instead of passing quietly.

**The adoption audit now measures the field controller for `select`, not the standalone one**, and
knows a controller is offered for `colors` and `file`. The score moves from `45/45` to `42/51` — not
because adoption fell, but because the question sharpened. Nine renderer/kind pairs are offered a
controller and do not call it, and that list is now printed.

---
"@modyra/core": minor
---

The reactivity conformance suite checks that a destroyed scope stops the effects it owns.

`@modyra/core/testing` already asked whether a scope fires its cleanups and cascades to its children.
Neither question reaches the guarantee a scope exists for: **that what was created inside it stops.**
An adapter whose scope registers nothing passes both of the old checks and leaks every effect a form
ever made.

Every adapter in the repo passes the new check — the suite had simply never asked. It fails when the
ownership registration is removed from an adapter, which is the point.

Vue now runs the conformance suite directly rather than through
`core/test/reactivity-contract.mjs`. That shim hardcodes `destroy: () => {}` and a flush that
resolves immediately, so an adapter tested through it is never asked to tear anything down and never
asked to flush anything real. Vue's harness supplies a scope that owns every effect the suite makes
and Vue's own `nextTick`.

Worth knowing for anyone writing an adapter harness: `options.scope` is the ownership channel.
`scope.run()` enters the reactive context and does not, on its own, transfer ownership.

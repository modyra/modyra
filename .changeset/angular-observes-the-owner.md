---
"@modyra/angular": patch
---

`@modyra/angular`'s select adapter observes the runtime that owns the handle, and builds a fresh one
only where nothing owns it yet.

`angularReactivity` returns a new instance on every call, so constructing one here handed the
controller a second owner with the same name — and a runtime is refused the signals of one it does
not own. What that costs is not the complaint: it is a widget that renders once and then ignores
every change made anywhere else, which is what a field handle exists to deliver. The same shape was
repaired in `@modyra/lit` earlier, where the second runtime was vanilla rather than a second Angular
one.

The fallback stays Angular's rather than the shared default: a control in this package needs this
framework's scheduling, and the shared answer would hand back a vanilla runtime whose signals an
Angular template cannot see.

**Said plainly about the evidence.** This was found while chasing twenty-one cross-runtime complaints
printed by a conformance run, and those turned out to be a stale build — they are gone after
rebuilding, and restoring the old code does not bring them back. So the repair is made on the rule
rather than on an observed failure: the mechanism is demonstrated in isolation, where handing a
controller a runtime other than its handle's owner produces exactly one complaint, and passing a
fresh instance where an owner is registered is that case by construction.

---
"@modyra/lit": patch
---

Two complaints `@modyra/lit` made on the way past, both of which cost real behaviour.

**The daterange kept none of its root classes.** `classList.add` takes one token per argument, and
the catalogue answers with a list; joined, this kind's three root classes are one string with spaces
in it. The DOM refuses that by throwing, so the element ended up with none of them rather than with
some. It printed fifty-two times in this package's own suite while every test passed.

**The select adapter observed a runtime it did not own.** It built its controller over a fresh
`vanillaReactivity()` instead of the one that owns the handle: two instances of the same factory are
two different owners, and the second is refused the first's signals. What that costs is not the
complaint — it is a widget that renders once and then ignores every change made anywhere else, which
is what a field handle exists to deliver.

Neither was found by a test. Both were found once the manifest gate stopped letting a renderer's
`stderr` past while reporting success.

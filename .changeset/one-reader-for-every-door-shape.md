---
"@modyra/widgets": minor
---

Ask a door through one reader, whatever shape it has

`MDY_CLASS_DOORS` exists so a door added here is seen by every gate the same day. That held for the
door *names* and did not hold for the door *shapes*: each caller switched on which resolver an entry
carried, so a caller that had not yet learnt `resolvePath` called a `resolve` that was not there.

It threw. The page that walked the manifest is built in one pass, so the throw took the whole panel
with it — a manifest entry added in this package emptied a page in another, and twenty-one browser
tests failed on a page that rendered nothing. That is the product of two growing numbers again, one
level up from where the manifest closed it: every reader having to learn every shape.

`answerDoor(door, asked)` knows the shapes where they are defined, and returns `classes` plus, where
there are none, the reason. A door of a shape it has not been taught answers with that reason rather
than throwing — a caller that cannot be told about a new shape must at least not be broken by one.

The return type is deliberately not exported: it is what `answerDoor` returns, and a name a consumer
can spell as `ReturnType<typeof answerDoor>` is a name 1.0 does not have to keep stable.

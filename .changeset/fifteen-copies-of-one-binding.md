---
"@modyra/angular": patch
---

Fifteen host blocks stop repeating a class the control they extend already binds

`mdy-renderer--touched` was declared on the control every renderer extends *and* written again in
fifteen component host blocks, identically. Angular inherits host metadata, so the copies did
nothing: a rename would have had to reach sixteen places, and a renderer added without the line would
have looked wrong and behaved correctly.

Removed rather than routed through a shared helper. Deleting a redundant declaration is a smaller
change than replacing it with a computed one, and the alternative — binding a class *record* on the
host — replaces what a static `class` put there unless the two merge, which would take a kind's own
identifying classes away while every behavioural check stayed green.

**Nothing asserted the class in a rendered document, in any renderer.** The only check that covered
it reads renderer source for the names it mentions — it says so in its own header — so it establishes
that a file names a class, not that an element carries one. A spec now mounts six kinds, marks each
field, and asserts both halves: the state class arrives, and the kind's own classes are still there.
Removing the one remaining binding turns all six red.

The source-level manifest loses fifteen mentions, which is the change and not a regression.

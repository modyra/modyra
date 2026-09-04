---
"@modyra/lit": patch
---

The unbound-element warning waits for the page to go idle, not for a count of frames.

An element appended and never bound paints nothing, and without a word it looks like a broken library
rather than a missing line — so `@modyra/lit` says so. It waited three animation frames first, on the
reasoning that a host binding on a later frame is doing nothing wrong.

**Three frames is a count, and a count is a guess about how fast a machine is.** Measured on the
browser tier: the spec that appends an element and binds it one frame later is green three times out
of three on an idle machine and red inside the full suite. The spec is identical in both runs, so what
the deadline was measuring was the load — and the element was told nobody had bound it by a page that
had. A warning that says something untrue about the element it names is worse than silence, because it
exists to be believed.

Idle is a boundary rather than a number: the page has finished the work it had, so an element still
unbound is one nobody is going to bind. A host that offers no idle callback keeps the frames it always
had, and a page that never goes idle never hears this at all — silence, which is the safe side of a
warning that cannot be sure.

**The threshold did not vanish; it became variable, and that is worth knowing.** On a quiet page
`requestIdleCallback` fires almost at once, so a host that waits more than a frame or so before
binding still hears the warning; on a busy page idle arrives late, which is why an ordinary
create-append-bind order is no longer told off under load. Measured: never bound → warned, bound after
one frame → silent, bound after five frames on an idle page → warned. The warning is now inversely
patient with load, which is the intent — an element still unbound when the page has finished its work
is one nobody is going to bind — but it is a threshold the page decides rather than one the code
states.

Verified where it can be: the tier runs the spec alone *and* inside the full suite, and green in both
is the criterion. Green alone was the state this repairs.

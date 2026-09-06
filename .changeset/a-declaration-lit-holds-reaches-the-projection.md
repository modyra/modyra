---
"@modyra/widgets": major
"@modyra/lit": patch
---

A declaration changed after the mount reaches the projection in Lit

A controller's projection is a memoized computed owned by the runtime that owns the field handle. A
declaration Lit holds as a reactive property is invisible to that runtime, so writing one invalidated
nothing and the projection kept answering with whatever it had when it last ran. Supporting text set
after the mount never arrived; a timepicker told to wear the other clock kept the first one.

**The defect hid behind a coincidence, and only a sequence found it.** Two components wiring the same
option the same way looked identical read statically, and one of them worked — something in its
settle happened to touch a signal, so its projection recomputed for an unrelated reason. That is a
derivation agreed in *time* rather than in data: two paths that coincide until you put them in the
same run. The three lines that decided it:

    at rest                    names the errors
    after setting the words    names the errors                       <- nothing moved it
    after any value change     names the errors and the description

Lit now keeps a counter in the handle's own runtime — not a second one, because a second reactivity
is a second owner — and every declaration it passes a controller is read through `declared()`, so the
projection depends on it. A declaration that skips that wrapper is read once and frozen, which is why
the test asserts the middle line on two different options rather than one.

**`format` is read rather than captured.** `MdyTimepickerFieldControllerOptions.format` accepts a
getter as well as a value. Callers passing a value are unaffected; classified major because code
reading the option's type as `MdyTimeFormat` no longer type-checks, which is a narrow but real break —
unlike a widening the audit reports for caution, this verdict has a core.

---
"@modyra/core": minor
---

A reactivity the engine cannot use is refused at the door

An adapter whose signals lacked `asReadonly` produced `hasDraft.asReadonly is not a function`, thrown
inside `MdyFormEngine` — a file its author has never opened, naming a local variable that means
nothing to them.

The engine now says what is missing and which interface owes it:

    This reactivity is missing a member the form engine needs:

        signal().asReadonly() — hand out a view that cannot be written through,
        required by MdyWritableSignal

That second interface is the part a compiler does not catch: `asReadonly` is declared on
`MdyWritableSignal`, not on `MdyReactivity`, so an adapter can satisfy the interface it implements
in full and still hand back signals the engine cannot use.

What is required was measured rather than assumed. `effect` and `capabilities` are **not** demanded:
a reactivity that runs no reactions is supported — the engine degrades and reports it through the
diagnostics sink — and demanding them would have turned a documented fallback into a crash. A core
test does exactly that, and refused the first draft of this check.

`missingReactivityMembers` is exported for an adapter author who wants the same answer before
handing their adapter to a form.

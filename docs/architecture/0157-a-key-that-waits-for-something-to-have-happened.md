# ADR 0157: A key that waits for something to have happened

Status: Accepted

## Context

The keyboard table says three things about a binding beyond the key itself: **where a person is**
(`on`), **what phase the overlay is in** (`when`), and **what the field is able to do** (`requires`).
Between them they covered every key the library had, until the way back gained one.

`Ctrl`/`Cmd`+Z puts back the last destructive change. On a field where nothing has been removed there
is nothing to put back, so the key correctly does nothing — and from outside **a key that does nothing
because the moment is wrong is indistinguishable from a key nobody implemented.**

A sweep that presses every declared key on a plainly declared control found it and reported it
unanswered. That sweep is right to exist and right to refuse the obvious fix: arranging state for a
widget so its keys have something to act on answers a gentler question than the one asked, and this
project has watched that shortcut turn four reds into two by hiding a finding rather than repairing
anything.

`requires` does not cover it, and the difference is not a nicety. It names a **capability** — a
document turned reordering on, and it stays on for the life of the field. This is something that
**happened**, and stops being true again the moment it is used.

## Decision

**A binding may name the transient state it waits for: `awaits`.**

```
requires   a capability the field has, for as long as it has it     "reorderable"
awaits     something that has happened and can stop being true      "wayBack"
```

The value is the state as the kind's own reader names it, so a field can be asked about it directly
rather than through a second vocabulary that has to be kept in step.

What follows from a binding naming one:

- a check may **arrange the state before pressing**, or count the key as **unreached** rather than
  unanswered — the same two outcomes `requires` produced one axis over;
- a legend or help panel says **when** the key applies rather than promising it always, because a key
  listed like the others reads as broken to anyone who presses it in a fresh field;
- a renderer answers the key only while the state holds, which is what it already had to do.

## Consequences

The table now has two words for two kinds of precondition, and someone will reach for the wrong one.
The test is whether the answer can change while nobody touches the document: a capability cannot, a
state can.

`MdyKeyBinding` grows an optional member, so every reader of the type sees it. Anything that copies
bindings without carrying `awaits` produces a table that promises a key unconditionally — the state
this record exists to leave behind.

It does not make the key discoverable. A person still has to be told the shortcut exists; `awaits`
tells them *when it will work*, which is a smaller thing than *that it is there*.

## Alternatives rejected

**Widen `when` to name this phase.** It is the closest fit — `when` already means "only in this
situation" — and it would put one concept in one place. It is also read by `keyBindingFor` as the
overlay's phase, so a value that is not an overlay phase would make the binding unreachable through
the accessor every renderer uses: a declaration that exists and can never be resolved, which is the
exact defect `on` was added to end.

**Reuse `requires`.** One word for both would be smaller, and it would make a capability and a moment
answer the same question — so a check arranging "reorderable" and a check arranging "something was
just removed" would look identical and one of them would quietly not be arrangeable.

**Declare the key unconditionally and let the sweep carry a list of exceptions.** The list is a copy
of the table, kept somewhere else, going stale on the first binding that moves. This project has
found that shape five times.

**Drop the binding and let the button be the only way.** The button sits at the field's trailing edge
and a removal leaves the reading position among the chips, so the way back would be reachable only by
someone who has already walked to it — for whom pressing it was never the hard part.

## Verification

`npm run contract:diff` classifies the declaration, and the battle sweep over every declared key is
what asked the question: with `awaits` it can tell a key that waits from a key that is missing.

The renderers' own answer is checked by `e2e/shared/a-way-back-the-record-promises.spec.ts`, which
presses a key that is **not** the gesture first and requires the value **not** to come back — without
it, "the value returned" is satisfied by anything that restores it.

**What is not checked here**: that a renderer honours `awaits` rather than happening to. Three
renderers guard the offer themselves; nothing fails if one stops reading the declaration and keeps
its own condition. That is the residual risk this record leaves.

## Security and privacy

None. A precondition on a keystroke changes nothing about what is stored, sent or shown.

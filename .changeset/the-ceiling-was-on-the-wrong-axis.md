---
"@modyra/core": minor
---

The layout nesting limit rises to 32, because it was on the wrong axis

`MDY_LAYOUT_MAX_DEPTH` was six, on the argument that nobody answers a question whose applicability
depends on six earlier answers. ADR 0160 stated that plainly so it could be contradicted, and it has
been: the argument is about **conditionality** and the constant limits **arrangement**.

Six nested sections are "Address → Billing → Registered office". Measured, the field at the bottom of
them is active, visible and conditional on nothing — there is no memory cost because there is no
earlier answer to hold. Meanwhile a chain of eleven rules, each gating on the answer before it,
mounts with no refusal at all: the axis the argument defends was never limited.

The cap stays, at 32, as what it was really doing — a bound against a structure arriving from outside
that would otherwise drive unbounded recursion through a parse. It remains a constant for the reason
it always was one: a limit an attacker's input can raise is not a limit.

**Migration.** A structure between seven and thirty-two levels now mounts where it was refused.
Nothing that was accepted becomes refused. A consumer reading the constant rather than writing `6`
follows this without editing anything.

ADR 0161 supersedes 0160, which is kept: its reasoning is what makes the new record legible, and the
argument it makes would justify a limit on rule chains, where there is none today.

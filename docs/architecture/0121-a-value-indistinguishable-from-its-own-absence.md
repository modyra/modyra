# ADR 0121: A legitimate value must not be indistinguishable from its own absence

Status: Accepted

## Context

Four defects in one evening's work on the timepicker's dial shared a shape, and none of them was
caught by a unit test — every one had a suite that agreed with the wrong answer.

- **An empty list of dimmed arcs.** A face whose granularity removes nothing correctly has none, and
  a face that was never measured also produced none. One renderer never drew the dimming at all, for
  weeks of nothing, and every test agreed because `[]` is a real answer.
- **A radius read from a stylesheet.** `getComputedStyle(el).getPropertyValue("--tp-hand-length")`
  returns an unresolved `calc()`, so `parseFloat` gave `NaN` and the guard beside it fell through to
  half the face — a plausible number, 28% wrong, used by every hit test in the widget.
- **A ring from an unread rectangle.** A hit test handed the wrong kind of object answered `"outer"`
  at every radius including zero, which reads as a plausible sweep rather than as a broken call.
- **A hand of full length at the centre.** `pointerReach > 0` put a pointer at the exact middle in
  the same branch as a pointer nobody measured, and that branch answered "the full hand".

Each is a different bug. The shape is the same: **a guard that asks whether a value is usable when
what it needs to know is whether the value is present.** `0`, `[]`, `NaN` and `"outer"` are all
legitimate answers to *some* question, so the fallback fires silently and produces something a reader
cannot tell from a real result.

This will keep happening. Geometry code is full of quantities whose zero is meaningful — a radius, a
count, an angle, an index — and the idiom `x > 0 ? real : fallback` is the natural way to write a
guard in a language where `0` is falsy.

## Decision

**A guard distinguishes presence from value.** Where zero, empty or `NaN` is a value the domain can
legitimately hold, the check is whether the caller supplied something — `=== undefined`, `in`, an
explicit sentinel — not whether what they supplied passes a truthiness or positivity test.

Where the two cases genuinely differ, they get **separate branches with separate answers**, and both
are asserted separately. `handLength <= 0` means *no geometry known* and may answer with a default;
`pointerReach === 0` means *geometry known perfectly* and must answer `0`. Collapsing them is the
defect, not the fallback.

**A fallback that can be reached by a real input is a defect until proven otherwise.** When a guard
has a fallback, the check that covers it must show that the fallback is unreachable from any value
the domain admits, or name the values that reach it.

## Consequences

Guards get longer and read less naturally: `pointer !== undefined` beside `hand > 0` is two
conditions where one used to do. That is the cost, and it is the point — the two conditions are two
questions.

Some of these are only findable by measuring the real thing. `--tp-hand-length` parses in no browser
and there is no type error to catch it; the arcs' emptiness is correct in one case and wrong in
another that looks identical from inside the function. **A unit test written by the same person who
wrote the guard will share its assumption**, which is why all four survived their own suites.

What tends to catch them: a **property over the domain** rather than a case. Monotonicity caught the
ghost's floor — coming inward may never lengthen the hand — and it holds against any future fallback
that reintroduces the same thing at another radius, which a test of the single point would not.
Two-sided assertions catch the arcs: *none* where nothing is removed, *some but not all* where
something is.

## Alternatives rejected

**Forbid fallbacks.** A face with no stylesheet loaded has no rings for an answer to be wrong about,
and refusing to answer would take the widget away over a condition nobody can act on. The fallback is
right; sharing a branch with a real value is not.

**Make the sentinel explicit everywhere — `null` for "not measured".** Better in principle and it
would have prevented three of the four. It also means every geometry function grows a nullable
parameter and every caller a conversion, for a distinction that `undefined` already expresses in the
options objects these functions take. Where a function takes positional numbers rather than options,
this is still worth doing.

**Treat it as four bugs.** They were four bugs. Recording them as one shape is what stops the fifth,
and the fifth is coming — the idiom is not going to stop looking natural.

## Verification

There is no single check for a shape. What is enforced instead, per instance:

- `packages/widgets/test/time-granularity.spec.mjs` asserts the ghost's reach is monotonic across the
  whole radius and that an unmeasured face is a separate case with its own answer;
- the same file asserts the arcs two-sidedly — none for a face that removes nothing, some but not all
  for one that does;
- `packages/widgets/test/css-properties.spec.mjs` holds `MDY_TIMEPICKER_NUMBER_SIZE` and the ring
  fraction against the stylesheet, so a constant cannot drift from the paint it describes.

The radius-from-`calc()` case has **no unit-level guard** and cannot have one: it depends on how a
browser resolves a custom property, which jsdom does not model. It is covered only by the browser
tier, and only for plain and lit — Angular has no host, which is finding 325.

## Security and privacy

None directly. Worth one line for a reader who arrives from a security review: the shape is a
correctness hazard rather than a trust one, but the same idiom in a *permission* check — `if
(allowed > 0)` where `0` means "explicitly none" and `undefined` means "not evaluated" — inverts to
open rather than to closed. Nothing in this repository does that today; the rule above is the one
that keeps it that way.

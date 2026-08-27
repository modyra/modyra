# ADR 0161: The nesting limit was on the wrong axis

Status: Accepted

Supersedes [ADR 0160](0160-six-levels-of-nesting.md).

## Context

[ADR 0160](0160-six-levels-of-nesting.md) capped layout nesting at six and stated its reason as a
claim about people, deliberately and in the open:

> nobody answers a question whose applicability depends on six earlier answers

It also said, in as many words, that stating it plainly was what made it falsifiable — that anybody
with evidence to the contrary would have something specific to contradict. The evidence arrived, from
inside this repository, and it holds.

**The argument is about one axis and the constant limits another.** Applicability depending on
earlier answers is *conditionality*: a chain of rules, each gating the next. `MDY_LAYOUT_MAX_DEPTH`
limits *arrangement*. Measured — a layout six deep with no rules at all:

```
depth 6   groups traversed = 6   field rendered = 1
          disabled = false       hidden = false
          names a reader hears: [Section 1 … Section 6]
```

The field is active, visible and conditional on nothing. There is no memory cost because there is no
earlier answer to hold. Six nested sections are "Address → Billing → Registered office", not six
questions in a chain.

**And the axis the record defends is not defended at all:**

```
a chain of 11 rules, each gating on the answer before it
  → mounted, no refusal, 12 fields drawn
```

No constant limits rule chains. `MDY_MAX_EXPRESSION_DEPTH = 32` bounds the depth of a single
expression, which is a different thing.

So the state 0160 left behind was:

```
arrangement   the cheap axis, whose cost is audible immediately   capped at 6
conditionality  the axis the argument is about, cost invisible    unlimited
```

0160 is not wrong in its reasoning. It is wrong in its target — and the reasoning it wrote would
justify a limit on rule chains perfectly well.

## Decision

**`MDY_LAYOUT_MAX_DEPTH` is 32, and it is a guard against hostile input rather than a limit on how
much a form may ask.** It bounds recursion through a structure that arrived from outside — a stored
document, a configuration fetched at runtime — which is the one thing 0160's cap was genuinely
protecting, recorded there under Security and privacy and true independently of the argument that
has now failed.

It stays a constant for the same reason it always was one: a limit an attacker's input can raise is
not a limit.

**The refusal keeps every shape 0160 gave it.** A function call throws, a document drops the
arrangement and reports it, a bound input drops it and says why. That part of 0160 survives intact
and is the reason this record supersedes rather than replaces it.

**Depth has a real cost, and it is not the one 0160 named.** A person using a screen reader traverses
one group name per level before reaching the question. It is linear, and — the difference that
matters — **audible on the first encounter**, where a memory cost is invisible. A limit is not the
instrument for a cost somebody can hear coming.

## Consequences

- **A structure between seven and thirty-two levels now mounts.** That is the point, and it is a
  behaviour change: a document refused yesterday is accepted today. Nothing that was accepted becomes
  refused.
- **The human argument is now homeless, and it was a good argument.** Rule chains have no limit and
  the reasoning that would justify one is written down in 0160, which is why that record is
  superseded rather than deleted. Whether to act on it is open; this record does not decide it,
  because a limit invented alongside a retraction is a limit nobody measured.
- **The announcement cost is unguarded.** Nothing today asserts that a reader traverses a bounded
  number of group names before the question. At six it could not get far; at thirty-two it can. This
  is the check this decision owes and does not yet have.
- **`test:contracts` classifies the change as a patch**, because the constant is exported and its
  value is not part of the shape the contract snapshot records. A consumer reading the constant
  rather than writing `6` follows it without editing anything, which is why it was worth exporting.

## Alternatives rejected

**Leave it at six.** Requires defending the number with the argument that has just been shown to be
about something else, or with the measurements — and the measurements say nesting is free. Neither is
available.

**Remove the cap entirely.** What the user asked about first, and it loses on the one thing the cap
was really doing: a generated document nesting five hundred deep would recurse through a parse with
nobody noticing, and the announcement cost would be unbounded as well. Removing it discards a real
guard along with a mistaken one.

**Make it configurable.** Rejected in 0160 and still rejected, for a reason the retraction does not
touch: whoever raises it is by definition whoever it has just blocked, deciding in the moment for
their own branch. And as a guard against hostile input, a caller-supplied bound is worse than none —
the input that would exceed it is the input that would raise it.

**Move the cap to rule chains in this record.** Tempting, symmetrical, and wrong to do here. The
number would be invented in the same breath as the retraction of a number that was invented, with
nothing measured about where chains actually become unanswerable. The argument is preserved in 0160;
the limit needs its own evidence.

## Verification

`a-ceiling-one-door-keeps` reads `MDY_LAYOUT_MAX_DEPTH` rather than spelling a number, and checks the
cap and one past it whatever the cap is — so it followed this change without being edited. That is
the property that made this record cheap to write, and it is worth stating: a check that spells the
number it is checking has to be revisited every time the number is right to change, and the revisit
is where a check quietly stops matching the rule.

`assertLayoutWithinDepth` is measured at the cap, one past it, and well past it, with `undefined`, an
empty layout and a non-layout as the control cases that must stay silent.

**What is not verified**: the announcement cost named above. Recorded as owed rather than left to be
discovered.

## Security and privacy

This is now the decision's main purpose rather than a side effect, which is the substantive change
from 0160. The cap bounds recursion over a structure that may arrive from outside the application, so
it is what stops a hostile or corrupt document from driving unbounded recursion during a parse.
Thirty-two is far above any authored structure and far below anything that threatens a stack.

Nothing else moves: no personal data is involved and no trust boundary changes. The one rule that
must not be relaxed is the constant staying a constant — an input-supplied bound would be defeated by
exactly the input it exists to stop.

# ADR 0205: A document declares in two channels, and only one of them validates

Status: Accepted

## Context

A field says two different kinds of thing about itself, and until now they travelled by whatever
road each renderer happened to take.

**Rules judge a value.** `min`, `maxLength`, `pattern`, `required` — the engine builds a validator for
each, the projection composes them onto the control as native attributes, and a value that breaks one
is refused with a message.

**Other declarations draw the control.** A slider's `step`, a `placeholder`, the name a control has
where nothing captions it. None of them judges anything, and the engine refuses to build a validator
for them: asked for a `step` rule it answers *"no validator declares the name `step`"*.

That refusal is not a gap in the vocabulary. `nativeConstraintAttributes` already states the thesis
from the other side: a slider's `step` is **dropped** where it would move the thumb off the value the
field holds — *the affordance gives way to the value*. A rule cannot do that. A rule that a value
breaks makes the value invalid; it does not quietly stop applying.

The consequence was invisible until the conformance kit was asked to prove a bound reached its
control: the section could ask for everything a validator can express, and nothing else. A Vue slider
shipped with its `step` never reaching the platform, and no check in the repository could have been
written to catch it, because the only channel a check could speak through was `rules`.

## Decision

What a document declares travels in **two channels**, and the conformance kit asks about both.

**`rules`** carries what validates. The engine builds it, the projection composes it, and
`nativeConstraintAttributes` decides which of them a kind's own control can carry.

**`config`** carries what a document declares so the widget can be drawn — today `step`,
`placeholder` and the accessible name. A fixture receives them as the field's own properties, which
is how a document states them, and the kit's section *Declarations that are not rules reach the
control* asks whether they arrived.

An adapter opts in by exporting `declaresConfig`, exactly as `declaresRules` already works, and a
config that does not is reported as not run rather than as passing.

## Consequences

Two channels are two things an implementer must know about, and the boundary between them is a
judgement — "does this judge a value" — rather than a list. The ADR is the place that judgement is
written down; a declaration added to the wrong channel will be asked the wrong question.

The kit gains a section that can only ask what a fixture forwards, so an adapter that accepts `config`
and silently drops it reads as conformant. That is the same exposure `declaresRules` already carries,
and the same answer: the section names what it asked, and the count is in the report.

The accessible name is read as a **name**, not as an attribute. `aria-label` is one of four ways an
element gets one, and the reference renderer uses a different one for two of its kinds — a caption
element carrying the words, associated by `for`. A check reading the attribute reported those two as
nameless, which is a renderer a browser announces correctly accused by a check looking in one place.

## Alternatives rejected

**Promote `step` to a validator rule.** It would give one channel instead of two, and it is wrong on
its own terms: the door that draws a step already documents that it gives way to the value, and a
rule that gives way is not a rule. It would also widen the public vocabulary this close to 1.0 and
open a question no document is asking — whether a value off the step is *invalid*, with everything
that follows for messages, submission and cross-field rules.

**Its condition for coming back**: a document that needs to *validate* a step rather than draw one —
to refuse a value off the grid rather than snap the thumb to it. That is a rule, it belongs in the
vocabulary, and it gets its own record.

**Ask nothing, and leave `step` to the browser tier.** The behavioural question — does the thumb land
on a multiple — is a legitimate browser check and remains one. It is not a substitute: a jsdom
section can ask whether the declaration reached the control at all, which is the half that was
missing and the half that shipped broken.

## Verification

`npm run test:conformance` runs the section for every config that exports `declaresConfig`. Removing
the accessible name from the reference renderer's shell turns it red for four kinds, naming what each
control is announced as instead; restoring it turns it green. A kind whose control can carry none of
these declarations is skipped rather than ticked, and the count of kinds asked is printed.

What it does not guard: an adapter that never opts in. Its line says "not run", which is the same
honesty the rules channel already offers and not a check.

## Security and privacy

None. The channel carries presentational declarations a document already states; it adds no data
flow, no persistence and no trust boundary.

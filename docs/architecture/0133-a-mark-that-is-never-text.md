# ADR 0133: A chip's mark is drawn, never written

Status: Accepted

## Context

A chip's buttons — remove, and the two steppers a counter chip carries — are drawn with an accessible
name and nothing to see:

```
plain      button text ""    aria-label "Remove"
lit        button text "×"   aria-label "Remove"
angular    button text "×"   aria-label "Remove"
```

A person using a pointer meets a blank square in one renderer and a character in two, and the three
disagree about which. This is the first of six points raised about the closed control and the last of
them still open.

There is **no icon system in the repository** to draw from. Building one — symbols published by the
contract and reusable by every widget — is the sounder long-term answer and is explicitly not this
decision: it touches every kind, and the mark is needed now.

## Decision

**The mark is drawn by CSS — a `mask` or a background on the button — and is never a character in the
button's text.**

Two reasons survive scrutiny, and one that was argued at the time does not; all three are recorded
because the refuted one was the *deciding* argument when the choice was made, and a reader who finds
only the survivors will not understand why this was ever contentious.

**It survives a theme.** A mark in CSS is a theme's to change without touching a renderer. A character
in markup is a renderer's, and the next theme that wants a different glyph has to ask three renderers
for it — which is how `mdy-chip--counter` came to be named in one place rather than spelled three ways.

**Three renderers agreeing is not a contract.** Today the chip carries an explicit `aria-label`, so
nothing reads the `×` out. That is a decision each renderer currently makes the same way, and nothing
holds it. A mark that is never text cannot be read out by accident whether or not that agreement lasts.

## The argument that was wrong, and was the reason at the time

The decision was made on this: *the chip's accessible name is composed from its text content, so a `×`
inside the button joins it and a reader says "Opzione A 2 ×" unless somebody remembers to exclude it.*

Measured, that is not what happens:

```
           chip textContent   chip aria-label   button text   button aria-label
plain      "Roma"             "Roma"            ""            "Remove"
lit        "Roma ×"           "Roma"            "×"           "Remove"
angular    "Roma×"            "Roma"            "×"           "Remove"
```

The chip declares an explicit `aria-label`, which wins over its content, and so does the button.
Nothing reads the `×` out.

The reasoning was sound about names composed from content; this name is not composed from content. It
was passed to the implementer as the deciding argument and acted on, and the correction was sent before
anything was built on it. The decision stands on the two reasons above, which were always true and were
not why it was taken.

## Consequences

Every theme owes the mark. A theme that styles a chip and forgets it produces the blank square this
record exists to remove, and there is no text underneath to fall back to — which is the cost of the
choice and is worth stating plainly.

`forced-colors` mode strips background images. A mask survives it where a background does not, so the
mark is a `mask` where the two are equivalent — the same reasoning that made an edge gradient
insufficient for the overflow cue in
[ADR 0127](0127-a-strip-that-scrolls-against-the-practice.md).

## Alternatives rejected

**A character in the button's text**, which is what two renderers do. It is free and it is a renderer
deciding what a remove button looks like, in three places, with a glyph a theme cannot change.

**An icon system now.** The right answer and the wrong time: it is a contract addition touching every
kind, and it would hold six UI points behind one of them.

**An SVG per renderer.** Same defect as the character with more markup: three copies of a shape, and a
theme still cannot change it.

## Verification

`a-closed-control-a-person-can-read.spec.ts` asserts that each of a chip's buttons **paints something**
— a background, a mask, or generated content — and deliberately not that it paints a particular glyph,
because the mark belongs to the theme and a spec naming one would go red on a theme that chose
differently. Red in all three today.

The check that fails if this is satisfied in letter and violated in spirit: a renderer putting the glyph
back as text while also painting one would pass the paint assertion. **That gap was named here and is
now closed** — the same spec asserts each button's text is empty, beside asserting that it paints. The
two are separate expectations on purpose: painted-and-written is not a partial success, and a single
combined assertion would report which half failed less clearly than two report it.

## Security and privacy

No impact.

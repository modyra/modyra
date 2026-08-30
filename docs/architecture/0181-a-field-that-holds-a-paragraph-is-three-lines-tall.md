# ADR 0181: A field that holds a paragraph is three lines tall, and says so in lines

Status: Accepted

## Context

Every single-row field in the library takes its height from the control scale, which [ADR
0136's rule in `DESIGN.md`](../../DESIGN.md) settled: a kind is inside the row system when its
height comes from that scale, and a control carrying a height of its own is the defect.

A multi-line text field is the one kind that cannot answer to it. It exists to be taller than one
row, and none of the four steps — 28, 36, 44, 56 — is the height of a paragraph.

Nothing filled the gap, so each renderer answered separately: two of them draw three lines, one draws
two. Same line height, same padding, same minimum: 2 × 24 + 16 = 64 against 3 × 24 + 16 = 88. The
divergence is durable rather than accidental, because **the contract has no place to state it.**
There is no `defaults` concept anywhere in the widget catalogue, and a document's field schema has no
row count, so no renderer could have read the number even if one had been decided. A rule wired to
nothing is not a rule, and three implementations wrote three answers because none was published.

The number cannot be chosen by counting renderers. Two of three drawing the same thing is what a
majority looks like, not what a reason looks like, and the majority here is one commit away from
being the minority.

## Decision

**A multi-line text field shows three lines of text at rest, and its resting size is stated in lines
of its own text rather than in a length.**

Both halves are load-bearing.

*Three*, because two lines are not yet a different shape. The eye reads a two-line box as a one-line
box that came out wrong — a measurement error, not an invitation — and the affordance the field
exists to offer is invisible until the box is taller than a row can plausibly be. It is also the
number a browser draws when nobody says anything, which makes it the value every published design
system corrects upward for exactly this reason.

*In lines*, because a resting size exists to show **how much text fits**, and how much text fits is
measured in lines of that text at the size it currently has. A length in pixels says "three lines" at
a 16px body and "one and a half" at 32px — it stops saying the thing it was written to say precisely
when a person has enlarged their text, which is when it matters most. The native `rows` attribute
carries this meaning and the platform resolves it against the current text size; a height token
cannot, because a token is a length.

A field's resting size is therefore not always a style-layer question. Where a height is a control's
size, the scale owns it; where a height is *an amount of text*, the text owns it.

## Consequences

- The multi-line field is **outside the row system by declaration**, not by omission, and the check
  that asks whether a kind is inside it in every renderer or outside it in every renderer now has an
  answer for this kind instead of a divergence.
- The library keeps a height that no token controls. A theme that moves the scale moves every other
  field and does not move this one — correct, and surprising to anyone who reads only `DESIGN.md`,
  which is why this record exists.
- Three renderers each write the number, because the contract has nowhere to publish it. That is
  agreement held by a test rather than by a declaration, and it is the weakest part of this decision.
  A contract slot for kind defaults would fix it and is not opened here: it would add a concept every
  consumer must learn and 1.0 must keep stable, for one integer. If a second default ever needs
  stating, that is the moment the slot becomes cheaper than the repetition, and this paragraph is the
  argument for opening it.
- A field that grows as a person types is compatible with this and is not decided here. If it is
  built, the resting size is its floor: growth that shrinks back below three lines while text is
  deleted moves the page under the hands that are typing, which is the thing the growth was meant to
  avoid.

## Alternatives rejected

**A height token on the style layer**, `--mdy-textarea-height`, consistent with every other field.
Rejected on the accessibility argument above: a length stops meaning "three lines" at the moment a
person enlarges their text. This was the intended decision before the interaction question was asked
outside the project, and the outside view reversed it — recorded because the reasoning is what a
future reader needs, and because the pull toward "one more token, like all the others" will recur.

**A fifth step on the control scale.** The scale is a scale of *control* sizes, and `DESIGN.md`
already states the test: would moving the scale move this? A paragraph's height should move with the
reader's text, not with a theme's control density. Adding the step would also make every theme that
moves the scale silently reflow every multi-line field.

**Two lines, matching the platform default.** It is the value the platform picks when nobody decides,
which is the definition of an undecided number, and it is the one a person cannot tell from a
single-row field.

**Leaving it to each renderer and asserting nothing.** The status quo, and the reason this record
exists: the same document produces a visibly different form in two of three renderers.

## Verification

`battle-tests/browser/a-row-system-three-renderers-disagree-about.spec.ts` fails when the kinds do
not agree in height across the three renderers, which is what caught this. It does not assert the
number three, nor that the size is stated in lines — a run in which all three renderers switched to a
fixed 88px height would pass while breaching the second half of this decision.

That gap is real and named rather than papered over: what guards the second half today is this record
and review, not a check. Closing it needs a check that enlarges the page's text and asserts the field
grew with it, which is the honest instrument and does not exist yet.

## Security and privacy

None. The resting height of a text field carries no data, crosses no trust boundary, and is visible
to anyone who can already see the form.

## Sources

The interaction question — how many lines a multi-line field must show before a person reads it as a
place for a paragraph — was put to an accessibility and interaction specialist outside this project,
described in ordinary words with no reference to this repository. Its answer was three, in lines
rather than in a length, with the enlargement argument above and a ceiling of four in a form of mixed
fields. It is cited as evidence, not as authority: the reasoning is restated here because "the
outside view said so" is a citation and not a rationale.

# ADR 0120: A picker that offers only some of the times

Status: Accepted

## Context

A booking form takes appointments every fifteen minutes; a shift planner takes them every five before
noon and every thirty after. The times in between are not invalid in any general sense — they are
simply not on offer at this field, which is a property of the field rather than of time.

A validator cannot express it. A validator refuses a value after it is chosen, and what is needed is
a control that does not offer it: a dial drawing minutes nobody may pick, arrows walking through
them, and a refusal arriving only at submit is four surfaces disagreeing about one rule.

The declaration also has to survive being written in a JSON document, sent by a server and read back,
which rules out a predicate.

## Decision

**A field declares which times it offers, as data, and every route into the value obeys it.**

```ts
granularity?: {
  minuteStep?: number;   // must divide 60
  hourStep?: number;     // must divide 24
  windows?: readonly { from: string; to: string; minuteStep: number }[];
}
```

- **A window's step overrides the field's** rather than composing with it. Composition has no answer
  when 5 and 15 disagree, and the narrower rule winning is what a reader expects.
- **A window is half-open** — `from` inclusive, `to` exclusive — so adjacent windows tile with
  neither a gap nor an overlap to refuse, and nobody writes `to: "11:59"`.
- **A declaration that cannot be honoured is refused where it is written**, by name. `minuteStep: 7`
  offers 0, 7 … 56 and then jumps four minutes into the next hour, so the rule its author wrote is
  not the one the field would enforce; a picker merely behaving oddly at 56 past sends them looking
  in the wrong place. The field is kept and the granularity dropped: taking the form away over a
  refinement removes something the user can see, over a rule they cannot.
- **Nothing is ever rounded.** A value already off the step — chosen before the rule changed, or sent
  by a server that does not share it — is kept, shown as it is, and reported invalid so `canSubmit`
  is false (ADR 0063). Stepping off it lands on an offered value *in the direction of travel*,
  because stepping is how a user leaves a value the field will not take.
- **Absent means every time**, so nothing that exists today moves.

Four routes reach the value and one rule governs all of them: the face draws only offered numbers,
the arrows and the dial's own keyboard move by the step, a typed entry off the step is refused as
`"off-step"` — distinct from `"out-of-range"`, because *"there is no 61st minute"* and *"this field
takes quarter hours"* are different sentences — and a dragged pointer lands only where
`acceptTimeField` would agree.

## Consequences

`MdyTimeFieldBounds` gains a required `step` and `MdyTimeRejection` a third member; both are breaking
for a caller that constructs bounds or switches exhaustively, and neither is for one that reads them.

The validation lives in `@modyra/core`, not `@modyra/widgets`, because a document is parsed before
anything renders it. `@modyra/widgets` re-exports the same names.

**A drag lands on the nearest *offered* value, not the nearest drawn number.** Those are different
sets and conflating them is the defect this record exists to warn about: a minute face has twelve
positions and a minute field has sixty values, so picking from the drawn list silently turned every
ungranulated picker in the library into a five-minute one. What must hold is that no angle, at any
step, reaches a value the field would refuse.

Known and deliberate: on a coarse face `PageUp` can land where `ArrowUp` lands — five steps of
fifteen minutes is seventy-five, which wraps to fifteen. A page is whole steps rather than a fixed
distance, because a page of five *minutes* would be smaller than one arrow press. Capping the page to
the offered count would remove the coincidence and is a number nobody has asked for.

An arbitrary rule — "every 7 minutes except Tuesdays" — cannot be expressed at all. That is the cost
of a declaration that survives serialisation, and it is the right trade while the alternative is a
callback no document can carry.

## Alternatives rejected

**A predicate.** Expressive and unserialisable. A document could not carry it, a server could not
send it, and the JSON schema could not describe it — so the capability would exist only for consumers
writing TypeScript by hand.

**Rounding an off-step value to fit.** It silently answers a different question from the one that was
asked, about a value somebody chose or a server sent. ADR 0063 already settled this for the same
reason in a different place.

**Refusing the whole field when its granularity is unhonourable.** It takes the form away over a
refinement: the user loses a control they can see because of a rule they cannot.

**Letting a step not divide its unit.** It produces a rule the author did not write, and the place it
shows is 56 minutes past the hour — as far as possible from the line that caused it.

## Verification

`packages/widgets/test/time-granularity.spec.mjs` and `timepicker-granularity.spec.mjs`: the
resolution and its refusals, the four routes, and two properties that hold at every step —

- **no face draws a number the field would refuse**, swept over ten hour steps and six minute steps,
  both formats, both rings. A drawn number that is refused is a press that does nothing, which reads
  as a broken dial rather than as a rule;
- **no angle reaches a value `acceptTimeField` would refuse**, swept over five granularities × both
  formats × both rings × 360°.

`packages/core/test/dynamic-diagnostics.test.mjs` drives `MDY_DYNAMIC_UNHONOURABLE_GRANULARITY` from
a document that must produce it.

Not covered: what a dragged hand *feels* like. No tier renders Angular in a browser, and a drag under
real pointer capture is not something jsdom produces. The demo section is the instrument for that,
and it is a person, not a check.

## Amendment: which ring a press claims

A 24-hour face draws two rings and the pointer's distance from the centre decides which one it
claims. Three rules were tried against a person using it, and the two that failed are worth keeping
because each was right about something:

- **everything inside the midpoint is inner** — the first. Most of a dial's area is empty middle, so a
  press aimed at the outer ring answered with an inner hour and the hand jumped short for it;
- **a symmetric band around the inner radius** — the second. It fixed that and introduced the
  opposite: the centre answered *outer*, so a pointer moving inward crossed outer → inner → outer and
  the hand snapped to the far ring exactly where its numbers are furthest away;
- **one edge, above the inner radius only**, at `MDY_TIMEPICKER_RING_BAND` of the gap between the two
  painted radii. This is the decision.

It is one-sided and will read as asymmetric: **below the inner ring there is no other ring to belong
to.** The outer ring is outside the inner one, so everything beneath the inner digits is nearer them
than anything else on the face and has exactly one plausible answer.

The geometric construction that looks obvious — midway between the facing ends of the two digit
boxes — cannot decide it. A box is `MDY_TIMEPICKER_NUMBER_SIZE` wide and the rings are exactly that
far apart, so the boxes touch: the gap is zero and its midpoint is the edge itself, whatever the box
size. Where the edge belongs *inside* that touching pair is a judgement, which is why the constant is
a published fraction rather than an expression — one number a person can move without touching the
rule.

## Security and privacy

None. A granularity is presentation and validation over a value the form already holds; it moves no
data and crosses no trust boundary. One note for a reader who might assume otherwise: it is **not** a
security control. A field offering quarter hours still accepts any time a server sends, keeps it, and
reports it invalid — the rule constrains what this control offers, not what the value may be.

# ADR 0082: A commit word answers for the control a person types in

Status: Accepted

## Context

`MDY_VALUE_CONTRACTS` publishes a `commit` column with two words and their meanings written beside
them: `live` — *every interaction writes through* — and `confirm` — *the field only changes on an
explicit confirmation; interaction edits a draft*. Sixteen kinds said `live`, one said `confirm`, and
nothing had ever compared the column against a widget.

Two kinds disagree with it, in different ways.

**A daterange is neither word.** Measured in both renderers: choosing one endpoint writes nothing, and
choosing the second writes both.

| | one endpoint | two endpoints |
| --- | --- | --- |
| plain | `{start: null, end: null}` | `{start: "2026-08-03", end: "2026-08-07"}` |
| lit | identical | identical |

It is not `live` — the first click does not write. It is not `confirm` — there is nothing to confirm,
no OK and no Cancel. And the behaviour is deliberate: `completeRange()` exists to call
`{start, end: null}` incomplete, and a core battle already pins the transition returning
`commit: undefined` until both ends are there.

**A colours field has two controls that commit differently.** The native swatch emits `input` and each
choice arrives immediately; the hex box beside it holds `#11` and writes on blur or Enter. Both are
right — `#11` is not a colour, and a field that took it would hold something nothing can show — and
one word per kind cannot say both.

The controls are the datepicker and the timepicker, measured in the same run: the first writes on the
interaction, the second discards on Cancel and writes on OK. So the column is enforceable and the two
kinds above are the ones that disagree, rather than the column being unreadable.

## Decision

**`MdyValueCommit` gains `complete`:** the field changes when what the user is building becomes a
value at all. That is the daterange, and it is the sentence `completeRange()` already makes from the
value's side.

**The word answers for the control the label names** — the one a keyboard reaches and types into. A
kind may draw a second affordance beside it that writes as soon as it is used; the column says what
the *typed* control does, because that is the one a person can leave half-finished, and half-finished
is the only state where the question has two answers.

**`colors` is therefore `confirm`, not `live`.** The hex box is what the label points at and what a
keyboard types into. The swatch beside it is a second way in, and the guide's sentence for `confirm` —
interaction edits a draft — is exactly what typing `#11` does.

## Consequences

**Adding a member to a published union breaks an exhaustive `switch`.** The type-surface audit
classifies it major and agrees with the reading.

**`colors` changes its published answer without changing behaviour.** Anything that branched on
`MDY_VALUE_CONTRACTS.colors.commit === "live"` now takes the other branch — and was previously being
told something untrue about the control it was branching for.

**The column is now a statement about one control per kind, not about the kind's every element.** That
is a real loss of precision, chosen over the alternative: a `commit` per part would put a second
vocabulary in the catalogue and make the common case — *when does this field change* — a lookup with a
question in front of it. Where a kind's second affordance matters, the kind's own contract already
names its parts.

**Two of the hunter's browser assertions move**, deliberately: they read the declared word rather than
hard-coding one, which is what makes a change to the table a change to the test.

## Alternatives rejected

**Declare `commit` per part.** It is the honest granularity and the wrong trade. Every consumer asking
the ordinary question would have to know which part they mean, to answer something that differs for
one kind in seventeen.

**Call the daterange `confirm`.** There is no confirmation to make. A word that sends a consumer
looking for an OK button that does not exist is worse than no word.

**Call colours `live` and treat the hex box as the exception.** It makes the column true for the
affordance a mouse uses and false for the one a keyboard uses, which is backwards: the typed control
is the one whose intermediate states exist.

**Leave the table and change the widgets.** A daterange that wrote a half-range would write a value
`completeRange()` calls incomplete; a hex box that wrote per keystroke would hold `#11`. Both
behaviours are right and it is the label that is wrong.

## Verification

- `battle-tests/browser/when-a-value-becomes-the-value.spec.ts` — reads the declared word and drives
  the widget in both renderers, so the table and the behaviour cannot drift apart silently.
- `battle-tests/adversarial/lifecycle/half-a-range-is-not-a-range.battle.test.mjs` — the core half:
  the transition answers `commit: undefined` until both endpoints exist.
- `node scripts/audit-type-surface.mjs` — the new member classified major.

## Security and privacy

None. When a value reaches the model, not what may be in it or where it goes.

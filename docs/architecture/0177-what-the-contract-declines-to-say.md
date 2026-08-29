# ADR 0177: The second door, and what the contract declines to say

Status: Accepted

## Context

Three findings survived every repair because none of them is a defect in a renderer. Each is a place
where all three renderers agree and the contract is silent, and a sweep reading the contract reports
the silence as a divergence — forever, because there is nothing to fix.

```
a-panel-a-pointer-opens-undeclared   4 parts open a panel; the tables name only the first opener
a-part-drawn-that-nothing-asks-for   35 rows: optional parts with no condition, drawn by some
file's control named two ways        plain by the caption's `for`, the others by `aria-label`
```

An exemption argued in a conversation is not an exemption: the house rule is that a check reads it
from the document that makes it. Without one, a row stays red and the reasoning erodes.

## Decision

### The second door is declared

**A kind may name one part a pointer opens its overlay from, beside the opener that carries the
relation.** The calendar button beside a typeable date, the clock beside a typed time, the box a
multiselect's chips sit in, the swatch beside a colour: `alsoOpensFrom`.

It carries **no relation**. `aria-expanded` and `aria-controls` belong to the part that holds the
value — one control says whether the overlay is showing, and a second element claiming it announces
two comboboxes for one list. The declaration says a pointer may open from here, which is what a check
needs in order to press it and what a renderer needs in order to know it owes it.

Three renderers answering a press that nothing asked for is the evidence: the door worked everywhere,
and any of them could have dropped it with every suite green.

### An optional part with no condition is the renderer's choice, and that is a decision

`presentWhen` says *when* a part is on the page. A part that is optional and declares no condition is
saying something different and deliberate: **whether to draw it is the renderer's, and the contract
will not adjudicate.** `errors` and `supportingText` are the cases — a renderer may reserve the band
under every field or build it when there is something to say, and both are correct.

`partIsOwed` already answers `false` for such a part, which is the rule in code. This is the record
that says it is a rule rather than an omission, so a checker can stop reporting thirty-five rows about
a question the contract declines to answer.

The line, for a part that arrives later: if two renderings would tell a person different things, the
part owes a condition. If they differ only in what is in the document, it does not.

### Naming a control by the caption's reference or by its words is one answer, not two

Plain names a file field's control through the caption's `for`; lit and Angular carry the caption's
words in `aria-label`. Both resolve to the same words and neither leaves the control unnamed, so this
is redundancy across renderers and not a divergence a person can hear.

Converging them would mean changing what `projectFieldShellA11y` emits for **every kind** — a blast
radius out of all proportion to a set difference in a sweep. Dismissed with the measurement: the ids
match, the caption is drawn, and both mechanisms name the same element.

This does **not** license two names on one element. A control carrying `aria-labelledby` *and*
`aria-label` says only the first, which is ADR 0175's finding and remains a defect.

## Consequences

The first decision adds a declaration and closes three rows by making the door checkable. The second
and third close rows by stating that the question has an answer and the answer is "either" — which is
worth less than a fix and more than a permanently red row nobody can act on.

The risk in the second: "the contract declines to say" is a phrase that can absorb any inconvenient
divergence. The line above is what stops it, and it is a judgement rather than a test — the honest
weakness of this record.

## Alternatives rejected

**Give the second door the full relation.** Two elements carrying `aria-expanded` for one overlay
announce two comboboxes; a reader hears the field twice and neither instance is the one holding the
value.

**Declare a condition for `errors` and `supportingText`.** It would make one of two correct renderings
wrong. The conditions that exist — `errorsAreVisible`, `fieldCanBeInvalid` — describe when the
*content* is there, which is a different question from whether a renderer reserves the box.

**Leave the three as known-red.** They are not known-red; they are questions with answers, and a
baseline that carries them says the suite found something when it found a silence.

## Verification

`packages/widgets/test/a-part-owed-and-a-part-gated.spec.mjs` asserts that every declared second door
names a part the kind has, is not the opener, and is not the controlled element. Four kinds declare
one today and the check says so, so a kind losing its declaration fails rather than passing quietly.

Not verified here: that each renderer actually opens from the part it now declares. The press is a
browser-tier gesture; this record declares what to press and does not claim the presses were made.

## Security and privacy

No impact. A declaration of an existing gesture, and two statements about what the contract does not
decide.

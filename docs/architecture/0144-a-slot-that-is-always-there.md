# ADR 0144: A slot that is always there

Status: Accepted

## Context

Removing a value from a multiselect offers one way back, on a row under the control. The row existed
only while the offer stood, so it appeared and disappeared with the offer — and everything below the
field moved 21px each time. Measured on the three renderers with a text field beneath the multiselect:

    plain    the field below moves y=164 → y=185
    lit                             y=140 → y=161
    angular                         y=140 → y=161

Remove three values and the page steps down three times. A person reaching for the next control with
a pointer misses it; a person who had just read it has to find it again. It is worse than a control
that is permanently taller, because a fixed cost is learnt once and a moving one cannot be learnt at
all. The same band is where a validation message goes, so an error and a way back also competed for
one region, and the error was the one that lost.

The obvious repair — put the offer *inside* the control, where there is already room — moves the
defect onto the other axis: the clear-all and the caret slide sideways as the offer arrives.

## Decision

**The way-back row is always in the page, and reserves one line whether or not anything is offered.**
Its contents are what come and go: at rest the sentence and the undo button are `hidden`, so there is
nothing to read, nothing to announce and nothing to press, and the band's height does not change when
they arrive.

The row is a sibling under the field, never inside the control's box. Both axes are fixed: nothing
below the field moves vertically, and nothing at the field's trailing edge moves horizontally.

The reservation is `min-height: 1lh` on the row, so the band is one line of the row's own text — the
line the sentence will occupy — rather than a number that has to be kept in step with the font.

## Consequences

Every multiselect is one line taller than its control, always, including one nobody will ever undo
anything in. That is the cost, and it is the cost this decision chooses deliberately over a cost that
moves.

An empty landmark-free row sits in the DOM of every multiselect. It carries no role and no text at
rest, so it adds nothing to a reader's traversal, but it is one more element in every snapshot and in
every structural count.

`1lh` is the modern unit for this and is supported by the browsers the suite runs (Chromium, Firefox,
WebKit). A renderer targeting an older engine would collapse the band and take the defect back.

The row's document order is now load-bearing: it is always present, so it is always compared against
the contract's part order, which puts `wayBack` before `popup`. Angular's template had the row after
its overlay panel, which was invisible while the row was conditional and became a conformance failure
the moment it was not.

## Alternatives rejected

**Leave the row conditional and animate its arrival.** Motion does not fix a moving target; it makes
the moment the target is elsewhere longer, and `prefers-reduced-motion` removes it entirely.

**Show the offer inside the control's box.** Fixes the vertical shift and creates a horizontal one:
the clear-all and the caret move as the offer appears. Asserted against, at an unchanged `x`.

**A floating toast.** An undo that takes itself away after a few seconds is a time limit under WCAG
2.2.1 with no exception available to it, and a toast also detaches the offer from the control it
belongs to.

**Reserve the band with a fixed pixel height.** Correct until the font size moves, and then either a
gap or a second shift; the row's own line box is the honest measurement.

## Verification

`battle-tests/browser/nothing-below-a-field-moves-when-a-value-goes.spec.ts` drives a removal through
the control a person would press, in all three renderers, and asserts both axes: the field below at
an unchanged `y`, and the clear-all and caret at an unchanged `x`. It was red for all three before
this decision and is green for all three after.

Part order is checked by the widget DOM conformance suites — `npm run test:angular` and
`npm run test:conformance` — which report `PART_ORDER:popup` when the row is placed after the popup.

## Security and privacy

None. The row carries a sentence naming a value the person just removed, which is data they entered
and are looking at; reserving its space changes nothing about what is stored, sent or exposed.

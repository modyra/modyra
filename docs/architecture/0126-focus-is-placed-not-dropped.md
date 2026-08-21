# ADR 0126: Focus is placed, not dropped

Status: Accepted

## Context

Removing a chip destroys the element that has focus. Measured across the three renderers before this
was settled:

    plain      removing a middle chip → the document body     removing the last → the document body
    lit        removing a middle chip → the next remove button removing the last → the document body
    angular    removing a middle chip → the document body

A person navigating by keyboard is returned to the top of the page after every removal and has to
travel back. It is invisible to anyone testing with a pointer, and invisible to a check that removes a
chip and then asserts on the value — both of those passed throughout.

Lit's split is the important reading. It caught the middle case and dropped the last one, which is not
a half-finished implementation: focus was **landing** on whatever occupied that index after the DOM
settled, rather than being **placed**. That works while a next chip exists and fails at the end of the
strip.

The first pin written for this asserted only that focus stays inside the field. That is a threshold, and
a threshold is what an accidental implementation satisfies — lit satisfied it half the time by
coincidence.

## Decision

**After a chip is removed, focus goes to the next chip; if there is none, to the previous one; if the
strip is empty, to the control's trigger.**

The rule is stated once, in `@modyra/widgets`, and every renderer asks it. It is not three
implementations that agree today.

The same rule governs any removal path — the chip's own button, `Backspace` on a focused chip under
[ADR 0125](0125-a-chip-strip-is-one-thing-to-a-keyboard.md), or a programmatic change to the value.

## Consequences

Every renderer needs the DOM to have settled before it places focus. Lit needed a second
`updateComplete`: the first settles a render already scheduled when the value changed, so the strip is
still the old one and focus lands on the chip *after* the one removed rather than the one that took its
place. That is the same shape as the timepicker's focus command and takes the same repair.

Placing focus means the control now decides something the browser used to decide by accident, which is
the point — but it also means a renderer that forgets to ask has a silent defect rather than a visibly
broken one, because focus will still land somewhere.

## Alternatives rejected

**Keep focus on the strip itself.** One rule, no edge cases, and it loses the person's place: after
removing the fourth of twelve they are at the start again.

**Focus the previous chip always.** Simpler to state and wrong at the front of the strip, where it
means "leave the strip" after removing the first chip.

**Assert only that focus stays within the field.** This was the first pin and it is what this record
exists to replace. It is a floor, not a design, and each renderer invents its own rule underneath it —
which is exactly what the measurements above show.

## Verification

`four-holes-in-a-control-that-holds-many.spec.ts` asserts the rule at three positions: a middle chip,
the last chip, and the only chip. The last two are what separate placed focus from fallen focus, and an
implementation that satisfies only the middle case fails.

**The check passed vacuously before it was guarded, three times.** Focus falling to the body reads the
focused chip's label as `null`, and the expected label is `null` too when there is no chip to expect —
so the comparison succeeded by matching nothing against nothing. A premise assertion now requires the
expected chip to have an accessible name before the comparison is allowed to mean anything. A stricter
assertion is not automatically a stronger one.

## Security and privacy

No impact. Focus placement moves no data and grants no capability.

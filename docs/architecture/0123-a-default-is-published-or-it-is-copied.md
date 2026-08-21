# ADR 0123: A default is published, or it is copied

Status: Accepted

## Context

ADR 0116 chose the 24-hour clock for every renderer. It recorded the choice and left the *answer*
written out in four places:

    angular  timepicker-renderer.component.ts   input<MdyTimeFormat>("24h")
    angular  timepicker-clock.component.ts      input<MdyTimeFormat>("24h")
    lit      timepicker-field.ts                this.format = "24h"
    plain    timepicker-field.ts                format: MdyTimeFormat = "24h"

Four copies agreeing is indistinguishable from one answer until the day the decision moves, and then
it is four decisions, three of which nobody remembered to change. The same batch found the proof: two
copies of the *view* default had already drifted past ADR 0116 — Lit's resting state and Angular's
clock component still opened on the twelve-hour clock — and every test passed, because each renderer
was handed the right value explicitly by whatever wrapped it. A default is only read when nothing
else answers, which is exactly the path tests do not take.

`MDY_TIMEPICKER_INITIAL_VIEW` existed and showed the shape working. There was no constant for the
format at all.

A second pressure arrived from the same direction. `viewMode` was a controller option and a widget
state, so the library could open a picker on the number boxes and **nothing outside the library could
ask for it**: no document member, no renderer input. The capability existed and was unreachable.

## Decision

**A default that more than one renderer needs is published as a constant, and the renderers read it.**
`MDY_TIMEPICKER_DEFAULT_FORMAT` joins `MDY_TIMEPICKER_INITIAL_VIEW` in `@modyra/widgets`, and all four
sites point at them.

`DEFAULT_` and not `INITIAL_`, beside a constant that is the other word: the view is initial — a
person toggles it and closing restores it — while the format does not change once the field is drawn.
Two lifetimes, two words, and the name says which.

**A capability a document cannot reach is not a capability.** `MdyDynamicDateField` gains
`viewMode?: MdyTimepickerViewMode`, timepicker only, absent opening on the dial. It travels the six
stops `format` travelled: the typed member, the parser's refusal, the known-members table, and the
three published JSON schemas. Each of the three renderers gains the matching input.

The type is declared in `@modyra/core` and re-exported by `@modyra/widgets`, the way
`MdyTimeGranularity` already is. A document names the view, and a document is parsed before anything
renders it, so the engine owns the vocabulary and the widget contract borrows it. A second
declaration beside the renderers would be a second answer to which views exist.

**The same name outside and inside.** `viewMode` is what the contract published, and it is what the
attribute is called. `view=` would read better and would need a mapping, and a mapping between two
names for one thing is where the two come to disagree.

## Consequences

Additive throughout: an optional document member, two constants, one function, three inputs. No
existing document or call site changes meaning.

**Angular's clock kept a parallel copy and had to stop.** It held `viewMode` as its own signal, so a
picker told to open on the boxes opened on the face and the controller's restore-on-close reached
nothing. It now takes the view as an input and reports the toggle as an output; the controller
decides. This is the third instance this month of a renderer holding a second copy of state the
contract owns, and the first that a document member made visible.

`timepickerPlaceholder` is published for the same reason one field over: the hint was
`format === "24h" ? "HH:mm" : "hh:mm AM/PM"` in two renderers and **absent in the third**, so one
document told a person what to type in two adapters and nothing in the other.

**The Angular renderer overrun ceiling moves from 707 to 728.** The rule in
`renderer-overrun-baseline.json` is that the number may only fall, and it holds; this is the second
recorded exception and it has the same cause as the first, written down for the same reason. Twenty-one
lines is a `viewMode` input on two components with the documentation this repository requires. What
was available to give back was given: the clock's local signal is gone, and both new doc comments were
cut to their invariant. The alternatives — deleting the documentation, or moving an inline template
into an `.html` the audit does not count — remain refused.

## Alternatives rejected

**Leave the four literals and document the rule.** A rule that lives only in prose is what ADR 0116
already tried; two of the four copies had drifted from it before this batch opened.

**A renderer input without a document member.** It would serve a hand-written host and leave Studio,
a document from a server, and every dynamic renderer with one view — which is the position the format
was in until two commits ago.

**`view` as the public name.** Prettier as an attribute, and a second name needs a mapping.

## Verification

- `packages/core/test/dynamic-diagnostics.test.mjs` — `MDY_DYNAMIC_UNOPENABLE_VIEW`, a view that is
  not one of the two.
- `npm run test:type-surface` — `MdyDynamicDateField.viewMode was added (optional)` and
  `timepickerPlaceholder is newly exported`, both classified minor.
- Measured in the browser across the three renderers: a document declaring `viewMode: "input"` opens
  on the number boxes and one declaring nothing opens on the dial; toggling to the other view,
  closing and reopening returns to the **declared** view in all three, which is what
  `timepicker-field-controller.ts` promises and what nothing outside it asserted.

## Security and privacy

None. Which of two views a picker opens in is what a person sees; the value is `HH:mm` either way and
no boundary moves.

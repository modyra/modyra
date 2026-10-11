# ADR 0213: A time picker is complete without a clock face

Status: Accepted

## Context

A time field opens a panel. Three renderers draw an analog clock face in it: a hand to drag, the
hours and minutes around a ring, and a switch to the typed boxes. A fourth draws only the two typed
hour and minute boxes, plus confirm and cancel. Three browser specs measure the face: the hand's
length matches the ring it points at, unavailable hours are dimmed on the face, and the dimming sits
under the hand. Each fails on the renderer that draws no face, and the failures were listed as known
reds that needed a decision.

The contract does not settle it in one voice. The timepicker's `required` list is `toggle` and
`container`. `clock`, `dialFace`, `dialHand`, `dialNumber` and `modeToggle` are declared but optional
in the canonical anatomy. [ADR 0145](0145-a-dial-that-repeats-what-a-box-already-says.md) makes the
face a redundant pointer surface: it is hidden from assistive technology because the boxes already
say and accept the value. The comment above the timepicker's definition reads the other way ("the
clock is the picker"), but it argues that a drawn dial must use the declared anatomy, not that the
dial must be drawn.

The outside view (WCAG 2.2 SC 2.5.7 and 2.1.1; the Material 3 dial and input variants; Flutter's
`inputOnly` mode; the WinUI and iOS pickers, which have no dial) agrees on the first half. A panel of
typed or stepped boxes is a complete time picker, and a face is an optional enhancement that must
never be the only input. It adds one point: a library that promises one field should offer the same
modes in every toolkit, unless the developer chooses a different mode deliberately.

## Decision

The clock face is optional in the timepicker contract. It is not added to `required`. A renderer that
draws only the typed boxes and the confirm and cancel actions draws a complete timepicker. A renderer
that does draw a face uses the declared anatomy, and the face is never its only input, as ADR 0145
states.

The face's absence is a contract-conforming state, not a defect. A spec that measures the face
measures it on the renderers that draw `dialFace`. On a renderer without a face, the spec has nothing
to judge for that host, and skips it rather than failing.

A renderer that draws no face still owes parity with the others. The difference is recorded as
product debt to close, not as an accepted permanent divergence.

## Consequences

- Vue's timepicker conforms as written. The three dial reds stop being contract questions. Until the
  specs are changed to skip hosts without a face, they stay on the known-red list, which records no
  reason per row.
- Because the face remains optional, nothing in the suite forces a renderer to draw it. Parity across
  toolkits, which the outside view asks for, rests on the debt being worked rather than on a check.
  That is the cost of keeping the public surface small.
- A renderer may open on the typed boxes rather than the face.
  `MDY_TIMEPICKER_INITIAL_VIEW = "dial"` holds only where a face exists.

## Alternatives rejected

- **Require `clock` and `dialFace`.** This adds to what every renderer and every future adapter must
  ship, and to what 1.0 must keep stable. It contradicts ADR 0145, which keeps the face redundant to
  the boxes. It would also make a typed-only picker non-conforming, although published practice calls
  that complete.
- **Declare a "boxes only" variant (ADR 0017).** A variant is a configuration a consumer chooses. A
  renderer omitting the face is not a consumer's choice, so a variant would name the gap without
  closing it, and would add public surface.
- **Bless the difference permanently.** The outside view's point about one field behaving the same
  everywhere is the reason the absence stays debt.

## Verification

- `packages/widgets/src/testing/canonical.ts` lists the face parts as optional, and the conformance
  suite asserts each renderer against the canonical anatomy. Adding `clock` to `required` without
  superseding this ADR changes that file and the contract snapshot (`npm run contract:diff`).
- The dial specs (`battle-tests/browser/a-hand-that-says-which-ring.spec.ts` and
  `a-dimming-that-covers-the-hand.spec.ts`) do not yet skip hosts without a face. Until they do, the
  vue rows in `battle-tests/reports/known-red-browser.json` are the only guard, and nothing keeps a
  renderer that dropped its face from looking like this case.
- *Amendment, 2026-10-10.* Both dial specs now skip a host only when two conditions hold:
  `battle-tests/browser/bench.ts` lists it in `HOSTS_WITHOUT_A_CLOCK_FACE`, and the open panel is
  the complete typed one (`aPickerWithoutAFace`: two segment inputs, two actions, and no face or mode
  toggle). A renderer that drops its face without being listed is red. A listed renderer whose
  picker failed to open, or that draws a toggle leading nowhere, is red too. The list is where the
  parity debt is recorded, so removing a host from it measures that host's face again. Emptying the
  list turns the three vue rows red, which was checked when the skip was added.

## Security and privacy

None. This concerns the presence of a visual pointer surface. No data or trust boundary is involved.

# ADR 0225: Escape leaves the calendar view it is in

Status: Accepted

## Context

A datepicker's and a date range's popup has three views: the days, the months and the years. The
months and years replace the day grid while they are shown. The kind declares `Escape` as a
dismissal (`intent: "cancel"`, `restoresFocus: true`), and the renderers read that one binding two
ways. Lit and Angular answer it by leaving the view on screen: a month or year view goes back to the
days, and only the days close the popup. Plain and Vue answered it by closing the popup from any
view. Two people pressing the same key on the same field saw different things depending on which
renderer drew it.

Asked as a behaviour question with three answers — Escape returns to the previous view and a second
Escape closes; Escape always closes; leave the divergence — the outside view (TypeSafe, 2026-10-11)
chose the first at 92%, "always closes" at 8%, and the divergence at 0%. This matches the convention
that Escape undoes the innermost thing that was opened: the month view is opened from inside the
popup, so it is the first thing Escape takes away.

## Decision

In every renderer, the dismissal that keeps the key (`restoresFocus: true`, today `Escape`) answers
the view before the panel. In the month or year view it shows the days, keeps the popup open, and
moves focus onto the day grid's tab stop, or onto its first choosable day when that tab stop is not
in the month on screen. In the day view it closes the popup and returns focus to the opener, as
before.

The rule lives in each renderer's view-stepping handler, which is answered before the panel's own
dismissal and consumes the press, so no other listener closes the panel with the same key.

## Consequences

- The four renderers agree on Escape in every view.
- A person in the years view needs two presses of Escape to close the popup. The first undoes the
  view, which is the documented cost of this convention.
- Plain's view-stepping handler stops the press's propagation when it takes Escape. A listener above
  the field that expects every Escape pressed inside it no longer hears this one, and that is the
  intent: the press has been answered.
- The rule is held by four renderers, not by the controllers. The controllers' `keydown` intent still
  closes on Escape whatever the view, so a fifth renderer that forwards Escape without asking the view
  first closes the popup again.
- `Tab` is still read two ways. Lit and Angular send any `cancel` from a wider view back to the days,
  `Tab` included. Plain and Vue leave `Tab` to the browser there. This decision does not settle that
  difference.

## Alternatives rejected

- **Escape always closes the popup.** Simpler, and one press is enough from any view, but the person
  loses the whole popup when they only meant to back out of a view they opened by mistake. The outside
  view ranked it at 8%.
- **Leave the divergence.** Breaks the rule that the widgets contract is the same behaviour in every
  renderer. Ranked at 0%.
- **Move the rule into the controllers' `keydown` intent.** This would be one place instead of four,
  and it remains the better long-term home. It changes what `keydown` does for every renderer, though,
  and Lit and Angular already answer the view before they forward the key. Moving it is a separate,
  contract-level change.

## Verification

- `packages/vue/test/a-calendar-that-leaves-its-days.test.mjs`: Escape on a month brings the days
  back, keeps the panel open and puts focus in the grid, and a second Escape closes the panel. Fails
  if the branch is removed, and fails if the focus landing is not armed.
- `packages/plain/test/a-view-a-key-can-change.test.mjs`: the same, for both kinds. Fails if the
  branch is removed, and fails if the press is not stopped before the panel's dismissal.
- Lit and Angular are guarded by their existing calendar tests. No cross-renderer test compares the
  four renderers' answers to Escape in a wider view, so a drift in one of them is caught only by that
  renderer's own suite.

## Security and privacy

None. The change is keyboard handling inside a popup. It reads and writes no data and crosses no
trust boundary.

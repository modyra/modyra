# ADR 0197: A panel opens on what it is for

Status: Accepted — amended 2026-09-03, see Consequences

## Context

Opening a panel is a question every overlay widget answers: where does the person land?

Five kinds already answered it the same way in all three renderers, without anything saying they
must. A select lands on its filter box, a datepicker and a daterange on a day, a timepicker on the
hour, a colours field on a swatch. One rule, followed privately five times: **the primary operable
unit of the panel takes focus**, because it is what the person opened the panel to operate.

The sixth had three answers. Measured, in the same configuration each time:

```
multiselect, filter box present    plain: the box   lit: the trigger   angular: the box
multiselect, no filter box         plain: the first option   lit: the trigger   angular: the trigger
```

So a person met different muscle memory depending on which adapter their team had chosen — the same
failure the timepicker's opening view was declared to end, and its file says so in those words.

Both patterns are legitimate for a combobox: focus may stay on the control with
`aria-activedescendant`, or move into the list. That is what made the divergence survive — every
renderer was defensible on its own, and no two were the same.

## Decision

**Focus enters the panel, on the part the contract names.** `focusPartOnOpen(kind, { searchable })`
answers it: the filter box where there is one, the first option where there is not; a day for the two
calendars, the hour for the timepicker's opening, a swatch for colours; `null` for a kind that opens
no panel of ours.

For the multiselect specifically: **not the chip, and not the trigger.** A chip is the affordance for
*removing* a choice, so opening a list to choose and landing on the control that deletes one is the
right element at the wrong moment. Staying on the trigger is the alternative pattern, and it loses to
the five kinds already in the house: consistency inside one product beats the abstract legitimacy of
the other pattern, which is the argument `timepicker-focus.ts` already makes for itself.

The part is **named**, not selected. The parts exist in the catalogue, and a renderer choosing its own
selector is a renderer that can disagree with the contract about where focus went.

## Consequences

- For five kinds this is a declaration and not a change: nothing moved to make them conform, and the
  checks that now assert it passed the moment they were written.
- Lit moves focus into the panel for the multiselect, in both configurations, where it kept it on the
  trigger.
- **Amendment, 2026-09-03: Angular does not follow this yet for a multiselect with no filter box, and
  that is recorded here rather than left to the code.** The change was made and reverted the same
  morning: moving focus to the first option took the keyboard away from the element this renderer
  binds type-ahead to — `onOverlayKeydown`, whose condition is `!searchable()` — so a person typing a
  letter moved nothing, which a browser battle caught on the published head. Before the batch, focus
  stayed on the trigger by *omission* rather than by decision: the reference the old code focused is
  `undefined` when there is no filter box. Angular keeps that behaviour until the keyboard is answered
  from wherever focus is; the departure is asserted in
  `packages/angular/src/lib/renderers/multiselect/a-panel-opens-on-what-it-is-for.spec.ts` so it cannot go quiet, and the
  condition for rejoining is that type-ahead stops depending on where focus happened to stay.
- The decision above is unchanged. What this amendment records is that its adoption is partial, and
  where.
- A person using a keyboard reaches the options with no extra press, in every renderer.
- A renderer that wants the activedescendant pattern for a kind now has to argue it here rather than
  implement it quietly. That is the cost, and it is the point — and the amendment above is that rule
  applied to this record's own author: the departure was argued in a comment and a test first, which
  is not the place this sentence names.

## Alternatives rejected

- **Leave focus on the trigger everywhere** — the activedescendant pattern, applied uniformly. It is
  a coherent answer and it loses to the five kinds already shipping the other one: the change would
  be larger, it would move behaviour people already rely on, and it would win nothing a keyboard user
  can feel.
- **Let each kind keep its own answer, and only document it.** That is the state this record ends:
  every answer was documented in the renderer that held it, which is why three of them disagreed.
- **Focus the first chip on a multiselect with no filter box** — what one renderer did. It puts the
  person on the control that removes a value at the moment they asked to add one.

## Verification

Three benches, one per renderer, asserting focus landed on the part the contract names:
`packages/plain/test/a-panel-opens-on-what-it-is-for.test.mjs` covers every kind that opens a panel and both
multiselect configurations; the Lit and Angular ones cover the kind that changed.

Each states the configuration beside its assertion, because a multiselect with a filter box and one
without are different questions — reading two such runs as one answer is how three renderers looked
like three opinions when two were being asked something else.

Each also asserts the panel opened and the opener held focus **before** reading where focus went: in
a DOM without a real pointer, a `click()` does not focus the element it hits, so a run that only
pressed reports "focus is on the document" about a control that is fine.

## Security and privacy

None. Where focus lands inside a panel the person opened changes no value, no stored data and no
trust boundary.

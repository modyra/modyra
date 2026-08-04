# ADR 0018: A select declares whether it filters

Status: Accepted

## Context

One widget, three behaviours, and one of them broken. Measured across the adapters:

| | search box | focus on open | typing does |
| --- | --- | --- | --- |
| `@modyra/plain` | **always** | into the search | filters |
| `@modyra/angular` | when `searchable` | into the search, when searchable | filters |
| `@modyra/lit` | rendered, never focused | **stays on the trigger** | **matches one character** |

Lit dispatches `{ type: "search", query: e.key }` per printable key and the controller *replaces* the
query, so typing `mar` searches `m`, then `a`, then `r`. A typeahead can never match more than one
character. Plain appends a filter box unconditionally, so a five-option select gets a search nobody
asked for and focus lands in it rather than on the list.

Nothing caught any of it. `testing/canonical.ts` states that a combobox *may* keep focus on its
opener **or** move it into a search, so the contract has no opinion and all three conform — including
the one that is broken.

**The root cause is that `searchable` was not contract data.** It was a component input in Lit and
Angular and did not exist in Plain or in the Dynamic Form Contract, which is precisely why Plain
could not honour it. A renderer cannot implement a distinction it has no way to read.

## Decision

**A select declares whether it filters, and the declaration selects one of two interaction models.**

`searchable?: boolean` on the option-based field config, defaulting to `false`.

**`false` is a listbox.** No filter box. Focus stays on the trigger. Typing accumulates into a
typeahead buffer that jumps to the first option whose label matches the accumulated prefix.

**`true` is a combobox.** Focus moves into the search input when the list opens. Typing filters.

**Both drive the list with `aria-activedescendant`**, rather than moving focus into it — which is
what makes the trigger remain the thing a screen reader is reading in either model.

**The typeahead buffer clears on a 1s idle timeout**, and on Escape, selection, close and blur. The
timeout is what makes it a buffer rather than a growing string: without it, typing `mar`, pausing,
then typing `co` searches `marco` and finds nothing.

**It is contract data, not a renderer input**, because the alternative is what the table above shows.
A behaviour that every adapter must agree on has to be readable by every adapter, and both SDKs carry
it for the same reason: a document that loses it describes a different control.

## Consequences

- **`@modyra/plain` stops rendering a search box unconditionally.** That is a visible change for any
  select that did not ask for one, and it is the point of the decision rather than a side effect.
- **`@modyra/lit`'s typeahead starts working.** The single-character bug is a consequence of the
  replace-not-accumulate controller path, and the shared buffer is what fixes it in one place.
- **Two models is more surface than one**, and the alternative was worse: no model, three behaviours,
  and a conformance suite that blesses all of them.
- **A renderer must now implement both**, including the typeahead, which is new work for the
  non-searchable path in Angular. The rule itself lives once in `@modyra/widgets`, so what each
  renderer owns is feeding it keystrokes and reading the result.
- **`canonical.ts`'s permissive statement about focus becomes wrong** where it used to be honest: the
  contract now has the opinion it lacked, and the equivalence check should assert per model rather
  than admit either.

## Alternatives rejected

**Leave it a renderer input and document the difference.** What exists today. Rejected because it is
not a documented difference, it is an undocumented one — the divergence was found by measurement, not
by reading, and one of the three behaviours is a defect nobody had noticed.

**One model for everyone: always a combobox.** Simplest contract, and it forces a filter box onto
every select including a three-option one, where a search is noise and the typeahead is what a user
expects. Rejected on the same ground as always-a-listbox: a select with forty options genuinely wants
filtering.

**Infer the model from the option count.** A threshold nobody can predict, changing behaviour when
data changes. Rejected: a control that becomes a different control because a list grew is worse than
either fixed answer.

**Put the typeahead in each renderer.** Rejected on the evidence that produced this record — three
renderers implementing one behaviour produced three behaviours, and the one that diverged silently
was the one nothing checked.

## Verification

- `packages/widgets/test/typeahead.spec.mjs` — the buffer, its idle timeout and its explicit clears,
  with an injected clock so the suite needs no fake timers.
- Per renderer, in a browser: real keystrokes, asserting the active option. **A shared buffer proves
  the algorithm and not that three renderers feed it**, which is the failure this record exists to
  prevent and would be reproduced exactly by testing only the rule.
- The 1s timeout observed rather than assumed: type, wait past the interval, type again, and assert
  the second query did not inherit the first.
- `npm run contract:diff` classifies the field.

## Security and privacy

None. `searchable` selects an interaction model over options the host already supplies; nothing is
stored, transmitted or parsed differently, and no trust boundary is touched.

The accessibility impact is the substance. Both models keep the reading position on the trigger via
`aria-activedescendant`, and the defect this record fixes — a typeahead that matches one character —
is one that affects only users who do not point at what they want.

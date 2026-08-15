# ADR 0067: A track spans what the field holds

Status: Accepted

## Context

A slider has to span something to be drawn at all. Where a document declares no range, the contract
takes the one a bare `<input type="range">` assumes — 0 to 100 — and says so in
`nativeConstraintAttributes`, *"which is why it is decided here and not left to each renderer to
remember"*.

Both renderers remembered it anyway, separately:

```
packages/plain/src/fields/text-field.ts     offered().max ?? 100
packages/lit/src/components/slider-field.ts this.max ?? constraints.max ?? 100
```

And the default turned into a misrepresentation. A form holding `150` with **no** bound declared drew
a track ending at 100 and put the thumb there:

| | the form holds | the page shows | `aria-invalid` | said |
| --- | --- | --- | --- | --- |
| no bound declared | 150 | **100** | false | nothing |
| `step: 5` | 7 | **5** | false | nothing |

The second row is the platform snapping a range input to a multiple. Neither is a rule: the document
declared no bound, and the validator vocabulary has no `step`, so there is nothing to appeal to and
nothing said. A person sees a slider at its maximum and sends three times that.

[ADR 0066](0066-a-bound-beside-the-field-is-a-rule.md) closed the declared-bound half — a value past a
declared `max` is now refused with a message. This is what is left where nothing was declared.

## Decision

**A track spans what the field holds.** `sliderTrack(constraints, value)` returns the range a slider
is drawn on: the bare-input default where nothing is declared, widened to include the value.

**Widened only where nothing was declared.** A document that declared `max: 50` keeps it. The
attribute is the native guard and must not promise less than the rules it came from
([VAL-004](../../battle-tests/charter/claims-under-test.md)), and since ADR 0066 a value past it is
refused with a message — so the page *explains* the difference rather than hiding it. Where nothing
was declared there is no rule to explain anything, and showing the value is the only honest answer
left.

**A step that would move the thumb is dropped.** `step: 5` with a value of 7 draws at 5, and there is
no step rule to appeal to. The affordance gives way to the value: an increment is a convenience,
showing the number the form holds is not.

**One source for the drawn fill and for the attributes.** Both renderers take the track from the same
function, and Lit's element offers it as its own narrowing so the projection and the painted fill
cannot disagree.

## Consequences

A slider with no declared bound and a large value now draws a track that reaches it, so the thumb
moves as the value changes instead of sitting pinned at the end. The drawn range is no longer a
constant a stylesheet or a screenshot can rely on.

`step` disappears from the attributes while the value is off-grid and comes back when it is on one.
A keyboard user arrowing from an off-grid value moves by 1 until they land on a multiple.

`nativeConstraintAttributes` and `MdyFieldShellA11yOptions` take an optional `value`. Both are
additive; a caller that omits it gets the previous behaviour, which is correct for every kind that
does not draw a track.

**Template order became load-bearing in Lit.** A range input clamps its value to the bounds it
carries at the moment of assignment, so the value must be set *after* the part applies `min`/`max`.
It is stated where it matters, because the failure is invisible in review: the attributes are right,
the value is right, and the rendered control is wrong.

## Alternatives rejected

**Widen the track even where a bound is declared.** It shows the held value everywhere, and it makes
the native `max` promise less than the rule — the drift VAL-004 exists to prevent — for a case ADR
0066 already explains with a message.

**Clamp the value into the track.** A widget that rewrites what a form holds is what ADR 0029
forbids, and it would turn a display problem into data loss.

**Leave the default and document it.** The document declared no bound, so there is no sentence to
show a person and nothing they could act on.

**Keep `step` and accept the snap.** It is the current behaviour, and it means a slider shows a
number the form does not hold whenever a value arrives off-grid — from a prefill, a draft, or a
scripted write.

## Verification

- `packages/widgets/test/form-shell.spec.mjs` — the track for a declared bound, an undeclared one, an
  off-grid step and an empty field.
- `battle-tests/browser/a-slider-that-shows-a-different-number.spec.ts` — both renderers, with **a
  value inside the range** as the control: a repair that widened everything would pass the red and
  fail that one.
- `examples/plain/panels/states.js` — the track printed beside what the form holds, in the panel the
  browser suite drives.

## Security and privacy

None. Nothing is retained or transmitted that was not before: the value is unchanged, and only the
range it is drawn against moves.

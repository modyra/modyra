---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/angular": minor
"@modyra/lit": minor
---

One call turns a placement into the class the catalog names it

`above` and `overlay` are states of every popup part, but each adapter had to know how to ask: read
the part's first class, suffix it, and skip `below` because the catalog gives it no class. Three
adapters, three copies of that reasoning, and a fourth about to be written for Studio.

`popupPlacementClass(kind, placement)` is that reasoning, once, in `@modyra/widgets`. It answers with
the class or with `null` when the popup sits in the ordinary place. Every adapter now calls it:

- `@modyra/plain` keeps the decision it already held, so `releaseOverlayPlacement` is unchanged.
- `@modyra/angular` — `<mdy-overlay-panel>` computes it from its `kind`; `select` and `colors` own
  the element the state belongs on and compute it themselves. The `[class.…--above]` literals are
  gone from both.
- `@modyra/lit` gains `popupClass(placement)` on the base, and `renderOverlayPanel` stops emitting
  `mdy-overlay-panel--above` / `--overlay`. Six components moved: `select` and `colors` off
  hand-spelled literals, and `datepicker`, `daterange`, `timepicker` and `multiselect` gained a
  placement class they never had.

**No adapter emits `mdy-overlay-panel--above` or `--overlay` any more.** Nothing in the workspace ever
styled them. A host that wrote its own rule against those names should move it to the widget's popup
class — `mdy-select__dropdown--above`, `mdy-datepicker__popup--above`, and so on.

The two audits that read class names out of renderer source resolve the call rather than looking for
a literal, the way they already resolved `multiselectChipClasses`. Without that, an adapter moving
onto the contract reads as one that stopped emitting the classes altogether — which is precisely the
regression the audits exist to catch, reported backwards.

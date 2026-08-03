---
"@modyra/widgets": minor
"@modyra/lit": patch
"@modyra/angular": patch
---

A state is checked on the part responsible for it.

`inspectWidgetState` accepted a state's ARIA attribute on **any** declared part. The claim it could
make was therefore "the widget exposes the state somewhere", not "on the right element" — and a
select that moved `aria-expanded` from its trigger to its root passed.

`stateCarriers(kind, state)` now names the part or parts a kind must announce a state on, and the
check asserts presence on each of them. `open` is derived from `MDY_POPUP_OPENERS[kind].opener`,
which the contract already declared; `invalid`, `disabled` and `readonly` are declared in a new
per-kind table, because nothing existing answered for them — the catalogue's per-part `states:` is a
class vocabulary, and it names `inputWrapper` where `aria-disabled` goes on the control.

Extras are still tolerated: the check asks whether the carrier announces the state, not whether
anything else does.

**Three renderer defects surfaced immediately**, each one a state announced where nothing listens:

- `@modyra/lit` and `@modyra/angular` never set `aria-disabled` on the multiselect's search button —
  the opener, and the element the label names. Angular had it on the options group instead.
- `colors` had no correct carrier to name. Angular's `control` is the native `<input type="color">`,
  deliberately `aria-hidden`; the carrier is `hexInput`, the field a user types into.

**Classification.** `contract:diff` reports `patch`: the catalogue anatomy is untouched, and the
differ snapshots the catalogue only. This ships as `minor` because `stateCarriers` is a new root
export. The disagreement is the same blind spot recorded as finding K in `docs/contract-gaps.md` —
public surface outside the catalogue has no classification path.

A downstream renderer that passed conformance may now fail it. That is the point of the change, and
it is a verdict rather than an API break: nothing a consumer wrote needs editing to compile.

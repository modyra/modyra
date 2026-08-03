---
"@modyra/widgets": minor
---

The number field's spin buttons are part of the contract.

`@modyra/angular` renders spin buttons beside a number input. They wear `mdy-spin-btn` and
`mdy-spin-btn-up`/`--down`, `modyra.css` styles them with four custom properties — and the widget
contract declared no part for either. So no anatomy, relation, state or equivalence check had ever
looked at them, and none could: every audit here starts from what the contract declares.

That is the inverse of the shape the contract-gap audit kept finding. Everything else there is
*declared and wired to nothing*; this was **emitted and painted and declared by nothing**, which is
the direction an audit rooted in the contract is blind to.

`number` now declares `increment` and `decrement` as **optional** parts with `button` semantics and
those classes. Optional because the native control has its own spinners and a renderer that leaves
them to the platform is complete without them — declared, so the ones that are drawn are checked.

Confirmation the gap closed rather than moved: the three classes were sitting in the style audit's
off-contract allowlist, and the audit now reports them as stale entries because they are contract
classes. Removed.

Found by a key check added for an unrelated reason: `PARENT_CANDIDATES` was keyed by `decrement` and
`increment`, parts no kind declared. The table had been anticipating them since before they existed.

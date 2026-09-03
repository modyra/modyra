---
"@modyra/angular": patch
---

Leave `aria-readonly` to the contract on the four kinds where the contract already writes it

Four renderers bound `aria-readonly` in their own markup on an element that also receives the
contract's projection. Two authors for one attribute, each derived separately, and which one lands
decided by nothing either file states.

The projection is the author, so the bindings are gone from `text`, `number`, `textarea` and
`segmented`. Nothing changes on the page: the attribute is still there, written once instead of
twice.

**Measured per site, not generalised.** Removing all twelve bindings first turned the state matrix
red for six kinds — `colors`, `datepicker`, `daterange`, `multiselect`, `select`, `timepicker` — where
the template is the only writer and the projection does not reach that element. Those bindings stay.
The remaining four were then checked one at a time for the attribute actually landing, because a
check that stays green can mean the projection supplies it *or* that nothing demanded it, and only
the first is a reason to remove a writer.

`renderers/one-writer-for-a-state-attribute.spec.ts` guards what is now unwatched: the shared state
matrix does not require `aria-readonly` on those four — three are native controls whose own
`readonly` carries the refusal, and `segmented` has no native attribute at all — so a page that
dropped the ARIA attribute entirely would have passed. It asserts the fixture entered the state
before asserting the attribute, and cutting the projection off from one of them turns it red by name.

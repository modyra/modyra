---
"@modyra/widgets": minor
---

A popup can say which edge it hangs from, and a range calendar can say where it is.

Every popup declares `right` alongside `above` and `overlay`, and nothing derived it. So the adapters
each spelled an edge class themselves — `mdy-overlay-panel--right`, a name no stylesheet has ever
matched, on a wrapper that is `display: contents` and lays nothing out. That is the same failure
`popupPlacementClass` was written to end for `--above`, surviving in the one case it did not cover.
New `popupAlignmentClass(kind, alignment)` answers it, `left` being the ordinary case that carries no
class exactly as `below` does.

**`popupPlacementClass` was wrong for the range picker, and had been all along.** It looked for the
first class shaped like a modifier of the popup's base, and a popup may already carry one: the range
picker's resting classes are `["mdy-datepicker__popup", "mdy-popup", "mdy-datepicker__popup--range"]`.
So every placement it was ever asked about returned `--range` — a variant marker that says nothing
about where the popup is — and `mdy-datepicker__popup--above` was emitted by nothing. Both functions
now return the class the state *added*, which is the question that was meant to be asked.

The select gains the `--above` rule its anatomy has always wanted. Its popup is `search`, then
`listbox`, exactly like the multiselect's, and the multiselect has flipped its column when opening
upwards for as long as the class has existed — so the search box stays beside the control the user is
typing in rather than across the whole list. The select declared the state and no rule answered it.

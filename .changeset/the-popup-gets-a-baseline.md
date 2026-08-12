---
"@modyra/lit": patch
---

The modal placement centres, and the popup has a baseline at last

Every visual baseline in this repository shot a widget **at rest**, and a resting
overlay widget draws none of its popup: the calendar grid, the month and year
views, the modal header and the surface they sit on had no image at all. That is
how a confirmation row could be removed from two renderers without a single
baseline moving. The suite now shoots the calendar open, and — where a renderer
offers the modal placement — shoots it modal, on the whole page, because a modal
is defined by what it covers.

It found a defect on its first run. `MdyLitOverlayController` wrote seven of the
contract's eight overlay properties onto the popup and left out
`--mdy-overlay-transform`, which is how the modal placement centres: the
coordinates put the popup's corner at the middle of the viewport and the
transform pulls it back by half its own size. Half of that happened, so a popup
asked to go modal stayed hanging off its control. It is carried with the rest
now.

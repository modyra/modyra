---
"@modyra/angular": patch
"@modyra/styles": patch
---

An overlay is positioned once, by the box that draws it

`<mdy-overlay-panel>` placed itself — `position: fixed` with all four insets, a width and a
max-height — and *also* published `--mdy-overlay-*` for the popup inside it, which the foundation's
`.mdy-overlay` rule reads to place itself. Two boxes, at identical coordinates, agreeing only
because both were derived from one measurement.

Measured, in the built demo: unposition the wrapper and the popup does not move (`534×324@373,385`
before and after); unposition the popup and the wrapper places it instead. Either one alone is
sufficient, so one of them was always doing nothing. The popup is the one kept — it is the box
anyone can see, the box the contract names, and the box the framework-free renderer positions.

**The split was hiding a real defect.** `max-height` was applied to the wrapper, whose only child is
out of flow, so it clamped nothing — while `--mdy-overlay-max-height` was never written at all and
the popup fell back to the foundation's `50vh`. The room the placement policy measured did not reach
the element it was measured for: 323px allowed, 360px granted. A popup with more content than room
grew straight past the allowance the policy had just calculated for it. It now stops at it.

The wrapper keeps what a wrapper is for — the top layer, the backdrop, the focus trap — and gains
`inset: auto`, without which the UA's `inset: 0` for popovers would stretch it over the whole
viewport now that it states no insets of its own, swallowing every click on the page behind it. The
test measures that corner rather than trusting it.

Visibility stayed on the wrapper: whether an overlay is showing is state, not placement. A browser
without the Popover API keeps the panel in the page — the component says as much and carries on —
so this is the only thing hiding a closed overlay there. Removing it surfaced a closed calendar to
axe, which is how that was established rather than assumed.

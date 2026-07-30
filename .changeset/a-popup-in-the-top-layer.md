---
"@modyra/plain": minor
"@modyra/styles": patch
---

A popup goes in the top layer, so nothing above it can move it

`@modyra/plain` positions a popup from viewport coordinates and lets the foundation apply them to a
`position: fixed` box. That only holds while no ancestor is a containing block for fixed
descendants — and anything carrying `contain: layout` becomes one, which is exactly what
`container-type` implies. The foundation needs `container-type` on the form so a row can ask how wide
the *form* is rather than how wide the window is, and without this change that would have quietly
moved four popups by the form's own offset.

`setOverlayOpen(popup, open)` is now the one place that decides how a popup is shown, the way one
place already decides where it is placed — the six fields each assigned `hidden` themselves before.
It sets `popover="manual"` and calls `showPopover()`/`hidePopover()`, keeping `hidden` in step so the
two can never disagree. `manual` rather than `auto`: light-dismiss would close the popup before this
renderer's own outside-pointer handling ran, and two things closing one popup is how a click-through
appears.

Four of the six popups — colors, datepicker, daterange, timepicker — live in their field's own
subtree and are the ones this protects. `select` and `multiselect` already portal to `document.body`,
so nothing in the form could contain them; they move to the top layer too, for one behaviour rather
than two.

It also fixes a standing bug in its own right: a popup could be clipped by an `overflow: hidden`
ancestor, and in the top layer it cannot be.

The foundation adds one declaration, `.mdy-popup[popover] { position: fixed }`. Every other UA
popover style — the centring insets, the default border, padding, background and width — is already
answered by the contract's own `.mdy-popup` rule, which outranks the UA sheet.

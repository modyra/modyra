---
"@modyra/lit": patch
---

A dialog the page can point at, and a grid that says what it is

lit's popups were announced as rooms with no name and no address.

- **The timepicker's dialog role and the id its opener names were on two different elements.**
  `aria-controls` resolved to a wrapper with no role, while the element carrying `role="dialog"` had
  nothing pointing at it. The popup takes the projection's dialog part — role, name and `aria-modal`
  together — and keeps the id the opener names, because two ids on one element is not a thing an
  element can have.
- **The datepicker's dialog had no id at all**, and its day grid no name: forty-two cells announced
  as a grid of nothing.
- **The multiselect's popup and the daterange's grid** are named by the field's own label, which is
  what every other renderer does.

A role that must be named and is not is announced as its role and nothing else — "dialog", "grid" —
which tells a person what kind of room they are in and nothing about which one.

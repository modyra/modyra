---
"@modyra/angular": patch
---

Tab out of an open picker closes it.

`MDY_WIDGET_KEYBOARD` declares `Tab@open: cancel` for the kinds whose popup Tab leaves, and the
datepicker, daterange and colors renderers answered it nowhere: the popup stayed open, so the keys
still went to it and the next Tab walked its internals — a calendar cell, then the next cell — with
nothing to tell a keyboard user that the way out was a different key.

The binding is now answered once for every overlay control, asked of the contract rather than listed:
the timepicker declares `Tab@open: move` because its confirm button lives inside the panel and Tab
has to reach it, and it is unaffected.

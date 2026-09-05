---
"@modyra/angular": patch
---

A date range's opener keeps naming something that is on the page

The reference was pinned to the day grid while the panel draws three grids in turn, so choosing a
month left it naming an element that had gone with the view. The panel is still open then, so the id
kept alive while it is *shut* never applies. The opener now retargets per view, exactly as this
package's date picker already did — with the reason written beside it there: *a reference that stops
resolving on a view change is the same defect as one that was never right*.

**The measurement that missed this is the point.** A search for `viewMode` in the date range's own
files came back empty and I reported the kind as having no views. It has them: they live in the
calendar it mounts, where the signal is called `view`. The search answered truthfully about the file
it was pointed at, and the question was about the widget.

A search reads the name you already expect. Only driving the control — opening the panel and changing
the view — could answer this one, and that is what found it.

No custodian ships with this change, and that is said rather than left to be noticed: a spec written
here passes with the repair removed, because this harness keeps the old element reachable where a
browser does not. A guard that stays green with the defect restored is worth nothing, so the
verification for this belongs to the tier that drives a real browser.

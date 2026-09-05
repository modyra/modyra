---
"@modyra/angular": patch
"@modyra/vue": patch
---

Angular's colour and date-range openers point at what keeps the promise, and a strip holds something

The two kinds whose reference moved to a sub-region were repaired in Lit and left in Angular, where
the panel and the opener still shared one id — so the reference resolved to whichever element the
document found first, which was the panel. The panel now carries an id of its own and the region
carrying the promised role carries the controlled one: the presets for a colour field, the grid for a
date range.

Angular's date picker already answered this, retargeting per view with the reason written beside it —
*a reference that stops resolving on a view change is the same defect as one that was never right* —
and its date range has no view modes, so the third state that bit Lit does not exist there.

**A vue multiselect holding nothing draws no strip.** `chips` is declared present when a value is —
with nothing chosen there is no strip, not an empty one — and drawn always it put a `role="grid"` on
the page with no rows and no name. `grid` is one of three roles the contract says must be named, so
an empty container announced itself as a grid that is not about anything. Plain and Lit draw none at
rest and name theirs when filled; this one now does the same, and the bench asserts **both** states,
since a renderer drawing no strip in either would pass an assertion on the empty one alone.

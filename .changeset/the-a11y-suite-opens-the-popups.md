---
"@modyra/angular": patch
"@modyra/styles": patch
---

The accessibility suite opens the popups it audits, and three defects fall out

The axe suite ran over a form with every popup closed. Closed, they are invisible to axe — an
overlay panel carries `visibility: hidden` and axe skips hidden subtrees — so everything a popup
*contains* was outside the suite entirely: the calendar's grid, the clock's dial, a listbox's
options. That is most of the ARIA in the library, untested by construction rather than by decision.
Each popup is now opened through its own trigger, the way a user opens it, and audited open.

Three violations were waiting.

**Calendar rows had no grid (critical).** `.mdy-datepicker__row` and the weekday header declare
`role="row"`, which ARIA requires to sit inside a grid, table or rowgroup. `<mdy-calendar-grid>` and
`<mdy-range-calendar-grid>` declared no role at all, so every row in every calendar was an orphan.
Both hosts now carry `role="grid"`.

**A modal panel was a nameless dialog (serious).** `<mdy-overlay-panel>` took `role="dialog"`
whenever it had a backdrop and never had a name. For the datepicker it was worse than nameless:
`<mdy-calendar>` inside already declares a *named* dialog, so a screen reader was handed a nameless
dialog wrapping a named one. The rule is now that **the element carrying the role is the element
that has a name** — a popup whose content announces itself leaves `dialogLabel` unset and the panel
goes back to being a positioned host; the clock and the palette, whose content does not, pass a name
and are announced there. The focus trap is unchanged and still keyed on the backdrop: trapping focus
is not the same question as who says the word "dialog".

**A colour input nested inside a button (serious).** An invisible `type="color"` was stretched over
the picker button as its click surface — a focusable control inside a focusable control. The button
beneath already carried the same handler, the same disabled state and the accessible name, so the
input contributed the defect and nothing else. It is now a sibling and takes no pointer.

One thing worth writing down: the first attempt to explain these fixes in comments broke the golden.
The audit greps `aria-*` out of renderer source, and axe *rule names* — `aria-required-parent`,
`aria-dialog-name` — read exactly like attributes the renderers emit. Two rule names entered the
golden as ARIA surface. Teaching the audit to strip comments looked right and was worse: it also
dropped genuinely emitted attributes, shrinking what the golden guards. The comments were reworded
instead, and the golden verifies byte-identical at 237/16/40.

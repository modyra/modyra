---
"@modyra/angular": patch
---

Angular derives its popup classes from the contract instead of restating them.

Six templates carried the class list as a literal — `'mdy-datepicker__popup mdy-popup …'` — so a class
added to the catalogue reached the renderers that derive and stopped at this one. That is how the
popup-surface split passed conformance for two adapters and failed for the third until every template
was edited by hand.

Each component now reads `MDY_WIDGET_CONTRACTS.<kind>.parts.popup.classes`. Falsified rather than
assumed: adding a class to the catalogue and rebuilding leaves Angular conformant with no template
change, which is exactly the case that failed before.

One consequence worth stating: the static Angular UI audit scrapes templates for class literals, so
those classes leave its baseline — 31 entries. What it was guarding against is drift between Angular
and the contract, and derived classes cannot drift. Conformance still verifies them, by mounting the
component and inspecting the DOM, which is the stronger check of the two.

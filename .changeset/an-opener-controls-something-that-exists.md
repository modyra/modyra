---
"@modyra/widgets": minor
"@modyra/lit": patch
---

An opener controls something that exists, and a part inside an absent parent may be absent.

Two halves of one assumption: the contract, and the suite that checks it, both took an eagerly
mounted popup for granted. A renderer that builds its overlay on demand could not report its resting
state honestly.

**`aria-controls` named a listbox that was not there.** `projectOverlayOpenerA11y` emitted the id
unconditionally, so a lazily-mounted popup left the trigger pointing at nothing while closed — a
dangling reference assistive technology cannot follow, and one no amount of correct `aria-expanded`
makes up for. `controlsRendered` now answers it, defaulting to `true`, which is what every caller
assumed before. It threads through `projectSelectA11y` (`popupRendered`) and
`createSelectController` (`setPopupRendered`), because that projection sits behind the controller and
a renderer cannot answer for itself otherwise. `@modyra/lit`'s select declares it; the eagerly
mounted renderers are unchanged.

**A mandatory part inside an optional one could not be declared absent.** `datepicker.calendar` is
`optional: false` with parent `popup` at `optional: true` — a required child of an optional
container. `inspectWidgetDom` rejected `calendar` in `absentParts` even when `popup` was absent too,
so a lazy renderer had no way to describe its closed state. Absence is now *entailed* when an
ancestor is absent, rather than treated as a claim. The contract is unchanged: `calendar` is still
required whenever the popup is there.

Found by `scripts/conformance-cli.mjs` running against `@modyra/lit`, which reports **CONFORMANT**
with both fixes and four findings without them.

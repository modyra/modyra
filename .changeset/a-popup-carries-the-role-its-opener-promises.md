---
"@modyra/widgets": major
---

A multiselect's popup carries the role its opener promises

Declaring the promise was half the answer. `MDY_POPUP_OPENERS.multiselect.promises` says `dialog`,
and `MDY_WIDGET_CONTRACTS.multiselect.parts.popup` declared **no role at all** — so no renderer
emitted one, nothing on screen answered to what the opener announced, and a person told "combobox,
has popup dialog" got a `group`.

That it failed identically in both renderers is what says this was the contract still being silent
rather than a renderer being careless.

The kind now declares `roles: { popup: "dialog" }`, and its projection reads the role from the
catalogue instead of restating it. The popup is:

- **named**, by the field's label — a dialog without an accessible name is a region an assistive
  technology cannot introduce;
- **not modal**, deliberately. The panel is anchored to its field and the page behind it stays
  reachable, so `aria-modal` would say the opposite of what dismissal does.

## Migration

**`MDY_WIDGET_CONTRACT_VERSION` moves from 2 to 3.** ADR 0084 puts a part gaining a role in the set
that moves the number, and `contract:diff` classifies it major for the reason the number exists: a
renderer built against 2 emits that panel with no role, which was conforming under 2 and is not
under 3.

**If you maintain a renderer**, add the role to the multiselect popup and name it. Take both from the
projection rather than writing them out — `projectMultiselectFieldA11y(…).popup.attributes` now
carries `role` and `aria-labelledby`, and a literal is how the promise and the popup came apart in
the first place. Then re-pin whatever asserts the contract version.

**If you only consume the tables**, nothing breaks: `MDY_WIDGET_CONTRACTS.multiselect.parts.popup.role`
returns `"dialog"` where it previously returned nothing.

`@modyra/plain` is updated. `@modyra/lit` builds this panel by hand and still drops the projection's
attributes, so its multiselect stays non-conforming until it takes them.

See ADR 0110, amended.

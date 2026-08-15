# ADR 0076: A state belongs to something that can be in it

Status: Accepted

## Context

`aria-invalid` and `aria-required` say something about a **value**. A role with no value has no room
for either: told that a `role="button"` is invalid, an assistive technology has nothing to attach the
claim to, and most simply drop it — so the state is neither reported nor reported *wrong*, it is
absent.

Swept across all seventeen kinds in both renderers, exactly one kind carried them somewhere they could
not be: the multiselect. `@modyra/plain` put them on `button.mdy-multiselect__search-btn`;
`@modyra/lit` put them there *and* on the `div[role="group"]` wrapper. Every other kind was clean in
both, which is what identifies the cause: where the contract names a role, the state has somewhere to
sit. `MDY_POPUP_OPENERS` declares `role: "combobox"` for `select`, `datepicker` and `timepicker`, and
declared no role at all for `multiselect`.

The projection then made the omission invisible. `projectMultiselectFieldA11y` spread only
`projectOverlayOpenerA11y(...)?.attributes` into the trigger part, so even a declared role would not
have reached the DOM: `aria-expanded`, `aria-invalid` and `aria-required` arrived, and the role that
makes all three legitimate was dropped on the way.

## Decision

**The multiselect's opener is a combobox**, like its single-choice sibling's. It holds the field's
value — the label's `for` points at it, it is what a keyboard reaches, it is what carries the field's
verdict — so it carries the role that has room for a value, and `aria-invalid`, `aria-required` and
`aria-expanded` are legitimate on it.

**A part contract carries the role as well as the attributes.** The opener projection returns both;
spreading half of it is how a declaration that was right produced markup that was not.

**`searchButton` is an `input` in the semantics table**, not a `button`. What the part *is* follows
from what it does: the multiselect has no typeable control, so this is the control.

**A trailing affordance is a thing you press, whatever role it carries.** `trailingAffordances` keyed
on the declared element being a button; the role change would have quietly dropped the multiselect's
opener out of the class list a theme sizes hit targets with. An opener drawn inside the field's
`header` is now included whatever its element — which is the shape in between: pressed like an
ornament, holding a value like a control.

**A `role="group"` wrapper carries no verdict.** `@modyra/lit` applied the field-shell control
projection to the box around the chips. A group is a box around other things; it describes what it
holds. It keeps its label and its `aria-describedby`, and nothing about a value.

## Consequences

**The multiselect's opener changes role in every renderer.** Anything selecting on
`[role="button"].mdy-multiselect__search-btn` — a test, a theme, an automation script — stops matching.
The contract snapshot classifies both the element and the role change major, and agrees with the
reading.

**A screen reader announces the multiselect differently**: "combobox, collapsed, invalid" where it
previously announced a button and dropped the rest. That is the intent, and it is a change to what
users hear.

**The affordance rule now has two clauses.** "A button, or an opener inside the header" is less
uniform than "a button", and a future kind whose opener sits somewhere else will need the rule
extended rather than inherited. It is written where the derivation is, with the reason.

**Canonical fixtures move with it.** The widgets suite builds its own multiselect DOM; those builders
now emit the role. A fixture written before a contract change is a test that pins the previous
contract, which is what made two of them fail here.

## Alternatives rejected

**Leave the role off and remove `aria-invalid`/`aria-required` from the opener.** The multiselect
would then be the one kind in the catalogue that never reports its own validity to assistive
technology, because there is no other element in it that could.

**Allow `combobox` on the `button` semantic.** It would silence the check by making the table wrong:
a button is not a combobox, and every other kind's opener would then be free to claim either.

**Put the states on the `role="group"` wrapper.** A group has no value. This is the lit half of the
same defect, not a repair for it.

## Verification

- `battle-tests/browser/a-state-only-a-widget-may-report.spec.ts` — sweeps every kind in both
  renderers for a state on a role that has no room for it. Both green; before the change, one entry
  in plain and two in lit.
- `npm run test:widget-contract` and the renderers' DOM contract tests — `PART_ROLE` and
  `PART_ELEMENT` fail if the rendered opener stops matching the declaration.
- `packages/widgets/test/affordance.spec.mjs` — pins that the opener's class stays in the list a theme
  sizes hit targets with, which is what the role change nearly removed.
- `npm run contract:snapshot` — classified element and role major.

## Security and privacy

None. The change is which ARIA role and states an existing element carries; no value, no new data, no
trust boundary moves.

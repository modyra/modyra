# ADR 0140: A popup that holds a draft is a dialog, and the catalogue says so

Status: Accepted

## Context

A time picker's popup is not a dropdown. It holds a draft the field does not have yet — a clock the
person turns, two segments they can type into, a confirm button that is the only way out that keeps
what they did. Everything about it is the composite ARIA calls a dialog.

Two of the three renderers said so and one did not, and the reason the third did not is the part
worth recording. It derived the answer from its own placement: the panel announced `role="dialog"`
only when it was drawn over the page with a backdrop, and a picker anchored under its field was a
`<div>` with no role at all. A person opening it was told a clock had appeared and never that the
page behind it was unavailable — measured open, with the dial rendered, `role` null and `aria-modal`
null, where the other two renderers gave `role="dialog"`, `aria-modal="true"` and a name.

The catalogue already had the slot for this. `MDY_WIDGET_CONTRACTS[kind].parts.popup.role` is where
the multiselect declares its popup a dialog, and that declaration is why its panel does not decide
for itself. The timepicker declared nothing, so each renderer answered separately and one answered
from geometry.

The same catalogue entry also shows why the role cannot carry modality with it: the multiselect's
popup is a declared dialog that is deliberately **not** modal, because it is anchored to its field
and a click outside dismisses it. `aria-modal` there would say the opposite of what dismissal does.

## Decision

**A kind declares in the catalogue what its popup is, and every renderer announces that.** Where
`parts.popup.role` is declared, a renderer emits it wherever and however the panel is drawn.

**Modality is a separate property from the role, and it is the kind's, not the placement's.** A popup
holding a draft that only confirmation keeps is modal whether it was drawn over the page or under its
field; a popup anchored to a field that a click outside dismisses is not modal even though it is a
dialog. `aria-modal` and the focus trap follow modality, never the role alone, and never the backdrop
alone.

**A dialog holding one field's draft is named by that field's label**, through `aria-labelledby`
pointing at the label already on the page — not by the words on the button that opened it. One string,
and the one the person read to know what they are setting.

## Consequences

The timepicker's popup is now announced identically by all three renderers: `role="dialog"`,
`aria-modal="true"`, named by the field's label. Its Tab focus trap is now on wherever it is drawn,
where before an anchored picker let Tab walk out of a panel holding an uncommitted draft.

`contract:diff` classifies the added role as **major**, and it is: a renderer implementing this
contract must now emit a role it was previously free to omit. Nothing loses a capability, and the two
renderers that already emitted it are unchanged.

The cost is a third property to keep straight per kind — role, modality, backdrop — where a renderer
previously had one. That is the honest cost of the multiselect being a dialog that is not modal: the
three are genuinely independent, and collapsing any two of them is what produced both this defect and
the nameless-dialog defect before it.

Modality itself is still declared per renderer rather than in the catalogue. A kind whose renderers
disagree about it would not be caught by the contract, only by a spec that reads the DOM in each.

## Alternatives rejected

**Leave each renderer to decide, and fix the one that was wrong.** This is what produced three
answers to one question. The nameless dialog, the dialog wrapping a named dialog, and this missing
role were all a renderer deciding locally; the catalogue exists so that a kind is described once.

**Put modality on the role — a declared dialog is modal.** Directly contradicts the multiselect's
recorded decision, and would have told a screen reader the page was unavailable while a click outside
still dismissed the panel.

**Keep modality on the backdrop and give the timepicker a backdrop everywhere.** Changes what the
control looks like — an anchored picker would dim the page — to fix what it announces. The visual
and the semantic are separable here, so separating them costs nothing.

**Name the panel by the opener's label.** Two strings for one thing, free to drift, and the weaker of
the two: "Open time picker" names the button, while the field's label names what the person is
setting. The other two renderers already point at the label.

## Verification

`npm run contract:diff` reports the role addition and classifies it. The browser tier reads the three
renderers' popups directly: `role`, `aria-modal` and the name on the open panel must agree across
plain, lit and angular for the timepicker, and the multiselect's panel must carry the dialog role
with no `aria-modal`. `npm run test:angular` covers the panel's own behaviour, including that a kind
with no declared popup role is unchanged.

What is not guarded: nothing fails if a future kind declares a popup role and its renderers disagree
about modality, because modality is not in the catalogue to compare against.

## Security and privacy

None. The change is what an assistive technology is told about a panel that was already on screen
and already reachable; no data crosses a boundary it did not before, and the focus trap restricts
input rather than exposing it.

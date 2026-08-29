# ADR 0171: Absent for configuration, disabled for state

Status: Accepted

## Context

A multiselect draws a button that takes everything out of it, and a button that puts back what was
last removed. Both were declared present only when there was something to clear or to restore, and
all three renderers drew them always — one by hiding the element, which is absence by another name.

Read on a page, that is two facts collapsed into one. **Whether a control exists** is a fact about the
field's design: fixed, learnable, the same every time somebody meets the field. **Whether it can act
right now** is a fact about the moment, and changes as they work. Taking the control away when it
cannot act makes the first change at the rate of the second — the number of tab stops moves under
somebody's hands as they fill the field in, and whoever has never used the control discovers it can
be emptied only after picking three things, or never.

The moment it is worst is the one that matters most: somebody presses clear-all, the field empties,
and the button they are standing on disappears. Focus goes to the document.

## Decision

**A control that is part of a field's design is always present, and says so when it cannot act.
Absence is for what is not part of *this* field — something a configuration left out.**

Absent for configuration, disabled for state.

Applied: `multiselect.clearAll`, `multiselect.wayBackAction` and `file.clear` lose their presence
condition and gain `disabled` among their declared states.

Three that stay conditional, and they are not exceptions:

- `chipMove` and `chipRemove` belong to a chip and exist exactly when the chip does. The chip *is* the
  state; there is no moment where the button exists and its subject does not.
- `overflowCount` reports a state rather than offering an act. Nobody learns the field by finding it,
  it has no stop of its own, and "+0" is noise where absence is legible.

The test that tells the two apart: **would somebody tabbing through the empty field want to find
this?** Clear-all yes — it tells them what the field can do. A count of hidden items, no.

**Announced, not set.** `aria-disabled`, and the handler refuses. The native property removes the
control from the tab order, which is the moving-stops problem again and takes focus with it at the
exact moment the state changes — which is the moment somebody has just pressed the button. Announced,
the button keeps focus and they hear the change, which is itself the confirmation that it worked.

## Consequences

**Two existing checks say this is a defect, and they are right about the usual case.** The DOM
inspector reports `aria-disabled="true"` on a natively disableable control that carries no `disabled`
attribute; the state matrix reports the same from the other side. Their reason is exact — the reader
is told one thing and the pointer and keyboard do another — and it is the reason `aria-disabled` as
decoration is a defect.

What neither can see is whether the handler refuses. That is a question about an act, and both read
markup. So the contract declares the exception narrowly, by name, in `MDY_ARIA_DISABLED_PARTS`, and
both checks read that one declaration rather than each carrying its own reading of it.

Narrow on purpose: twenty-one parts declare `disabled` among their states and most are natively
disabled, so keying the exemption on that would have given the rule away for all of them.

**The check that would settle it does not exist.** It presses the control while it says it cannot act
and reads the value. Measured today, removing the renderer's own guard changes nothing observable —
the controller refuses a clear on a field out of play, and clearing an empty one changes nothing — so
the guard in the handler is a second lock rather than the one that holds. That is recorded in the code
where the guard is, because a reader would otherwise take it for the mechanism.

## Alternatives rejected

**Keep the presence condition and let the control come and go.** What the contract said. It is the
option that moves the tab stops, and it loses focus at the worst moment.

**Use the native `disabled` property.** Satisfies both existing checks with no argument needed, and
reintroduces exactly the problem the decision is about: out of the tab order, focus dropped when the
state changes under somebody.

**Key the exemption on the declared `disabled` state.** Twenty-one parts declare it, including the
triggers that are natively disabled. It would have exempted them too, which is giving away the rule
to avoid writing three lines.

## Verification

- `packages/plain/test/a-control-that-cannot-act-right-now.test.mjs` asserts the three halves: the
  control is there and reachable whichever state the field is in, it says whether it can act, and it
  refuses the press it says it will refuse.
- Restoring the hidden-when-empty behaviour turns the first two red.
- **Removing the handler's guard leaves all three green**, and that is recorded rather than repaired:
  the controller is what refuses, and a check that claimed the guard would be claiming what it cannot
  see. The property asserted belongs to the field; which layer keeps it is not visible from outside.
- The conformance kit is green on all three renderers with the exemption in place, and its two rules
  still fire for every part not named in the declaration.

## Security and privacy

None. A control that announces itself unavailable and refuses is not a security boundary — the
refusal that matters is the controller's, and it is the same refusal whether the button says anything
or not. Worth one line so nobody reads it as one: `aria-disabled` is a statement to a reader, not a
lock, and a page that needs an action to be impossible must not rely on it.

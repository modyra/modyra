# ADR 0077: The opener a contract names is the one a keyboard reaches

Status: Accepted

## Context

`MDY_POPUP_OPENERS` names, per kind, the part that opens the popup — and the role that part takes:
`combobox` for the three kinds whose opener is the control the value is typed into, and nothing for
the three whose opener is a button, because a button already has room for `aria-expanded`.

`@modyra/lit` disagreed with that table in two ways at once, and each half looked defensible alone.

**The state was on the wrong elements.** Its daterange put `aria-expanded` and
`aria-haspopup="dialog"` on both date inputs. Two elements said whether one popup was open, neither of
them was the part the table names, and a text input is a `textbox` — a role with nothing to expand, so
`aria-allowed-attr` rates it critical. The field's own projection says the opposite in a comment: one
grid serves both ends, so one thing opens it and one thing says whether it is open.

**The opener nobody could reach.** The same toggle carried `tabindex="-1"` — the better choice while
the control beside it opens the popup, which is the arrangement in `@modyra/plain`. In lit the control
answered no key at all, so both doors were shut: measured across every kind, plain opens all six from
the keyboard and lit opened four. A keyboard-only user could still type a date, if they knew the
format the field wanted, and nothing on the page said what that was.

## Decision

**The part the opener table names is the part that carries the overlay's state.** `aria-expanded`,
`aria-haspopup` and `aria-controls` go on the declared opener and nowhere else. A renderer that puts
them on a second element has described one popup twice and named neither opener.

**That part is reachable.** An opener may drop out of the tab order only where another element opens
the same popup; where nothing else does, `tabindex="-1"` closes the widget to a keyboard.

**A control that is the declared opener answers the keys the contract publishes.**
`MDY_WIDGET_KEYBOARD` already states them per kind and phase; a renderer reads `keyBindingFor` rather
than writing a key of its own. Every reimplementation is an opportunity to diverge, which is how
these came to differ in the first place.

**`aria-haspopup` names what actually opens.** The daterange promises `grid`, as its projection
declares — `dialog` described a different widget from the one that appears, in both renderers and in
opposite directions.

## Consequences

**Lit's daterange gains a tab stop.** The toggle is reachable, so tabbing through the field is start,
end, toggle. That is one more stop than before and one more than plain's timepicker, and it is the
cost of the popup being openable at all.

**A key handler now consults a table at every keystroke.** `keyBindingFor` is a linear scan of a small
frozen list per kind. It runs on keydown of a focused control; the cost is not measurable beside the
render it triggers, and the alternative is a key written twice.

**The projection stops declaring a role for the daterange opener.** It wrote `role="combobox"`
literally while the opener table deliberately declared none — and no renderer consumed it, so the
contradiction had no symptom until both halves were read together. A `<button>` is what it is; the
value lives in the two inputs beside it, and calling the button a combobox claims the value is its.

**Two of `@modyra/widgets`' own tests moved.** One pinned the role this removes; its property — the
opener owns the overlay, the inputs own none of it — is now witnessed by the relation attributes
instead. A test written against a projection is a test that pins whatever the projection said.

## Alternatives rejected

**Give the daterange inputs the combobox role** so their `aria-expanded` becomes legitimate. It makes
two comboboxes out of one popup and contradicts the projection's stated reason.

**Drop `tabindex="-1"` and stop there.** It reaches the popup but leaves the control answering no
declared key, so the contract's keyboard table stays a document nothing enforces.

**Have the control open on any of the declared keys, read literally.** For the daterange the table
includes the space bar — its opener is a button, and a button opens on Space — and the reachable
element is a text input where a space is a space character. The keys are read for the kind whose
opener *is* the control; the daterange opens from its button instead.

## Verification

- `battle-tests/browser/a-picker-no-keyboard-can-open.spec.ts` — every kind with a popup, every part a
  keyboard can reach, every key the contract names: all six open in both renderers.
- `battle-tests/browser/an-attribute-the-element-may-not-wear.spec.ts` — every element carrying
  `aria-expanded` is a button or carries a role that permits it.
- `battle-tests/browser/what-a-control-promises-will-open.spec.ts` — what `aria-haspopup` promises is
  what appears. The daterange no longer appears in either renderer's failures; multiselect and colors
  still do, and are not this record's subject.
- `packages/lit/test/dom-contract.test.mjs` — the toggle stays the button the catalogue declares.

## Security and privacy

None. Which element carries an ARIA relation, and which keys open a popup that is already in the page.
No value, no storage, no boundary.

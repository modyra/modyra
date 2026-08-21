# ADR 0117: A row is not a target

Status: Accepted

## Context

Clicking anywhere on a checkbox or toggle row toggled the field — including the empty space to the
right of the words. Three renderers behaved identically, because all three built the wrapper as a
`<label>`, and a native label forwards a click from anywhere inside it. Plain's own header said so:
*"its anatomy is one clickable wrapper"*.

It was first read as a contract divergence — `inputWrapper` is declared `element: "group"` and a
`<label>` is not a group. Measured, that is false:

    dom-tests.ts:133    group: undefined

`group` is deliberately unconstrained, with a comment recording the omission as a decision. So the
conformance check accepted the `<label>`, there was no divergence, and what looked like a repair was
a **design decision** wearing a conformance costume: whether the row is a pointer target.

The decision is that it is not. What made it worth writing down is the second half — removing the
row as a target must not leave the field with a smaller one, because the native input is visually
hidden (1×1, clipped) in every renderer. Measured after the wrapper became a container and the words
became the label:

    the words   toggles
    the box     INERT      ← the thing a person actually aims at
    the row     inert

That is worse than the defect it replaced. WCAG 2.5.5 asks for a 44×44 target; the drawn box had
none at all.

## Decision

**A boolean's row is a container. Its target is the control and the words, and the drawn box is part
of the words.**

- `inputWrapper` on `checkbox` and `toggle` declares `element: "container"` — a per-kind override,
  not a narrowing of `group`, which stays open for wrappers everywhere else.
- `label` on those two kinds declares `element: "label"`, and carries `for` pointing at the control.
- The **indicator** (checkbox) and the **track** (toggle) are parented to `label` rather than to
  `inputWrapper`. This is the part that is not obvious: the native input is hidden, so the `<label>`
  is the only element left that forwards a click, and a drawn box outside it is decoration nobody can
  press.

`MDY_WIDGET_CONTRACT_VERSION` moves 3 → 4: the anatomy changed.

WCAG 2.5.5 is met the way DESIGN.md § *the target is not the box* already meets it everywhere else —
the target is an overlay rather than a grown element, so the visible box keeps its size while the
pressable area does not shrink below 44px.

## Consequences

**Every form with a checkbox or toggle changes behaviour.** Clicking the empty part of the row no
longer toggles. Anyone relying on that has to click the control or its words, which is what the rest
of the row never legitimately was.

The DOM changes in all three renderers: the wrapper is a `<div>`, the words are a `<label for>`, and
the box is inside them. A stylesheet or test selecting `label.mdy-checkbox` or
`.mdy-toggle > .mdy-toggle__track` selects nothing. The shipped stylesheet moves with it — `cursor:
pointer` leaves the row and goes to the label, where the pointer now belongs.

Measured after the whole change:

    the box     toggles
    the words   toggles
    the row     inert

## Alternatives rejected

**Leave the wrapper a `<label>` and shrink its box with CSS.** The row would still forward clicks
from wherever the box reached, so the target would be a rectangle nobody can see the edges of. The
element decides this, not the paint.

**Keep the box outside the label and make it clickable in each renderer.** Three copies of a handler
for something a native element does, in three languages — and the user's own rule for this batch
forbids exactly that: *no local workarounds if the behaviour belongs to the widget*.

**Narrow `group` globally so no wrapper may be a `<label>`.** The mistake that started this, repeated
at scale: `group` is open on purpose, and other kinds' wrappers are free to be whatever they need.

## Verification

- `packages/plain/test/mount.test.mjs` — the anatomy: a `div` wrapper, a `label` for the control, the
  track inside it.
- `packages/widgets/test/structure-contract.spec.mjs` — the contract version names this anatomy.
- The three renderers' conformance suites, which now refuse a `<label>` wrapper on these two kinds.
- Measured directly, and this is the check the tests cannot make: a synthetic click on the box, on
  the words and on the row, before and after.

## Security and privacy

None. No boundary moves and no value leaves the process differently. The change is what a pointer can
reach.

# ADR 0130: A popup outlives the box it opens from

Status: Superseded by [ADR 0131](0131-a-rectangle-outside-a-box-is-not-a-clipped-one.md)

## Context

Where an overlay lives in the document was never decided, so each renderer answered on its own. It
first surfaced as a nuisance — a test that counted chips under the control over-counted in one
renderer, because the popup's options are chips too — and was filed as an asymmetry worth settling
rather than a defect.

Measuring it settled it differently. A multiselect was put inside an ordinary 120px scrolling box, the
shape a form takes inside a dialog, a card or a side panel, and the popup was opened:

```
            popup inside the field   list bottom   scroller bottom   clipped
plain       no                               146               130   no
lit         yes                              146               130   yes
angular     yes                              202               130   yes
```

Two renderers of three draw their options **inside** the field, so an ancestor with `overflow` cuts the
list off. Angular loses 72 of its 104 pixels. This is not a scoping inconvenience; it is a control that
cannot be used inside a scrolling container, which is where forms usually are.

It also corrects the record: the asymmetry was first written down as *Angular keeps its popup inside
where plain and lit portal theirs out*. Lit keeps its inside too. One renderer does this correctly, not
two.

## Decision

**A popup is rendered outside the field it belongs to, in every renderer.**

It is positioned against its trigger and it is not a descendant of it. Plain is the reference; lit and
Angular follow.

Two things follow that are part of the decision rather than consequences of it:

- **an overlay must not depend on its ancestors' `overflow`, `transform`, `clip-path` or stacking
  context**, because a consumer chooses those and a control cannot ask them not to;
- **"scope this query to the control" means the field and not its popup**, in all three, which is what
  makes a spec written against one renderer true of the others.

## Consequences

An overlay outside the field cannot inherit anything from it — theme custom properties reach it through
`:root` or must be set on the overlay, and a renderer that relied on inheritance will need to pass what
it needs explicitly.

Focus and the accessibility tree stop being the DOM's problem and become the control's: an overlay that
is not a descendant needs `aria-controls`, `aria-expanded` and an explicit focus return, and none of
those is free the way containment was.

The trigger's own `overflow: auto` — which [ADR 0127](0127-a-strip-that-scrolls-against-the-practice.md)
requires for the chips strip — stops being able to clip the popup by accident. That is the same class
of defect as the one measured above, one level in, and this decision closes it before it is written.

## Alternatives rejected

**Keep the popup inside and require consumers not to clip it.** What two renderers do today. Rejected
because it is unenforceable: a form inside a scrolling dialog is ordinary, and a control that fails
there fails in the common case while passing every test written on a bare page — which is exactly how
this survived until it was measured.

**Inside, with `position: fixed` to escape the scroller.** Escapes `overflow` and not `transform`,
`filter` or `contain`, each of which creates a containing block for fixed descendants. It trades a
predictable failure for one that depends on a consumer's stylesheet.

**Let each renderer answer for itself, and scope tests accordingly.** The status quo, and it is the
thing the project instructions name outright: Lit and Plain consume the same contract rather than redefine it, and
Angular migrates without unapproved variation. Three answers is three controls.

## Verification

The measurement above is the check, and it is not yet a battle: nothing in the suite puts a field in a
scrolling ancestor and asserts the popup survives it. **That gap is the reason this defect reached a
release-candidate anatomy** — every existing spec mounts on a bare page, where all three renderers look
correct.

The battle owed is: a multiselect inside a 120px scroller, popup open, the list's bottom edge not above
its own last option. It fails today in two renderers of three.

`a-closed-control-a-person-can-read.spec.ts` and `two-doors-to-one-order.spec.ts` both had to be scoped
to the chips strip because of this; when the decision lands, that scoping stops being load-bearing and
becomes ordinary precision.

## Security and privacy

No impact. Where a node is rendered moves no data and grants no capability; the overlay's content is
the same content.

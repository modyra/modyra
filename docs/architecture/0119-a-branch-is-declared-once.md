# ADR 0119: An overlay's boundary is the contract's, not the renderer's

Status: Accepted

## Context

Light dismiss closes an overlay when a primary interaction begins and ends **outside its logical
branch**. ADR-level reasoning about *when* an interaction dismisses has lived in
`createLightDismiss` since it was written, and no renderer decides that moment.

Where it is dismissing *from* was a different story. The rule took an `isInside` predicate, on this
reasoning, written into the file itself:

> A renderer supplies that predicate because only it knows where its portal went.

Four renderers supplied it, four different ways:

| renderer | what it called inside |
|---|---|
| plain | a list of parts, portalled popup included, passed at every call site |
| lit, dropdown | `this.contains(node)` |
| lit, overlay host | `host.contains(node)` |
| angular | the wrapper, widened to the whole host by multiselect |

Three of the four also carried their own copy of a duck-typed node guard, because `Node` is not a
global in every host these packages run in.

The premise is false. A widget that portals a popup **declares the relationship**: its opener names
the popup through `aria-controls`, and `portalRootFor` has followed that declaration out of the
widget root since it was written for the conformance auditor. The branch is derivable from the root,
and four renderers were each answering a question the contract can answer once — with three of them
free to get it wrong, silently, in the direction of a popup that dismisses itself when you press it.

## Decision

**A renderer names the roots of its branch; the contract decides membership.**
`createLightDismiss` takes `MdyOverlayBranch` — `{ root, also? }` — instead of a predicate, and
`overlayBranchContains` answers the question:

- everything under `root` is inside;
- so is whatever `root` portalled, **found from the root rather than supplied**, so a renderer that
  forgets to list its portal is not thereby a renderer whose popup dismisses itself;
- `also` is for what containment cannot reach and `aria-controls` does not name — a part of the
  field rendered outside the root the overlay is anchored to, like a multiselect's chips;
- a target that is not a node is **outside**. An interaction the rule cannot locate did not happen
  inside, and answering the other way produces a popup nothing can dismiss.

`MdyOverlayRoot` is structural — anything that can answer `contains` — because a host that is not
itself a DOM element answers containment perfectly well, and requiring `Element` would put a cast at
every call site to satisfy a type nothing reads.

## Consequences

This is a **breaking change to `@modyra/widgets`'s type surface**: `MdyLightDismissOptions.isInside`
is removed and `branch` is required. `npm run test:type-surface` classifies it `major`. Every call
site in this workspace moves with it; an out-of-tree renderer must supply roots instead of a
predicate, which is a smaller thing to write than what it replaces.

What it costs: a renderer can no longer express an arbitrary boundary. A branch is roots and
containment, so a kind wanting "inside means this element but not that descendant of it" has nowhere
to say so. No kind wants that today, and the constraint is the point — an arbitrary predicate is what
let four renderers diverge.

`branch` accepts a thunk as well as a value, because a renderer's roots are view children that do not
exist when the rule is built. A branch resolved once would hold the nulls it saw then.

The portal lookup runs per interaction rather than being cached. It is a `querySelectorAll` for
`[aria-controls]` within the widget root on each pointer press — bounded by one field's subtree, and
not measured. If it ever shows up, the fix is to cache per open rather than to hand the question back
to renderers.

## Alternatives rejected

**Keep `isInside` and document the portal requirement.** The requirement was already documented, in
the sentence that stated the false premise. Three of four renderers still did not implement it, and a
document that four readers implement four ways is not the mechanism.

**Have the contract find the branch entirely, with no `also`.** It cannot: a multiselect's chips sit
outside the wrapper and no `aria-controls` names them. `also` is the honest residue — the part a
renderer genuinely knows and the contract genuinely cannot.

**Take an `Element` for `root`.** Lit's overlay host is a structural interface with `contains` and
nothing else, and widening the parameter is cheaper than casting a host into a DOM type to satisfy a
signature that only calls one method on it.

## Verification

`packages/widgets/test/overlay-branch.spec.mjs` asserts the two halves that decide whether a press
closes something: a popup this widget portalled is inside wherever it sits, and the popup beside it —
same class, same shape, another field's — is outside.

`packages/plain/test/a-press-inside-a-portalled-popup.test.mjs` drives it through a real renderer:
this package appends a select's popup to `document.body`, and a press on it must not dismiss. The
press lands on the popup rather than on an option, because choosing an option closes the overlay for
reasons unrelated to dismissal and would report "closed" either way.

Shown able to fail rather than merely green: with the portal lookup neutralised **and** the
renderer's own list of parts truncated to the wrapper, the popup dismisses. With either one present,
it does not. That is the defect this decision removes, reproduced.

## Security and privacy

None. No trust boundary moves, nothing is stored or transmitted, and the rule reads only the DOM
relationships a widget already declares. The nearest consequence is one of correctness in the user's
favour: a popup that dismissed itself under the user's own press was a way to lose work in progress
in a form, not a way for anybody to reach data.

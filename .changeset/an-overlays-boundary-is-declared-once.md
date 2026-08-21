---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

An overlay's boundary is the contract's, not the renderer's

`createLightDismiss` decided *when* an interaction dismisses and asked the renderer *where from*,
through an `isInside` predicate. Four renderers answered four ways, three of them carrying their own
duck-typed node guard, and the reason given was that only a renderer knows where its portal went.

It is not true. A widget that portals a popup declares the relationship — its opener names the popup
through `aria-controls` — and `portalRootFor` follows that declaration out of the widget root. So the
branch is derivable, and the three renderers that answered by containment alone would have dismissed
their own portalled popup under the user's own press.

**Migration.** `MdyLightDismissOptions.isInside` is removed; `branch` replaces it:

```ts
// before
createLightDismiss({ isOpen, dismiss, isInside: (t) => t instanceof Node && wrapper.contains(t) });

// after
createLightDismiss({ isOpen, dismiss, branch: { root: wrapper } });
```

`branch` takes `{ root, also? }`, or a function returning one when the roots are view children that
do not exist yet. `root`'s descendants are inside, and so is whatever it portalled — found from the
root, not supplied, so forgetting is no longer possible. `also` is for what containment cannot reach
and `aria-controls` does not name, such as a multiselect's chips outside the wrapper. A target that
is not a node is outside.

`overlayBranchContains`, `MdyOverlayBranch` and `MdyOverlayRoot` are exported for a renderer that
needs to ask the question directly. Angular's `overlayContains` override becomes `overlayBranch`.

ADR 0119 records the decision and what it forecloses: a branch is roots and containment, so an
arbitrary boundary can no longer be expressed — which is the constraint that stops four renderers
diverging again.

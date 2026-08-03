---
"@modyra/widgets": major
"@modyra/plain": major
"@modyra/lit": major
"@modyra/angular": major
---

Light dismiss: an overlay closes on an outside *interaction*, not an outside event.

`capabilities.dismissOnOutsidePointer` changes from `{ event: "pointerdown" | "click" }` to
`false | "light-dismiss"`. A consumer reading `.event` no longer compiles.

An interaction has an origin and a completion, and both decide:

> An overlay closes when a primary interaction that **began** outside its logical branch is
> **completed** outside that branch. An interaction that began inside never dismisses, however far
> outside it ends.

That asymmetry is the point. Selecting text in a popup and releasing past its edge is a drag from
inside, and the browser fires the resulting `click` on a common ancestor — so any rule reading only
the completion target closes a popup the user was working in.

Completion is `click`, not `pointerup`: a drag ending on a different element than it began on
produces no `click` at all, which is exactly the gesture a touch user makes to scroll the page
behind an open popup.

Also normative, and newly enforced:

- only a primary pointer on the primary button dismisses — a right-click opens a context menu, it
  does not close the popup underneath it;
- `pointercancel` never dismisses, and only cancels the interaction it belongs to;
- a `click` with no observed pointer interaction — a keyboard activation, a programmatic `.click()` —
  does not satisfy a capability that names a pointer;
- "inside" is the **logical branch**: invoker, popup, descendants and portalled content;
- an interaction is abandoned on `blur`, on the document being hidden, and on unmount.

The rule lives once in `@modyra/widgets` as `createLightDismiss`, with an explicit state machine. All
three rendering adapters call it, so a renderer can no longer decide when a pointer dismisses.
`Escape` is unchanged.

Recorded as [ADR 0013](../docs/architecture/0013-the-dismissal-names-its-gesture.md), which
supersedes ADR 0011.

Also fixed here: `contract-diff` classified this as `minor`. It treated withdrawal as a capability
disappearing or becoming `false`, and did not see a capability that keeps its name and stops
answering a question it used to — whether by losing a key or by ceasing to be an object at all.

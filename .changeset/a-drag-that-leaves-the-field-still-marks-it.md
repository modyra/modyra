---
"@modyra/widgets": major
"@modyra/angular": patch
---

A gesture that begins inside a panel still records the visit

Two capabilities meet when somebody drags out of an open panel, and the contract orders them:
`dismissOnOutsidePointer` refuses to close on an interaction that began inside the branch, and
`dismissOnFocusOutside` must not reinstate through the focus path exactly the dismissal the pointer
path just refused. Dragging a slider inside a colour panel takes focus off the element under the
pointer, and a widget that closed there would close under the person's own hand.

The half that is easy to lose is the second one: the person has been in this field either way, so it
is touched. Angular wrote this rule out for itself instead of calling the contract's door, and the
copy kept the veto and dropped the visit. Measured across all six kinds with a panel: the panel
stayed open, and the field reported that nobody had been there — so validation waiting for a visit
stayed silent about it. The renderer now calls `bindDismissOnFocusOutside`, which decides which kinds
close this way, which event reports where focus landed, how a portalled panel is recognised as this
widget's, and that a pointer gesture in flight outranks the focus path.

**The public change**: that door's `branch` parameter accepts
`ReadonlyArray<MdyOverlayRoot | null | undefined>` where it accepted `ReadonlyArray<Element | …>`.
`MdyOverlayRoot` is the vocabulary this package already publishes for a branch — `MdyOverlayBranch.root`
has that type, and its own documentation says demanding the full DOM interface "would put a cast at
every call site". A renderer holding a branch had to cast to reach a door that was going to check the
shape structurally anyway.

**Migration: none.** A parameter widens contravariantly, so every existing call still compiles. This
was measured rather than asserted, with a probe that compiles two call shapes against the emitted
declarations: against the new signature both the old element-array call and the new one compile;
against the old signature the same probe *fails* on the new shape — which is what makes its green
worth reading. The one break that is real is exotic: code assigning a narrower implementation to
`typeof bindDismissOnFocusOutside`.

The release is classified major because `contract:diff` classifies it so. Recorded honestly: that
verdict is stricter than the compiler's, and the disagreement is being taken to the tool rather than
argued around here.

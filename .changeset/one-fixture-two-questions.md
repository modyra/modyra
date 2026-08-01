---
"@modyra/widgets": patch
---

`MdyStateFixture` gains two optional members: `value()` and `portalRoots()`.

A fixture is mounted to be asked a question about a widget in a state, and there are two such
questions — whether this renderer is right, and whether three renderers agree. The state matrix asks
the first from the DOM; a canonical observation asks the second and needs the value the form holds
rather than the one a renderer chose to display, plus any element outside the subtree that may hold
the widget's overlay.

Both are optional, so `collectStateMatrix` and every fixture already written are unaffected.

The three in-repo adapters now mount both suites through one fixture each. Two fixtures per adapter
is two claims about the same widget that drift, and only one of them is checked: the state matrix's
driver already knew that a daterange's empty value is an object and a slider's is its minimum, while
the equivalence suite's mount knew neither and could not drive a state at all.

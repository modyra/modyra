---
"@modyra/angular": patch
"@modyra/plain": minor
---

The three places one adapter still answered for itself

**Angular binds the shared light-dismiss listeners.** Two renderers had been
unified onto `bindLightDismiss` and the third kept its own six, which is how the
set drifted in the first place — one of them was deciding on `click` alone, which
the policy documents as the tail of a gesture rather than the gesture.

**Angular draws the contract's backdrop.** It had a `<div>` in its own template
with the colour written inline, so it was the one adapter not using the element
the contract draws and the theme paints. Dismissing it needs no handler of its
own: a click on the backdrop is a click outside, which the shared policy already
answers.

**The framework-free renderer can be told.** It returned a teardown and nothing
else, so `setOptions` and `setBounds` — which the controllers take, and which the
other two adapters pass through — had no door here at all: an option list
arriving from a fetch could not reach a mounted chooser, and a range narrowing
because a sibling was answered could not reach a mounted calendar. The teardown
now carries the updaters its kind supports, so every existing caller keeps
working and the result is still the function it always was.

Its option rows are rebuilt when the list is replaced. They were built once at
mount, so the DOM outlived the list it came from.

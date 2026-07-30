---
"@modyra/react": patch
---

A headless consumer can arrange a form from the contract

This was planned as "render `layout` in react, preact, vue, svelte and solid", on the understanding
that five adapters consumed the contract and dropped its arrangement. They do not: **they render
nothing at all.** They ship hooks, composables and command runtimes, and the consumer brings the
markup. An arrangement cannot be missing from a package with no elements to arrange, so there was no
renderer to write — and the gap was somewhere else.

`@modyra/react`'s dynamic form said `layout` was unapplied "matching the Angular renderer's own
documented gap, not a new one". That stopped being true when `<mdy-dynamic-form>` learned to render
layout, so the one place a consumer would look for this explained the situation with a fact that had
expired. It now says what is actually the case, and points at the two functions that do the work.

The layout audit reported "Adapters rendering layout: 2/2" while never mentioning the other five,
which reads as "every adapter" and means "both of the two that render". It now names the headless
packages as what they are, and checks that `layoutNodeAttributes` and `layoutSlotStyle` are still
exported — because for a headless consumer those two functions are the entire feature, and nothing
else was guarding them.

The recipe is in `docs/guides/headless-recipes.md`, mirrored in a test like every other helper in
that guide: a walk over a layout node that produces the same classes and the same `--mdy-layout-*`
properties both rendering adapters produce. Its first draft spelled a property by hand and asserted
against one that does not exist, which is the mistake the recipe tells you to avoid — so it takes
the names from the contract, and says why in a comment.

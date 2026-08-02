---
"@modyra/widgets": minor
---

A shell part that restates the shell's own class keeps the shell's states.

A widget that gives a part a class of its own has made it a different part, and it does not inherit
the shell's states: a multiselect's `inputWrapper` is `mdy-multiselect`, the grid of chips, and
handing it `mdy-input-wrapper`'s states would mint `mdy-multiselect--disabled` — a class no theme
styles and no renderer emits. That rule is right and stays.

The test for it was wrong. It asked whether a kind *named* a class, not whether the class *differed*,
so a kind that restated the shell's own spelling was treated as having replaced it. `checkbox`
declares `label: ["mdy-label"]` because its label sits inside the wrapper rather than above it — the
same class, the same element a floating label rises on — and lost `filled` and `hasError` for saying
so. `partClasses("checkbox", "label", { filled: true })` threw, while the identical call on `text`
returned `mdy-label mdy-label--filled`.

Three parts get their states back: `checkbox.label` (`filled`, `hasError`), `checkbox.requiredMarker`
and `toggle.requiredMarker` (`filled`). The parts that really are their widget's own —
`checkbox.inputWrapper`, `toggle.inputWrapper`, `toggle.label`, `multiselect.inputWrapper` — still
carry no shell states, and a call reaching for one still throws.

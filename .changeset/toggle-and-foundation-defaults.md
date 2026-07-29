---
"@modyra/styles": minor
---

The switch was invisible in two themes, and now wears a state layer

`--mdy-comp-*` belong to the token tier (`modyra-base.css`), which a theme need not load — so
`width: var(--mdy-comp-switch-track-width)` resolved to nothing and the switch was drawn 0×0 in the
default and Material themes. Every component token the foundation reads now carries the tier's own
value as its fallback, and the audit fails a fallback-less one: a foundation that assumes a theme
loaded something is not a foundation.

The toggle gains a state layer — a halo around the thumb on hover and focus, sized from the handle
and coloured from it, so it reads as the same control lighting up rather than a second thing
arriving. Themes can size, colour or silence it through `--mdy-toggle-state-layer-*`.

Measured in all five themes, off and on: the track keeps its size and its radius, the thumb keeps its
size, and only its position changes.

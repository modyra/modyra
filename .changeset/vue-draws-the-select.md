---
"@modyra/vue": minor
---

`@modyra/vue` draws the select, in the shape that has a panel of its own.

The other shape is the platform's chooser — the contract answers `native` whenever the field does
not filter — and this package does not draw it: it has no popup, no landing place for focus and no
keyboard model a renderer could add without taking one away.

Every behaviour is read from a published door rather than decided in the component: where focus goes
when the panel opens is `focusPartOnOpen`, which key opens, moves, commits or cancels is
`keyBindingFor`, and whether Tab stays inside is `popupHoldsAnAction` — `false` for this kind, so Tab
closes the panel and is left to the browser.

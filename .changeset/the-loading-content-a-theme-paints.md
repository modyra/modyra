---
"@modyra/widgets": minor
---

The select's loading content is declared where the theme already paints it

`mdy-select__loading-content` is drawn by two renderers and styled by a theme, and the catalogue
named it nowhere — so an allowlist entry excused it as drift. It is now a presentation class on
`select`, and the exemption is gone with it.

Presentation rather than a part: a part must declare which element it admits, because a part the
contract has no opinion about admits every element. This is a box the loading state is drawn inside,
not an element the contract has a semantic for.

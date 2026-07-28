---
"@modyra/lit": minor
"@modyra/widgets": patch
"@modyra/angular": patch
---

Take the Lit elements' vocabulary from the contract: each element declares its widget kind and
reads root, shell and part classes from `MDY_WIDGET_CONTRACTS` instead of repeating literals, and
its ids follow the shared id policy. The supporting-text container is always rendered with the id
the controllers describe the control by, so `aria-describedby` no longer dangles. Angular emits the
contract's boolean control class for the same parts, and a jsdom conformance suite holds the Lit
elements to the same runtime DOM gate as the other adapters.

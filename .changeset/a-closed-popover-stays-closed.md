---
"@modyra/styles": patch
---

A closed popup's contents are not drawn in the page

The browser hides a closed popover, and any author rule that states `display` on the panel beats it.
A panel class that lays its contents out — `.mdy-multiselect-overlay__panel { display: flex }` — is
exactly such a rule, so Angular's shut multiselect drew its whole option list in the page: every option
seen twice, announced twice, and clickable in two places.

`[popover]:not(:popover-open) { display: none }` is stated once in the foundation rather than by
scoping each panel class to `:popover-open`. The property being defended belongs to the popover and
not to any one widget, and a class added later would otherwise have to remember.

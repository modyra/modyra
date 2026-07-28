---
"@modyra/widgets": patch
"@modyra/plain": patch
"@modyra/styles": patch
---

Emit the canonical class vocabulary from the widget controllers: `mdy-description` becomes
`mdy-supporting-text`, `mdy-error` becomes `mdy-control__errors`, the control part carries no
`mdy-input` class of its own, and `aria-modal` is emitted as the string `"true"`. Plain builds its
field shell from the contract (so a radio group is `mdy-renderer--radio-group`, as in Angular and
Lit) and no longer stacks a duplicated class on a part.

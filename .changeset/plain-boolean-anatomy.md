---
"@modyra/widgets": patch
"@modyra/plain": patch
"@modyra/styles": patch
---

Give the boolean controls the anatomy Angular and Lit already render: one clickable
`.mdy-checkbox` / `.mdy-toggle` wrapper holding the input, the drawn `.mdy-toggle__track` >
`.mdy-toggle__thumb`, and the text after it. A switch is a checkbox input with `role="switch"`, and
the wrapper — not the input — carries the component class. The theme's Plain-only
`.mdy-switch-control` and input-drawn checkbox rules are gone with the markup that needed them.

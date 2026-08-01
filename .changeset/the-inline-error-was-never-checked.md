---
"@modyra/widgets": major
---

The `inlineError` part is named by the class renderers actually emit. It was declared as
`mdy-inline-error-icon` — the Angular component's *selector*, not a class — so the part was
unlocatable on all thirteen kinds that declare it, and no theme styled the name either. It is now
`mdy-control__inline-errors`, which both adapters emit and three themes style.

Its semantic changes from `status` to a new `image`: the inline error is an icon carrying its
message as an accessible name, not a live region. The message already reaches assistive technology
through the control's `aria-describedby`, and both adapters had independently chosen `role="img"`.

Two further corrections the same fixture exposed:

- The inspector compared a state's *name* against the class suffix, so every state whose modifier is
  spelled differently — `hasError` becomes `--has-error` — was rejected as an invented class. It now
  translates through `MDY_STATE_MODIFIERS`.
- `mdy-inline-errors`, `mdy-control__inline-errors-icon` and `mdy-control__inline-errors-tooltip`
  join the shared vocabulary. A renderer emitted all three and the contract knew none of them.

`allowedClasses` is removed from the DOM inspector options. Nothing passed it; a renderer that needs
a class of its own namespaces it under `adapterPrefix`.

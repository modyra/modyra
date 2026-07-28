---
"@modyra/widgets": minor
---

Multiselect picks from an overlay, like every other popup widget

The multiselect controller now owns an `open` state and `open`/`close`/`toggleOpen` intents, routed
through the same `overlayLifecycleTransition` policy the select and the pickers use, and the view
projects `trigger`, `popup`, `search`, `placeholder` and `chips` parts. Rendering the option group
inline reflowed the page on every open; the group now lives inside the popup.

`view.parts.group` therefore carries `mdy-multiselect__options` (the catalog's listbox class) rather
than `mdy-multiselect`, which is now the trigger's. Renderers that styled the group as the visible
control should move that class to the trigger.

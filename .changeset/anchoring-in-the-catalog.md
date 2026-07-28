---
"@modyra/widgets": minor
"@modyra/plain": patch
---

Each widget declares how its popup attaches

`capabilities.anchoring` names, per kind, whether the popup matches its control's width and how much
room it needs — a select's list belongs under its control and as wide as it, a calendar is sized by
its own content. The renderers read it instead of repeating those numbers, so two adapters can no
longer choose different widths for the same widget, and `MDY_OVERLAY_PORTAL_CLASS` names the class
a renderer adds when it lifts a popup out of its field.

The suite asserts every overlay-capable kind declares its anchoring and carries the shared container
class, so a new widget cannot be added without saying how its popup attaches.

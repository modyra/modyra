---
"@modyra/angular": patch
---

A segmented control's option no longer asserts `aria-disabled`

Each option's native radio carried `aria-disabled` beside its native `disabled`, a state the
segmented `optionControl` part does not declare. A switched-off option wrote `aria-disabled="true"`
on every page. The native `disabled` is what conveys it, as on a radio group and in the other
renderers. No migration; a selector that matched `[aria-disabled]` on a segment should match
`:disabled`.

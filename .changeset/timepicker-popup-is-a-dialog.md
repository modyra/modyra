---
"@modyra/widgets": minor
"@modyra/angular": patch
---

The timepicker's popup declares `role="dialog"` in the widget catalogue.

`MDY_WIDGET_CONTRACTS.timepicker.parts.popup` now carries `role: "dialog"`, which every renderer of
the kind must announce. `@modyra/plain` and `@modyra/lit` already emitted it and are unchanged.

**Migration for a renderer implementing this contract**: emit the declared role on the popup element
wherever the panel is drawn, rather than deriving it from placement. Modality is separate — the
timepicker's popup is modal (`aria-modal="true"`, focus trapped) while the multiselect's declared
dialog is not — so do not derive `aria-modal` from the role alone.

`@modyra/angular`'s timepicker previously announced no role at all unless the panel was drawn over
the page with a backdrop; it now matches the other two renderers, named by the field's label through
`aria-labelledby`. See ADR 0140.

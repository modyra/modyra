---
"@modyra/angular": patch
---

Three things a document declares that this adapter dropped.

- **`ariaLabel` never reached a control.** The dynamic form binds `[label]` on every kind and bound
  the spoken name on none, so a document deliberately giving a control a different spoken name was
  silently overruled by the visible one — and a name that differs from the label is the only reason
  anybody writes it.
- **A field with no label at all was announced as nothing.** The name a control takes now follows
  `fieldAccessibleName`: the spoken name, the visible label, then the field's own name. A poor name
  is better than a text box announced as a text box on a form of them.
- **A file field did not start as the empty list its contract declares.** Every other kind's case
  bound its empty value and this one did not, so a document's file field held `undefined` until
  something was picked and its payload had a different shape from its siblings'.

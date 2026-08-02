---
"@modyra/angular": patch
---

Supporting text is identified, so a screen reader can announce it.

No element in the Angular package carried the `<fieldId>__description` id. All fifteen renderers
emitted `<div class="mdy-supporting-text">` with no `id` at all, and two failures followed from that
one cause:

- **radio, slider, file and segmented** bind the shared projection, which names
  `<fieldId>__description` in `aria-describedby`. That id existed nowhere, so the reference
  **dangled** — the control claimed a description and the browser computed none.
- **The other eleven** use a helper that only ever names the error list. Their supporting text was
  rendered, styled, and **announced to nobody**.

The second is the failure `projectFieldShellA11y` already warns about for error lists — *"without
`aria-describedby` the error list is rendered, styled, and announced to nobody"* — reached from the
description side instead.

`descriptionId` now answers for the supporting-text element and every renderer binds it as `[id]`;
`describedById` names the error list where there is one and the supporting text otherwise, so a
control with neither still describes itself by nothing rather than by an id no element holds.

Measured on the demo, before and after: **0 → 36** controls whose computed accessible description is
non-empty, and **4 → 0** dangling `aria-describedby` references. Text like "Only PDF files are
accepted" and "1 = Poor, 10 = Excellent" reached no assistive technology before this.

Every existing check was green because they all stop at the attribute: they ask whether
`aria-describedby` is present and whether it resolves in their own fixture, and those fixtures render
errors. Nothing asked the browser what description it actually computed. `e2e/screen-reader.spec.ts`
now does.

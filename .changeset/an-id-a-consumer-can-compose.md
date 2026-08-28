---
"@modyra/lit": patch
"@modyra/angular": patch
---

Every published id is composed the way the factory composes one

Seven ids were joined with a hyphen — `field-start`, `field-label`, `field-trigger`, `field-hex` —
where every id this library publishes is `scope__part`. They were unique and they worked, which is
exactly why nothing caught them: what a hand-joined id cannot do is be **composed**. A consumer that
knows the scope builds a part's id the same way the factory does, and reaches nothing for these.

All seven now go through `defaultWidgetIdFactory.part`. Measured on the page afterwards: none left,
in any renderer.

---
"@modyra/vue": patch
---

A refused control names the reason, not the hint

Two controls pointed `aria-describedby` at the supporting text and never at the error list, so a
person using a screen reader heard how to fill the field and not why it had been rejected. The text
was on the page, correct, and announced to nobody.

The select's reference is published by its projection, and the controller already offers
`setDescribedBy` to say which of the two texts applies — this renderer never called it. The colours
field's hex input spelled the description id by hand; it now composes both through
`fieldDescribedBy`, which puts the error first because that is the order a person needs them in.

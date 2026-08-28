---
"@modyra/angular": minor
---

The colour and file fields read their own controllers, and a palette that had stopped closing

The last two kinds here still deciding their own behaviour now take it from the contract, which takes
adoption to 51 of 51 renderer/kind pairs.

**The colour field.** The rule for what a colour act does was shared already; the sequence around it
was not — the transition, the write, the mark, and whether the palette has served its purpose were
four decisions taken in the renderer. They are one dispatch.

Adopting it revealed the shape of a half-adoption. The controller only reports a palette as closable
if it knows the palette is open, and this renderer opened its overlay without telling it: a swatch
chosen wrote the value and left the palette standing over the field a person had just finished with.
Both directions are told now — opened, and closed by whatever closed it. **Nothing asserted the
closing**, which is why it could break silently; a check now does, along with the field being marked
as answered by the same act.

**The file field.** Same adoption, and one behaviour change that comes with it: **clearing a file
field now leaves `[]` where it left `null`.** The field is declared as a list, the contract answers
`[]`, and the framework-free renderer already did — this one was handing hosts a shape the type does
not allow.

Its two outputs had no check at all. `filesRejected` is the only way a host learns a file was turned
away — the value cannot say it — and `fileSelected` now stays quiet when a pick was refused
outright, rather than announcing the previous selection as though it had just been made.

Both checks were written before the adoption, and both mutations that survived the first attempt were
coverage findings rather than passes: nothing had been asserting either behaviour.

The readiness audit named `dispatchValueIntent` as this kind's evidence of taking its behaviour from
the contract. Adopting the controller removes that call, which is the point rather than a gap — the
audit's own header says so, and its table had not been brought along for these two.

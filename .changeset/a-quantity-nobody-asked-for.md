---
"@modyra/plain": patch
---

A number field that is emptied holds nothing, not zero

`MDY_VALUE_CONTRACTS.number` declares the kind nullable: empty is a value a numeric field can hold and
the one it starts from. The renderer read the box through `Number(text)`, and `Number("")` is `0` — so
clearing the field supplied a quantity nobody typed, showed it in the box, and carried it to the wire:
typed 7, cleared, submitted `{"qty": 0}`.

For a quantity that is an order line of zero, for a price it is free, for a discount it is all of it.
And because the box *shows* the zero, noticing means re-reading a field you have just emptied.

Empty is now nothing, text that is not a number is nothing, and a number is itself — which is what
`@modyra/lit` already did for the same kind through the same public call.

Read from the text rather than `valueAsNumber`: that property is unimplemented in some DOM
implementations this renderer runs in, where it answers `NaN` for a box that plainly holds a number.

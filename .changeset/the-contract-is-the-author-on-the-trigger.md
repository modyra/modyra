---
"@modyra/angular": major
---

Apply the field's own part to the multiselect trigger, and stop writing its attributes twice

The trigger received the overlay opener's part — which knows about expanding and controlling a panel,
and nothing about a field's verdict — while the template derived `aria-invalid`, `aria-required`,
`aria-readonly`, `aria-describedby` and `aria-labelledby` for itself. So the contract's answer to
five questions never reached the page, and the answer that did was computed a second time, in another
language, with nothing saying which would win if the two ever disagreed.

The part applied is now the field's own trigger. Measured before the change rather than assumed: it
answers the opener's three — `aria-expanded`, `aria-controls`, `aria-haspopup` — with the same values
in the same state, and the other five besides. The five template bindings are gone.

**The rung this needed, and one it found.** The projection names the caption, the description and the
errors whenever it describes a control, so those references only land on elements this adapter draws
— the batch before this one. It also named an element nobody had looked for: with inline errors,
there is no error list, and the message lives beside the caption. `mdy-inline-error-icon` now carries
the id the field's errors are named by, so a reference the contract makes resolves to the element
that actually holds the message rather than to nothing. The census that sized the previous batch had
measured one mode and missed this one.

**Migration.** `MdyMultiselectComponent.openerPart` is now `triggerPart`, both `protected`: a subclass
reading the old name has to use the new one. `MdyControlLabelComponent` and
`MdyInlineErrorIconComponent` gain an optional `errorsId` input, and `MdyBaseControl` a protected
`errorsElementId` — additions, and nothing existing changes shape.

The guard that recorded which of the two authors won is replaced by one that asserts there is only
one: the states the contract projects are on the element, and every reference it makes resolves.
Putting the opener-only part back turns it red — the element drops to four ARIA attributes and
`aria-invalid` disappears.

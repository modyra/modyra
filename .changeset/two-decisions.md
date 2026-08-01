---
"@modyra/lit": patch
"@modyra/widgets": patch
---

The two questions left open by the role work, answered from evidence.

**Lit's colour palette stops borrowing the swatch's class.** Two buttons carried
`mdy-colors__primary-picker` while the contract declares `nativePicker` singular. Reading what the
themes do with that class settled it: it is written for the control's swatch — `width: 3rem`,
`align-self: stretch`, a fixed swatch that fills the input wrapper — and the palette's button is a
text button reading "Custom…". It was not deliberate reuse; it was a text button wearing a swatch's
geometry. It now carries `mdy-button`, which both themes style and the contract already declares
shared, so nothing new is published and the conformance fixture no longer has to say which of two
elements is the part.

**The multiselect's `aria-required` is recorded as a gap rather than restored.** Neither
`role="group"` nor `role="button"` supports the attribute, and the widget renders its options as
toggle chips in a group by a documented choice rather than as a listbox. The important part is that
removing it lost nothing: an attribute a role does not support is not announced, so the requirement
never reached assistive technology on this widget — the invalid markup only made it look as though it
did. Closing it properly needs a visually-hidden "required" in the label, which is shared CSS that
does not exist yet. The reasoning now sits in the projection so the attribute is not quietly put back.

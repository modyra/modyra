---
"@modyra/plain": patch
"@modyra/lit": patch
---

An entry a control cannot read is an error like any other

ADR 0073 made an unreadable date or time entry a real error of the field. The paint did not follow:
both renderers still asked the control's own state whether to look invalid, which is outside every
rule the form applies to its errors.

Two opposite halves of one hole. `@modyra/plain` kept announcing `aria-invalid` and kept the message
on the page after the field was **disabled** — a control nobody can touch, still reported as wrong to
a screen reader. `@modyra/lit` painted the message without ever reporting the entry, so the control
was never marked invalid at all: visible to whoever can see it, absent for whoever cannot.

Both now report the entry to the form and read the verdict back through `showsAsInvalid` and
`shownErrorsOf`, which is where "a field out of play has no verdict" lives. The same field made wrong
by an ordinary rule already obeyed that in both renderers; the entry error now does too.

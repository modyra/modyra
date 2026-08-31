---
"@modyra/core": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

The month a date is read by

A date field now shows its month named, in the reader's language and order: `2026-04-03` reads
"3 April 2026", "3 aprile 2026", "3. April 2026". A named month cannot be transposed, so the
display says which number is the month without the reader having to know the convention.

The value is untouched and stays ISO — in the form, in the payload, in a draft. What is typed
stays wide: `parseLocalizedDate` already accepted the reader's numeric order, ISO, dots, slashes
or dashes, and still does. What changed is only the text read back, which is now the echo that
catches a transposed entry at the moment it is made.

`formatLocalizedDate(value, locale)` is new on `@modyra/core/datetime`, beside the parser it
inverts. The three renderers derive their field text from it rather than each formatting its own:
plain and lit were showing the raw ISO value and Angular a numeric localized one, so the same day
read three ways across two adapters and neither of them was the one a reader could not misread.

Date **ranges** still format their own text and are unchanged.

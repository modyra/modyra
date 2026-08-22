---
"@modyra/widgets": major
---

An id a selector can reach

An option's key was percent-encoded into its id, which solved half the problem it was written for and
left the other half worse. `%` is not a character a CSS identifier may carry, so
`document.querySelector("#city__option__a%20b")` **throws** rather than missing — measured, not
assumed — and a caller who handles "not found" still gets a stack trace. An option valued `hash#one`
or `quote"three` did the same.

Nothing an assistive technology does was ever broken: `getElementById`, `aria-activedescendant`,
`label[for]` and `aria-describedby` are exact string matches. The path this broke is the one a person
writes by hand, which is why it survived review.

Keys are now escaped as `_` and two hex digits — the one punctuation character an identifier may
hold. Every property the old encoding claimed still holds: reversible, because the escape escapes
itself as `_5F`; injective, because each character carries its own code, so `a b`, `a\tb` and `a\nb`
stay three ids rather than one that every reference resolves to whichever element comes first;
delimiter-free, because an escape is always `_` followed by a hex digit and a hex digit is never `_`.
Above ASCII is left alone — an identifier may carry it, so `città` stays readable.

Migration: an id built from a key containing anything outside `[A-Za-z0-9-]` changes spelling —
`city__option__New%20York` becomes `city__option__New_20York`. A stylesheet or test naming one by
hand is the thing to update, and it is now a selector that parses.

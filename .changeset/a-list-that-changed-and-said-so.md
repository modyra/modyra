---
"@modyra/widgets": patch
---

Replacing a select's options tells whoever is drawing it, and clears a keyboard pointer the new list
no longer has. The declared list was rewritten in place, so the signal holding it published the same
array it already held and nothing was told: `setOptions` — the only published route for changing what
a select offers, called precisely when options have just arrived — left the old ones on the page
until something else redrew it. And `aria-activedescendant` kept naming the option that left, so a
screen reader was pointed at an element no longer in the document until the next keystroke.

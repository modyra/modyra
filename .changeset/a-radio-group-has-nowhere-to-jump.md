---
"@modyra/widgets": major
---

A radio group no longer declares Home and End

`MDY_WIDGET_KEYBOARD` gave every kind that navigates options four `move` bindings — the two arrows,
`Home` and `End`. `radio` and `segmented` are the only members with no overlay, so theirs were the
only `Home` and `End` that landed as closed-state bindings, and a browser sweep pressing them found
that nothing happened.

`Home` and `End` jump to the first and last option, which is the listbox pattern and the grid
pattern. A radio group is neither: the APG gives it Tab, Space and the four arrows, and its arrows
both move and select, so there is no separate reading position for a jump to land on.

**Nothing implemented it.** `@modyra/plain`, `@modyra/lit` and `@modyra/angular` all omit it
independently — one oversight made three times, read as a defect; one rule applied where it does not
belong, read as a contract error.

The condition is asked of the catalogue rather than of a second list: a kind declaring a part with
`role="radiogroup"` gets the arrows and not the jumps. The arrows are untouched.

## Migration

**Four bindings leave the public contract**, which `contract:diff` classifies major. Nothing
implemented them, so no renderer changes and no user loses a key that worked — but the declaration was
public and its removal is a break.

If you build a radio group from `MDY_WIDGET_KEYBOARD`, you now implement two fewer keys. If you had
implemented `Home` and `End` there anyway, keep them: the table is a floor for implementers, not a
ceiling.

**`MDY_WIDGET_CONTRACT_VERSION` does not move.** It names the anatomy — a part existing, its element,
its role — and a key binding is none of those. ADR 0021 withdrew eight bindings on the same footing.

See ADR 0112.

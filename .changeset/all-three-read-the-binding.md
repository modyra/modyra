---
"@modyra/lit": patch
"@modyra/angular": patch
---

All three renderers read the binding for the parts no relation names

The contract now says which message names a part nothing points at. These two were still choosing.

One built `"<caption> — End date"` around a translated word — a sentence no table holds, so a
translated page said half of it in the caption's language and half in English. The other named neither
the second box of a range nor a panel's search input at all, and carried two more hardcoded English
phrases behind them: `"Start date"` and `"End date"`, composed with the caption exactly as the first
one did.

Both read `MDY_PART_NAMES` now. The first box of a range keeps the caption that already points at it,
which is what makes removing its composed phrase safe rather than a tidy-up that ships a nameless
control — asserted, because that is not visible from the removal.

**A mutation that survived, and what it says.** Pointing the range's second box at the *first* box's
message broke nothing: both the renderer check and its expected value read the same binding, so the
two move together. That check is a tautology about following the table, which is worth having and is
not a statement about the table being right. What can be said from the contract is now asserted
there: two parts of one kind must not be named the same words, or a reader in one cannot tell it from
the other.

The readiness fixture asked the Angular renderer's source to mention `daterangeEndLabel`. It reads the
binding instead, which is the stronger evidence — the name comes from the contract rather than this
file happening to use the same word — so the token is the binding.

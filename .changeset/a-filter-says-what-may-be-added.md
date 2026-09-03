---
"@modyra/angular": patch
---

Offer a held value the host's filter refuses

The multiselect widened its option list for a value the field holds that the options do not carry,
and the host's `filterFn` then removed the widened option — while the controller, handed the
filtered list, widened a second time and put it back. Two derivations of one list, and the panel
drew the one that hid the value.

The renderer now reads `filteredOptions` from the controller instead of narrowing again for itself.
A filter says what may be added, never what is already held. ADR 0196.

Visible where a cross-field rule narrows the offered catalogue — the country moves, so the cities do
— and the value already chosen falls outside the new list. It stayed in the chip strip and vanished
from the panel; it is now in both.

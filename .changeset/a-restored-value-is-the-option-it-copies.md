---
"@modyra/widgets": patch
"@modyra/core": patch
"@modyra/angular": patch
"@modyra/lit": patch
---

A restored value is the option it copies

A select handed a value that came back from a draft, a refetch or an import showed nothing chosen:
the controller looked option values up by identity, and none of those returns the option object the
list was built from. It now finds the option by `sameChoice` — a copy of an object option, keys in
any order, or a numeric option's text — and reports the option's own value as the selection.

Draft restore compared stored objects by their JSON text, so an offered option written back with its
keys in another order was dropped as if it were hostile. It now uses the validator's own structural
comparison, so it restores exactly what `oneOf` accepts. Text standing for a number is still refused
from storage. The radio and segmented controller finds its option the same way. The Angular select asks the
contract's rule for both its selected class and `aria-selected`, and the Lit select for its trigger
label and selected state. ADR 0216.

No migration.

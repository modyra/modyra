---
"@modyra/core": patch
---

`mdyFormSerialize` describes a `BigInt` instead of raising on it

`JSON.stringify` refuses a `BigInt` outright, so a form holding one stopped every reader of its
value that serialises — including the devtools panel, whose render effect froze on its previous
paint. It is now described the way a `File` is, `10n` becoming `"[BigInt: 10]"`, which keeps it
distinguishable from the number `10`.

No migration: values that serialised before are unchanged.

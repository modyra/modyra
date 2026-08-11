---
"@modyra/angular": patch
"@modyra/core": patch
---

The devtools panel masks a sensitive field inside a collection, and stops showing dates as `{}`.

The panel's own rule is that it "must never become the easiest way to shoulder-surf a password":
values whose path looks sensitive — `password`, `token`, `secret`, `card`, `cvv`, `ssn`, `iban`, plus
whatever `[maskFields]` names — are replaced with `•••` in the table and in the JSON view. The JSON
view treated an **array as a leaf**, so it handed back its rows whole: a password inside a collection
row was printed in clear, and an `[excludeFields]` path naming a row's field was ignored. The table
was right, because it asks by field path; only the view that gets copied into a ticket leaked. Rows
are now walked by their indexed path, so one rule answers for both views and a listed path may name
`items.0.password`.

`mdyFormSerialize` (`@modyra/core/serialize`) exists so a `File` does not stringify to `{}` — but
rebuilding every object property by property discarded `toJSON`, which made it *lose* what plain
`JSON.stringify` keeps: a `Date` came out `{}`, and so did every domain type that defines `toJSON` to
be storable. A value that defines `toJSON` now keeps the answer it already gives, `File` is still
described first (it has no `toJSON`, and a polyfill adding one must not change how a file reads), and
a value that refers back to itself is described as `[Circular]` instead of exhausting the stack.

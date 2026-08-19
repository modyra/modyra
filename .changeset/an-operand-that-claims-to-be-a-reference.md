---
"@modyra/core": patch
---

An operand that claims to be a reference and is not decides nothing, and the panel describes what it cannot read

Three repairs to the same rule — *a question with no reading is not answered with the one that opens*:

- `{ context: 123 }`, `{ self: "yes" }`, `{ root: 1 }`, `{ path: 4 }` reached the literal branch and
  were compared as the objects they are — never empty, never equal — so `isNotEmpty` answered `true`
  and a section governed by a misspelled operand was shown to everyone. They now decide nothing, the
  way an unknown operator does. An object with none of those members stays a literal: an option's
  value may be an object and a membership list is an array.
- `isPathRef` required the member to be *present*; `{ path: 4 }` then took the read down inside
  `memberAccess`, where a number has no `split`.
- A context key that throws when read — the bag belongs to the application, so in a real one it is a
  store, a signal or a Proxy — no longer takes the whole form read with it.

And `mdyFormSerialize` describes a value it cannot read, as it already described the ones it cannot
carry: an accessor that raises becomes `[Unreadable: <member>]` with the rest of the object intact, a
`toJSON` that fails names itself, and an object that refuses enumeration is described rather than
raising. The panel is what a developer opens when something is already wrong.

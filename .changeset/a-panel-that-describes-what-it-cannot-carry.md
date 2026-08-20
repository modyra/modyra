---
"@modyra/core": patch
---

A snapshot describes a `Map`, a `Set` and an `Error`, and stops before the stack does

`mdyFormSerialize` exists because a `File` carries no `toJSON`, so passing it through read as `{}` —
the same as a field nobody filled in. Three more values had exactly that shape: a `Map` holding
entries, a `Set` holding members and an `Error` carrying a message all serialized to `{}`. Somebody
opens the panel to find out why a form is wrong, and the panel answered a different question. They
are described now — `[Map: 1 entry]`, `[Set: 2 members]`, `[Error: boom]`.

And the walk has a ceiling. Every other walk in this library has one — a path is 512 characters, an
expression is 32 levels — and the one without was the walk whose whole promise is that reading a
form's value never fails: at eight thousand levels it raised `Maximum call stack size exceeded`. It
does not take a hostile value to get there, only a recursive structure from an API or a tree an
editor built. Past 512 levels the value reads `[Too deep]`, beside `[Circular]` and `[Unreadable: …]`.

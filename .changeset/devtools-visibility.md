---
"@modyra/core": minor
"@modyra/studio-model": minor
"@modyra/studio-contract": patch
"@modyra/studio-ui": minor
---

A field decides whether the devtools panel shows its value

The panel masked values by matching the field's name against a regex — `password`, `token`, `iban`
and a handful more — and nothing could overrule it. A guess is right often enough to be useful and
wrong in both directions often enough to matter: `notes` can hold a recovery phrase and was printed
in full, while `cardStyle` was masked for containing "card".

`MdyDynamicField` gains an optional `sensitive`, and `mdyFormSnapshot` takes a `sensitive(path)`
lookup. `isSensitivePath(path, declared)` is the rule in one place: a declaration wins, and the name
heuristic only fills the silence — so nothing changes for a field that says nothing.

In Studio, each field carries an eye beside its required marker. It cycles through three states
rather than two, because "guess from the name" is a real answer and the one every field starts with:
guess → shown in the clear → hidden → guess. A two-state toggle would make the heuristic unreachable
the moment you touched it.

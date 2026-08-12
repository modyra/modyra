---
"@modyra/core": minor
---

An abstraction you can substitute something for

`MdyFormRegistry` was declared inside the engine's own file, beside its only implementation, and both
collection managers imported the concrete `MdyFormEngine` and called eight methods that were on no
interface at all — `registerPathGate`, `refreshPathGate`, `peekField`, `ownField`, `disownField`,
`fieldNames`, `getField`, `errorsFor`. The interface described the class; nothing could be put in its
place, and nothing said so.

- `MdyCollectionHost` names what a collection actually needs from the form that holds it: a control
  claims one field, a collection creates and destroys a range of them and answers for which are in
  play. Both managers now depend on it, and a test drives them against a double that is not the
  engine — behind a `Proxy` that throws on any method the contract does not have.
- `MdyFormRegistry` and `MdyPathGate` moved to `contracts/`, out of the implementation file.
- `MdyReactivity` and its neighbours moved to `reactivity-contract.ts`; the reference runtime and its
  module-level scheduler live in `vanilla-reactivity.ts`. Nine modules that only name the types no
  longer pull four hundred lines of scheduler to do it.
- `MDY_FIELD_KINDS` is a leaf module. `MdyValueKind` was `(typeof MDY_DYNAMIC_FIELD_KINDS)[number]` —
  this library's canonical type derived from a constant inside a JSON parser, which also closed a
  cycle between three modules that compiled only because the build erases type-only edges. The
  document format names the vocabulary now instead of owning it, and a test fails if the re-export
  ever forks.

`MdyArrayManagerDeps.engine` and `MdyRecordManagerDeps.engine` are typed `MdyCollectionHost` rather
than `MdyFormEngine`. The differ reads that as major and it is worth stating plainly: for anyone
*constructing* these deps it is a widening — the engine satisfies the interface — and for anyone
*reading* `deps.engine` expecting the engine's other methods it is a narrowing. Neither type is on
the package entry. Undoing it would mean undoing the inversion, which is the point.

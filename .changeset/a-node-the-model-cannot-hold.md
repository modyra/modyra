---
"@modyra/studio-model": minor
---

A schema node the model cannot hold is refused where the project is opened

A Studio project is a file: saved, committed, hand-edited, written by an older editor and read by a
newer one. `loadProject` refused what it could not use at the **root** and said so by name — not an
object, no valid schema root, a `studioVersion` from the future. Below the root it trusted the type.

A field node with no `name` loaded without a diagnostic and reached the generator, which emitted a
schema keyed by `undefined`: valid TypeScript declaring a field nobody wrote, so "the generated code
compiles" stayed true about a form that is nonsense. A node missing its `validators`, or a group
missing its `children`, came out as a raw `TypeError` from inside a walk — at a door that has a
refusal with its own name.

Every node under the root is now held to the rules the root already applies: it is an object, it
declares a known node type, and it carries a string `id` and `name`; a field carries its `validators`,
a group its `children`, an array its `validators` and its `item`. Refused rather than reported,
because that is what this door already does with a project it cannot use.

The walk is iterative and stops at a node it has already seen — a project is a file anyone may edit,
so its nesting must not decide how much call stack this takes, and the cyclic and too-deep refusals a
few lines below are the ones a reader should get.

A field whose **kind** the editor does not know is deliberately not refused here: `compileToContract`
reports it as `UNSUPPORTED_FIELD_KIND` and degrades the field to text, so the author can open the file
and fix it.

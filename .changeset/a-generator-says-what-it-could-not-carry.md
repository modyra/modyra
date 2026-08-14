---
"@modyra/studio-contract": patch
"@modyra/studio-codegen": patch
"@modyra/studio-target-json": patch
---

A generator says what it could not carry

Three ways a Studio project's intent left the pipeline without a word.

**A field kind nobody recognises.** `compileToContract` looked the kind up in a map and spread the
result, so an unknown one produced a contract field with **no kind at all** — and the only signal
anywhere came from the engine's schema builder, naming a synthesised path rather than the field the
author named, in a package the author never invoked. This is the ordinary case, not a hostile one: a
project written by a newer Studio, a file edited by hand, a kind added to the catalogue after this
shipped.

It is now reported as `UNSUPPORTED_FIELD_KIND` and the field is **degraded to text rather than
dropped** — a field that vanishes takes its parent collection's rules with it, and the author loses
more than the one thing that was wrong. A warning rather than an error for the same reason: an error
blocks the whole compilation, so one unknown kind would cost every other field too.

**A target profile that names no import source.** `buildFormModule` emitted
`import { array, field, group } from "undefined"` — a module that cannot compile, with no diagnostic.
`TargetProfile.factoryImportSource` is required by the type and both `buildFormModule` and
`TargetRegistry` are exported, so a custom target is exactly who reaches this. It now reports
`INVALID_TARGET_PROFILE` and emits nothing.

**A target that ignored its own defaults.** `createJsonTarget().generate(project)` raised where the
other three targets return, because it read `options.pretty` off whatever it was handed while
declaring `defaults() { return { pretty: true } }`. A host iterating the registry worked three times
and crashed on the fourth. It now merges its declared defaults, and an explicit `pretty: false` is
still honoured.

Found by `battle-tests/adversarial/studio/`.

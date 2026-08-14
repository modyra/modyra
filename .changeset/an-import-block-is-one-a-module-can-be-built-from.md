---
"@modyra/studio-codegen": patch
---

An import block is one a module can be built from

`ImportResolver` is a `Map<source, Set<name>>` and checked neither half, so four inputs printed a
block that does not compile:

```ts
import { field } from "a"; import { field } from "b";   // two sources, one binding
import { with space } from "…";                          // not an identifier
import { class } from "…";                               // a reserved word
import { field } from "a"b";                             // a quote in the specifier
```

The collision is the one a **profile** reaches: `factoryImportSource` and `validatorsImportSource`
are separate fields and nothing says they are distinct. The shipped mapper's names happen not to
overlap — the factory brings `field`/`group`/`array`, the validators bring the kind names — which is
load-bearing and was written down nowhere.

Three of the four already had their answer in this package and none was consulted: a reserved word is
`isValidBindingName` (an imported binding is a declaration too), a non-identifier name is the same
check, and a specifier is `printString`.

**Refused rather than repaired**, which is the opposite of what a stub name gets: a stub's name is the
target's to choose, while an import's belongs to the module it comes from — renaming it would bind a
different identifier than the one the mapper then calls, trading a module that fails loudly for one
that fails at the call site.

**Reported rather than thrown**: `imports.problems` is collected into the module's diagnostics as
`INVALID_TARGET_PROFILE`, beside every other bad-profile finding, so a host shows it instead of
catching an exception out of `generate()`.

Found by `battle-tests/adversarial/studio/`.

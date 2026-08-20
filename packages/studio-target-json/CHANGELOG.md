# @modyra/studio-target-json

## 0.5.7

### Patch Changes

- @modyra/studio-contract@0.6.1

## 0.5.6

### Patch Changes

- 28485d9: A generator says what it could not carry

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

- Updated dependencies [bf05bc0]
- Updated dependencies [2a4e09a]
- Updated dependencies [75cfd90]
- Updated dependencies [28485d9]
- Updated dependencies [6e672c5]
- Updated dependencies [5a95871]
- Updated dependencies [9191632]
- Updated dependencies [1b26cac]
- Updated dependencies [4051d66]
- Updated dependencies [1eaa4cd]
- Updated dependencies [178ddce]
- Updated dependencies [1e91463]
- Updated dependencies [a9f1f37]
- Updated dependencies [9116bde]
  - @modyra/studio-codegen@0.6.0
  - @modyra/studio-contract@0.6.0
  - @modyra/studio-model@0.6.0

## 0.5.5

### Patch Changes

- @modyra/studio-contract@0.5.5

## 0.5.4

### Patch Changes

- Updated dependencies [992b36d]
  - @modyra/studio-contract@0.5.4
  - @modyra/studio-codegen@0.5.1

## 0.5.3

### Patch Changes

- @modyra/studio-contract@0.5.3

## 0.5.2

### Patch Changes

- @modyra/studio-contract@0.5.2

## 0.5.1

### Patch Changes

- @modyra/studio-contract@0.5.1

## 0.5.0

### Patch Changes

- 8c7a80f: Exporting an arranged form no longer loses the arrangement in silence

  Planned as "the code generators pass `layout` to the component they emit". They emit no component:
  both targets produce a form _module_ — a schema, its validators, and the stubs they reference — and
  no markup at all. There is nowhere for an arrangement to go, which is a reasonable thing for a
  target to be.

  Losing the work without saying so is not. A form arranged over four breakpoints exported as a flat
  schema with nothing said about it, and the first anyone found out was when they rendered it.

  `arrangementDiagnostics` reports the loss through the channel every other target limitation already
  uses: one `info` diagnostic naming how many layout nodes were dropped, that the JSON target carries
  them, and that `layoutNodeAttributes`/`layoutSlotStyle` apply them to your own markup. `info`, not a
  warning — a target that does not draw has not failed, and an arranged project stays compatible.

  `TargetCapabilities` gains an optional `supportsLayout`, false by default because most targets emit
  no markup. The JSON target declares it, since it serialises the whole contract and `layout` is part
  of the contract — and the test checks the layout is genuinely in the emitted `contract.json` rather
  than merely unreported.

- Updated dependencies [d54a604]
- Updated dependencies [207901b]
- Updated dependencies [8c7a80f]
- Updated dependencies [fd87ae7]
- Updated dependencies [7cec920]
- Updated dependencies [0bcc147]
  - @modyra/studio-contract@0.5.0
  - @modyra/studio-model@0.5.0
  - @modyra/studio-codegen@0.5.0

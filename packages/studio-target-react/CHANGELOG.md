# @modyra/studio-target-react

## 0.5.3

### Patch Changes

- @modyra/studio-contract@0.6.1

## 0.5.2

### Patch Changes

- 4051d66: A target answers with everything it knows about the project

  `core`, `react` and `angular` reported only what their own generators found, so a project the
  contract compiler rejects was answered with `compatible: true` and generated without a word — a
  field whose kind no catalog declares became a plain leaf and the author's tooling had nothing to
  stop on.

  Each now carries the contract compiler's **errors** (its warnings stay with the contract document —
  these targets emit the server validators it omits) and reports a field whose kind is not in its own
  `capabilities.fieldKinds` through the new `capabilityDiagnostics`, the sibling of
  `arrangementDiagnostics`.

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

## 0.5.1

### Patch Changes

- Updated dependencies [992b36d]
  - @modyra/studio-codegen@0.5.1

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

- Updated dependencies [207901b]
- Updated dependencies [8c7a80f]
- Updated dependencies [7cec920]
  - @modyra/studio-model@0.5.0
  - @modyra/studio-codegen@0.5.0

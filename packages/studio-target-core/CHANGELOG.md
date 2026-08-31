# @modyra/studio-target-core

## 0.5.5

### Patch Changes

- @modyra/studio-contract@0.6.3

## 0.5.4

### Patch Changes

- @modyra/studio-contract@0.6.2

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

- Updated dependencies [207901b]
- Updated dependencies [8c7a80f]
- Updated dependencies [7cec920]
  - @modyra/studio-model@0.5.0
  - @modyra/studio-codegen@0.5.0

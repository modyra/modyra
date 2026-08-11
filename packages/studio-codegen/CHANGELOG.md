# @modyra/studio-codegen

## 0.5.1

### Patch Changes

- 992b36d: An expression has a bottom, so a deep document is reported instead of taking the process down.

  Every recursive part of the dynamic contract was bounded — schema depth 8, 500 nodes, layout depth 6,
  100 initial rows, 256 characters of pattern — except the expression tree. `JSON.parse` walks deeper
  than the parser did, so a 52 KB document nesting `and` two thousand levels deep arrived intact and
  `parseDynamicForm` died on it with `RangeError: Maximum call stack size exceeded`, where the contract
  promises a diagnostic. An expression handed over as an object graph could also carry a cycle, which
  spun the same way in `validateExpression` and `expressionPaths`.

  An expression now nests at most `MDY_MAX_EXPRESSION_DEPTH` (32) levels, exported from `@modyra/core`.
  Past it, validation reports a problem like any other malformed shape, path collection stops, and
  evaluation returns what an unreadable rule already returns — `true`, which keeps a field visible and
  fires no error. A cycle meets the bottom rather than spinning. A real condition is three or four
  levels deep, so nothing an author writes is affected.

  `@modyra/studio-contract` holds the same bound: a deeper condition raises `ExpressionTooDeepError`,
  which its compile step reports as `EXPRESSION_TOO_DEEP` rather than as a reference to a missing
  field, and `@modyra/studio-codegen`'s compiler refuses it too — the parity ADR 0007 requires between
  the interpreter and the generator.

  See ADR 0007, amendment "inert includes finite".

## 0.5.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [207901b]
- Updated dependencies [7cec920]
  - @modyra/studio-model@0.5.0

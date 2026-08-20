# @modyra/studio-codegen

## 0.6.0

### Minor Changes

- 4051d66: A target answers with everything it knows about the project

  `core`, `react` and `angular` reported only what their own generators found, so a project the
  contract compiler rejects was answered with `compatible: true` and generated without a word — a
  field whose kind no catalog declares became a plain leaf and the author's tooling had nothing to
  stop on.

  Each now carries the contract compiler's **errors** (its warnings stay with the contract document —
  these targets emit the server validators it omits) and reports a field whose kind is not in its own
  `capabilities.fieldKinds` through the new `capabilityDiagnostics`, the sibling of
  `arrangementDiagnostics`.

- 9116bde: Studio can author a keyed collection

  `RecordNode` joins `ArrayNode` in the project model, and a collection's row may itself be a
  collection. The compiler emits the contract's `record` node, codegen emits `record(...)` with the
  rows the author declared as `initial`, the index walks a row template of either kind, and the
  preview draws a keyed collection from the keys its handle reports rather than from a row count.

  One rule holds across the pipeline: a path crosses **one** positional level. An array below another
  array is refused at compile with `UNSUPPORTED_NESTING`, naming the node that declared it, and
  nothing unaddressable is emitted.

### Patch Changes

- bf05bc0: A bound that is not a finite number is reported, not emitted as `null`

  `mapFieldValidator` gated a numeric bound with `typeof v.value !== "number"`. `NaN` and both
  infinities have a number's type, so they passed — and `literalCode` is `JSON.stringify`, which turns
  each of them into `null`:

  ```
  minLength: 3          →  minLength(3)
  minLength: "3"        →  omitted, MISSING_VALIDATOR_VALUE reported
  minLength: NaN        →  minLength(null), nothing reported
  minLength: Infinity   →  minLength(null), nothing reported
  ```

  Measured against the engine rather than assumed: `minLength(3)` refuses `"ab"` and `minLength(null)`
  accepts it, and it declares `minLength: null` as a fact — so the native constraint goes onto the
  control too. An author writes a minimum, the generated form has none, and nothing between the two
  says a word.

  The gate is `Number.isFinite` now, in both places a bound is read — a field's bounds and an array's
  row counts. A bound that is not a finite number is no more usable than one that is a string, which
  was already reported and omitted; that case is what shows the machinery was there and only the
  question was too narrow.

  Found by `battle-tests/adversarial/studio/`, following the same `NaN`/`Infinity` distinction that
  [ADR 0056](https://github.com/modyra/modyra/blob/main/docs/architecture/0056-a-project-file-does-not-decide-what-the-generated-module-does.md)
  applied to expression operands — the second place it was needed.

- 2a4e09a: The conformance suite asks about both path spellings, and about a file's content

  `runConformanceSuite` is the gate a target must pass before it ships, and `TargetRegistry` is
  exported — so the targets it judges are not only the four in this repository. A host writes what it
  is handed.

  **The path check knew one notation.** `path.startsWith("/") || path.split("/").includes("..")`:

  ```
  ../out.ts        refused      ..\out.ts          admitted
  a/../../out.ts   refused      a\..\..\out.ts     admitted
  /etc/passwd      refused      C:\out.ts          admitted
                                \\server\share     admitted
                                a/..\..\out.ts     admitted
  ```

  A host on Windows resolves every one of those exactly as it reads. Both separators are checked now,
  along with drive-qualified and UNC paths.

  **A file is a path, a language, a role and content**, and three were checked. A file with no content
  at all, and one whose content was the number `42`, were conformant. Two files at one path were too —
  a target overwriting its own output, where which one survives depends on how the host iterates.

  **A target that produces nothing has to say why.** Emitting no files passed every check by having
  nothing to check, which is the emptiest way through a suite whose purpose is to be passed before
  shipping. Nothing plus an error diagnostic is conformant — a project a target cannot express is what
  diagnostics are for — and nothing alone is not.

  Found by `battle-tests/adversarial/studio/`.

- 75cfd90: A generated stub is named something the language accepts

  `buildStubsModule` names each stub from what someone typed into the editor, choosing between the name
  as written and a sanitized one with `isValidIdentifier`. That function answers about an identifier's
  **shape** — a letter, `_` or `$`, then letters, digits, `_`, `$` — and every reserved word has that
  shape:

  ```ts
  export function class(value: unknown): readonly string[] { … }
  ```

  Thirteen ordinary names produced a module that does not compile, and none of them is exotic:
  `default` is what someone calls the fallback rule, `import` the one that runs on an imported row,
  `new` the one for a new record. Studio generates code other people compile.

  Shape and legality are now two questions, because they genuinely are: `isValidIdentifier` still asks
  about shape, which is the right question for a **property key** (`{ class: 1 }` is legal and quoting
  it would be noise), and the new `isValidBindingName` asks whether something can be _declared_.
  `toBindingName` repairs one that cannot — prefixing `_`, which is what a leading digit already gets,
  so there is one repair shape to recognise and the original word stays readable.

  Reserved under **module** semantics, which is what is generated: `await` is reserved there and not in
  a sloppy script, and `let`, `static` and `yield` are reserved under strict mode, which a module always
  is. TypeScript's soft keywords — `type`, `as`, `satisfies` — are deliberately absent: they are legal
  declaration names, and refusing them would rename code that compiles.

  Found by `battle-tests/adversarial/studio/`, the first battle against a Studio package.

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

- 9191632: A project file cannot put code into the module Studio generates

  `compileExpressionToJs` printed a literal operand as `String(operand)` when it was not a string. An
  array is its own join:

  ```js
  // project.json → condition.operands[1] = ["globalThis.taken = 1"]
  value["a"] === globalThis.taken = 1
  ```

  An assignment, in a module a consumer compiles and ships, decided by a file that arrives from a
  repository, a template or an export. `["fetch('//elsewhere')"]` gets there the same way; an object
  gives `[object Object]`, which is the same defect failing loudly. `loadProject` accepted such a
  project and reported **zero diagnostics**, so nothing between the file and the generated code said a
  word.

  An operand is now printed by its kind: a string as an escaped string literal, a finite number and a
  boolean as themselves, and anything else — an array, an object, a function, `NaN`, `Infinity` —
  raises. `loadProject` reports `BAD_CONDITION_OPERAND` for the same values, reported rather than
  thrown, because a project that cannot be opened cannot be repaired in the editor that reports it.

  Both ends deliberately: the editor holds a file someone can fix, and every codegen target reaches the
  compiler directly without loading a project through the model.

  **The four kinds a condition holds compile exactly as before** — that is pinned, since reaching
  further would rewrite conditions that were always correct.

  Recorded as [ADR 0056](https://github.com/modyra/modyra/blob/main/docs/architecture/0056-a-project-file-does-not-decide-what-the-generated-module-does.md).

- 1eaa4cd: An import block is one a module can be built from

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

- Updated dependencies [6e672c5]
- Updated dependencies [5a95871]
- Updated dependencies [9191632]
- Updated dependencies [178ddce]
- Updated dependencies [1e91463]
- Updated dependencies [a9f1f37]
- Updated dependencies [9116bde]
  - @modyra/studio-model@0.6.0

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

# @modyra/studio-contract

## 0.6.2

### Patch Changes

- Updated dependencies [5262ad2]
- Updated dependencies [2dfa37b]
- Updated dependencies [841f0f9]
- Updated dependencies [53ecc1a]
- Updated dependencies [a0ab5de]
- Updated dependencies [6d90b06]
  - @modyra/core@2.4.0

## 0.6.1

### Patch Changes

- Updated dependencies [20c69d0]
  - @modyra/core@2.3.0

## 0.6.0

### Minor Changes

- a9f1f37: Studio draws the nesting the engine runs

  `@modyra/core` lifted the one-positional-level rule and the depth cap (ADR 0043), and Studio stated
  the old rule in three places: `ArrayNode.item` excluded another array, the editor refused to insert
  one, and the compiler reported `UNSUPPORTED_NESTING` and emitted nothing for that branch.

  An array's row is any schema node now, the editor inserts what a project declares, and the compiler
  emits the nesting. `UNSUPPORTED_NESTING` is gone: no shape produces it, so a consumer matching on the
  code will never see it again.

- 9116bde: Studio can author a keyed collection

  `RecordNode` joins `ArrayNode` in the project model, and a collection's row may itself be a
  collection. The compiler emits the contract's `record` node, codegen emits `record(...)` with the
  rows the author declared as `initial`, the index walks a row template of either kind, and the
  preview draws a keyed collection from the keys its handle reports rather than from a row count.

  One rule holds across the pipeline: a path crosses **one** positional level. An array below another
  array is refused at compile with `UNSUPPORTED_NESTING`, naming the node that declared it, and
  nothing unaddressable is emitted.

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

- 1b26cac: A row count that is not a finite number does not reach the contract as `null`

  The same gate as the code generator's bounds, in a different package reading the same field.
  `compileToContract` spread a collection's row count when `typeof minItems === "number"`, and the
  contract is written as JSON:

  ```
  min: 3         →  "minItems": 3
  min: "3"       →  absent            (the wrong type was already dropped)
  min: NaN       →  "minItems": null  nothing reported
  min: Infinity  →  "minItems": null  nothing reported
  ```

  `parseDynamicForm` accepts the resulting contract with no diagnostic either, so the author's rule is
  absent from the output and nothing between the project and the engine says so.

  A project has two outputs and one validator feeds both, in two packages that each decided for
  themselves what a number is. Both are `Number.isFinite` now.

  `@modyra/studio-ui` had the third instance on authored data: a layout's track count for a breakpoint,
  where `NaN` reached the grid as `repeat(NaN, …)` and painted a layout nobody wrote.

  Found by `battle-tests/adversarial/studio/`, filed as one defect across two surfaces rather than two
  coincidences.

- Updated dependencies [435a31a]
- Updated dependencies [76509d3]
- Updated dependencies [d2cdcaa]
- Updated dependencies [27224d8]
- Updated dependencies [894699d]
- Updated dependencies [f297a3c]
- Updated dependencies [09b1c21]
- Updated dependencies [6e53749]
- Updated dependencies [25d004c]
- Updated dependencies [57c68d8]
- Updated dependencies [de7e122]
- Updated dependencies [3fa4c1a]
- Updated dependencies [45eb775]
- Updated dependencies [d2cdcaa]
- Updated dependencies [039059c]
- Updated dependencies [3f0787e]
- Updated dependencies [7ac08a7]
- Updated dependencies [4892a49]
- Updated dependencies [d9203ee]
- Updated dependencies [2904441]
- Updated dependencies [ccde959]
- Updated dependencies [1c164b7]
- Updated dependencies [5440e08]
- Updated dependencies [b9897fb]
- Updated dependencies [a9dcdb4]
- Updated dependencies [d95d4c4]
- Updated dependencies [d470286]
- Updated dependencies [f22d828]
- Updated dependencies [f47ef54]
- Updated dependencies [69b18ae]
- Updated dependencies [6690972]
- Updated dependencies [6d31da6]
- Updated dependencies [a51d3db]
- Updated dependencies [6bc3df5]
- Updated dependencies [404109c]
- Updated dependencies [5f8a35c]
- Updated dependencies [d51b2fa]
- Updated dependencies [8dde798]
- Updated dependencies [cec751a]
- Updated dependencies [95bb48b]
- Updated dependencies [f00ead6]
- Updated dependencies [0c3a770]
- Updated dependencies [1783afc]
- Updated dependencies [f47ee5e]
- Updated dependencies [b6a1325]
- Updated dependencies [3ff02a3]
- Updated dependencies [7f847da]
- Updated dependencies [3233dd4]
- Updated dependencies [d89c221]
- Updated dependencies [6e672c5]
- Updated dependencies [1b76a2c]
- Updated dependencies [a2a2bda]
- Updated dependencies [7c8e0b4]
- Updated dependencies [eab4653]
- Updated dependencies [c521845]
- Updated dependencies [599695f]
- Updated dependencies [d443319]
- Updated dependencies [5b5b2df]
- Updated dependencies [ade50ff]
- Updated dependencies [a336b22]
- Updated dependencies [0994475]
- Updated dependencies [7c53545]
- Updated dependencies [896f37b]
- Updated dependencies [86bda68]
- Updated dependencies [abb242d]
- Updated dependencies [b1874dd]
- Updated dependencies [5a95871]
- Updated dependencies [bc1cc05]
- Updated dependencies [1c8e529]
- Updated dependencies [0a96145]
- Updated dependencies [e59d37c]
- Updated dependencies [ecca49f]
- Updated dependencies [2e005a4]
- Updated dependencies [892c01b]
- Updated dependencies [551320a]
- Updated dependencies [e6b35e4]
- Updated dependencies [9191632]
- Updated dependencies [e35174d]
- Updated dependencies [5e32e40]
- Updated dependencies [29849b2]
- Updated dependencies [626ec0a]
- Updated dependencies [8ad9612]
- Updated dependencies [a0f68a9]
- Updated dependencies [c5f854a]
- Updated dependencies [618a7d0]
- Updated dependencies [906115b]
- Updated dependencies [c395a2c]
- Updated dependencies [df8db70]
- Updated dependencies [9133c94]
- Updated dependencies [e712ea0]
- Updated dependencies [2066daa]
- Updated dependencies [2882c66]
- Updated dependencies [9133c94]
- Updated dependencies [c8f3eb4]
- Updated dependencies [2dd4cff]
- Updated dependencies [fe06a63]
- Updated dependencies [afb6d57]
- Updated dependencies [7695d89]
- Updated dependencies [7f739f7]
- Updated dependencies [70ccff8]
- Updated dependencies [02bbad2]
- Updated dependencies [e2ad213]
- Updated dependencies [7c299e2]
- Updated dependencies [717a69e]
- Updated dependencies [e7e15c7]
- Updated dependencies [6712836]
- Updated dependencies [2bf8290]
- Updated dependencies [095e9ef]
- Updated dependencies [9f45e15]
- Updated dependencies [c7b25ce]
- Updated dependencies [cfa1ec6]
- Updated dependencies [c228019]
- Updated dependencies [0879e90]
- Updated dependencies [44a23e5]
- Updated dependencies [daf38f2]
- Updated dependencies [d6a97f6]
- Updated dependencies [7cbcd34]
- Updated dependencies [ca1c6c3]
- Updated dependencies [aa3574c]
- Updated dependencies [c464e35]
- Updated dependencies [bbf6081]
- Updated dependencies [4914abd]
- Updated dependencies [b5c81b7]
- Updated dependencies [315a533]
- Updated dependencies [30d8a97]
- Updated dependencies [c0e0348]
- Updated dependencies [49cebaa]
- Updated dependencies [7d5dc5b]
- Updated dependencies [8802f09]
- Updated dependencies [bf0c12e]
- Updated dependencies [67aa107]
- Updated dependencies [178ddce]
- Updated dependencies [e30a985]
- Updated dependencies [85ff99a]
- Updated dependencies [9190e59]
- Updated dependencies [ad86c08]
- Updated dependencies [0f9cf08]
- Updated dependencies [e4182c0]
- Updated dependencies [cd62884]
- Updated dependencies [59c70fe]
- Updated dependencies [211ee54]
- Updated dependencies [3fa4c1a]
- Updated dependencies [000f195]
- Updated dependencies [1e91463]
- Updated dependencies [bd8a9ed]
- Updated dependencies [357316c]
- Updated dependencies [7997644]
- Updated dependencies [5589197]
- Updated dependencies [9f29b19]
- Updated dependencies [89e7d14]
- Updated dependencies [bda72f8]
- Updated dependencies [d2e0d7f]
- Updated dependencies [556517c]
- Updated dependencies [4749edc]
- Updated dependencies [eacc848]
- Updated dependencies [83e94a5]
- Updated dependencies [50e1211]
- Updated dependencies [2707f44]
- Updated dependencies [87ff0a4]
- Updated dependencies [621866a]
- Updated dependencies [3c7f88f]
- Updated dependencies [d9583ff]
- Updated dependencies [a9f1f37]
- Updated dependencies [9116bde]
- Updated dependencies [d51b2fa]
- Updated dependencies [8e5fef8]
- Updated dependencies [c8c8470]
- Updated dependencies [e712ea0]
- Updated dependencies [5029184]
- Updated dependencies [ca1c6c3]
- Updated dependencies [07bea5d]
- Updated dependencies [c849c60]
- Updated dependencies [e16ed4f]
- Updated dependencies [b137ea2]
- Updated dependencies [2b04e24]
- Updated dependencies [55dd238]
- Updated dependencies [4bc6e19]
- Updated dependencies [74dbda3]
- Updated dependencies [3b6ecac]
- Updated dependencies [8347116]
- Updated dependencies [bd05055]
- Updated dependencies [9133c94]
- Updated dependencies [14d74cc]
- Updated dependencies [e7b5f9c]
- Updated dependencies [bb37b4e]
- Updated dependencies [c48c9c1]
  - @modyra/core@2.2.0
  - @modyra/studio-model@0.6.0

## 0.5.5

### Patch Changes

- Updated dependencies [34d5023]
- Updated dependencies [b31091b]
  - @modyra/core@2.2.0

## 0.5.4

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

- Updated dependencies [2e29f30]
- Updated dependencies [2e29f30]
- Updated dependencies [c47d0ac]
- Updated dependencies [6921584]
- Updated dependencies [6581883]
- Updated dependencies [2e29f30]
- Updated dependencies [cf498d8]
- Updated dependencies [985685b]
- Updated dependencies [b048e2c]
- Updated dependencies [d5c1774]
- Updated dependencies [94474e4]
- Updated dependencies [039b0b9]
- Updated dependencies [062881c]
- Updated dependencies [c090eac]
- Updated dependencies [992b36d]
- Updated dependencies [850a463]
- Updated dependencies [90fdf00]
- Updated dependencies [df1aaeb]
- Updated dependencies [c47d0ac]
- Updated dependencies [2a38f16]
- Updated dependencies [6921584]
  - @modyra/core@2.1.1

## 0.5.3

### Patch Changes

- Updated dependencies [0b64826]
- Updated dependencies [ba5f5f9]
- Updated dependencies [faf3275]
- Updated dependencies [206b0b3]
- Updated dependencies [3d8391b]
- Updated dependencies [495ff44]
- Updated dependencies [8b88c9f]
  - @modyra/core@2.1.0

## 0.5.2

### Patch Changes

- Updated dependencies [2037ba5]
- Updated dependencies [3161bad]
  - @modyra/core@2.0.0

## 0.5.1

### Patch Changes

- Updated dependencies [0a23bfd]
- Updated dependencies [e8b586a]
- Updated dependencies [76f4e7e]
- Updated dependencies [27c1222]
- Updated dependencies [7bafd3d]
- Updated dependencies [3bb85a6]
- Updated dependencies [186cbad]
- Updated dependencies [3068258]
- Updated dependencies [0d3fa5f]
- Updated dependencies [08cb845]
- Updated dependencies [8e67cfe]
- Updated dependencies [75d2553]
- Updated dependencies
- Updated dependencies [342f396]
- Updated dependencies [1a99bbb]
  - @modyra/core@1.0.0

## 0.5.0

### Minor Changes

- d54a604: A group is something a row can hold

  A layout slot pointing at a container was expanded to the field names underneath it. In a section
  that was invisible; in a column row it was the reason a group could never be put beside a control —
  the cell was built for one child and received however many fields the group happened to contain, and
  the group stopped existing in the compiled contract altogether.

  A container slot now compiles to a **section** carrying the container's own id and label, with those
  same leaf names as its children. The row holds one child. Nothing new was added to the Contract to
  make this work: `MdyDynamicLayoutChild` has always allowed a nested layout node, and both
  `@modyra/plain` and `@modyra/angular` have always rendered one inside a column cell — the compiler
  was throwing away the only thing that made the slot a container.

  Studio follows: the group box has the same column button a field has, side drop zones so a control
  can be dropped beside it, and the neighbour search no longer skips containers when pairing. A group
  at the form root can now be put side by side with a control, by button or by drop, and its fields
  stay inside it.

  A group **inside** another container still has no column button, unchanged and for the reason it
  always had: its parent already owns where it renders.

  Outside a row this is visible too — a group slot in a section now renders as a titled box rather
  than as loose fields, which is what the slot said all along.

- 7cec920: Studio's model can hold a per-breakpoint layout, and compiles to the version that says it

  `StudioLayoutColumns` had no `at`, so a row's track count could not be authored even though Contract
  v2 had carried it for some time, and a slot had nowhere to say where it sits or whether it shows. The
  model now holds both: `at` on the row, and `at` on the slot.

  `StudioLayoutSlot` extends `NodeRef` rather than replacing it, so every `"nodeId" in child` reading
  of a layout keeps working and a slot with nothing to say still serializes as the `{ nodeId }` it
  always was.

  **The compiled version is the lowest one that can say what the project says.** A row's track count is
  v2's own feature and compiles to v2; only a slot that places or hides itself raises the document to
  v3. A form that never touches a breakpoint produces the same v2 document it produced before — no
  stored contract, SDK, or target has to change because v3 exists. `CompileResult.contract` widens to
  `StudioContract`, the union of the two.

  Placement that a row could not honour — a column past its tracks, a size that says neither `column`
  nor `hidden` — is dropped rather than compiled, because a half-finished edit in the canvas is the
  ordinary way to produce one and it must never cost the author their form.

- 0bcc147: Studio previews the real controls

  The Preview panel hand-wrote its own `<input>`, `<select>` and `<textarea>` for every field it drew.
  A datepicker previewed as a text box, a slider as a text box, a toggle as a checkbox, a multiselect
  as a native multi-select — and a preview whose controls are not the controls is not a preview, it is
  a mock-up that happens to be bound to real state. Everything it told you about validation was true;
  everything it showed you about the form was Studio's own drawing.

  Preview now mounts the same controls the canvas does — `renderField` from `@modyra/plain`, given the
  descriptor `compileToContract` emits and the live handle of the form the panel already reports on.
  The value, the errors and the pending state are the live ones; the appearance is the foundation's.

  What made this possible is that the fields no longer live in a repainting region. The panel is three
  siblings — a head Region, a persistent mount, a tail Region — because `Region.update` rewrites
  `innerHTML`, and mounted controls inside it would be destroyed on every keystroke, taking the caret
  and any open popup with them. The mount is rebuilt only when the structure it draws changed: the
  schema, the arrangement, a repeater's row count, a mock mode, or the identity of the form itself.
  Typing changes none of them.

  `@modyra/studio-contract` gains `dynamicFieldForNode(node, name)`, the descriptor for one project
  field at one live path. The whole-project compiler flattens repeaters from their _initial_ rows, so
  it cannot describe a row pushed in Preview; this answers for that path from the same mapping, so a
  previewed control is the control the contract asks for rather than a second opinion about it.

  Studio's own chrome stays Studio's: the repeater's Add row/Remove, the per-field server-mock
  selector, the validity badges and Submit. `@modyra/plain` renders a repeater's rows as flat fields
  and has no repeater control of its own, so those buttons remain Studio's to draw.

  One visible consequence: the foundation keeps a field's error list in the DOM and empties it rather
  than removing it, so `.mdy-control__errors` is now always present in the preview — Studio's markup
  used to add and remove the element, which reflowed the form under the pointer on every keystroke.

### Patch Changes

- 207901b: A field decides whether the devtools panel shows its value

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

- fd87ae7: A placement belongs to a column, and now says so everywhere

  Contract v3 shipped a gap: a slot's `at` parsed anywhere a slot could appear, but only a column could
  act on it. A slot in a section was accepted and then silently ignored by every renderer — the exact
  failure the strict parser exists to prevent.

  **Placement is now refused where it cannot be honoured.** `at` is valid only inside a `columns` row,
  including for a section at the top of a layout, which occupies no column. A slot with no `at` is
  still a field name written longhand and is fine anywhere.

  **And it is now possible where it was needed.** A group compiles to a section, so a group in a row
  could be moved and hidden per size in Studio and the compiler dropped both without a word. A section
  occupying a column carries the same `at` a slot does, read by the same code in both renderers — the
  column is the element either way. Studio's group box gains the controls its fields already had:
  left/right, columns-across, and the eye.

  Also closed, all of them ways the same feature could be silently lost:

  - A `column` past a row's tracks — what a row narrowing under it leaves behind — is trimmed at
    compile time. It used to reach the parser, be refused, and take the whole layout down with it.
  - The compiled version is read off the finished layout rather than tracked while building it, so a
    document cannot claim v3 for a placement that was trimmed away after the slot carrying it was
    emitted.
  - `layoutNodeAttributes` reads only numbers from `at`. Row counts and slot placements share the key
    across the layout union, and a placement reaching it became `NaN` tracks.
  - A group in a column laid its legend out on one unwrapped line: a dozen controls, 267px of them in a
    135px column, overflowing onto the column beside it where they took the clicks meant for its
    buttons. The action bar now folds inside its own column — scoped there deliberately, since at full
    width it fits on one line and folding it would only make every row taller.

- Updated dependencies [29621a7]
- Updated dependencies [b0aa545]
- Updated dependencies [2ce4ef1]
- Updated dependencies [9e8cbad]
- Updated dependencies [879b5e9]
- Updated dependencies [c4ca77d]
- Updated dependencies [207901b]
- Updated dependencies [05c5665]
- Updated dependencies [242551e]
- Updated dependencies [d568743]
- Updated dependencies [098a0af]
- Updated dependencies [a8606da]
- Updated dependencies [f5ee72d]
- Updated dependencies [9864d9a]
- Updated dependencies [6aab031]
- Updated dependencies [fd87ae7]
- Updated dependencies [1523836]
- Updated dependencies [fc6327f]
- Updated dependencies [61271c5]
- Updated dependencies [fe0dba3]
- Updated dependencies [7cec920]
- Updated dependencies [df563d4]
- Updated dependencies [1644bf5]
- Updated dependencies [ec3d8ca]
  - @modyra/core@0.5.0
  - @modyra/studio-model@0.5.0

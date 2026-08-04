# @modyra/studio-contract

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

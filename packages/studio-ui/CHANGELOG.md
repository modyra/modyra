# @modyra/studio-ui

## 0.5.2

### Patch Changes

- Updated dependencies [fa6d81e]
- Updated dependencies [c76dfc9]
- Updated dependencies [c1ddb7c]
- Updated dependencies [14bdd6a]
- Updated dependencies [4e9a4bc]
- Updated dependencies [aeca6f4]
- Updated dependencies [2c6ff57]
- Updated dependencies [7ecaef6]
- Updated dependencies [0f45da0]
- Updated dependencies [1a4d6f2]
- Updated dependencies [e5f45bb]
- Updated dependencies [a5658fb]
- Updated dependencies [81171c9]
- Updated dependencies [eb267c1]
  - @modyra/styles@0.7.0
  - @modyra/plain@0.6.1
  - @modyra/studio-contract@0.5.2
  - @modyra/studio-preview@0.5.2
  - @modyra/studio-target-json@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [ff37d78]
- Updated dependencies [5db335c]
- Updated dependencies [ed2b5c1]
- Updated dependencies [e8b586a]
- Updated dependencies [ebc9014]
- Updated dependencies [b020a7b]
- Updated dependencies [a3c4580]
- Updated dependencies [f107368]
- Updated dependencies [35d6094]
- Updated dependencies [b067cdc]
- Updated dependencies [57a0daf]
- Updated dependencies [643ac13]
- Updated dependencies [ca0eebc]
- Updated dependencies [2ac6b1e]
- Updated dependencies [31cbcdb]
- Updated dependencies [75d2553]
- Updated dependencies [34c5fd6]
- Updated dependencies [c783668]
- Updated dependencies [ba9d206]
- Updated dependencies [5dbdf1a]
- Updated dependencies [b10a5b1]
- Updated dependencies [c7c6adf]
- Updated dependencies [b558322]
- Updated dependencies [bc91571]
- Updated dependencies [e4aa213]
- Updated dependencies [342f396]
- Updated dependencies [84ae084]
- Updated dependencies [3367ced]
- Updated dependencies [bfeb371]
- Updated dependencies [bdde472]
  - @modyra/plain@0.6.0
  - @modyra/styles@0.6.0
  - @modyra/studio-contract@0.5.1
  - @modyra/studio-preview@0.5.1
  - @modyra/studio-target-json@0.5.1

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

- 14682ec: Each size keeps its own layout

  Setting a width at `sm` also changed `md` and `lg`. That is the mobile-first cascade working as CSS
  defines it — a size that states nothing follows the nearest smaller one that does — and the previous
  change made it _legible_, labelling the inherited value `auto 2× from sm`. Legible is not the same as
  correct: each size is meant to hold its own arrangement, and changing one must never move another.

  Studio now **pins the sizes a change would otherwise move**. Before writing a size, every larger size
  with nothing of its own is given the value it is currently showing, so it stops following. Setting
  `md` to one column on a two-column row writes `lg = 2` first, then `md = 1`; `lg` stays two columns.
  Smaller sizes are never touched, because the cascade only runs upward.

  The same rule applies wherever a size is authored — the row's track count, a field's visibility, and
  a field's column within the row — so the behaviour is one rule rather than three.

  Only the sizes that would have moved are written, so a row still states what it needs rather than all
  four sizes every time anything is touched. The emitted contract is unchanged in shape and still
  cascades legitimately; what changed is that Studio stops _relying_ on the cascade the moment the
  author states something.

  `auto` remains, and is now the only thing that puts a size back to following a smaller one.

  Reported as _"ogni layout deve avere la sua conformazione, non è che se cambio in SM allora anche MD
  sarà così."_

- 1259afd: Studio lays out for a screen size, and shows you that size while you do

  There was no way to say what a form does on a phone. The canvas was one width, a row's track count
  was whatever the row's column count happened to be, and every arrangement applied everywhere.

  The toolbar gains **base / sm / md / lg**, and it both authors and previews:

  - **Previews** — the canvas narrows to that breakpoint's width, so the foundation's own media queries
    decide the arrangement rather than Studio predicting it. What you see is what the form does.
  - **Authors** — `base` edits the arrangement itself; the other three write overrides for that size
    only. A form composed without ever touching the selector is unchanged, and produces the same
    contract it did before.

  Three things are authorable per size, which is what a layout actually needs:

  - **How many across** — a select on a row's field, bounded by the columns the row has.
  - **Where a field sits** — `←` / `→` (and `Alt+←/→`) move a field between columns. At `base` that
    rearranges the row; at any other size it writes that field's column at that size and leaves every
    other size alone. Otherwise moving a field on a desktop would move it on a phone, and there would
    be nothing per-breakpoint about it.
  - **Whether it shows** — an eye on the field's action bar. Turning it back on at a larger size writes
    an explicit "shown" rather than removing the entry, because a size that says nothing inherits the
    smaller one — "hidden on a phone, shown from tablet" needs the tablet to say so.

  The selected size is view state, deliberately outside the command history: which width you are
  looking at is not an edit, and undoing one must not also move you to another screen.

  Studio's canvas widths are restated rather than imported — studio-ui depends on no renderer contract
  package — and a test in `@modyra/widgets` fails if they drift from `MDY_LAYOUT_BREAKPOINTS`, since a
  canvas previewing `md` at a width the foundation does not switch at would show an arrangement the
  shipped form never produces.

- 0cbfcb4: Studio's canvas draws on Modyra's foundation

  The canvas renders Modyra controls, but Studio never loaded `@modyra/styles` — so it restated the
  contract's own rules, re-implementing `.mdy-layout-columns` as a grid of its own reading
  `--mdy-layout-column-count`. Two pictures of the same layout, free to drift.

  `apps/studio` now depends on `@modyra/styles` and imports the foundation before Studio's chrome, so
  the layout grid, the field height, the popup container and the chip primitive are the contract's.
  Studio's rule keeps only what is Studio's: the spacing between the tracks.

  Verified with Studio's own end-to-end suite — the layout, canvas and preview specs pass with the
  grid deduped, and the run is identical to the one before the change.

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

- 72e1156: The size selector comes out of the floating toolbar

  Choosing which screen size you are laying out for lived inside the dock — behind a FAB that is
  collapsed by default and floats over the canvas. It is a constant action while arranging a form, and
  the canvas underneath is already showing the answer, so it belongs where it can be seen.

  There is now a permanent strip above the canvas holding **base / sm / md / lg**, the width that size
  means, and a line saying what editing at that size does. The dock goes back to being what it was:
  templates and project actions.

  Same `data-breakpoint` attributes and `aria-pressed` state, so nothing addressing it had to change —
  and several tests stop opening and closing the toolbar just to reach it.

- 9a2e3b1: Zoom the canvas, so a wide viewport fits a narrow screen

  A `lg` viewport is 80rem. With the outline and the inspector open there is nowhere near that much
  room, so the size most worth checking was the one you could not see: the canvas simply scrolled.

  The canvas bar gains a zoom — 50 / 75 / 100 / 125 % and **Fit**, which works the ratio out from the
  room the canvas actually has. Zoom changes how big the form is _drawn_ and nothing else: it still
  measures `lg`, the container queries still report `lg`, and the arrangement on screen is the `lg`
  arrangement. Seeing a wide layout on a small screen was the point; showing a narrower one instead
  would have defeated it.

  **It is a `transform`, not the `zoom` property, and that was measured rather than assumed.** `zoom`
  is inherited into the top layer, so a popup's viewport coordinates were reinterpreted in the zoomed
  space and it landed about a hundred pixels off its control, above it instead of below. A transform
  does not reach the top layer: the popup stays anchored, and is drawn at natural size, which also
  keeps it readable while the form around it is half-size. Both facts have tests.

  A transform leaves the original layout box behind, so the canvas surface is sized to the scaled
  result and clips it — otherwise the canvas went on scrolling to reach a width no longer drawn
  anywhere.

  The preview panel now also names the breakpoint its own width reads as. Its width is whatever the
  panels leave it and lands on a breakpoint almost never, so the nearest one is reported — the panel
  used to show an arrangement it never named.

### Patch Changes

- 420ebf9: A layout asks how wide the form is, not how wide the window is

  The foundation's breakpoints were `@media` queries, which made a row's arrangement a property of the
  **window**. The same form in a sidebar and in a full-width page laid out identically; a preview panel
  could not show what a narrow form does without lying about its width; and Studio's canvas had to
  re-resolve the track count in JavaScript and override the foundation to show the size being authored.

  `MDY_LAYOUT_BREAKPOINTS` has always described the _form_ — "what a row looks like on a phone, a
  tablet, a desktop". A container query is what actually asks that. `.mdy-dynamic-form` is now a named
  container and the three blocks are `@container mdy-form (min-width: …)`. The widths, the
  `--mdy-layout-column-count-*` cascade and the per-slot placement are all unchanged.

  `<mdy-dynamic-form>` takes the `mdy-dynamic-form` class on its host, so all three renderers name the
  form root the same way — `@modyra/plain` always has — plus `display: block`, because a custom element
  is inline by default and an inline box cannot be a container.

  **This changes behaviour for hosts, deliberately.** A dynamic form rendered in a narrow column now
  stacks its rows even on a wide screen. That is the arrangement the form's own width earns, and it is
  what the breakpoints meant all along.

  Studio drops the workaround this replaces: the resolved-count loop and the rule that outranked the
  foundation are gone, and the canvas gets its arrangement from the same queries the shipped form does.
  The canvas frame is sized by its **content box** so that previewing `md` makes the _form_ md wide —
  measured border-box, the frame's own padding came off the form and `md` answered as `sm`. The canvas
  scrolls when the panel is narrower than the size being previewed, which is the honest cost of
  previewing a size the panel cannot fit.

  Baseline is not a concern: the foundation already relies on `@starting-style` and
  `transition-behavior: allow-discrete`, both newer than container queries.

- ed2a010: A width says whether this size decided it, or inherited it

  Setting a row to one column at `md` also changed `lg`. That is the mobile-first rule working —
  a size that says nothing reads the nearest smaller one that does — but nothing on screen said so.
  The control showed `1×` at `lg` exactly as it showed `1×` at `md`, so an inherited number was
  indistinguishable from a decision, and there was no way to stop inheriting once you had started.

  The columns-across control now leads with an **auto** option that names the number this size would
  show anyway and where it comes from — `auto 1× from md` — and is selected whenever this size has
  stated nothing. Picking a number states one for this size only. Picking `auto` takes the statement
  back, which had no control at all before.

  The distinction is carried by the option's own words rather than a shade: dimming it put the text
  under the AA contrast ratio, and words are what a screen reader gets.

  Reported as _"nel canvas non vedo per ogni breakpoint il layout che ho deciso"_ — and it was true:
  what you had decided and what you were merely inheriting looked the same.

- 5f9869f: Hiding a column actually hides it, and stays undoable

  Studio restated `display: grid` on `.mdy-layout-column`. That beat the foundation's own
  `display: var(--mdy-layout-column-display, flex)`, so a column hidden at a breakpoint published
  `none` and went on being displayed — the property was right the whole time and nothing happened. The
  e2e could not catch it, because it asserted the custom property rather than the effect; it asserts
  the effect now, the same lesson as the group-visibility bug before it.

  Studio no longer restates `display` at all. A stacking column is a stacking column whether it is flex
  or grid, and the one that decides is the foundation's.

  That fix immediately produced a worse problem: with hiding working, hiding a node on the canvas took
  the eye that would unhide it away with the node, and the edit could not be undone. **The canvas is an
  editor, so it marks a hidden column instead of removing it** — dimmed, badged "hidden here", still
  selectable and still editable. The shipped form hides it for real; only the canvas keeps it in reach.

  _(An earlier draft of this note also claimed the Preview tab hid it for real. It did not: Preview
  built its own arrangement and ignored every slot's placement. That is fixed separately, in "Preview
  shows the arrangement it is previewing".)_

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

- 7ebd064: Preview shows the arrangement it is previewing

  Preview is the third renderer of the same layout and it was the one left behind. `mountArrangement`
  wrote the declared column count by hand and ignored the row's `at` and every slot's `at`, so the
  per-breakpoint counts, per-size column placement and per-size visibility were authorable, compiled,
  shipped — and invisible in the one panel that exists to show them. A row drew the same arrangement at
  every width while the form it previews changed at three.

  It now calls the same `layoutNodeAttributes` the two shipping renderers call, and applies
  `layoutSlotStyle` to the **column**, which is the grid item that can act on it — the same reading as
  `@modyra/plain` and `<mdy-dynamic-form>`, so the panel and the form cannot disagree about where a
  field goes or whether it shows.

  The preview container is also named `mdy-dynamic-form`, like the other two renderers' roots.

  One consequence worth stating: a row now stacks in Preview at the narrowest size and takes its
  declared tracks from `sm` up, because that is what the shipped form does. Preview used to show the
  declared count flat at every width, which read as "two columns" no matter how narrow the panel was.

- bd4fe56: Two rows at `sm` and one at `md`, from the same three fields — proved and kept proved

  Reported as not being able to set different layouts between SM, MD and LG. Driven end to end in
  Studio, it works: a row of `username`, `password` and `mail` told to be **two tracks wide at `sm` and
  three at `md`** draws username and password together with the mail below at `sm`, and all three on
  one line at `md`. A row is a grid, and a grid wraps — the third field goes to a second line when
  there are only two tracks for it.

  The regression test asserts it from the **drawn cells**, by their measured y positions, rather than
  from the width control. The per-breakpoint tests already covered what the control says; this covers
  what the form does with it, which is the half a user actually sees. It also re-checks `sm` after
  setting `md`, because "each size holds its own arrangement" is the property that made this worth
  authoring per breakpoint in the first place.

  No behaviour changed. What was missing was the proof.

  Worth knowing, and not changed: a row offers as many track counts as it has fields, so **a row of two
  fields can only take two distinct widths across four sizes** — at least two sizes must match. Whether
  a row should be able to declare more tracks than it holds, with Contract v3's per-slot `column`
  placing fields into the gaps, is a product decision rather than a defect.

- c2d5302: The canvas draws the size you are authoring, not the size of your window

  Choosing `base` narrowed the canvas to a phone and then drew the desktop's two-column row anyway. The
  foundation's breakpoints are **viewport** queries, and the canvas is a frame inside a window that had
  not changed width — so the frame shrank and the arrangement did not. The selector previewed the width
  and nothing else, and the e2e could not tell, because it asserted the published custom properties
  rather than the tracks the browser actually computed.

  Studio is the only thing that knows which size is being authored, so Studio picks which of the counts
  the renderer already published applies, and the canvas draws that row. The counts stay the
  renderer's — this chooses among them rather than restating a grid, which is what made the canvas
  drift from the form the last time tracks were written here — and with nothing selected it falls back
  to exactly what the foundation would have done.

  The test now counts the computed tracks. `base` stacks; `md` shows two; narrowing the row at `md`
  stacks it there and leaves every other size alone.

- 8864b01: The canvas fits by default, so switching size shows the difference

  Reported: _"cambiando il breakpoint continuo ad avere lo stesso layout spalmato ovunque."_ The
  arrangement was right the whole time — what was wrong is that you could not see it.

  A `md` form is 64rem and an `lg` form 80rem. The canvas between the outline and the inspector is a
  few hundred pixels, and at 100% it simply scrolled: every size showed the **same left-hand slice**,
  measured at 51% of the form at `lg` and 63% at `md`. Four different arrangements, all cropped to the
  same visible strip, so switching size looked like it changed nothing.

  The zoom therefore starts on **Fit**. It never magnifies — it is capped at 1 — so a size that already
  fits is untouched and this costs nothing where it was not needed. With it, all four sizes are fully
  on screen and visibly different.

  Two corner cases closed with it:

  - **A fit only holds for the width it was measured against**, and the panels move. Dragging the
    inspector wider is exactly when a fitted canvas would quietly stop fitting, and nothing re-rendered
    on a resize. A `ResizeObserver` on the canvas re-fits it, off the render path.
  - That observer is **feature-detected**. It is a refinement, not a requirement, and hard-requiring it
    stopped Studio mounting at all where the API is absent — twelve unit tests, in the everyday case of
    a jsdom run.

  The new regression test asserts what the report was about: with a different arrangement authored at
  each size, every one of them is both fully on screen and its own arrangement, and the form really was
  laid out at four different widths rather than one width four times.

- Updated dependencies [33eeeae]
- Updated dependencies [d54a604]
- Updated dependencies [1f09875]
- Updated dependencies [420ebf9]
- Updated dependencies [29621a7]
- Updated dependencies [602ac27]
- Updated dependencies [766851c]
- Updated dependencies [46e6a0e]
- Updated dependencies [b0aa545]
- Updated dependencies [2ce4ef1]
- Updated dependencies [879b5e9]
- Updated dependencies [cd22e96]
- Updated dependencies [b45d649]
- Updated dependencies [33679ba]
- Updated dependencies [e5eb12d]
- Updated dependencies [c2fc744]
- Updated dependencies [fbf1fa7]
- Updated dependencies [881d3e5]
- Updated dependencies [207901b]
- Updated dependencies [05c5665]
- Updated dependencies [9e06022]
- Updated dependencies [242551e]
- Updated dependencies [9ff6635]
- Updated dependencies [14ba12d]
- Updated dependencies [8c7a80f]
- Updated dependencies [8a5aff2]
- Updated dependencies [098a0af]
- Updated dependencies [8279dc3]
- Updated dependencies [031f820]
- Updated dependencies [8e1164f]
- Updated dependencies [db0c39a]
- Updated dependencies [5e23a94]
- Updated dependencies [0d22b78]
- Updated dependencies [3f2e9d0]
- Updated dependencies [a8606da]
- Updated dependencies [f5ee72d]
- Updated dependencies [7dfad3e]
- Updated dependencies [ff4edb2]
- Updated dependencies [6bdfb02]
- Updated dependencies [351c0ed]
- Updated dependencies [65ca85b]
- Updated dependencies [25b9dd7]
- Updated dependencies [9f20c63]
- Updated dependencies [c1253e3]
- Updated dependencies [8e1dc80]
- Updated dependencies [d9e424a]
- Updated dependencies [d21390f]
- Updated dependencies [9864d9a]
- Updated dependencies [fd87ae7]
- Updated dependencies [9d7b426]
- Updated dependencies [ecfb325]
- Updated dependencies [26017d8]
- Updated dependencies [e0a4cef]
- Updated dependencies [9f0170d]
- Updated dependencies [9f0732c]
- Updated dependencies [623f3fc]
- Updated dependencies [e7f3189]
- Updated dependencies [7cec920]
- Updated dependencies [0bcc147]
- Updated dependencies [3eb8a33]
- Updated dependencies [2679735]
- Updated dependencies [88b57b4]
- Updated dependencies [b3aa842]
- Updated dependencies [9e8d1c8]
- Updated dependencies [0e38698]
- Updated dependencies [f759e3d]
- Updated dependencies [d082bf8]
- Updated dependencies [df563d4]
- Updated dependencies [6d000c1]
- Updated dependencies [182dfe8]
- Updated dependencies [026cf08]
- Updated dependencies [1292b5f]
- Updated dependencies [2074ba4]
- Updated dependencies [a613ac8]
- Updated dependencies [fbef1f6]
- Updated dependencies [e403b6d]
- Updated dependencies [4128b40]
- Updated dependencies [095fff8]
- Updated dependencies [77f2095]
- Updated dependencies [b4b236d]
- Updated dependencies [9c8a238]
- Updated dependencies [0310e27]
- Updated dependencies [5a66c4a]
  - @modyra/styles@0.5.0
  - @modyra/studio-contract@0.5.0
  - @modyra/plain@0.5.0
  - @modyra/studio-model@0.5.0
  - @modyra/studio-codegen@0.5.0
  - @modyra/studio-target-angular@0.5.0
  - @modyra/studio-target-react@0.5.0
  - @modyra/studio-target-json@0.5.0
  - @modyra/studio-preview@0.5.0
  - @modyra/studio-editor@0.5.0
  - @modyra/studio-target-core@0.5.0

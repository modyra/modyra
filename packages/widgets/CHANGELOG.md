# @modyra/widgets

## 2.1.0

### Minor Changes

- b31091b: A package depends on its siblings by range, so a tree holds one engine instead of two.

  Every package except `@modyra/angular` pinned its siblings at an exact version. The packages version
  independently, so a release that lands partially — as 2.1.1 did — is enough to install the engine
  twice:

  ```
  npm install @modyra/plain@0.7.0 @modyra/widgets@2.0.2
  → node_modules/@modyra/core                               2.1.0
  → node_modules/@modyra/widgets/node_modules/@modyra/core  2.1.1
  ```

  And two copies of `@modyra/core` are two engines. The engine keeps module-level symbols and
  registries, so a `required()` built by one is **not required** to the other: `MDY_MARKS_REQUIRED` and
  `MDY_VALIDATOR_FACTS` do not match across the boundary, and `aria-required` — along with every
  declared constraint — stops crossing it. That is what ADR 0030 exists to prevent, arriving through
  packaging instead of code.

  Sibling dependencies are now `^` ranges, which is what `@modyra/angular` already published and what a
  package manager deduplicates. `npm run test:tarballs` installs everything this repository publishes
  into a clean consumer and counts the copies: more than one fails the gate, naming the paths.

  Nothing changes for a consumer who installs a matched set. A consumer holding an older adapter now
  gets engine patches instead of being pinned away from them.

  See ADR 0033.

- 965dd88: A field the form is not asking about no longer paints as failing.

  A disabled field — by a binding, or inside a section a condition has closed — is **not validated by
  the form**: `form.state.valid()` ignores it. Every renderer painted it anyway, so a closed section of
  empty required fields was a block of red boxes for something nobody was being asked, while the form
  reported itself valid. The form was right and the screen was misleading.

  _Out of play, no verdict._ A disabled field reports no failure to show: the wrapper takes no error
  modifier, the label no `has-error`, `aria-invalid` reads `false`, and the message is not rendered.

  The rule is one function in `@modyra/widgets` — `shownErrors` / `showsAsInvalid` — asked by the five
  field controllers, the six projections, and each renderer through a single accessor of its own.
  Thirty-three call sites had been deciding it separately, which is how the projection and the wrapper
  beside it came to disagree in the first place.

  The errors are not forgotten. The field keeps them, the form keeps ignoring them, and both come back
  the moment the field is in play again: the verdict was never wrong, it was being shown to someone who
  could not act on it.

  The Angular devtools panel deliberately keeps reading the field's own errors: a debugging view shows
  the model, not what the user is being asked.

  Closes finding T (`docs/contract-gaps.md`).

### Patch Changes

- Updated dependencies [34d5023]
- Updated dependencies [b31091b]
  - @modyra/core@2.2.0

## 2.0.2

### Patch Changes

- 6921584: A rule declares what it enforces, and the control offers it.

  `maxLength(50)` used to let someone type five hundred characters and hear about it afterwards: the
  constraint reached the error list and never the input. Only `min`/`max` on numbers had made the
  crossing, and each renderer wrote those by hand.

  Now every rule with a native counterpart declares it — `required`, `min`, `max`, `integer` (a step of
  one), `minLength`, `maxLength`, `pattern`, `email` — a field reports the total as
  `MdyFieldState.constraints` / `MdyFieldHandle.constraints`, and every renderer offers what its kind
  can carry. The translation lives in `@modyra/widgets` (`nativeConstraintAttributes`), once. A rule
  with no native counterpart declares nothing and stays exactly what it was.

  **A declared fact now survives composition.** `compose()` and `composeFirst()` carry the sum of what
  they combine. This fixes a silent defect as old as `compose`: `compose(required(), maxLength(3))`
  produced a field that was **not marked required** — no `aria-required`, nothing for a screen reader.
  Where two rules bound the same thing the tightest wins; two different patterns cancel, because an
  input carries one and their intersection is a rule nobody wrote.

  **A Zod schema crosses over untouched**: `z.string().min(3).max(8)` reaches `minlength`/`maxlength`.
  Only what has a native counterpart crosses — `z.number().gt(10)` deliberately does not, since
  `min="10"` would admit exactly the value it refuses.

  **The boundary is the model.** Attributes constrain typing. A value arriving from a draft, a server
  or `set()` is kept whole and judged by the rules, as ADR 0029 requires of a widget.

  Also in this change:

  - **A conditional section now covers the collections inside it**, rows already declared included.
    _Out of play if any condition says no_ was written three times and one copy did not know about the
    others; it is written once now, in `conditions.ts`.
  - **`createForm` forwards `devWarnings`.** The switch the guides promised for silencing development
    diagnostics could not be reached from a typed form at all.
  - New development diagnostics, each silent in the ordinary case: a binding that cannot put back in
    play what the schema left out, two patterns that cancel each other, and a `when` predicate that
    gives two answers for the same value.

  `MdyFieldState.bounds`, added in an unreleased changeset, is now `constraints` and carries the whole
  family. Nothing published ever had it.

  See ADR 0030.

- 2e29f30: A select no longer erases a value its options do not contain.

  It used to write `null` into the form the moment the control mounted with an unrecognised value —
  consistent from the widget's point of view, and destructive from everyone else's. The case that
  matters is a value that came from outside: an import carrying the name of a category that does not
  exist yet is exactly what lets a person find the row and fix it, and it disappeared before they saw
  it.

  The value now stays in the model and is rendered as an option of its own, selected, labelled by the
  value unless the application supplies a name (`[unknownOptionLabel]` in Angular). A value that
  matches an option loosely — `"1"` against `1`, as one read from JSON does — is still normalised to
  the option's own value. Nothing is added while the option list is empty, because options that have
  not loaded are not a list that refuses the value.

  **A value outside the list is now refused by rules, not by the widget**: pair the field with
  `oneOf()` if it must be invalid. New in `@modyra/widgets`: `optionsWithUnrecognizedValue`, which is
  the whole of what the three renderers share here.

  If your application merged the orphan value into the option list to work around this, that code is
  now redundant — and harmless, since the helper adds nothing when the list already contains the value.

  See ADR 0029.

- 062881c: Two features finished: a condition can cover a whole section, and every option widget shows what it
  holds.

  **`when` on a section.** `group(children, { when })` asks the question once for a branch instead of
  repeating one predicate on every leaf under it — which is the work `when` existed to remove. A
  field's own condition and every section above it are all consulted: the field is in play only while
  each of them says so, and a section inside a section obeys both. It works the same inside a
  `record()` or `array()` row, where what the predicate reads is its own row.

  The predicate now receives the form value in **the nested shape the schema declares**, so
  `form.address.country` reaches a nested sibling. It used to be handed the engine's flat map, which
  happened to work for top-level keys and for nothing else.

  **A value the options do not contain is shown by every option widget.** The rule left the renderers
  and moved into the controllers: `createSelectController` and `createMultiselectFieldController`
  compute the list a renderer paints — the declared options plus every held value they do not name —
  and expose it as `state.options`. The multiselect now renders a chip for such a value, which is also
  the only way to take it off; before, the value was held and submitted with nothing on screen.

  **Removed**: `unknownOptionLabel` from the Angular select input list and the Lit select's properties,
  and the `label` parameter of `optionsWithUnrecognizedValue`. Naming an out-of-list value is done by
  supplying an option for it — the same code in every renderer and in a data-only document, which a
  callback could not be.

  See ADR 0029, amendment "the rule belongs to the controller".

- 850a463: Six findings from a pre-release audit, closed.

  **One projection decides what a control exposes.** `projectFieldA11y` no longer spells the state and
  constraint attributes: it asks `projectFieldShellA11y`, which is where a renderer that binds a part
  reads them. Two projections emitting the same attributes is how they come to disagree — measured
  identical across all thirteen attributes before and after, so nothing moved but the ownership.

  **A fact no control can act on is no longer carried.** `MdyFieldConstraints.inputType` travelled from
  `email()` through the whole pipeline and was deliberately dropped at the end: the kind decides what
  an input _is_, and a rule that could change it would let a validator turn a text field into
  something else. `email()` keeps asking for the right keyboard (`inputMode`), which is applied.

  **Removed**: `applyNativeConstraints`, exported and used by nobody since the projection took over
  placing attributes. **Removed**: a dead `native` computed left in the Angular textarea by the same
  change.

  **Tested directly rather than from above**: `withFacts` (including that it does not tag the function
  it is given), `factsOf` (including the marker adapters set before this module existed), `mergeFacts`
  (tightest end, non-finite dropped, two patterns cancelling), `factsOfAll`, `nativeConstraintAttributes`
  per kind, and `narrowConstraints` — which can tighten an end and never widen one.

  **Documented**: the date and time kinds derive no native constraints yet. Their inputs have
  `min`/`max`/`step` too, expressed as dates, and that crossing is not done.

  Two more, found by a second sweep of the places the first one did not reach:

  - **`useMdyField` now carries `required` and `constraints`** in `@modyra/react` and `@modyra/preact`.
    Those adapters exist so the caller writes the input, and their hand-enumerated snapshot did not
    include what a control needs to draw itself — so a constraint declared once was enforced and
    unshowable there. Vue, Solid and Svelte hand back the handle and were never affected.
  - **A condition now has a test for the path a restored draft takes.** `enableDraft` restores through
    `patchValue`; every conditional case asserted a value typed into the form, so a form resumed from a
    draft was the one path nothing covered.

  `@modyra/standard-schema` deliberately gains nothing: the Standard Schema V1 contract exposes only
  `~standard.validate`, so there is no `.min(3)` to read. Zod could cross over because Zod publishes
  its checks.

  A defect the demos found the moment they showed the feature:

  **`minLength` refused an empty field.** Its own documentation said the opposite, and `<input
minlength>` agrees with the documentation — the platform does not apply it to an empty value, because
  that is `required`'s question. A collection is the other way round: `minLength(1)` on an array is how
  "at least one row" is said, and exempting `[]` would take that away. So the rule now reads: **a blank
  field is not short, it is empty; an empty collection is short.**

  Also: `@modyra/angular`'s `group()` wrapper dropped the `when` option, which would have made an
  Angular schema quietly poorer than every other adapter's.

- 90fdf00: Four defects found by attacking what the previous release added, before it ships.

  **`when` was ignored inside `record()` and `array()` rows.** The condition applied to a field
  declared at the top of a schema and to nothing inside a collection — so a required cell in a table
  made the form permanently invalid, which is the exact defect `when` exists to end. Rows now honour
  it, and the predicate's second argument is **what encloses the field**: the row when the field is
  inside a collection, the form otherwise. A rule written once for the item of a collection cannot name
  a key or an index, so what it reads is its own row.

  **A select with object option values could swap one entity for another.** The match compared values
  through `String()`, and every plain object renders as `[object Object]` — so an option list holding
  entity A "recognised" entity B and wrote A into the model. Matching is now loose only between
  primitives, which is why it exists (`"1"` from JSON against `1`), and by identity for everything
  else. This one predates the previous release.

  **A slider's track and its painted fill disagreed.** The attributes took the field's rules while the
  fill was measured from a hardcoded 0, so a slider bounded at 10 drew its handle in the wrong place.
  Both now read one range. Sliders in all three renderers also derive their track from the field's
  bounds when the control does not state one — Angular's `[min]`/`[max]` accept `null` for "not
  stated", which is what lets the field answer instead.

  **A bound that is not a finite number is no longer offered to a control.** `min(NaN)` produced
  `min="NaN"` on the input: ignored by the browser, misleading in a diff. The rule still runs.

  Measured while here: 300 controls mounted before their rows are declared cost ~13ms to bind; the
  number is in the benchmark harness so a change that makes it quadratic is visible.

- 6921584: The conformance kit checks two rules a renderer used to be trusted on.

  **Declared rules reach the control**: a field that states `maxLength(8)` must produce a control that
  carries it. **A value the options do not contain is shown**: what a widget will not erase, it has to
  display, or the form holds something nobody can see or remove.

  Both were true of the framework-free renderer and asserted in its own suite, which is exactly the
  arrangement that lets the next renderer be the one that forgets. The kit found two on its first run:
  Lit's textarea and Angular's textarea carried no length constraint at all. Both fixed here.

  A config says it forwards the kit's new inputs by exporting `declaresRules = true`; without it both
  sections report **not run** rather than failing, because the kit cannot tell a renderer that ignores
  a constraint from a config that never handed it one. The kit reads the control through `parts()`,
  the one thing every config provides.

- 6921584: No renderer names a constraint attribute any more: the projection places them.

  The previous change had every renderer read the field's rules and write `minlength`, `maxlength`,
  `pattern`, `min`, `max` and `step` itself. The conformance kit found two renderers that had missed
  some — and that is the finding, not the two renderers: **if forgetting is possible it eventually
  happens.**

  `projectFieldA11y` and `projectFieldShellA11y` now emit the native constraints beside the ARIA they
  already emitted, so a renderer that binds the control part offers them without naming one. A control
  that wants to offer _less_ than the field accepts says so once through the controller
  (`constraints`, read rather than captured, so a limit set after mount is honoured) and the projection
  composes the two: whichever end is tighter, never wider than the rules.

  **All fourteen Angular renderers now bind `[mdyPart]`** — the five that did not are exactly the five
  where constraints had to be hand-written, which is what made the omission possible. Adding a
  constraint tomorrow touches the projection and the per-kind translation, and no renderer at all.

  A slider's default 0–100 span moved to the same place: a slider must span something to be drawn, and
  that is the kind's own default rather than something each renderer remembers.

  Also in this change:

  - `withFacts` no longer tags the function it is given. It is exported, so that function may be one
    the caller uses elsewhere; it returns a wrapper.
  - `mergeFacts` combines through a table of strategies, so a fact added tomorrow cannot compile
    without saying how two of them add up.
  - `MdyRecordManagerDeps.sections` / `MdyArrayManagerDeps.sections` are `() => boolean`: they were
    already bound to what they read, and the two-argument shape invented arguments nobody supplied.
  - The two Angular source audits now read the rule they already stated — a renderer satisfies an ARIA
    token by naming it _or by naming the directive that supplies it_.

  See ADR 0030, amendment "the projection places the attributes".

- 062881c: The select's "name what the list cannot name" hook now exists in Lit as well as Angular.

  `unknownOptionLabel` shipped on the Angular select and nowhere else, which made a rule of the
  contract into one renderer's feature. It matters exactly where the value is an object: without it
  such a value renders as `[object Object]` — honest, and useless.

  The framework-free renderer deliberately has no such hook: its field configuration is data, and a
  function cannot live in a document. There the value names itself.

  Also new: `optionsWithUnrecognizedValues`, the multi-value form of the existing helper. Nothing uses
  it yet — it exists so that closing the multiselect's half of ADR 0029 starts from one place rather
  than three. See that record's amendment for what is still open there, and
  `packages/plain/test/multiselect-unrecognized.test.mjs` for the tests that pin it.

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

## 2.0.1

### Patch Changes

- Updated dependencies [0b64826]
- Updated dependencies [ba5f5f9]
- Updated dependencies [faf3275]
- Updated dependencies [206b0b3]
- Updated dependencies [3d8391b]
- Updated dependencies [495ff44]
- Updated dependencies [8b88c9f]
  - @modyra/core@2.1.0

## 2.0.0

### Major Changes

- c76dfc9: A dialog overlay is not a combobox, and the pickers answer the keys they always declared.

  **Contract change.** `MDY_WIDGET_KEYBOARD` gave every overlay kind the combobox opening keys:

  ```ts
  { key: "ArrowDown", when: "closed", intent: "open" }
  { key: "ArrowUp",   when: "closed", intent: "open" }
  ```

  Four of those kinds hold no options. A calendar, a date range, a clock face and a colour palette are
  dialogs a button opens; the rule's own justification is about arriving on the first or last _option_,
  and there is none to arrive in. A kind now gets those two keys if the catalogue says it declares a
  `listbox` part — `select` and `multiselect` do, the pickers do not.

  Eight bindings are withdrawn, which `contract:diff` classifies as major. **No renderer implemented
  them**, so nothing changes for a user and no adapter needs updating; a consumer building a picker
  from the table stops being asked for two keys the three reference renderers had all declined to
  write. [ADR 0021](https://github.com/modyra/modyra/blob/main/docs/architecture/0021-a-dialog-overlay-is-not-a-combobox.md)
  records it.

  **Fixes**, found by pressing the declared keys in a real browser for the first time:

  - `multiselect` opened on `ArrowDown` but not `ArrowUp`, from a deliberate `null` in the shared
    keyboard policy while the table declared both. It opens on either now — in the policy, so for every
    renderer at once.
  - `@modyra/plain`'s `datepicker` did not close on `Escape` while its two siblings did. Its calendar
    grid handled the key, but the overlay does not take focus when it opens, so a user who opened it
    from the toggle was holding a dialog that answered nothing.
  - All four of `@modyra/plain`'s pickers now dismiss on `Tab`, which the contract has always declared
    and none of them did. A panel left floating over a field the user has tabbed away from is the same
    defect a moment later.

- 7fb3ebf: `MdyMultiselectFieldMode` is removed. Use `MdyMultiselectMode` from `@modyra/core`.

  The two were the same union — `"single" | "multi"` — declared twice, in two packages, for one
  concept. `@modyra/core` owns it: the mode is a field of the Dynamic Form Contract, which is what both
  SDKs carry, and `MdyWidgetVariant` is already an alias of it so a variant key cannot drift from the
  value a document holds. A second declaration was a third spelling waiting to disagree with the other
  two.

  Migration is the import:

  ```diff
  -import type { MdyMultiselectFieldMode } from "@modyra/widgets";
  +import type { MdyMultiselectMode } from "@modyra/core";
  ```

  The values are unchanged, so nothing needs rewriting beyond the name.

  Also: the type-surface audit now classifies exported union aliases. It read interfaces and type
  literals only, so withdrawing a union — or one of its members — reported `patch`, including for the
  unions renderers switch on. This removal is the change that exposed it.

### Minor Changes

- c1ddb7c: A popup is positioned, not dressed.

  `.mdy-popup` positioned a popup **and** painted it. A container that paints is a wrapper around the
  thing it was meant to present: a material applied to the content sits on an opaque panel rather than
  on the page, which is a translucent effect with nothing to be translucent against.

  The primitive now keeps position, insets, clipping and the open/close transition. **`mdy-popup--surface`**
  takes background, border, elevation and padding, and the catalogue emits both on every `popup` part —
  so nothing changes by default, and a theme whose popup _is_ its content neutralises one class without
  touching the coordinates. The radius stays on both: on the primitive it is what `overflow` clips to.

  **`capabilities.overlayScrolls`** — `true` for `select` and `multiselect`, `false` for the four
  pickers. A popup whose content does not scroll and which **no placement holds entirely** — neither
  side vertically, neither edge horizontally — now centres instead of being clamped. A 256px clock face
  with 200px below it was called a fit, docked, and turned into something you scroll a clock in; it is
  centred and whole. A modal placement of non-scrolling content gets the viewport rather than 70% of
  it, since that framing reintroduces the same stub one step in.

  **`trackAnchoredOverlay`** follows the page in one place, `{ capture: true, passive: true }` and
  coalesced to one reposition per frame. The framework-free renderer repositioned synchronously on every
  scroll event, non-passive and uncoalesced — a measure-and-write far more often than frames, which is
  both the cost and the judder.

  Migration: a host that styled `.mdy-popup` expecting a surface should style `.mdy-popup--surface`. A
  renderer that hardcodes popup classes rather than deriving them from the contract must add the new
  one — Angular did, in six templates.

- 4e9a4bc: The conformance kit can run its two browser sections.

  Keyboard behaviour and the accessibility audit could not be answered in Node — focus, native key
  defaults and computed accessible names are not simulable — so they ran nowhere, for anyone. A config
  may now export one more function:

  ```js
  export async function openBrowserSession(kind) {
    return { press(key), focusOpener(), evaluate(source), close() };
  }
  ```

  and both sections run: **8 of 8 sections**.

  The assertions stay in the kit and are evaluated in the page; the config supplies only the transport.
  `@modyra/widgets` therefore takes no browser dependency, an implementer drives it with whatever they
  already test with, and the rules stay in one place instead of being re-derived per renderer — which
  is the failure the kit exists to prevent.

  `@modyra/plain` ships a reference transport, `conformance.browser.config.mjs`, backed by Playwright
  and the built example. Run it with `npm run test:conformance-browser`.

  What the sections claim is bounded on purpose. The accessibility section checks that every operable
  element has a name the platform computes; it is not an axe pass. The keyboard section asserts `open`
  and `cancel` only — `move` is reported as unasserted, because what "the active option moved" looks
  like is not one thing and the contract pins neither form of it.

  It found real divergences on its first run, recorded as contract gap Q.

### Patch Changes

- 3e9e1fb: The conformance CLI names its own coverage instead of overstating it.

  Two of its eight sections — keyboard behaviour and the accessibility audit — cannot run in a Node
  harness, because pressing a key and computing an accessible name need a real browser. The run said so
  in a parenthetical and then printed `CONFORMANT`, which is the line a reader stops at and the one a
  consumer wires into CI.

  A run with unexecuted sections now reports:

  ```
  CONFORMANT WHERE CHECKED  ·  17 kind(s)  ·  6 of 8 section(s) run
    Not established: Keyboard behaviour, Accessibility audit.
    Run the browser suites for these; this exit code does not cover them.
  ```

  The exit code is unchanged — it still reports whether the sections that ran found anything, which is
  what it has always meant. Only the verdict text changes, so a consumer asserting on the exit status
  is unaffected; one grepping for the exact word `CONFORMANT` still matches.

- a5658fb: One declaration of the multiselect mode union, referred to everywhere else.

  `"single" | "multi"` was written out in five places besides the one that owns it: an exported alias
  in `@modyra/widgets` (`MdyChipMode`), a parameter in its behaviour module, a Lit property, a Plain
  parameter, and an Angular signal input. Each was free to drift from the value a form document
  actually carries.

  `MdyMultiselectMode` in `@modyra/core` is that value — the mode is a field of the Dynamic Form
  Contract, which both SDKs carry. Every other site now refers to it.

  `MdyChipMode` stays exported and keeps its meaning; it is now an alias rather than a second
  declaration, so nothing needs changing at a call site.

  Also: the type-surface audit records what a single-target alias points at, rather than recording it
  as opaque. Re-pointing an alias is the change most worth seeing, and it was invisible — including for
  `MdyWidgetVariant`, which the baseline held as `(opaque)`.

- eb267c1: The popup surface split reaches the themes, and the time popup stops being wrapped twice.

  Splitting `.mdy-popup` into position and surface stopped at the foundation. **Modern painted
  `.mdy-popup` itself, unlayered**, so the theme most people see still dressed the primitive and
  outranked the surface it was supposed to move to. It paints `.mdy-popup--surface` now, and keeps the
  typeface on the popup so a theme that declines the surface does not lose its face with it.

  **The time popup carried a card inside a card.** The foundation already said its shell must be
  transparent — "visual chrome lives entirely in `.mdy-timepicker-container`" — and Modern overrode it
  on a reason that had expired: _"plain's time popup holds two number inputs and three buttons rather
  than the themed dial"_. It renders the dial and its container now, so the surface arrived twice: a
  bordered box around a bordered box. The timepicker's popup no longer carries the surface class at
  all, because that kind declares a `container` and the container is the card.

  **And the shell had a scrollbar it was told not to have.** `.mdy-popup { overflow: auto }` is declared
  after `.mdy-timepicker__popup { overflow: visible }` at equal specificity, so the primitive won the
  tie — putting a scroll context and its scrollbar around a dial that already has one, and clipping the
  container's shadow. The exception now names both classes, so it holds wherever either rule moves.

  Measured after: the shell paints nothing, sizes exactly to its container, and its scroll height equals
  its height.

- dce1918: The type-surface audit records exported function signatures.

  Finding K's last half. The projections — `projectFieldA11y` and its seven siblings — each return an
  inline type literal naming the parts they hand back, so "which parts does a renderer receive" was a
  fact the declarations already carried and nothing read. Withdrawing one classified as `patch`.

  Each parameter is now recorded by position and by name, with its type, and so is the return type.
  Position matters as much as name: renaming a parameter breaks nobody, while reordering two of the
  same type breaks every caller silently. 310 exported shapes became 544.

  No API changes — this is the check, not the thing checked.

- Updated dependencies [2037ba5]
- Updated dependencies [3161bad]
  - @modyra/core@2.0.0

## 1.0.0

### Major Changes

- 04d150e: `capabilities.keyboard` and `capabilities.focus` are withdrawn, and the report that survives means something.

  Both were `true` on all seventeen kinds. As per-kind flags they said nothing — a consumer branching
  on one was branching on a constant — and `dismissOnOutsidePointer` was exactly `overlay` beside them.
  A declared capability that cannot be false is a promise with no content, and leaving it as decoration
  invites someone to write the branch. Nothing in this repository read either one.

  `overlay` and `dismissOnOutsidePointer` stay. The second is kept deliberately even though it never
  varies: a popup a click elsewhere cannot dismiss is a real design, and this is where it would be
  declared. What it still does not say is **which event** delivers the dismissal, and that gap is
  measured rather than theoretical — the renderers disagree, and a drag beginning outside an open popup
  fires one binding and not the other.

  **Two defects in the tool that classifies these changes, found by making one.**

  `contract-diff` compared capabilities by iterating the _current_ ones, so a capability that had been
  removed was never visited — the one change `docs/contract-compatibility.md` calls major was the one
  change the gate could not see. It now compares the union of both sides. And the keyboard comparison
  recorded `Object.keys` of an array, so it held the _indices_ `"0"`, `"1"`, `"2"`: it could tell that a
  kind's key count had changed and never which key, and declaring `Tab` was reported as
  `key declared: 8`. It now records each binding as `key@phase:intent`.

  The snapshot format changes with it, which is why every kind reports its keyboard afresh once.

- 5db335c: A segmented choice is a radio, and the contract names it.

  `segmented` declared `elements: { option: "presentation" }`, so nothing constrained what a choice
  is: a `<div>` with a click handler conformed, and a screen reader user got a page of unlabelled text
  where a chooser should be. That was finding **J1**.

  The anatomy now names both halves, exactly as `radio` always has — `option` is the labelled
  container, `optionControl` is the radio inside it, and both are required:

  ```ts
  elements: { option: "label", optionControl: "radio" }
  ```

  `radio` is a new semantic element, satisfied by `<input type="radio">` or by an explicit
  `role="radio"`. An `<input>` of any other type does not satisfy it.

  **`@modyra/lit` and `@modyra/angular` change markup.** A segmented option was a
  `<button role="radio">`; it is now a `<label>` around its own `<input type="radio">`, the pattern
  `@modyra/plain` already used. Arrow keys, the roving tab stop and form participation come from the
  platform instead of being reimplemented, and a theme reaches the selected and disabled states from
  the control rather than from a class the renderer has to remember to apply.

  **Migration:** an adapter emitting a button-with-a-role now reports `PART_ELEMENT: option` and
  `PART_MISSING: optionControl`. Styling that assumed a `<button>` needs the same follow-through the
  shipped themes got — `:disabled` on the segment never matches, because the segment is a label and
  the state belongs to the control inside it.

  [ADR 0012](https://github.com/modyra/modyra/blob/main/docs/architecture/0012-a-choice-is-a-radio-by-role-or-by-tag.md)
  decided the rule and predicted no renderer would change. It is amended in place: that prediction read
  a summary of the code rather than the code, and Plain's `option` was never the radio.

  **Pre-1.0 versioning.** `@modyra/plain`, `@modyra/lit` and `@modyra/angular` are on 0.x and make no stability promise yet, so a breaking change to them is a minor bump — that is what 0.x means. The change below is breaking; the version number is not claiming otherwise.

- c1584ad: A popup must frame something.

  Four of the six overlay kinds declared no required part inside their popup, so an open widget could
  render a positioning box with nothing in it and conform. `aria-expanded="true"` beside an empty popup
  was a coherent-looking, broken widget.

  No new declaration was added for this. `required` already said "this part must be there" and
  `overlayOnlyParts` already scoped it to an open widget — the mechanism `datepicker` used for its
  calendar — so four names joined four existing lists:

  | kind          | now requires |
  | ------------- | ------------ |
  | `select`      | `listbox`    |
  | `multiselect` | `listbox`    |
  | `timepicker`  | `container`  |
  | `colors`      | `presets`    |

  Each was measured in both rendering adapters first: every one is drawn by Plain and by Lit today, so
  no renderer needs new markup. `multiselect.listbox` is required to be **present**, not to be a
  listbox — what role a chip grid should carry is the mode question ADR 0016 settles.

  **Migration:** an adapter whose open popup omits its kind's part above now reports `PART_MISSING`.
  The fix is to render it, which is what the popup is for.

  **The conformance CLI gained a second anatomy pass.** It inspected every widget at rest only, and a
  part required inside a popup is skipped at rest — so all four requirements would have been enforced
  against nothing. `modyra-conformance` now drives each overlay kind open and inspects it there, six
  kinds per adapter. An adapter passing the previous version can fail this one for a defect that was
  always there.

  `timepicker.dialog` stays optional and is now recorded as a defect: no adapter draws the element the
  contract describes. Plain applies the part to the popup itself, Lit puts `role="dialog"` on
  `container`. Where that role belongs is a separate question, open in `docs/contract-gaps.md`.

  The decision behind this is [ADR 0014](https://github.com/modyra/modyra/blob/main/docs/architecture/0014-the-contract-names-the-responsible-element.md): the contract names the element responsible for something, not the region containing it.

- 35d6094: A timepicker segment names the control inside it.

  `hour` and `minute` are the containers the header lays out. Each holds the `<input type="number">` a
  user types into, and that input was not a declared part — so no anatomy, relation, state or
  equivalence check reached it. A segment holding a bare `<div>` conformed.

  `hourControl` and `minuteControl` are now optional parts with the `input` semantic, parented to their
  segment and carrying `mdy-timepicker-segment-input`. The catalogue change alone is **minor**: they
  describe elements every renderer already drew.

  **The breaking half is `projectTimepickerFieldA11y`.** Its `hour` and `minute` parts carried
  `role="spinbutton"`, `aria-label` and `aria-valuenow` — control semantics on a container — and a
  renderer applying them to its input ended up with two elements claiming to be `hour`. The projection
  now returns four parts where it returned two:

  | part                           | apply to                | carries                                                                       |
  | ------------------------------ | ----------------------- | ----------------------------------------------------------------------------- |
  | `hour`, `minute`               | the segment container   | its classes and the `focused` state                                           |
  | `hourControl`, `minuteControl` | the `<input>` inside it | the id, the control class, `role="spinbutton"`, `aria-label`, `aria-valuenow` |

  **Migration:** a renderer that applied `parts.hour` to its hour input should apply
  `parts.hourControl` there instead, and `parts.hour` to the segment around it. Same for the minute.
  Applying only the old two leaves the input with no role and no accessible value, and TypeScript will
  not report it — the attributes moved rather than disappearing.

  Two resolver defects surfaced with it. `inspectWidgetDom`'s fallback lookup matched parts on classes
  alone, so two parts sharing a selector each resolved to both elements — `daterange`'s `startControl`
  and `endControl` had the same hole. Both resolvers now read one rule, declared order among the parts
  that share a selector.

  The decision behind this is [ADR 0014](https://github.com/modyra/modyra/blob/main/docs/architecture/0014-the-contract-names-the-responsible-element.md): the contract names the element responsible for something, not the region containing it.

- Modyra 1.0.

  **What 1.0 covers is two packages, and that is the whole of it.** `@modyra/core` — the form engine and
  the Dynamic Form Contract, zero dependencies — and `@modyra/widgets`, the widget contract, which
  depends only on core. The perimeter is checked rather than claimed:
  `scripts/audit-package-independence.mjs` passes, core declares no dependencies at all, and widgets
  declares exactly one.

  Studio, the Rust and Java SDKs, the five headless adapters and the three rendering adapters ship
  independently and stay on 0.x. The renderers reach 1.0 after the contract does, not with it — a
  version number over all of it would be a promise about the parts least ready to make one.

  **What you are promised** is in `docs/contract-compatibility.md`: nothing is removed or changed
  breakingly outside a major, a deprecation keeps working until the next major and never less than one
  minor, and both halves of a deprecation — `since` and a replacement — are enforced by a check.

  **What holds it up.** Every claim here has a check that has been watched to fail:

  - the widget catalogue is snapshotted and every change classified;
  - **205 exported shapes** are snapshotted too, so a type change is classified rather than invisible;
  - what the tarballs actually contain is installed into a clean consumer, imported, type-checked and
    run — all 26 entry points, with a baseline so a withdrawn one is a diff;
  - two renderers are conformance-checked against the contract, in every configured variant;
  - the browser suites run on three engines and block, with screenshot baselines per renderer, engine
    and theme.

  **Known and open**, because a 1.0 that hides its defects is worth less than one that names them:
  WebKit ends the page when a visually hidden native input is reached, which affects the radio and
  colours widgets there. It is recorded as finding **N** in `docs/contract-gaps.md`, and the rows that
  cannot run are quarantined by name rather than by making a suite permissive.

- 5dbdf1a: The dismissal names its event, and it is `click`.

  `dismissOnOutsidePointer` said an overlay is dismissed by a pointer outside it and never said
  **which event**. Three adapters each picked one: `@modyra/plain` and `@modyra/lit` bound
  `pointerdown`, `@modyra/angular` bound `click`. The choice is observable — `pointerdown` fires on
  press, `click` only on a completed press-and-release over the same target — so a drag beginning
  outside an open popup dismissed on two renderers and not on the third.

  ```ts
  dismissOnOutsidePointer: false | { event: "pointerdown" | "click" };
  ```

  **`click`**, decided by the owner: a drag that begins outside is not necessarily a dismissal, and a
  user may press, think better of it, and return. `@modyra/plain` and `@modyra/lit` now read the event
  from the capability instead of naming one, so it cannot become a per-renderer choice again.

  **Major**, not the minor this was planned as. The shape is additive in what it can express, but
  `boolean` became a union: `caps.dismissOnOutsidePointer === true` no longer holds and no longer
  type-checks. The previous capability change in this release was withdrawn as major for the same
  reason, and being inconsistent about it would make the classification a matter of who wrote the
  changeset.

  **What this does not fix, and the tests now say so.** Naming the pointer event was necessary and is
  not sufficient. `@modyra/plain`'s select also closes on `focusout` when focus leaves the widget, so a
  drag that presses outside still dismisses it — through a second path the contract does not name.
  `e2e/plain/dismiss.spec.ts` asserts the declared path in isolation (a completed click) and records
  the focus path as it behaves, rather than asserting the contract as it now reads.

- bc91571: Light dismiss: an overlay closes on an outside _interaction_, not an outside event.

  `capabilities.dismissOnOutsidePointer` changes from `{ event: "pointerdown" | "click" }` to
  `false | "light-dismiss"`. A consumer reading `.event` no longer compiles.

  An interaction has an origin and a completion, and both decide:

  > An overlay closes when a primary interaction that **began** outside its logical branch is
  > **completed** outside that branch. An interaction that began inside never dismisses, however far
  > outside it ends.

  That asymmetry is the point. Selecting text in a popup and releasing past its edge is a drag from
  inside, and the browser fires the resulting `click` on a common ancestor — so any rule reading only
  the completion target closes a popup the user was working in.

  Completion is `click`, not `pointerup`: a drag ending on a different element than it began on
  produces no `click` at all, which is exactly the gesture a touch user makes to scroll the page
  behind an open popup.

  Also normative, and newly enforced:

  - only a primary pointer on the primary button dismisses — a right-click opens a context menu, it
    does not close the popup underneath it;
  - `pointercancel` never dismisses, and only cancels the interaction it belongs to;
  - a `click` with no observed pointer interaction — a keyboard activation, a programmatic `.click()` —
    does not satisfy a capability that names a pointer;
  - "inside" is the **logical branch**: invoker, popup, descendants and portalled content;
  - an interaction is abandoned on `blur`, on the document being hidden, and on unmount.

  The rule lives once in `@modyra/widgets` as `createLightDismiss`, with an explicit state machine. All
  three rendering adapters call it, so a renderer can no longer decide when a pointer dismisses.
  `Escape` is unchanged.

  Recorded as [ADR 0013](../docs/architecture/0013-the-dismissal-names-its-gesture.md), which
  supersedes ADR 0011.

  Also fixed here: `contract-diff` classified this as `minor`. It treated withdrawal as a capability
  disappearing or becoming `false`, and did not see a capability that keeps its name and stops
  answering a question it used to — whether by losing a key or by ceasing to be an object at all.

  **Pre-1.0 versioning.** `@modyra/plain`, `@modyra/lit` and `@modyra/angular` are on 0.x and make no stability promise yet, so a breaking change to them is a minor bump — that is what 0.x means. The change below is breaking; the version number is not claiming otherwise.

### Minor Changes

- e3f27b3: `npx modyra-conformance` — the conformance kit runs outside this repository.

  The suites that check Modyra's own renderers were reachable only by cloning it. They are now a `bin`
  on this package, so an implementer can check a renderer against the contract without reading four
  test files to work out how.

  ```bash
  npx modyra-conformance ./my-adapter.config.mjs
  ```

  A config exports `{ name, kinds, mount }` — optionally `absentParts` and `mountScoped` — and owns its
  own environment, because a renderer needs a DOM and only its author knows how theirs is set up.

  Reported: DOM anatomy and relations, the state matrix, renderer equivalence at rest, lifecycle, and
  multi-instance isolation. **Keyboard behaviour and the accessibility audit are reported as not run**,
  with the reason, rather than omitted — neither is answerable outside a real browser, and an
  implementer has to know what was not covered.

  Nothing new is checked: every suite already existed and both of this repository's Node-drivable
  renderers report CONFORMANT through it. What changes is who can run them.

- 9ec6b65: `@modyra/widgets/testing` states what a form owes when it unmounts.

  `MDY_LIFECYCLE_TRANSITIONS` names the nine transitions a form goes through; `inspectUnmount` and
  `inspectCoexistence` judge the conditions that only a teardown can violate — DOM left in the
  document, ids that still resolve, an effect that still runs after disposal, and ids shared by two
  live instances. The document is checked whole rather than under the host, so an overlay that was
  portalled out counts.

  Listeners and timers are not observable — no DOM implementation exposes a listener registry — so
  `REACTIVE_EFFECT_SURVIVED_UNMOUNT` observes the consequence a stray subscription would have instead
  of its registration. The substitution is stated rather than implied.

  The conditions are meant to run over a loop: a renderer that leaks one node per mount is clean on a
  single teardown and ruins a page that lives for an hour.

- 2d2398b: A radio group describes itself by an element that exists.

  `projectOptionFieldA11y` chose its `aria-describedby` target from `errors.length` — whether errors
  _exist_ — rather than from whether the error list was _rendered_. A renderer that defers its list
  until the field is touched has errors long before it shows them, so a required, untouched radio
  group pointed at an error list that was not in the document.

  The field shell already solved this: `projectFieldShellA11y` takes an `errorsVisible` flag and its
  comment says why — _"deriving this from `errors.length` would make `aria-describedby` name an
  element that is not in the document."_ The option projection never got the same treatment.

  `MdyOptionFieldA11yOptions.errorsVisible` now answers it, defaulting to "there are errors" so no
  existing caller changes. Because this projection sits **behind** the controller — unlike the shell's,
  which renderers call directly — `createOptionFieldController` takes
  `errorsVisible?: (state) => boolean` and passes it through; a renderer cannot answer for itself
  otherwise.

  `@modyra/lit`'s radio and segmented elements now declare what their templates actually do
  (`touched && invalid`). Measured before and after on the state fixture: `aria-describedby` went from
  naming a missing `…__errors` to naming the supporting text that is really there.

  Found by `scripts/conformance-cli.mjs`, which crosses the state fixture's mounting with the DOM
  contract's checking — a combination no existing suite makes. Lit's own DOM suite mounts without
  validators, so the required-and-untouched state it needs was never reached.

- 4de3620: A shell part that restates the shell's own class keeps the shell's states.

  A widget that gives a part a class of its own has made it a different part, and it does not inherit
  the shell's states: a multiselect's `inputWrapper` is `mdy-multiselect`, the grid of chips, and
  handing it `mdy-input-wrapper`'s states would mint `mdy-multiselect--disabled` — a class no theme
  styles and no renderer emits. That rule is right and stays.

  The test for it was wrong. It asked whether a kind _named_ a class, not whether the class _differed_,
  so a kind that restated the shell's own spelling was treated as having replaced it. `checkbox`
  declares `label: ["mdy-label"]` because its label sits inside the wrapper rather than above it — the
  same class, the same element a floating label rises on — and lost `filled` and `hasError` for saying
  so. `partClasses("checkbox", "label", { filled: true })` threw, while the identical call on `text`
  returned `mdy-label mdy-label--filled`.

  Three parts get their states back: `checkbox.label` (`filled`, `hasError`), `checkbox.requiredMarker`
  and `toggle.requiredMarker` (`filled`). The parts that really are their widget's own —
  `checkbox.inputWrapper`, `toggle.inputWrapper`, `toggle.label`, `multiselect.inputWrapper` — still
  carry no shell states, and a call reaching for one still throws.

- b0d9252: A popup can say which edge it hangs from, and a range calendar can say where it is.

  Every popup declares `right` alongside `above` and `overlay`, and nothing derived it. So the adapters
  each spelled an edge class themselves — `mdy-overlay-panel--right`, a name no stylesheet has ever
  matched, on a wrapper that is `display: contents` and lays nothing out. That is the same failure
  `popupPlacementClass` was written to end for `--above`, surviving in the one case it did not cover.
  New `popupAlignmentClass(kind, alignment)` answers it, `left` being the ordinary case that carries no
  class exactly as `below` does.

  **`popupPlacementClass` was wrong for the range picker, and had been all along.** It looked for the
  first class shaped like a modifier of the popup's base, and a popup may already carry one: the range
  picker's resting classes are `["mdy-datepicker__popup", "mdy-popup", "mdy-datepicker__popup--range"]`.
  So every placement it was ever asked about returned `--range` — a variant marker that says nothing
  about where the popup is — and `mdy-datepicker__popup--above` was emitted by nothing. Both functions
  now return the class the state _added_, which is the question that was meant to be asked.

  The select gains the `--above` rule its anatomy has always wanted. Its popup is `search`, then
  `listbox`, exactly like the multiselect's, and the multiselect has flipped its column when opening
  upwards for as long as the class has existed — so the search box stays beside the control the user is
  typing in rather than across the whole list. The select declared the state and no rule answered it.

- a3c4580: A tap outside dismisses on Safari.

  The light-dismiss gesture completed on `click`, deliberately — a drag ending elsewhere produces no
  click, which is the gesture a touch user makes to scroll the page behind an open popup, so the
  browser's own judgement of an activation filtered it out.

  One engine does not supply that judgement. WebKit synthesises no mouse events and no `click` for a
  tap on an element it does not consider clickable, and a page's own background is not one:

  | engine   | events delivered for a tap on `<h1>`                                            |
  | -------- | ------------------------------------------------------------------------------- |
  | Chromium | `pointerdown` `touchstart` `pointerup` `touchend` `mousedown` `mouseup` `click` |
  | WebKit   | `pointerdown` `touchstart` `pointerup` `touchend` — and nothing else            |

  So on Safari, desktop and iOS, the pair never completed and an open popup stayed open. Nothing in a
  Chromium-only suite could see it.

  `MdyLightDismiss` gains `pointerup(target, pointerId?)`, which completes the interaction under the
  same origin and pointer-identity rules. `click` stays and normally does nothing — the release has
  already left the machine idle — but catches an interaction whose release never arrived. The scroll
  gesture is still protected, by `pointercancel`: a browser that takes a gesture over to scroll says so
  directly, and the absence of a click was standing in for that signal.

  **One behaviour changes beyond the fix**, and it is a correction: pressing outside and releasing
  _inside_ the popup no longer dismisses. It used to, because the click landed on a common ancestor
  outside the branch — but the interaction ended inside, which ADR 0013's own rule says must not
  dismiss.

  **Migration:** a renderer that wires the policy itself must add a capture-phase `pointerup` listener
  beside its `click` one. The three rendering adapters do this already.

  [ADR 0013](https://github.com/modyra/modyra/blob/main/docs/architecture/0013-the-dismissal-names-its-gesture.md)
  is amended in place, with the original reasoning kept — the risk it named is real, and what it got
  wrong is which signal guards against it.

  **Classification.** `contract:diff` reports `patch`: the catalogue is untouched and the differ sees
  nothing else. This ships as `minor` for the added method — the same blind spot recorded as finding K.

- c1b9b10: A state is checked on the part responsible for it.

  `inspectWidgetState` accepted a state's ARIA attribute on **any** declared part. The claim it could
  make was therefore "the widget exposes the state somewhere", not "on the right element" — and a
  select that moved `aria-expanded` from its trigger to its root passed.

  `stateCarriers(kind, state)` now names the part or parts a kind must announce a state on, and the
  check asserts presence on each of them. `open` is derived from `MDY_POPUP_OPENERS[kind].opener`,
  which the contract already declared; `invalid`, `disabled` and `readonly` are declared in a new
  per-kind table, because nothing existing answered for them — the catalogue's per-part `states:` is a
  class vocabulary, and it names `inputWrapper` where `aria-disabled` goes on the control.

  Extras are still tolerated: the check asks whether the carrier announces the state, not whether
  anything else does.

  **Three renderer defects surfaced immediately**, each one a state announced where nothing listens:

  - `@modyra/lit` and `@modyra/angular` never set `aria-disabled` on the multiselect's search button —
    the opener, and the element the label names. Angular had it on the options group instead.
  - `colors` had no correct carrier to name. Angular's `control` is the native `<input type="color">`,
    deliberately `aria-hidden`; the carrier is `hexInput`, the field a user types into.

  **Classification.** `contract:diff` reports `patch`: the catalogue anatomy is untouched, and the
  differ snapshots the catalogue only. This ships as `minor` because `stateCarriers` is a new root
  export. The disagreement is the same blind spot recorded as finding K in `docs/contract-gaps.md` —
  public surface outside the catalogue has no classification path.

  A downstream renderer that passed conformance may now fail it. That is the point of the change, and
  it is a verdict rather than an API break: nothing a consumer wrote needs editing to compile.

  The decision behind this is [ADR 0014](https://github.com/modyra/modyra/blob/main/docs/architecture/0014-the-contract-names-the-responsible-element.md): the contract names the element responsible for something, not the region containing it.

- 49c28c9: `timeFieldBounds`, `acceptTimeField` and `stepTimeField`: a time field's range becomes contract.

  An hour runs 1–12 with a period beside it and 0–23 without; a minute is 0–59 on either clock. Those
  ranges lived as literals inside the transitions, where the hour's two variants are easy to keep
  straight and **the minute's 0–59 is easy to lose** — it reads like the hour's neighbour and is not.

  The contract states two behaviours, deliberately different, because the user means different things
  by them:

  - **Stepping wraps.** An arrow key or a spinner is sequential: 12 + 1 is 1, 0 − 1 is 23, and a
    minute rolls 59 → 0. Someone holding the up arrow is scanning a range, not asserting a value, and
    stopping dead at the end answers the wrong question. A step also brings an already-invalid value
    back inside the range, because stepping is how a user _leaves_ a bad value.
  - **Typing is judged.** A typed `25` or `61` is a claim about a specific time. `acceptTimeField`
    returns a rejection carrying _why_ — `out-of-range` or `not-a-number` — and the range it was judged
    against, so a renderer can mark the field invalid and say what it expected. Previously the answer
    was `null`, which a caller cannot tell from "nothing happened": an out-of-range entry was dropped
    in silence, leaving a field that looked accepted holding a value it never took.

  Also stated rather than assumed: an empty box is not a request for midnight. `Number("")` is `0`,
  which is a valid hour on a 24-hour clock, so the shape is checked before the value.

  `timeClockTransition` now reads these bounds instead of carrying its own copies.

- 186cbad: A kind whose anatomy depends on its configuration declares it.

  `multiselect` renders a choice two ways: in `single` mode an option is a `<button>` with a tick, in
  `multi` it is a container holding a count between two step buttons. No single element declaration
  fits both, so `option` was declared `presentation` and nothing checked it in either mode. That was
  finding **J2**.

  The catalogue now declares **variants**, keyed by the `mode` the field config already carries:

  ```ts
  variants: {
    single: { elements: { option: "button"    }, required: ["optionCheck"] },
    multi:  { elements: { option: "container" }, required: ["optionStep", "optionCount"] },
  }
  ```

  In `single` the option _is_ the control; in `multi` it contains them. Both named, which is what
  [ADR 0014](https://github.com/modyra/modyra/blob/main/docs/architecture/0014-the-contract-names-the-responsible-element.md)
  requires and what saying "one of these is operable" cannot give.

  **Closed, and defined once.** `MdyWidgetVariant` is an alias of `MdyMultiselectMode` — newly named in
  `@modyra/core`, the same union `mode` already used — so the variant key _is_ the value a document
  carries. An invented name is a compile error, with a runtime guard behind it for callers without
  types.

  **`container`** is a new semantic element: a part that holds controls and is not one. `presentation`
  admits everything by design, so it could not refuse a `<button>` holding a `<button>`.

  **`MdyWidgetShape` is generic over its parts.** `required: ["notAPart"]` no longer compiles — which
  needed `NoInfer` on the shape parameter, because otherwise the shape is a second inference site and a
  name appearing only there widens the part union to include it.

  **For adapters:** declare which variants you support and the conformance kit mounts each. Declaring
  none is checked exactly as before, so this is additive for the sixteen kinds that have no variants.
  `contract-diff` now snapshots and compares variants, so declaring or withdrawing one is classified.

  `@modyra/lit`'s counter steppers gain accessible names — they were icon-only buttons announcing
  nothing, a defect the rule found the moment it existed.

- ee8198d: A Lit calendar starts its week where the user's locale starts it.

  `mdy-datepicker-field` and `mdy-daterange-field` set `firstDayOfWeek = 1` in their constructors, so
  every calendar began on Monday regardless of locale. Angular takes it from `MDY_DATE_LOCALE` and
  Plain from `buildDateLocale`; Lit was the only renderer holding a constant. Measured under
  `en-US`, with the same schema and the same fixture:

  ```text
  @modyra/plain   S M T W T F S     (correct for en-US)
  @modyra/lit     M T W T F S S
  ```

  Nothing about the Lit calendar was malformed — the parts were present, the ARIA correct, the grid a
  grid. Only the order was wrong, and only against a locale nobody had run it in, which is why the
  conformance and equivalence suites were green.

  `first-day-of-week` still overrides, and is now the way to ask for a fixed first day. Unset follows
  the locale. A host that was relying on the Monday default in a Sunday-first locale, and wants it
  kept, should set the attribute explicitly.

  `@modyra/widgets/testing` gains `inspectCalendarWeekStart` and `expectedWeekdayOrder`, so the rule
  is stated once for every renderer rather than three times. The expectation is derived from `Intl`,
  not from a renderer's own helper, so a renderer cannot satisfy it by agreeing with itself.

  The suites now drive **two locales with opposite week starts**. One locale proves nothing: a
  renderer with the week start hardcoded is correct in exactly the locale whose value it hardcoded,
  and a suite that only ever runs there is measuring its own environment rather than the renderer.

- 0f85077: Either arrow opens a closed combobox.

  `ArrowDown` on a collapsed overlay opened it; `ArrowUp` was declared by neither the keyboard table
  nor the policy, so it did nothing on all six overlay kinds. The authoring practices specify both.

  Unlike the `Tab` and `Space` gaps before it, **the two paths already agreed** — `widgetKeyIntent`
  and `selectKeyboardAction` were both silent — so no user was getting different behaviour from
  different renderers. This was a gap in the specification rather than a disagreement inside it, which
  is why it waited: the open question was whether opening upwards should also move to the last option,
  as the authoring practices have it.

  It should, and it already does, one layer down. `listboxNavigationIndex` answers `ArrowUp` from
  nothing-active with the **last** option and `ArrowDown` with the **first**. So opening with nothing
  active and letting the next arrow resolve gives exactly the specified behaviour, and declaring a
  move on the opening press would restate that where it can drift from it.

  Both paths changed together and both are asserted, because the `Tab` defect was one path fixed and
  not the other, twice.

- d6e8855: An opener controls something that exists, and a part inside an absent parent may be absent.

  Two halves of one assumption: the contract, and the suite that checks it, both took an eagerly
  mounted popup for granted. A renderer that builds its overlay on demand could not report its resting
  state honestly.

  **`aria-controls` named a listbox that was not there.** `projectOverlayOpenerA11y` emitted the id
  unconditionally, so a lazily-mounted popup left the trigger pointing at nothing while closed — a
  dangling reference assistive technology cannot follow, and one no amount of correct `aria-expanded`
  makes up for. `controlsRendered` now answers it, defaulting to `true`, which is what every caller
  assumed before. It threads through `projectSelectA11y` (`popupRendered`) and
  `createSelectController` (`setPopupRendered`), because that projection sits behind the controller and
  a renderer cannot answer for itself otherwise. `@modyra/lit`'s select declares it; the eagerly
  mounted renderers are unchanged.

  **A mandatory part inside an optional one could not be declared absent.** `datepicker.calendar` is
  `optional: false` with parent `popup` at `optional: true` — a required child of an optional
  container. `inspectWidgetDom` rejected `calendar` in `absentParts` even when `popup` was absent too,
  so a lazy renderer had no way to describe its closed state. Absence is now _entailed_ when an
  ancestor is absent, rather than treated as a claim. The contract is unchanged: `calendar` is still
  required whenever the popup is there.

  Found by `scripts/conformance-cli.mjs` running against `@modyra/lit`, which reports **CONFORMANT**
  with both fixes and four findings without them.

- ca0eebc: An opener that is a text field is not a switch.

  `MDY_POPUP_OPENERS` names the element that carries the overlay relation, and for the combobox kinds
  that is correctly the typeable control — the pattern puts `aria-expanded` nowhere else. The same
  declaration was then read as "the element that toggles the overlay", and those are not the same job.
  So the contract stated that a pointer press on a date picker's own text input closes its calendar:
  the user reaches for the caret and the field is taken away.

  One renderer implemented it literally and one did not. `@modyra/plain` bound the toggle to the
  control as well as to the button; Angular bound only the button. The same click did different things
  depending on who drew the widget, and the contract endorsed the worse of the two.

  `MdyPopupOpener` gains `typeable`, declared for `datepicker` and `timepicker`. Two rules follow from
  it:

  - the opener still **opens** on every kind, and only closes where it is not typed into — the toggle
    button beside the field is the switch;
  - **`Space` opens** the kinds whose opener is a button, and is left alone on the others, because in a
    text field the space bar is a space character and a widget that opened its calendar instead could
    not accept "12 March". The keyboard policy has opened on Space for as long as it has existed while
    the declared bindings claimed the key for nothing — the same disagreement `Tab` had, and it needed
    the opener to be able to say what it is before it could be settled.

  `@modyra/plain` no longer closes a date or time picker when the user clicks into its input.

- 2ac6b1e: `anchorOverlay` takes the writing direction, so a popup hangs from an inline edge.

  `overlayAnchoringFor(kind)` states which edge of the control a popup attaches to — the end where the
  trigger sits, the arrow, the calendar button. That is an **inline** idea, and it was being applied
  physically: in a right-to-left field every popup still hung from the right, which is the wrong end of
  the control.

  The declared alignment now mirrors under `direction: "rtl"`, and all three renderers pass the
  direction they are actually laid out in, read from the element rather than assumed.

  **Only the declared edge mirrors, deliberately.** How much room remains before the window's right
  edge, and where the user's pointer landed, are facts about the screen; they do not flip, and a popup
  that mirrored them would place itself off the side of the viewport. A test holds that line — a wide
  popup on a control near the right edge stays on screen in either direction.

  This is one change in the contract rather than three in the renderers, which is what the shared
  anchoring is for.

- 44d0e03: `overlayStyleProperties` carries the whole placement decision.

  `anchorOverlay` writes eight `--mdy-overlay-*` properties. `overlayStyleProperties` — the projection
  for a host that carries coordinates around instead of the property map — wrote five. It had no
  `transform`, no `max-height` and no `width`, so every host on that path completed the decision by
  hand, and they did not complete it the same way: Angular stated `80vh` for a modal placement where
  the policy computes 70% of the viewport. The same popup, having given up on its anchor, was a
  different size depending on which renderer drew it.

  `MdyOverlayCoords` gains `maxHeight` and `placement`. The placement is what makes the modal case
  expressible at all — centring on the viewport is a percentage offset and a translation rather than
  the measured insets every other placement uses, so without it there was nothing for a host to
  serialise and each one invented the centring itself.

  A contract test now holds the two projections to each other across `below`, `above`, `overlay` and a
  content-sized popup. It found a second disagreement on its first run: an unused inset is `auto` in
  `anchorOverlay` and was `unset` here, which leaves `var()` invalid at computed-value time and lets a
  stylesheet fallback answer instead. Both now say `auto`, the value the themes have always been read.

  Angular's overlay panel no longer states any of it, and its `maxHeight` input — which the height now
  reaches through the coordinates — is gone along with the six bindings that fed it.

- 0f09b34: `MDY_CANONICAL_DISABLED` and `MDY_CANONICAL_OPEN` complete the static half of renderer equivalence.

  Four states are now compared across three renderers — at rest, invalid, disabled, open — with one
  recorded divergence between them.

  `disabled` is rest plus one state and deliberately nothing else: a field that is disabled _and_
  required _and_ empty is two states at once, and a renderer getting either wrong would be reported the
  same way. `open` promotes `popup` from optional to required — a renderer may mount an overlay eagerly
  or build it on demand while closed, but showing none while open is not a free choice — and flips the
  opener's `aria-controls` from naming nothing to naming what the contract says it controls.

  **`focusOwner` can now be left unconstrained**, and is, for the kinds where two renderers make
  different defensible choices. A combobox may keep focus on its opener and drive the list with
  `aria-activedescendant`, or move focus into a search field; a timepicker may open on its dial or on
  its inputs, having a `modeToggle` precisely because both are modes. Freezing one of those would buy
  agreement by forbidding a legitimate implementation. It stays asserted where the contract does decide:
  a calendar takes focus into its grid, because a grid the keyboard cannot reach is a grid only a mouse
  can use.

  **The fixtures' portal scan is gone.** Each adapter's fixture looked for a portalled overlay by
  scanning the document for something dropdown-shaped, and passing that result — even empty — overrode
  the snapshot's own lookup, which finds the overlay through the relation that names it. Closed, this
  cost nothing and hid itself; open, it reported the popup absent and the opener's reference dangling
  on both listbox kinds. The naive scan was the method rejected when the snapshot was first written,
  reintroduced beside it.

  Recorded, not fixed: opening a `daterange` in `@modyra/plain` leaves focus where it was, while its
  own datepicker moves it into the calendar and so do the other two renderers.

- f4e593a: Focus is borrowed, not taken: `createFocusCustodian` makes the handover a contract.

  Moving focus is easy and losing it is silent. A widget opens an overlay, focus goes in, the overlay
  closes — and if nothing takes focus at that moment the user is standing on `<body>`, at the top of
  the document, with no way back to the field they were in. Nothing throws and every attribute is
  still correct.

  Five of the seven focus behaviours audited across the three renderers were wrong, each in a
  different file, each needing its own repair. That is a missing contract, not six careless renderers.

  Two halves, both enforced:

  - **Focus is recorded before it is moved**, so there is always somewhere to hand it back to.
  - **A move that is not taken did not happen.** `focus()` on a detached, hidden or inert element does
    nothing and reports nothing, so every candidate is verified against `activeElement` afterwards and
    a candidate that did not take it falls through. The chain is the caller's preference, then
    whoever held focus before, then the widget itself; focus goes nowhere only when the widget has
    left the document.

  **`@modyra/angular`'s `select`, `datepicker` and `daterange` stranded the keyboard on dismissal**, and
  now do not. Two earlier attempts failed on a wrong premise worth recording: the overlay renders its
  panel _inside_ the wrapper rather than portalling it, so "is focus still inside this widget" answered
  _yes_ for precisely the case that strands people. The panel is what disappears, so the panel is what
  is asked about — before containment, not after.

  `portalRootFor` moves from `@modyra/widgets/testing` to the package root, since the runtime needs it
  too; the testing entry re-exports it rather than keeping a second copy.

- 31cbcdb: Focus leaving an overlay names itself, and never outranks a pointer.

  New capability `dismissOnFocusOutside: boolean`, true wherever there is a popup. It declares what
  already happened — Tab out of an open popup closes it — and separates it from
  `dismissOnOutsidePointer`, which is a different question with a different answer.

  Conflating the two was a real defect: all three renderers could close a popup that the pointer rule
  had just refused to close. An interaction begun inside the popup and dragged out moves focus out on
  the way, and closing on that reinstates, through the focus path, exactly the dismissal light dismiss
  exists to prevent. The precedence is now explicit — while an interaction begun inside is unresolved,
  focus decides nothing — and all three renderers consult one rule instead of each deciding.

  `@modyra/lit` also loses a `setTimeout(…, 120)` on blur, replaced by the `relatedTarget` containment
  check the other two renderers already used. A delay is a guess about how long a click takes to land,
  and it raced whatever the pointer did meanwhile.

  `touched` still marks when focus leaves, including where the close is suppressed. Being touched is
  not a dismissal.

- b10a5b1: One select, one interaction model per renderer.

  [ADR 0018](https://github.com/modyra/modyra/blob/main/docs/architecture/0018-a-select-declares-whether-it-filters.md)
  names two models and `searchable` selects between them. This is the half the renderers owe.

  **`@modyra/plain` — breaking.** It appended a filter box to every select, so a three-option list got a
  search nobody asked for and focus landed in it rather than on the list. Now only a `searchable`
  select has one. A non-searchable select keeps focus on its trigger and jumps as you type.

  **`@modyra/lit`.** Typing on a searchable select's trigger dispatched one character at a time into a
  controller that _replaces_ the query, so `mar` searched `m`, then `a`, then `r` and a typeahead could
  never match a word. It now accumulates. Its non-searchable select is a native `<select>` and always
  had the platform's typeahead — which is why the defect hid in the model most selects do not use.

  **`@modyra/angular`.** Its non-searchable select had no typeahead at all: a printable key reached a
  keyboard policy with no rule for one and did nothing. It now jumps.

  **`@modyra/widgets` gains an `activate` intent** — make one option the active one without choosing
  it. `move` could not express it, taking a direction where a typeahead knows the destination.

  **A WebKit defect fixed on the way.** Not every engine focuses a `<button>` when it is clicked, so a
  list opened by pointer left focus on the document and every keystroke after went nowhere. The
  listbox model says focus _stays_ on the trigger; the renderer now makes that true rather than
  assuming it.

  Asserted with real keystrokes per renderer and per engine, not only against the shared buffer — three
  adapters implementing one behaviour is what produced three behaviours, and testing only the rule
  would reproduce it exactly.

  **Pre-1.0 versioning.** `@modyra/plain`, `@modyra/lit` and `@modyra/angular` are on 0.x and make no stability promise yet, so a breaking change to them is a minor bump — that is what 0.x means. The change below is breaking; the version number is not claiming otherwise.

- 8d7a621: The shell's state classes are derived, and the accessible-name rules are reachable.

  `MDY_FIELD_STATE_CLASSES` restated what `MDY_FIELD_SHELL_CLASSES`, the shell's part states and
  `MDY_STATE_MODIFIERS` already held — and restated it in a _second vocabulary_: `labelStates` said
  `"has-error"`, the modifier, where the shell states say `"hasError"`, the state. Two tables for one
  fact drift the moment one of them is edited, and they drift silently, because a theme rule keyed to
  the spelling nobody updated simply stops matching. Every member is now derived from the one table
  that already declared it, and the shell's states moved to `structure.ts` beside the shell's classes,
  where the name of a part and what it may be doing are one fact rather than two.

  The derived values are identical to the literals they replace, with one exception worth stating:
  `fieldStates` is now `["open", "touched"]` rather than `["touched", "open"]`, because that is the
  order the catalogue has always declared and the order its test asserts. It affects the order two
  class names appear in on the field root, and nothing else.

  `MDY_SEMANTICS_REQUIRING_NAME`, `partsRequiringName` and `MdyAccessibleNameSource` are now exported.
  They said how a part comes by the name a screen reader announces — a listbox, a dialog or a grid with
  no name is announced as an unlabelled container — and were reachable only from inside the package, so
  an adapter writing its own checks could not consult the rule it was being held to.

  `MDY_POPUP_OPENERS` and the relation tables are keyed by `MdyWidgetKind` instead of `string`. A
  misspelled or stale kind was silently ignored, and `relationsFor` guards each lookup, so a wrong key
  **dropped the relation** rather than failing — a field whose errors reach no assistive technology,
  which is the exact failure declaring the relations was meant to make catchable. Narrowing the key
  immediately found `projectOverlayOpenerA11y` and `overlayControlledId` taking a bare `string`; both
  now take a kind.

- c7c6adf: A field says it is unusable in one vocabulary, and the audit can read both halves.

  `MDY_FIELD_STATE_CLASSES` names `mdy-input-wrapper--disabled`, which is true of ten kinds and false
  of seven: `checkbox`, `toggle`, `slider`, `radio`, `segmented`, `multiselect` and `file` have their
  own wrapper class, so the themes reach those states **structurally** instead —
  `.mdy-checkbox__control:disabled + .mdy-checkbox__indicator`, `.mdy-slider:disabled`. Both mechanisms
  are legitimate. Only the first was checkable, so for seven of seventeen kinds half the expression of
  "this field is unusable" sat outside everything this repository audits.

  `MDY_STATE_EXPRESSION` declares which mechanism each kind uses, and the style audit checks the
  declared one. Giving those seven wrappers state classes instead would have been wrong twice over: it
  mints seven classes no theme paints, and it contradicts `statesFor`'s rule that a part redeclaring
  its class does not inherit the shell's states — narrowed one batch earlier, and verified here to
  still throw.

  **It found a defect on the first honest run.** `file` reaches its states by neither mechanism: twelve
  declared classes and **no theme rule anywhere** touching `:disabled` or `aria-invalid`. A disabled
  file field looked exactly like a usable one, and an invalid one exactly like a valid one, in all four
  themes. The dropzone now dims when its input is disabled and takes the error border when it is
  invalid — reached structurally, the way its six siblings already are.

  The declaration states what a kind is **expected** to do, not what the themes were found doing. That
  distinction is the reason the gap surfaced instead of being written down as intended.

- f4b41af: `MDY_CANONICAL_FILLED_OBSERVATION` and the reset comparison complete Milestone C's ten.

  **Programmatic update** — a value the form put there rather than one the user typed. It is the same
  widget as at rest with something in it, and across the whole catalogue the only anatomical
  difference either renderer showed is the select's: a filled select shows its value, so the
  placeholder that stands in for one becomes optional. No state is reflected — putting a value in a
  field is not the user touching it, and a renderer that marked it touched would show validation for
  an interaction that never happened.

  **Reset** — a widget given a value and returned to the one it started with must look exactly as it
  did before it was ever touched. This is the one comparison that cannot be made from a single
  observation, because it is about two of them being the same: a renderer leaving a class, an
  attribute or a stale display value behind passes every other check, since the state it is left in is
  _legal_, just not the one it started in. Making the select's placeholder never come back once
  hidden — the classic stale-display bug — fails it and nothing else.

  `MdyCanonicalExpectation.value` can now be absent, meaning the contract cannot name it. Used for
  exactly one case: a file field's filled value is a `File`, and two files with the same bytes are
  still different values, so each fixture makes its own.

  **All three renderers pass all six observations with empty ledgers** — at rest, invalid, disabled,
  open, filled, reset — plus the open-then-Escape sequence.

- afef217: `Tab` is declared, and opening a list has one owner again.

  `MDY_WIDGET_KEYBOARD` never declared `Tab`, so `keyBindingFor` and `widgetKeyIntent` both answered
  `null` for it — while `selectKeyboardAction` and its multiselect counterpart closed on it. Two
  contract paths to one key, disagreeing: a renderer built from the declared bindings left a popup
  floating over a form the user had already tabbed out of, and one that called the policy did not.

  `Tab` now closes on all six overlay kinds. `MdyKeyBinding` gains `restoresFocus`, because the two
  dismissals genuinely differ and the difference cannot be inferred from the intent: Escape means _put
  me back where I was_ and returns focus to the opener, while Tab is already carrying focus to the next
  control and pulling it back would trap the user in the field they just left. Escape keeps
  `restoresFocus: true`; only Tab is `false`.

  **Opening on `ArrowDown` had two implementations.** The keyboard policy answers a collapsed combobox
  with `open`, and `createSelectController` _also_ opened whenever it received a `move` while closed —
  an intent the policy never sends. Either could be removed with the widget still behaving, which is
  what made the pair invisible: the suite stayed green on a rule the contract had stopped stating. The
  controller now treats a `move` on a closed list as the no-op the policy already says it is, and
  opening belongs to the policy alone.

- 635529b: `compareToCanonical` compares the state, the value and the focus owner, not only the shape.

  The snapshot has always collected seven fields and the comparison read three of them. A renderer
  that announced a resting field as invalid, held a value no other renderer held, or parked focus
  somewhere on mount produced a canonical observation that differed from every other renderer's and
  passed. `MdyCanonicalExpectation` now declares all four dimensions and each reports in the
  contract's words — `state is [touched], expected []`, `value is "value", expected ""`,
  `focus rests on control, expected nothing`.

  `MDY_CANONICAL_EMPTY` is new: the value each kind holds before anyone has given it one, in one table
  every adapter's fixture reads. Milestone C compares renderers given _the same initial state_, and
  three fixtures each deciding for themselves is three different questions — a number field started at
  `0` is filled and valid where one started at `null` is empty and required-failing. Not derivable
  from `MDY_VALUE_CONTRACTS`, which says a kind's shape and whether it is nullable: `null` and `[]`
  are both legal for a multiselect and only one of them is what an untouched field holds.

  Two things this found, both by renderers disagreeing rather than by reading them:

  - **A required field is not a resting field.** Every kind announced itself `invalid` on mount, on all
    three renderers, before the user arrived — the fixture made every field required and empty, which
    is already failing. The contract leaves the error list's visibility to the renderer, so this is a
    policy and not a violation, but it makes "at rest" and "invalid" the same observation. The
    at-rest expectation is now measured against a field no validator has judged.
  - **Two renderers seeded a text field `""` and one seeded it `null`.** The declarative Angular
    adapter starts every field at `null` whatever the kind. The fixture now states the initial value
    instead of inheriting a per-adapter default, which makes the comparison honest and leaves the
    defaults themselves as a separate question.

- 7091a93: `MDY_CANONICAL_INVALID` declares what every renderer must produce for a field the user left invalid.

  The invalid state had been _measured_ once, by hand, on two renderers, and the two defects it found
  were fixed and shipped. Nothing asserted it afterwards, so nothing stopped it regressing and Angular
  was never measured at all. This is the assertion that should have carried that work: seventeen kinds,
  three renderers, one expectation.

  Derived from the resting expectation rather than restated — the invalid state _is_ the resting one
  plus what invalidity adds, and a second hand-written table would drift from the first the moment a
  part moved. Three things change:

  - `errors` and `errorItem` stop being optional. At rest a renderer may or may not materialise an
    empty list and both conform; once there is an error to show, showing none is not a free choice.
  - `aria-describedby` becomes normative and must reach the error list. At rest it may name an empty
    description box or nothing at all, depending on the renderer.
  - The field reflects `invalid` and `touched`.

  **Fourteen of seventeen kinds now produce the same observation on all three renderers.** The six
  remaining divergences are recorded in each adapter's ledger, asserted both ways so that a new one
  fails and a stale one does too. Every one is a real defect rather than a permitted difference,
  because the other renderers do the thing:

  - Angular's `radio`, `multiselect` and `colors` carry no `aria-describedby` in the one state where
    there is something to describe — the error is rendered, styled, and announced to nobody. `radio`
    and `colors` never expose `aria-invalid` either.
  - Lit's `multiselect` never exposes `aria-invalid`. Its error list is on screen and its reference
    reaches it, which is what hid this: only reading the state itself finds the gap.
  - Plain's `datepicker` and `timepicker` never reflect `touched`, so the root carries no
    `mdy-renderer--touched` and the wrapper no error modifier — treatments three themes key off.

- 84ae084: The multiselect's keyboard contract, held to the same rules as the select's.

  `multiselectOverlayAction` had the same two gaps and the same consumption problem:

  - **`ArrowDown` on a closed list opens it** — it returned `move`, an action on options nobody can see.
  - **`Tab` closes and yields focus**, with `restoreFocus: false`.
  - **`@modyra/plain` answered only `Escape`.** No opening, no Tab, no navigation: a list opened with a
    pointer could not be left from the keyboard by any other key. It now dispatches the contract's
    action.
  - **`@modyra/angular` bound its key handler to the overlay's input only**, so a _closed_ list had no
    keyboard handler at all and could not be opened without a pointer. Found by pressing the key in a
    browser. It also restored focus on every close, ignoring the action's own `restoreFocus`, which
    pulled a tabbing user back into the field they were leaving.

  **Recorded, not fixed**: Plain does not dispatch `move` or `select`. Its controller has no active
  option to move — the intents are `toggle`, `increment` and `decrement` over chips, with no cursor —
  so arrow-key navigation needs that cursor first, which is a controller change and its own batch.
  Opening, dismissing and yielding focus map exactly and are wired now.

- 50a654b: The same gesture, executed by every renderer: open an overlay, dismiss it from the keyboard.

  `MDY_CANONICAL_AFTER_ESCAPE` is the first expectation about what a widget _does_ rather than what it
  looks like in a state it was put into, and `MdyStateFixture` gains `press` so the sequence can be
  expressed once and run by all three adapters. It replaces a hand-written Escape test that each
  adapter kept its own copy of — three tests that agreed on the transition and each asserted only that
  `aria-expanded` became false.

  That is why five kinds could strand the keyboard and stay green. Dismissing an overlay left focus on
  the document body, dropping the user at the top of the page with no way back to the field they were
  in: Lit's `multiselect` and `colors`, Angular's `select`, `datepicker` and `daterange`.

  **Lit's two are fixed here.** Focus returns to the opener, and deliberately only on keyboard
  dismissal — folding it into `close` would yank focus away from wherever the user clicked when the
  overlay closes because they clicked outside it.

  Angular's three are recorded, not fixed: they close through the shared overlay panel, whose `close`
  output is also emitted for a backdrop click, so separating keyboard dismissal from pointer dismissal
  is its own change.

  **The contract says focus returns _into the widget_, not to a named part.** Both renderers put a
  dismissed daterange back in its start field rather than on the toggle that opened it, which is a
  defensible design; landing on the document body never is. `state` is left unconstrained after this
  gesture for the same reason — whether opening a picker and abandoning it counts as having touched the
  field decides when validation errors appear, the renderers disagree uniformly rather than by
  accident, and that is a product decision this contract does not get to make by recording whichever
  renderer was measured first.

- bfeb371: The select's keyboard contract is complete, consumed, and proven by real key presses.

  `selectKeyboardAction` was missing two of the behaviours the contract itself describes, and one
  renderer of three was using it at all.

  - **`ArrowDown` on a closed list opens it.** It returned `move`, an action on options nobody can see.
  - **`Tab` closes the list and lets focus carry on**, with `restoreFocus: false` — a list left open
    follows the user to the next field, and focus pulled back traps them in the one they just left.
    `restoreFocus` is no longer typed as always-`true`, because Escape and Tab want opposite answers.
  - **`@modyra/plain` consumed none of it**, handling keys with a switch of its own that disagreed with
    the contract on exactly those two keys. It now dispatches the contract's action.
  - **`@modyra/angular` cancelled `Tab`'s native meaning**, so focus stayed inside a panel being torn
    down and the overlay's focus rescue pulled the user back into the field they were leaving. Found by
    pressing the key in a browser, which is the only place that question can be asked.
  - Angular also opened the list on a `move` it could not perform — a renderer covering for the policy,
    which is the pattern this milestone exists to remove. Gone.

  Six behaviours now run against a real browser: what opens, what does not, where focus goes when the
  list opens, where it goes on Escape, and where it goes on Tab. The policy stays a pure function with
  its own unit test; the browser proves that pressing the key does what the policy says.

- 816ca68: The number field's spin buttons are part of the contract.

  `@modyra/angular` renders spin buttons beside a number input. They wear `mdy-spin-btn` and
  `mdy-spin-btn-up`/`--down`, `modyra.css` styles them with four custom properties — and the widget
  contract declared no part for either. So no anatomy, relation, state or equivalence check had ever
  looked at them, and none could: every audit here starts from what the contract declares.

  That is the inverse of the shape the contract-gap audit kept finding. Everything else there is
  _declared and wired to nothing_; this was **emitted and painted and declared by nothing**, which is
  the direction an audit rooted in the contract is blind to.

  `number` now declares `increment` and `decrement` as **optional** parts with `button` semantics and
  those classes. Optional because the native control has its own spinners and a renderer that leaves
  them to the platform is complete without them — declared, so the ones that are drawn are checked.

  Confirmation the gap closed rather than moved: the three classes were sitting in the style audit's
  off-contract allowlist, and the audit now reports them as stale entries because they are contract
  classes. Removed.

  Found by a key check added for an unrelated reason: `PARENT_CANDIDATES` was keyed by `decrement` and
  `increment`, parts no kind declared. The table had been anticipating them since before they existed.

- 9a8a747: `MDY_FIELD_STATE_CLASSES` names the classes that are really on screen.

  It declared `mdy-field--invalid`, `mdy-control--open` and eight more like them. **No theme styled a
  single one, and no renderer emitted them** — one renderer's source already carried a comment saying
  so and quietly emitting `mdy-renderer--touched` instead. A renderer built from the contract alone
  would have produced classes nothing paints, which is the one failure mode a shared class vocabulary
  exists to prevent.

  Measured and corrected to what three renderers emit and three or four themes style:

  | declared before          | styled by | now                                                                |
  | ------------------------ | --------- | ------------------------------------------------------------------ |
  | `mdy-field` + 7 states   | 0 themes  | `mdy-renderer` + `touched`, `open`                                 |
  | `mdy-control` + 3 states | 0 themes  | `mdy-input-wrapper` + `disabled`, `error`                          |
  | —                        | 3 themes  | `mdy-label` + `filled`, `has-error` — added, it was never declared |

  Four projections built the dead names, two of them as hand-written literals. The select's trigger
  also carried `mdy-control--open`, `--disabled` and `--invalid` alongside its own
  `mdy-select__trigger--*` modifiers; none of the six is styled, and only the trigger's own are
  declared, so the twins are gone.

  **Breaking.** A theme or renderer selecting on `mdy-field--*` or `mdy-control--*` matched nothing
  before and matches nothing now, but the contract no longer tells anyone to emit them. Read the state
  from `mdy-renderer--touched`, `mdy-input-wrapper--error` and `mdy-label--has-error`. A boolean's
  checked state has no class at all: the themes style `:checked` on the input, which is where it lives.

- bdde472: The runtime report probes the environment, and the anatomy says what a server can emit.

  `browserRuntimeCapabilities()` hardcoded `dom: true` and `hydrated: true`. Called in a Node process
  with no `document`, no `window` and no `HTMLElement`, it reported a browser. A controller consults
  the report precisely to decide whether a command can be executed — the module's own header gives
  "focus commands during SSR" as the example — so the one function that answers _where am I_ could
  not tell a server from a browser. `ssrRuntimeCapabilities` was exported and consumed by nothing, so
  no test could have caught it.

  It now probes every dimension, and with no DOM returns `ssrRuntimeCapabilities` exactly. `hydrated`
  is the one dimension no global can answer — a browser that has parsed server markup but not yet
  attached to it is indistinguishable from one that has — so it follows `dom` and a renderer that
  knows it is still hydrating passes `browserRuntimeCapabilities({ hydrated: false })`.

  New: `staticParts(kind)`, `dynamicParts(kind)` and `isFullyServerRenderable(kind)`. A widget's
  anatomy divides into the closed control, which is markup a server can emit and which every kind
  has, and the overlay — the popup and everything under it. The split is **derived** from the popup
  subtree rather than restated as a second table, because a hand-maintained copy would drift the
  moment a kind gained a part, and it would drift silently.

  This is a statement about anatomy, not a rendering strategy: a renderer that mounts its popup
  eagerly emits the dynamic parts while closed, one that mounts lazily emits them on open, and both
  are conformant. The split is what makes that choice expressible.

  Proved by a suite that runs in a process with no DOM, and which asserts the absence of one first —
  every other suite in the package runs beside one that installs jsdom, and a DOM leaking in would
  make every assertion pass without meaning anything.

### Patch Changes

- 1c672d4: A colour field is described on the element it is named on, and Angular's radio group is described at
  all.

  **The contract disagreed with itself about `colors`.** `LABEL_FOR` pointed the label at `hexInput`
  and `DESCRIBED_BY_CARRIER` hung the description off `control` — the native picker, which two
  renderers make unfocusable. One kind, two elements each claimed as the accessible control, so a
  field's name and its description sat on different things. `DESCRIBED_BY_CARRIER` now names
  `hexInput`, and the canonical snapshot counts `hexInput` among the elements a state can be expressed
  on.

  This was found by a renderer being marked wrong when it was right: Angular exposed the description
  and the validity on the hex input the user types in, and the expectation — reading `control` — called
  that nothing at all. Two of three renderers agreeing is not the same as two of three being correct.

  The equivalence suite no longer restates the carrier either; it reads the relation from the contract.
  A table beside a table is the shape of the defect this milestone keeps finding: two spellings that
  agree today and diverge the moment one moves.

  **Angular's radio group carried no `aria-describedby` and no `aria-invalid`.** The group is a
  `radiogroup` with a name and nothing else, so an error was rendered, styled, and announced to no
  assistive technology. It now binds the shared projection, as the segmented group already did.

  Each `<input type="radio">` bound that same projection, so the error text was also attached to every
  option — announced once per choice. The contract declares the relation from the group; the options no
  longer restate it.

  **Angular's multiselect described itself from the options container**, which the user never lands on,
  rather than from the search button its label names. Moved.

- b213813: The theme class-contract audit stops reading module paths as class names.

  Its whole-file scan matched every `mdy-*` token in a source file, which includes the specifier in
  `import { mdyPart } from "../mdy-part.js"`. Binding a part contract in a Lit component therefore
  looked like emitting a `mdy-part` class — on thirteen kinds at once, as soon as enough components
  consumed the directive. Module specifiers are now stripped before the scan, alongside comments.

  The count of theme classes emitted by neither renderer is unchanged at 2477, so nothing was
  suppressed along with it; an invented class in a real template is still reported.

- 76e119e: A select that closes on blur lets go of the focus.

  `blur` closed with `restoreFocus: true`, so leaving an open select pulled focus back to its own
  trigger — off whatever the user had just clicked or tabbed onto. The pointer path in the same
  renderer closed with `restoreFocus: false`, so the two disagreed and which one ran decided where
  focus ended up.

  The arrow followed from the same event: it carries the `open` state and animates its rotation, and a
  trigger regaining `:focus` a tick after the rotation starts is what made the close look like it
  stuttered.

  `Escape` still restores focus, and deliberately: there the user is still in the widget and has
  nowhere else to be. `touched` is unchanged.

  The colour field never had this: it is the one overlay field with no focus path at all, so it has a
  single dismissal rule and nothing to disagree with.

- 569128a: A contract table cannot be keyed by a part that does not exist.

  `PARENT_CANDIDATES`, `SHELL_CLASS_FALLBACK` and `MDY_SHELL_PART_STATES` are keyed by part name and
  are **deliberately partial** — most parts need no parent hint, are not shell parts, and carry no
  shell states, so a lookup that misses is an answer rather than a mistake. That rules out the
  `PART_SEMANTICS` treatment (throw on a miss), and typing them to a union is no better: the union
  would have to be derived from the catalogue these tables help build, and a type derived from the
  data it validates checks nothing.

  What was left to get wrong is the other direction — a **key naming a part that does not exist**. It
  goes on being looked up, never matches, and silently contributes nothing: the parent hint stops
  applying, the shell class stops being inherited, and the widget still renders, slightly differently,
  forever. The keys are now checked once at load, and a stale one throws.

  It found two immediately. `PARENT_CANDIDATES` was keyed by `decrement` and `increment`, which no kind
  declares — removed here. Why they were written is recorded as finding I in `docs/contract-gaps.md`
  and is not resolved by removing them: `@modyra/angular` does render spin buttons, they wear
  `mdy-spin-btn`, the themes style them, and the contract declares no part for either. That is the
  inverse of every other finding in that document — emitted and styled and declared by nothing, rather
  than declared and wired to nothing — and it needs a decision rather than a patch.

- eb224f8: Closing an overlay is no longer a validation event.

  A user who opened a picker, changed their mind and dismissed it was marked as having _touched_ the
  field, so a required field they never filled began showing "This field is required" — for deciding
  nothing. Six kinds did it: `select`, `multiselect`, `datepicker`, `daterange`, `timepicker` and
  `colors`, through the shared dropdown lifecycle and again in each kind's own close path.

  The other two renderers already left the field alone, which is how this surfaced: the first action
  sequence compared across renderers showed one of them reporting `touched` after open-then-Escape and
  the others not. A uniform per-renderer difference rather than a per-kind bug, so it was a decision
  rather than a defect — now taken, and the canonical expectation after a dismissed overlay asserts the
  resting state rather than declining to say.

  `markAsTouched` stays where a field is genuinely left: the blur handlers, and the select adapter's
  own `onTouched`.

- 8e67cfe: Every exported shape in the 1.0 packages is classified.

  `contract-diff` snapshots the widget _catalogue_ — parts, relations, states, capabilities — and had
  never seen a TypeScript type. So every public interface was outside classification, and it showed:
  four changes in recent memory reported `patch` because the differ had nothing to compare, including
  a projection's shape and a required field added to an interface four adapters implement.

  `npm run test:type-surface` records **205 exported shapes** from the _emitted_ declarations, with
  member names and optionality, and classifies a change the way `docs/contract-compatibility.md` says:

  - optional → required, or a member removed: **major**
  - a new optional member, or a newly exported shape: **minor**

  Accept an intended change with `npm run type-surface:accept`.

  This is what freezes `MdyFormError`, `MdyDynamicDiagnostic` and the parse result: not by forbidding
  change, but by making a change to any of them a reviewable diff with a level attached.

  **What it still cannot see** is member _types_ — that `payload` exists and is optional, not that it
  is `unknown`. A widening is invisible, and saying so is better than implying otherwise.

- 5c8784c: One derivation of the overlay subtree, and stepping can always leave a bad value.

  `overlayOnlyParts` and `dynamicParts` answered the same question — which parts exist only alongside
  an open overlay — by two different walks. One rooted on the part _named_ `popup`, the other on the
  part whose _element is_ `popup`. They agreed on all seventeen kinds because every popup-element part
  happens to sit inside the one called `popup`, which is agreement by luck rather than by construction:
  a kind whose calendar or dial sat elsewhere would have split them, and nothing would have said so.
  `overlayOnlyParts` now delegates. The surviving derivation is the one with the fixed-point walk and
  the test that runs it over child-first and reversed anatomies.

  `stepTimeField` no longer produces `NaN`. A field holding nothing readable — an empty box coerced to
  a number, a parse that failed — made the arithmetic non-finite, and the caller stored the result, so
  the value became unreachable by the very key meant to change it. Stepping is documented as how a user
  _leaves_ a bad value, so it must not be the one operation that preserves it. A non-finite current now
  enters the range from the end the user is moving away from: up from nothing is the first hour, down
  from nothing is the last. Entering at `min + delta` instead would have put the first press on the
  second value and left the first unreachable from the keyboard.

  A property test now asserts that no combination of current and delta — `NaN`, both infinities,
  negatives, values past the end — can produce anything outside the declared range.

- 6e434ab: `MdyStateFixture` gains two optional members: `value()` and `portalRoots()`.

  A fixture is mounted to be asked a question about a widget in a state, and there are two such
  questions — whether this renderer is right, and whether three renderers agree. The state matrix asks
  the first from the DOM; a canonical observation asks the second and needs the value the form holds
  rather than the one a renderer chose to display, plus any element outside the subtree that may hold
  the widget's overlay.

  Both are optional, so `collectStateMatrix` and every fixture already written are unaffected.

  The three in-repo adapters now mount both suites through one fixture each. Two fixtures per adapter
  is two claims about the same widget that drift, and only one of them is checked: the state matrix's
  driver already knew that a daterange's empty value is an object and a slider's is its minimum, while
  the equivalence suite's mount knew neither and could not drive a state at all.

- 8bdc82b: The file field's keyboard, and the one question a browser test can only record.

  Three behaviours are now asserted in a real browser: the browse affordance is reachable from the
  keyboard, it is a real `<button>` rather than a styled `div` — the difference a screen reader and the
  Enter key both notice — and the tab order is measured rather than assumed.

  Opening the picker ends in a native OS dialog Playwright cannot see, so "Enter opens the file
  chooser" is deliberately **not** asserted. A green there would mean nothing.

  **Measured and recorded, not decided**: both the hidden `input[type="file"]` and the browse button
  are tab stops, so a keyboard user meets one affordance twice — once announced as "choose file", once
  as "Browse". The input is visually hidden by the clip technique, which keeps it focusable on purpose,
  and the button forwards clicks to it. Which element should own the affordance is a genuine design
  question with two defensible answers — the contract's `label[for]` names the input, but the button is
  the one a sighted keyboard user can see themselves land on — so the test pins the current state and
  says so, rather than settling it in passing.

- 81e1e39: Fixes `handle.readonly is not a function`, thrown on the first render of any text field bound to a
  typed form.

  `@modyra/angular` declared its own `MdyFieldHandle` interface, written out member by member beside
  the engine's. When the engine's handle gained `interactivity` and `readonly` — the two halves of what
  a user may do — the copy did not. `_buildHandle` built a handle satisfying the copy, TypeScript
  agreed, and the first widget controller to read `handle.readonly()` threw at runtime.

  The type is now derived from the engine's rather than restated: the signal members re-branded as
  Angular signals, the imperative half passed through unchanged. `markAsTouched(): void` is
  structurally a zero-argument accessor, so a blanket mapping would have rewritten it as
  `Signal<void>` — the commands are excluded by name.

  The same mistake cannot be silent again: removing either member now fails the build rather than the
  browser. A regression test asserts both are callable on a handle from `mdyForm()`.

  Also in this change: the canonical snapshot used by the renderer-equivalence suite reads each state
  from its most universal signal instead of from a class. `disabled` was read from a wrapper modifier
  that only some kinds carry — a checkbox, a toggle and a file field are natively disabled and carry no
  class at all — so half the catalogue reported no state. It now reads the native and ARIA attributes,
  and all seventeen kinds report alike.

- e4aa213: Two defects the invalid state exposed, both found by comparing renderers rather than by reading them.

  **An error list nothing pointed at.** Five field projections spelled the error list's id
  `${widgetId}__error` while the shell — and the catalogue, where the part is named `errors` — spells
  it `${widgetId}__errors`. One letter. Wherever the two halves of a reference came from different
  sources, `aria-describedby` named an id that did not exist: a radio group's errors reached no
  assistive technology at all, in the one state where that is the whole point. All five now use the
  part's name.

  **Two kinds that never said they were touched.** `select` and `radio`/`segmented` never called the
  field shell's `syncState`, so their roots carried no `mdy-renderer--touched` and their wrappers no
  error modifier — the treatments three themes key off. Every other kind in that renderer either called
  it or set the class directly.

  With both fixed, the invalid state now produces the same canonical observation on both renderers
  across the kinds measured: the error list present, `aria-describedby` resolving to it, and the root
  reflecting `touched`.

- 342f396: These packages are now compiled by TypeScript 7.

  Nothing about the published API changes, and that is checked rather than asserted: both compilers
  emit all twenty-one projects and the results are compared file by file. Across 464 files the only
  difference is the order in which the members of a string-literal union are printed in
  `catalog.d.ts` — the same type either way. The contract snapshot is unmoved, and the Angular package
  still builds through its own TypeScript 5.9 toolchain from these declarations.

  The Angular package and Studio's embedded compiler stay on TypeScript 5.9, which their peer ranges
  and its package exports require.

- 6d1e0cd: The datepicker, date range and segmented control are proven from the keyboard.

  Six more behaviours run against a real browser: each calendar opens from a key press, dismisses
  without stranding focus, and moves through its grid with the arrows; the segmented control's
  `role="radiogroup"` is held to meaning something — the arrows must actually move the selection.

  **All three passed on first contact**, which is the point of writing the tests: their keyboard
  policies already lived in the contract (`calendarKeyboardTarget`, `optionNavigationIndex`) rather
  than in a renderer's handler, so there was nothing to fix — only something to prove. Removing the
  segmented control's navigation now fails a test; before this, nothing asked.

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

- 969c08f: Milestone B: the keyboard is declared per kind, and `widgetKeyIntent` stops answering the same way
  for all seventeen.

  `MDY_WIDGET_KEYBOARD` says which keys each kind claims and what they mean, derived from what the kind
  _is_: a widget with options navigates them, one with a range steps it, one with two states toggles,
  one with an overlay opens and closes it. `widgetKeyIntent` now reads that instead of a chain of `if`s
  that asked about the key and, for one kind, the kind.

  **Breaking, and the reason it is worth breaking.** The old answers were wrong for most of the
  catalogue:

  - a **slider** was told ArrowUp means "move to the previous option" — it has no options, and its
    arrows must change its value. It now increments and decrements, as `number` already did.
  - a **text field, email, password, textarea and file** claimed ArrowDown, ArrowUp, Home, End and
    Enter. They have no list and no overlay; the native control owns those keys, and the widget layer
    was answering over the top of it. They now claim nothing.
  - a **closed select** answered ArrowDown with "move to the next option" while showing no options. It
    now opens, which is how a keyboard reaches the list at all.

  `Home` and `End` on a range are deliberately absent rather than approximated: they mean "go to the
  minimum" and "to the maximum", and the intent vocabulary has no word for that. A gap on the record
  is better than a binding that says something untrue.

  No adapter consumed this function — each renderer writes its own key handling — so nothing in the
  repository changed behaviour. That is also the honest limit: this makes the contract's answer right,
  and does not yet make any renderer answer to it. Proving keyboard behaviour against the declaration
  is task 17.

- 29621a7: A field name is an identity, and two of them cannot collide

  Generated ids are `${widgetId}__${part}`. A field named `a__label` therefore lands on the same id as
  field `a`'s label, in a different role — and the browser is perfectly happy to hold two elements
  with one id, so `getElementById`, `label[for]` and every ARIA IDREF quietly stop being
  deterministic. The failure is invisible until two particular fields share a page.

  **`__` is now forbidden in a field name** rather than escaped. Escaping would have encoded `_`,
  changing the id of every field whose name contains one, and those ids are consumer-visible —
  selectors and tests are written against them. Forbidding costs nothing by comparison: an id built
  from a name containing the delimiter was never deterministic, so nothing correct is taken away. The
  dynamic parser drops such a field with a warning, as it already does for names containing `.`;
  `mountMdyForm` throws, because a typed call site can be told at the call site.

  `MDY_ID_DELIMITER` and `isValidWidgetId` are exported so a consumer can check a name before
  building one. The delimiter lives in `@modyra/core` — the parser needs it and core cannot import
  `@modyra/widgets` — and is re-exported from `@modyra/widgets` where the id policy lives.

  **`mountMdyForm` also rejects duplicate names.** Two definitions sharing one used to collapse
  silently: the second overwrote the first in the name map, the `rendered` set stopped the first from
  drawing, and the form came out with one instance where the caller asked for two — a difference
  visible only by counting. The dynamic parser already refused duplicates; the typed entry point now
  holds the same precondition, and names the duplicate.

  **If you have a field whose name contains `__`**, rename it. It was already producing colliding ids;
  this only makes the collision say so.

- 602ac27: Milestone B, batch 4: a landmark must be announced with a name.

  Dimension 2's remaining half. `element` already said what a part _is_ and the relations said what it
  points at; nothing said how a screen reader is supposed to announce it. A listbox, a grid or a dialog
  with no accessible name is read as an unlabelled container and the user has to guess what they have
  landed in.

  Declared as a rule rather than a table per kind, because the requirement comes from what the element
  is rather than which widget it appears on. Which mechanism supplies the name — `aria-label`, a
  resolved `aria-labelledby`, a `label[for]`, a wrapping label, or the element's own text — stays the
  renderer's choice, and so does the text, which the renderer has to translate.

  `colors.presets` is corrected from `group` to `listbox`. All three renderers emit `role="listbox"`
  over `role="option"` swatches, so calling it an unconstrained group let the contract have no opinion
  about something every renderer had already agreed on. With the semantic right, the rule applies — and
  found that Plain's palette carried no name where Lit's and Angular's both do.

- 2c6a57f: A part's ARIA role is contract data, and enforcing it found two shipped violations.

  `element` said what a part may _be_ — the semantic lists the roles it admits — and nothing said which
  one it has to _have_, so the contract could permit a listbox and never require one. Roles now sit on
  the part contract, declared per kind and derived for an overlay opener from the relation that already
  names it, so the two cannot disagree. The check accepts an implicit role: `<input type="checkbox">`
  is a checkbox, and asking a renderer to write `role="checkbox"` on it would be asking it to spell
  what the host language already says.

  Enforcing it surfaced a divergence between one renderer and the rest, and following that thread found
  the reason: **`role="alert"` on the error list was wrong on every kind.** The list is a `<ul>`, and
  the role replaces its list semantics — axe reports every `<li>` inside as an orphaned list item, and a
  screen reader sees the same. The projections already set `aria-live`, so the role added nothing and
  cost the structure; it is removed from the shared projection and from both renderers that spelled it.
  One renderer had reached this conclusion on its own and recorded it in a comment; the other sixteen
  kinds kept the defect because no test had ever rendered an error list.

  The second violation: **`aria-invalid` and `aria-required` on a `role="group"`**, which supports
  neither — they describe a value, and a group holds none. Removed from the multiselect's option group.

  The accessibility suite now runs a pass with the error lists on screen, which is what makes both
  findings visible. It had only ever audited fields that could not fail, so the element the whole
  error-reporting path ends at was outside it by construction.

  **Behavioural note for `@modyra/angular`**: the multiselect no longer exposes `aria-required`. Its
  option group could not legally carry it and neither can its search button, and the widget uses a
  chip-group pattern rather than a combobox, which is where that attribute would otherwise live.
  Giving it a carrier means deciding the multiselect's ARIA pattern, which this change does not do.

- b0aa545: Contract v3: a slot says where it sits and whether it shows

  v2 made a row's track count authorable per size. What it could not express is anything about one
  child of that row: a field that moves to another column on a wide screen, or that is not shown on a
  phone. Those are properties of the slot, not of the row, and there was nowhere to put them.

  **Contract v3** adds one thing — a slot that says more than its name:

  ```json
  {
    "ref": "coupon",
    "at": { "base": { "hidden": true }, "md": { "column": 2, "hidden": false } }
  }
  ```

  A bare string still means "this field, wherever the row puts it", and the two spellings mix freely
  inside one row. `column` is 1-based and refused when it names a track the row does not have;
  `hidden` is a boolean; a size that says neither is refused as the typo it usually is.

  **The row's track count stays where v2 put it.** `at` on the columns node keeps meaning what it
  means, rather than being respelled as `{ columns: n }`. One property, one spelling — a second way to
  say the same thing would leave every reader deciding which wins, and would force a v2 row to be
  rewritten to say what it already says. Everything else in a v3 document — `fields`, `schema`,
  `layout`, `rules` — is v2's, unchanged, so **a v2 document is a v3 document with the version raised**,
  and v2 keeps parsing exactly as before. A v3 slot inside a v2 document is refused: accepting it would
  make this parser disagree with every other reader of the same bytes.

  The placement lands on the **column**, not on a wrapper inside it, because the column is the grid
  item — `grid-column` and `display` are properties of one, and nothing nested inside a cell can move
  itself into a different track however it is styled. A column holding several slots takes the first
  placement it is given, which is exactly how every row Studio authors is built.

  `layoutSlotStyle` in `@modyra/widgets` turns `at` into custom properties, and the foundation reads
  them through the same mobile-first cascade the track count already uses: what a size does not say, it
  inherits from the next smaller one. Visibility is a `display` value rather than a class for that
  reason — a class cannot be undone at a larger size without a second class saying the opposite, and
  "hidden on a phone, shown from tablet" is the case worth having.

  Both config-driven renderers honour it: `@modyra/plain` and `<mdy-dynamic-form>`.

- 33679ba: Each widget declares how its popup attaches

  `capabilities.anchoring` names, per kind, whether the popup matches its control's width and how much
  room it needs — a select's list belongs under its control and as wide as it, a calendar is sized by
  its own content. The renderers read it instead of repeating those numbers, so two adapters can no
  longer choose different widths for the same widget, and `MDY_OVERLAY_PORTAL_CLASS` names the class
  a renderer adds when it lifts a popup out of its field.

  The suite asserts every overlay-capable kind declares its anchoring and carries the shared container
  class, so a new widget cannot be added without saying how its popup attaches.

- e5eb12d: Checkbox gains a contract `indicator` part; the toggle keeps its shape

  The checkbox's drawn box is now a real element every renderer emits (`mdy-checkbox__indicator`),
  the counterpart of the toggle's `track`/`thumb`. It used to be a pseudo-element on the _label_, so
  the tick was positioned against the text and drifted off centre whenever the label's height
  changed; it is now centred by the box that contains it.

  The toggle's thumb keeps one geometry in both states and only travels — a knob that also grew
  between off and on read as two different controls. Travel uses `inset-inline-start` plus a signed
  translation, so it runs the correct way in RTL, and it is suppressed under reduced motion.
  `--mdy-toggle-thumb-size-checked` is deprecated: it now resolves to `--mdy-toggle-thumb-size`.

  Overlays take their surface, outline, radius and shadow from the active theme's semantic tokens
  instead of a fixed panel, so a popup is never a light card floating over a dark theme.

- c2fc744: The chip is a contract, and the multiselect wears Angular's anatomy

  Every renderer spelled its own chip: `"mdy-chip mdy-chip--counter"` in one, a ternary for
  `--selected` in another. `MDY_CHIP_CLASSES` names the primitive and its variants, and
  `multiselectChipClasses({ mode, role, selected })` answers what a chip carries — the mode picks the
  variant, selection is a state on top of it, never a variant of its own. Angular, Lit and the
  framework-free renderer all ask it, so the foundation's `.mdy-chip--selected` is the only place that
  decides what a taken chip looks like.

  The multiselect's anatomy is now Angular's, which is the reference: the options are chips in a grid
  _in the field_, under a header whose search button opens a popup holding the same grid over a filter
  box. `options`, `header` and `optionWrapper` are named; the popup's grid carries the shared class
  plus the overlay one, so one rule lays out both. A compact trigger showing value chips stays
  declared and optional.

  Found while checking it in a browser: the foundation read `--mdy-sys-*` and `--mdy-ref-*` without
  fallbacks, so in the default and Material themes a chip had no border and no corners —
  `border: 1px solid var(--mdy-sys-color-outline)` is dropped entirely when that token is absent. All
  155 now resolve to the tier's own values, and the audit covers the system and reference tiers too.

- 4751929: Every class a renderer emits is declared by the contract

  Enumerated exception lists on each adapter — 25 on Plain, 40 on Angular, 6 on Lit — recorded classes
  the renderers used and the contract had never described. They are gone: every one is now declared,
  and no adapter carries an exception list.

  Most became `presentation` classes on their kind. Structure the themes style that the contract does
  not otherwise constrain — a spacer, a header label, a variant marker — declared so a theme can
  enumerate what it may target and a renderer knows what it may emit, and deliberately **not** promoted
  to parts. A part has anatomy: an element, a parent, an order, a place in every relation and state
  check. Claiming that for a visual container would freeze the DOM far past what has to be shared,
  which is the one thing this contract sets out not to do.

  `MDY_SHARED_UI_CLASSES` covers what belongs to no single widget: the shared button, the overlay
  machinery, the surface treatments.

  An adapter that needs a hook the contract has no opinion on namespaces it, and the inspector takes an
  `adapterPrefix` — a rule rather than a list, so the distinction between "my own hook" and "invented a
  contract class" stays checkable.

- 18929b0: Every part declares what element it is, and an undeclared one fails

  `semanticElement()` ended in `return "group"`, so a part nobody had classified silently admitted any
  element at all — 121 of 237 nodes were `group` because the question had never been asked. A part name
  missing from the new `PART_SEMANTICS` map now throws at load: the contract does not get to have no
  opinion by accident.

  `group` still exists and means what it always did — a container the contract leaves unconstrained —
  but it is now an answer rather than the absence of one, and it covers 48 nodes instead of 121.

  Two semantics are new because the old vocabulary could not express what the widgets are.
  `columnheader` is a weekday above a calendar: a grid cell, not prose. `affordance` is a label or a
  button that reaches a value.

  `text` is no longer unconstrained: prose may be a `<p>`, a `<div>`, a `<span>` and several others,
  and may not be a control or a button pretending to be a caption. Supporting text is classified as
  prose rather than as a live status, which it never was.

  Declaring the semantics found one real divergence: supporting text is a `<div>` in one renderer and a
  `<p>` in another. Both are prose and both now conform, which is the answer — the contract had simply
  never said so.

  **Breaking.** A part whose element does not satisfy its declared semantic now fails conformance where
  the contract previously had no opinion — and an unclassified part name throws rather than admitting
  anything. First-party renderers already conform; a custom one may need its element corrected.

- 098a0af: A column row can be authored per breakpoint

  Responsiveness was a single rule in the foundation: below `40rem` every row collapsed to one column,
  whatever it was and whatever it held. A form could not say "two columns from tablet, four from
  desktop", so a responsive layout was not something you could declare — or test.

  `MDY_LAYOUT_BREAKPOINTS` names the four sizes once — `base`, `sm` (40rem), `md` (64rem), `lg` (80rem)
  — and a contract-v2 columns row takes an optional `at` saying how many tracks it shows at each. The
  widths live in `@modyra/widgets` rather than in each theme, because a row that becomes two columns at
  `sm` has to do it at the same width everywhere or the layout cannot be tested at all.

  `layoutNodeAttributes` emits one custom property per authored size and the foundation cascades them,
  each falling back to the size below, so declaring only `sm` still behaves.

  **Behaviour is unchanged for existing layouts, but the properties moved.** A row that authors nothing
  stacks at `base` and takes its declared tracks from `sm` up — exactly what the old `max-width: 40rem`
  rule did. That means `--mdy-layout-column-count` now carries the _narrow_ count (1) and
  `--mdy-layout-column-count-sm` the declared one; anything asserting the old value reads the new
  property instead.

  `at` is validated like any other untrusted input: a track count must be an integer from 1 to 12 and
  an unknown size is rejected, because it reaches the renderer as a custom property.

- 8279dc3: Declarative layout gets a contract, a grid and an audit

  Contract v2 lets a form declare sections and column rows, but what they rendered as was Plain's
  invention and no theme styled any of it. `MDY_LAYOUT_CLASSES`, `MDY_LAYOUT_COLUMN_COUNT_PROPERTY`
  and `layoutNodeAttributes` name that vocabulary, the foundation draws the grid from it — even
  tracks that may shrink, collapsing to a stack below 40rem — and Plain takes its classes from there.

  `scripts/audit-layout-contract.mjs` (wired into `test:contracts`) checks that every class the
  contract names is styled, that an adapter rendering layout consumes the contract rather than
  literals, and lists the adapters that do not render layout yet: Lit and Angular. That gap is
  recorded, not implied.

  The timepicker's `hour` and `minute` now carry distinct modifiers. Sharing one class made the two
  segments indistinguishable — the demo's own conformance banner reported a part-order violation
  because both resolved to the same element.

- 8e1164f: Lit's popups join the top layer, and one function puts every adapter's there

  Lit was the last adapter still laying its popups out in the page. That is not a detail of how a
  popup looks: the coordinates every adapter writes are viewport coordinates, and `position: fixed`
  only means that while no ancestor is a containing block for fixed descendants. `container-type` —
  which the foundation needs so a row can ask how wide its _form_ is rather than how wide the window
  is — makes every ancestor of every field exactly that. A Lit popup was therefore anchored against
  whichever ancestor happened to win, and clipped by any `overflow: hidden` above it.

  `setOverlayOpen` moves from `@modyra/plain` to `@modyra/widgets`, where the rest of the anchoring
  contract lives, and both adapters now call it. Plain re-exports it so its fields keep one import for
  everything overlay. Two adapters calling one function is a contract; two adapters with one copy each
  is a drift waiting to happen — and this one carries a policy decision worth stating once, namely
  `popover="manual"` rather than `auto`, because light dismissal would close a popup before the
  adapter's own outside-pointer handling ran.

  The controller shows it once per popup rather than once per frame — `refresh` runs on every scroll
  frame and `showPopover` throws on an element already showing — and takes it out of the top layer
  explicitly on close, rather than relying on the element being removed, so a renderer that keeps its
  popup in the DOM does not leave a closed one showing.

  Every Lit widget with a popup is covered: jsdom has no top layer, so the assertion is that the popup
  reaches the one function that puts it there, wearing the `manual` policy that function applies.

- db0c39a: Fix the Lit select overlay and the controls around it, and put what was missing under contract:

  - The open panel is positioned by the overlay contract, not by the anchored `top` the theme
    declares for a docked panel — in a later layer that override left the panel with both a `top` and
    a `bottom`, collapsing it to zero height.
  - ARIA states are strings now, so `attributes["aria-expanded"] ? …` was always true; the Lit select
    read them as booleans and rendered an expanded, disabled trigger.
  - The segmented control's segment count is part of the contract (`MdyPartContract.style`), so every
    adapter emits `--mdy-segments-count` and the theme's tick gutter is right everywhere; the modern
    theme no longer applies the radio group's `align-items: start` to the segmented bar, which had
    left every segment 18px tall inside a 44px control.
  - The multiselect names its `placeholder` part, like the select, and always renders a trigger — an
    empty, unselectable box was the previous state with nothing chosen.
  - Prefix and suffix are rendered only when something is projected into them.
  - Listbox navigation is named in the contract (`listboxNavigationIndex`, which clamps) beside
    `optionNavigationIndex` (which wraps), so an adapter takes the right one rather than importing a
    lookalike.

- daaabe1: A loading field says so without being opened. The `loading` part now hangs from the control rather
  than the popup, so an indicator reachable only by opening the list no longer satisfies the loading
  state. `empty` keeps its popup parentage: "no options match" is a statement about the list and has
  nothing to say until there is a list on screen.

  Lit's multiselect renders its loader on the search button, which is what its own select and the
  contract already did.

  **Breaking.** `loading` hangs from the control, so a renderer whose only loading indicator lives
  inside the popup no longer satisfies the loading state. Move it to the control, as every first-party
  renderer now does.

- 3f2e9d0: The multiselect's popup is one anatomy, not one per renderer

  Angular's multiselect draws a header holding the filter, a grid of option chips, each chip in its own
  wrapper, and marks a taken option with a modifier. None of that was named, so another renderer could
  only produce a list that happened to hold the same words. The catalog now names `popupHeader` and
  `optionWrapper`, the listbox carries the grid class every adapter must emit, and the chips carry
  their state as modifiers — `mdy-chip--selected`, with `--counter` or `--centered` for the mode —
  which is what a theme styles.

  The framework-free renderer draws that anatomy: the filter in the header, each option chip in its
  wrapper inside the grid, and the selected modifier on a chip in either mode.

- a8606da: One chip vocabulary for the multiselect, so every renderer draws Angular's chip

  The multiselect contract now names the chip anatomy the Angular renderer established — `mdy-chip`
  with `mdy-chip__check`, `mdy-chip__label`, and, in counter mode, `mdy-chip__btn` and
  `mdy-chip__count` — as the `option`, `optionCheck`, `optionLabel`, `optionStep` and `optionCount`
  parts. The controller projects `mdy-chip--centered` or `mdy-chip--counter` per mode and
  `mdy-chip--selected` per option, so an option looks the same whichever framework rendered it.
  Plain renders that anatomy; the theme draws the tick for renderers that ship no icon set.

  The chips a closed trigger shows now carry `mdy-chip--value`, which distinguishes a readout of the
  current selection from an option a user can pick.

  `MdyDynamicOptionsField` gains `mode: "single" | "multi"`, so a multiselect whose options can be
  taken several times is expressible in a form config rather than only through a renderer argument.

- ba52f67: Multiselect picks from an overlay, like every other popup widget

  The multiselect controller now owns an `open` state and `open`/`close`/`toggleOpen` intents, routed
  through the same `overlayLifecycleTransition` policy the select and the pickers use, and the view
  projects `trigger`, `popup`, `search`, `placeholder` and `chips` parts. Rendering the option group
  inline reflowed the page on every open; the group now lives inside the popup.

  `view.parts.group` therefore carries `mdy-multiselect__options` (the catalog's listbox class) rather
  than `mdy-multiselect`, which is now the trigger's. Renderers that styled the group as the visible
  control should move that class to the trigger.

- c170cf3: No renderer diverges from the contract, on any adapter

  The four divergences Angular still recorded are resolved, and two of them were resolved by fixing the
  contract rather than the renderer.

  - The multiselect's label pointed at an id no element carried — a broken reference, not a difference
    of opinion. Its search button carries that id now. The label also sat inside the input wrapper
    where the contract declares the two as siblings, and is a sibling now.
  - `nativePicker` required a `<label>` wrapping the native colour input, because the contract was read
    off one renderer. The other deliberately un-nested that input: a focusable control inside a
    focusable control is nested-interactive. Requiring the first pattern mandated the weaker of the
    two, so the contract now admits either and no longer says where the native input sits.
  - The pickers' openers carried no relation. They bind it now, and the relation declares the
    `combobox` role it needs: `aria-expanded` and `aria-controls` are only allowed on a typeable
    control once it says it is a combobox, which axe caught the moment the attributes appeared without
    it.

  The timepicker's relation names its popup rather than a dialog, because a renderer whose panel is not
  modal has no dialog to name.

- 6bdfb02: One call turns a placement into the class the catalog names it

  `above` and `overlay` are states of every popup part, but each adapter had to know how to ask: read
  the part's first class, suffix it, and skip `below` because the catalog gives it no class. Three
  adapters, three copies of that reasoning, and a fourth about to be written for Studio.

  `popupPlacementClass(kind, placement)` is that reasoning, once, in `@modyra/widgets`. It answers with
  the class or with `null` when the popup sits in the ordinary place. Every adapter now calls it:

  - `@modyra/plain` keeps the decision it already held, so `releaseOverlayPlacement` is unchanged.
  - `@modyra/angular` — `<mdy-overlay-panel>` computes it from its `kind`; `select` and `colors` own
    the element the state belongs on and compute it themselves. The `[class.…--above]` literals are
    gone from both.
  - `@modyra/lit` gains `popupClass(placement)` on the base, and `renderOverlayPanel` stops emitting
    `mdy-overlay-panel--above` / `--overlay`. Six components moved: `select` and `colors` off
    hand-spelled literals, and `datepicker`, `daterange`, `timepicker` and `multiselect` gained a
    placement class they never had.

  **No adapter emits `mdy-overlay-panel--above` or `--overlay` any more.** Nothing in the workspace ever
  styled them. A host that wrote its own rule against those names should move it to the widget's popup
  class — `mdy-select__dropdown--above`, `mdy-datepicker__popup--above`, and so on.

  The two audits that read class names out of renderer source resolve the call rather than looking for
  a literal, the way they already resolved `multiselectChipClasses`. Without that, an adapter moving
  onto the contract reads as one that stopped emitting the classes altogether — which is precisely the
  regression the audits exist to catch, reported backwards.

- a0559ec: The contract has one class vocabulary, not two

  The catalogue declared a part's classes and the runtime a11y projections wrote their own literals for
  the same elements — `mdy-select__listbox` where the catalogue said `mdy-select__list`,
  `mdy-datepicker__trigger` where it said `mdy-datepicker__input`, plus a whole field- and control-state
  vocabulary (`mdy-field--invalid`, `mdy-control--open`) the catalogue never mentioned. Anything built
  from the catalogue therefore treated classes the contract itself produced as inventions.

  The projections now read the catalogue instead of naming classes themselves, and the shared field and
  control state classes are declared once in `MDY_FIELD_STATE_CLASSES`. Twenty-four class names that
  belonged to no declared vocabulary now belong to exactly one.

  A test fails if any projection names a class the catalogue cannot account for, so the two cannot
  drift apart again.

  `mdy-timepicker__dialog` is a declared part, and `select`'s trigger and listbox declare the states
  their projections were already emitting modifiers for.

- 351c0ed: A popup opens from the end of its control where the trigger is

  Which corner an overlay opened from used to depend on the pointer against the middle of the
  _viewport_, so the same calendar opened from the left corner on a form in one column and the right
  corner on another, and clicking a different part of the same field changed it again. Each widget now
  declares the edge its popup hangs from in `capabilities.anchoring.alignment` — every trigger in the
  catalog sits at the end of its control, so every popup opens from that end and stays there. Only a
  content width that will not fit that side can overrule it. Where no widget declares an edge, the
  pointer picks the half of _the control_ it landed in, which is the comparison that was wrong before.

  `overlayAnchoringFor(kind)` returns a widget's anchoring as `anchorOverlay` options. Angular, Lit and
  the framework-free renderer all take their popup's room, width and edge from it, so a renderer no
  longer holds numbers of its own — Angular's controls were flipping sides at 128px where the contract
  says 180 for a list and 240 for a calendar.

- f93c8cd: One source for the relation between an overlay and the control that opens it

  `projectOverlayOpenerA11y` returns the `aria-expanded` and `aria-controls` an opener carries. It is a
  function of kind, widget id and open-ness alone, so a renderer can bind it without building the
  controller that produces the rest of a kind's projection — and the kind-specific projections call it
  too, so six kinds across three adapters have one answer rather than four.

  `MDY_POPUP_OPENERS` now records both halves of the relation: which part opens the overlay and which
  part the relation names. Those are not the same thing — ARIA points at the element carrying the role,
  which is a listbox for select, a grid for the datepicker, a dialog for the timepicker, and the popup
  itself for the rest. The entries were previously bare strings.

  Angular's multiselect binds it: the search button carried no `aria-expanded` at all, so nothing
  announced that the overlay had opened. Its projected panel gains an id for the opener to name,
  through a new `panelId` input on the overlay panel — a panel rendered outside the field it belongs to
  has nothing else tying it back.

- ebfa0ca: One spelling for every custom property the renderers write

  `--mdy-overlay-left` was a string literal in four packages at once — widgets, core, angular and lit.
  A custom property that is misspelled fails silently in the worst way: the class is still there, the
  rule still matches, and the popup simply appears at the top-left of the page because the number never
  arrived.

  `MDY_CSS_PROPERTIES` names each one once, grouped by what writes it — the eight `--mdy-overlay-*` the
  placement policy emits, the layout column count, and the three per-control numbers a theme cannot work
  out for itself. `anchorOverlay`, `layoutNodeAttributes` and the segmented control's projection now
  write through the vocabulary instead of literals.

  `--index`, which positions a number on the clock face, is named here as the one property still outside
  the namespace: every theme reads it under that name today, and a test records the exception so it
  stays a known one rather than becoming a precedent.

  Two findings recorded while wiring this up, neither fixed here: `--mdy-overlay-surface-color` is read
  by the foundation and given a value by no tier, and `--mdy-segments-count` is read only by the iOS
  theme, which `modyra-base.css` documents deliberately.

- 4803d30: Every overlay opener names the element it opens, and the relation is checkable

  Angular emitted `aria-expanded` on its select, colour and range openers and `aria-controls` on none
  of them, so nothing tied an opener to the overlay it opened. All three now bind the shared opener
  projection, and the element the relation names carries the id — on the node holding the popup's
  contract classes, not on the positioning wrapper.

  `MDY_POPUP_OPENERS` pointed the timepicker's relation at a `dialog` part the catalogue never
  declared, so the relation named an id no part was responsible for rendering. The element exists and
  carries `role="dialog"` and the modal semantics; the catalogue simply omitted it. It is declared now,
  and a new assertion fails if any declared relation names a part the contract does not have.

- 8e1dc80: Anchoring is a contract, and all three adapters apply it

  `anchorOverlay` in `@modyra/widgets` turns a measured anchor and viewport into the placement, the
  alignment, the height, the width and the exact `--mdy-overlay-*` coordinates a popup needs. Plain,
  Lit and Angular now measure and apply; none of them computes a position of its own. It takes
  `current` to keep an open popup's shape steady while its anchor moves, and `lock` for a host that
  tracks the chosen corner itself — the locked height is measured for the locked side rather than
  inherited from the side the policy would otherwise have picked.

  Positioning also stops being something a theme can take back. The popup primitives are declared
  last in the components layer, so no earlier per-widget rule can override an overlay's placement,
  and Modern's docked `top: calc(100% + …)` rules are gone: a theme that positioned an overlay was
  deciding whether a popup landed on its own control.

  Every renderer now anchors popups to the control wrapper, as Angular always did — Lit anchored to
  the whole field (label included, opening a row low and 240px off) and Plain's pickers were docked
  inside the field with no shared positioning at all. Verified in the browser across five widgets in
  two demos: 6px gap, aligned to the anchor's edge, stable under scroll.

  The theme audit now reads Angular's `[panelClass]`, which had made every popup class Angular emits
  invisible to it.

- d9e424a: A popup is placed where it shows whole

  `anchorOverlay` takes the popup's measured size — `contentHeight` and `contentWidth` — and places it
  where the content fits rather than merely where there is room. A 280px calendar with 264px below its
  control and 288px above now opens above and shows whole, where the minimum-space rule opened it below
  and let it scroll. Horizontally the popup hangs from the edge that has room for it, and one too wide
  for either edge is moved bodily back inside the viewport instead of being left over it.

  `MdyOverlayDecision.fits` reports whether the content fits the space decided for it, so "does not
  scroll" is something a test can assert. `MDY_OVERLAY_VIEWPORT_MARGIN` and `MDY_OVERLAY_GAP` are
  exported, since the arithmetic is only reproducible if the two distances it uses are named. Every
  placement emits `--mdy-overlay-max-width`, which the foundation applies, so even a popup nobody
  measured cannot run off the screen.

  Both inputs are optional and the behaviour without them is unchanged: no measurement means the
  previous minimum-space rule, and `fits` is `true`, since a missing measurement is not evidence of a
  squeeze.

- d21390f: Overlays keep their shape, never take part in layout, and always sit above field feedback

  Every `popup` part in the catalog now carries `MDY_POPUP_CLASS` (`mdy-popup`), and the foundation
  takes anything wearing it out of flow. Lit's multiselect rendered its overlay content into a
  `display: contents` panel, so the options were laid out inline and pushed the page down on open;
  that guarantee is now the contract's rather than each renderer's.

  `stabilizeOverlayPlacement` keeps an open overlay's side, height and alignment fixed while its
  anchor moves: coordinates follow the anchor, but re-deciding the shape on every scroll frame is
  what made popups flip and resize as the page scrolled. Plain holds the decision for the lifetime
  of one opening.

  `@modyra/styles` gains a documented stacking scale (`--mdy-z-raised` … `--mdy-z-portal`) and the
  raw `z-index: 999/1000/9999` values now take rungs from it, with errors and supporting text placed
  below overlays so field feedback can never cover an open popup. Segments are equal-width with the
  check gutter reserved in every state, so selection no longer resizes the bar and two renderers with
  different labels produce the same geometry. The toggle track is border-box, so its height and
  radius no longer change between off and on. Plain's select renders the contract's `placeholder`
  part instead of a modifier class on the value, and its radio/segmented options put the drawn
  control on its own element rather than on the native input.

  The Angular UI golden baseline changes only by the three CDK popups gaining `mdy-popup`.

- 26017d8: Render `daterange` for real in the framework-free renderer: two endpoints, a separator, a toggle and
  a calendar popup driven by the widgets range policy, committing and closing as soon as the second
  endpoint is picked. The calendar body is shared with the datepicker and now carries the contract's
  full anatomy — a weekday header and one row per week — with month and weekday names, and the first
  day of the week, taken from Intl via `buildDateLocale`. Selecting a date in the datepicker likewise
  closes the overlay and restores focus to the trigger.
- e0a4cef: Render `file` and `colors` for real, retiring the placeholder renderer: a drop zone with a browse
  button, a file list and a clear action driven by `fileSelectionTransition`, and a colour control with
  a preview swatch, hex field and preset palette driven by `colorValueTransition` — which is also what
  decides that picking a preset closes the popup while typing a hex value does not. Popups are placed
  through a shared helper that applies `decideOverlayPlacement` and writes the `--mdy-overlay-*`
  properties the themes read. The catalog now names the classes for these parts, so an adapter takes
  them from the contract instead of inventing them, and the caret a renderer without an icon set
  leaves empty is drawn by the theme through `:empty` rather than by naming that renderer.
- 5dbf493: Whether a part must exist is a decision per kind, not a default

  A part was mandatory only if its name was one of eight strings — globally, for every widget. Everything
  else was optional, which is not a decision that it may be absent: it meant no renderer could be caught
  omitting a checkbox's indicator, a toggle's thumb or a select's arrow, because the contract had never
  been asked.

  Twenty-six parts across twelve kinds are now declared mandatory. The list is measured rather than
  assumed: every one is a part all three renderers already emit in the resting state, so nothing is
  being demanded that is not already true. Parts some renderers omit stay optional.

  Optional parts fall from 79% of the anatomy to 68%.

  **Breaking.** Twenty-six parts across twelve kinds are now mandatory where the contract previously
  had no opinion. A renderer that omits one — a checkbox's indicator, a toggle's thumb, a select's
  arrow — now fails conformance where it passed before. The list is measured from what every renderer
  already draws, so a first-party adapter needs no change; a custom renderer may.

- 1523836: A read-only field is finally read-only

  `form.setReadonly()` has always set the field state, and the widget controllers have always blocked
  intents when read-only, and the ARIA projection has always been ready to emit both `aria-readonly`
  and the native `readonly` attribute. None of it ever ran, because one hop was missing:
  `MdyFieldHandle` did not expose `readonly`, so the controllers read it from a local signal seeded by
  an option no renderer passes. Every other field of that projection — `value`, `disabled`,
  `required`, `touched` — came from the form. `readonly` alone did not.

  The consequence was a field a form had marked read-only that still accepted typing, in every
  renderer, with `aria-readonly="false"` on it while it happened. Found by the state matrix, and then
  by typing into one.

  `MdyFieldHandle` now exposes `readonly`, and `createFieldController`,
  `createBooleanFieldController`, `createDatepickerFieldController` and
  `createMultiselectFieldController` read it from the handle. `setReadonly()` on the controller stays
  an imperative override for a renderer with no form behind it.

  **This changes behaviour.** If you call `form.setReadonly()` today it does nothing; after this it
  does what it says — the control gets the native attribute, exposes `aria-readonly="true"`, and stops
  accepting input. Anything that depended on it being inert will notice.

  `MdyFieldHandle` gains a required member. If you implement that interface by hand rather than taking
  it from a form, add `readonly`.

- e7f3189: Milestone B, batch 2: the references between a widget's parts are contract data.

  `MDY_WIDGET_RELATIONS` declares, per kind, which part names which other part and with what attribute —
  the label's `for`, the control's `aria-describedby`, a group's `aria-labelledby`, an opener's
  `aria-controls`. These existed in two places and neither was the contract: the projections emitted
  them at runtime and the conformance inspector restated the rules in its own code. A rule that lives
  only in the checker cannot be read by someone implementing the widget, which is what this contract
  exists to make possible.

  Declaring them changes what can be caught. The inspector could only ever find a reference pointing at
  nothing — a _dangling_ id. A part carrying no reference at all has nothing to dangle, so a field
  whose errors reached no assistive technology looked exactly like one with no errors. Two shipped
  defects of that shape turned up immediately:

  - **A select described itself to nobody.** `projectSelectA11y` never emitted `aria-describedby`, so
    the two adapters that consume the projection linked no errors to the trigger at all. The projection
    now makes the relation, and the renderer says which of the description or the error list is on
    screen — `aria-describedby` must name an element that exists.
  - **A Lit radio group did the same.** The projection offered the attribute and the renderer restated
    its neighbours by hand, dropping it.

  `label[for]` is also checked against the HTML rule that it may only name a labelable element.

  **Breaking for `@modyra/angular`**: `MdyFormComponent` takes a second type parameter, `TSubmit`,
  defaulting to `Partial<T>`. It previously pinned that default, which made a typed form's own precise
  submit type unassignable to it — `[form]="typedForm"` did not compile, and the demo build had been
  failing. Callers naming the component's type explicitly gain a parameter with a default.

- 0bd898d: Angular renderers take their semantic state from the shared projection

  The slider, radio group and file input bound `aria-invalid`, `aria-required` and `aria-describedby`
  and never `aria-disabled`; the segmented control bound `aria-disabled` and never `aria-invalid`.
  Each template was its own answer to what a control must expose, so no two agreed.

  Those four now bind `[mdyPart]="controlPart()"` and receive all of it from the projection in
  `@modyra/widgets`. An attribute added there reaches the DOM without a template being touched.

  `projectFieldShellA11y` gains `descriptionVisible` alongside `errorsVisible`. A projection cannot
  know which of a control's descriptive elements a renderer actually emitted, and naming one that is
  absent leaves `aria-describedby` pointing at nothing — so the renderer answers, and a control with
  neither an error list nor supporting text describes itself by nothing.

- 7a574d1: A part inside the overlay can be required, and is required _of an open widget_.

  `inspectWidgetDom` takes `open`. A part that only exists inside the popup cannot be demanded of a
  closed widget, so until now such a part had to be optional — which meant nothing checked it at all.
  Left unset the option demands nothing, so every existing resting suite is unchanged.

  With that, `calendar` becomes a required part of both pickers. All three renderers draw one and two
  themes lay it out, and it was optional only because the contract had no way to say "required once
  this is showing".

  Angular gains the open-state conformance run its siblings have, and a reach ratchet beside it: 40 of
  the 45 parts that exist only while open are rendered by an open widget there, and a renderer that
  quietly stops drawing part of its popup now fails on the count rather than passing a conformance run
  performed on a smaller subject.

- fe0dba3: Overlay placement is one vocabulary, and it lives in `@modyra/widgets`

  `@modyra/core/overlay-position` held the placement policy Modyra had before there was a contract. Its
  functions have been unused by every renderer since `anchorOverlay` took over — but its _types_ were
  still the currency Angular and Lit spoke, so the package that no longer decides where a popup goes
  was still the package that said what "where" means.

  `@modyra/widgets` now names it: `MdyOverlayPlacement`, `MdyOverlayAlignment`, `MdyOverlayCoords`,
  `MdyOverlayPlacementResult`, and `overlayStyleProperties` for a host that positions its panel from the
  custom properties. Angular and Lit import from there; nothing in the repository imports
  `@modyra/core/overlay-position` any more.

  **For consumers of `@modyra/core`:** nothing is removed. Every export in that module stays, and each
  now carries `@deprecated` naming its replacement. The types are duplicated rather than re-exported
  because `@modyra/widgets` depends on `@modyra/core`, and re-exporting would make the two packages
  depend on each other; they are structurally identical, so imports can move across one at a time.

  Worth knowing before you move: `computeOverlayPosition` never knew how big the popup was. It picked a
  side with _enough_ room rather than the side where the content fits, and could not report whether the
  popup would scroll. `anchorOverlay` takes the measured content and answers both.

- 8b87472: Milestone C, at rest: **all seventeen kinds, all three renderers, one expectation, empty ledgers.**

  `MDY_CANONICAL_AT_REST` covers the whole catalogue. Each adapter's suite mounts the widget and hands
  over the root; nothing about a renderer appears in the expectation, which is the property that makes
  it one suite rather than three that happen to agree.

  The table is measured, not reasoned about. `parts` is what every renderer actually shows at rest —
  an empirical floor, so one dropping a part is visible even where the contract would permit it.
  `optional` is every other part the kind declares, because presence there depends on a free choice
  (eager or lazy mounting) or on what the consumer supplied.

  Building it took three passes, and each correction came from a renderer disagreeing rather than from
  theory:

  - **`supportingText` is not canonical.** Two renderers materialise an empty description box at rest;
    the third renders one only when content is supplied. The intersection has to be taken across all
    three, and taking it across two produced an expectation the third could not meet.
  - **`optionWrapper` likewise** — one renderer emits it only for a custom option template.
  - **`requiredMarker`, `prefix` and `suffix` are consumer-dependent**, not renderer-dependent: they
    appeared "extra" only because one fixture makes every field required and supplies affixes.

  `aria-describedby` is deliberately not in any at-rest expectation, for the same reason it was dropped
  from `select`: with nothing to describe, what it names follows from whether a renderer builds an
  empty description element. It becomes normative once there is something to say.

  Falsified by removing the label from one renderer's field shell: fifteen kinds fail.

- 5b34979: The declared anatomy matches what the widgets actually are

  Four defects in the catalogue, each of which had been hiding a renderer difference rather than
  describing one.

  **The timepicker's dial was declared outside its popup.** `container` fell through to `root`, so
  `overlayOnlyParts` covered only the popup and the dialog — and the thirteen parts of the dial were
  treated as resting-state anatomy. A renderer with a closed picker therefore looked like one that had
  lost thirteen parts. They are inside the popup now, which is where all three renderers put them.

  **Five parts carried no classes**, so no check could ever locate them. `datepicker.calendar`,
  `datepicker.dialogHeader` and `daterange.calendar` now carry the classes their renderers already
  emit — two of which had been filed as decoration. `daterange` gains `dialogHeader`, which it renders
  and never declared.

  **`number.decrement` and `number.increment` are removed.** No renderer implements them, no class
  could find them, and no theme could style them. A part nothing renders and nothing can check is not a
  contract.

  **`nativePicker` is `affordance`, not unconstrained.** It admits a `<label>` or a `<button>` — both
  are correct ways to reach the value, and the second avoids nesting a focusable control inside
  another. The previous release made it unconstrained, which let anything satisfy it.

  The calendar header may sit inside the calendar or directly in the popup, the same transitive rule
  the grid already had.

  **Breaking.** The timepicker's dial parts move under `popup`, so `overlayOnlyParts("timepicker")`
  returns fifteen parts rather than two. Anything reading the declared parentage — a conformance
  fixture, a theme selector written against the old tree, a renderer that mounted the dial outside its
  overlay — sees a different answer.

- 3acc9bf: The class vocabulary is enforced, and modifiers are bounded by declared states

  `strictClasses` gated the invented-class check and no adapter suite enabled it — the only caller was
  a unit test. All three now do, so a class outside the contract fails on Plain, Angular and Lit.

  Even enabled it was too loose: any `base--modifier` passed as long as the base was canonical, so
  `mdy-label--anything` was accepted. A part's `states` exist to make the classes it can carry finite,
  and nothing read them. Modifiers are now checked against the states their part declares —
  `mdy-chip--selected` passes, `mdy-chip--invented` does not. A part that declares no states stays
  unconstrained, since that vocabulary is still being filled in.

  Each adapter carries an enumerated list of the classes it uses that the contract does not yet
  declare — 31 on Plain, 40 on Angular, 6 on Lit. The lists are asserted, so a class added tomorrow
  fails until it is declared or added deliberately. They fall into three groups: adapter-internal
  hooks, classes the widget's own runtime projections emit that the static catalogue never lists, and
  structural classes the themes style that the catalogue has never described.

- 88b57b4: The clock face is a control, and a time keeps its formalism on screen

  Two things a time picker was getting wrong, both now decided once in `@modyra/widgets`.

  **The face ignored the format.** `timepickerDialNumbers` always answered 1–12, whatever the picker
  was set to — so a 24-hour picker held `14:00` as a value and offered no 14 to point at. The hour was
  reachable by typing and by dragging the hand, and not by the control that exists to pick it. A face
  that offers twelve hours on a twenty-four hour clock is telling the user something untrue about what
  they are editing. It now answers the hours the format has: **1–12 with an AM/PM toggle beside them,
  or 0–23 with none**, the second twelve on an inner ring at the same twelve positions, exactly as a
  clock has always done. `00` rather than `24`, because midnight is the hour a 24-hour clock names.

  **The face had no keyboard at all.** It listened for `mousedown` and `touchstart` and nothing else:
  no role, no value, no focus. Every number on it was reachable only by dragging a hand around a
  circle — the one gesture a keyboard cannot make and a screen reader cannot describe.
  `timepickerDialKeyIntent` is the policy, once: arrows turn the hand clockwise, Home and End go to the
  ends of _this_ face, PageUp/PageDown turn a quarter of it, and everything **wraps** — a clock is a
  ring, and clamping at the end of a circle is the one behaviour a dial cannot justify. It never
  produces an hour the format does not have, and the test walks every key from every hour in both
  formats to say so.

  `timepickerDialAria` gives the face `role="slider"` with the bounds the keyboard uses, so what a
  screen reader announces and what the arrows reach cannot drift apart — asserted against each other
  rather than written twice.

  Angular leads and Lit and plain call the same function, so all three faces show the same hours.
  Clicking a number also stopped calling every hour a 12-hour one, which turned every afternoon on a
  24-hour face into a morning.

  `inner` joins the state vocabulary and the `dialNumber` part declares it, so the ring a renderer drew
  a number on is named by the contract rather than spelled in three templates.

  Recorded while here: the golden audit walks `.ts` files only, and this widget keeps its template in a
  separate `.html`. Everything that clock renders — including the ARIA added here — is invisible to it.

- d32694a: The contract names the states a part can be in

  A part's classes said what it _is_; nothing said what it is _doing_. Selected, open, disabled,
  today's date, the start of a range — 38 such classes lived as string literals in the renderers and as
  rules in the themes, agreeing only because someone remembered. A theme styling `--focused` where a
  renderer emits `--active` is a rule that matches nothing, and no test in this repo could see it.

  `MDY_STATE_MODIFIERS` names each state once and fixes its spelling, `stateClass` derives the modifier,
  and `partClasses(kind, part, states)` answers "what classes does this part carry right now" from the
  catalog — the shape `multiselectChipClasses` already proved for the chip. A part declares the states
  it can be in; asking for one it never declared throws rather than emitting a class no theme has.

  Shell parts resolve through `MDY_FIELD_SHELL_CLASSES`, so a state on `inputWrapper` lands on
  `mdy-input-wrapper`. A widget that renames a shell part has made it a different part and does not
  inherit the shell's states: a multiselect's `inputWrapper` is the chip grid, and
  `mdy-multiselect--disabled` is a class nothing has ever styled.

  `multiselectChipClasses` gains `removable`, and spells `--selected` through the shared vocabulary
  instead of its own constant. `widgetStateClasses(kind)` reports every class a widget can produce,
  which is what an audit needs to hold the shipped CSS to the contract.

  Additive: no existing export changes shape.

- f7e0c7c: The state contract says what a state _does_, not only what it renders

  `MDY_WIDGET_STATE_CONTRACTS` described attributes and parts. That is enough to catch a renderer that
  forgets `aria-disabled`, and useless against the defect that actually shipped: `disabled` and
  `readonly` rendered differently and behaved identically — both submitted, both validated — and
  nothing about the markup was wrong.

  Each state may now declare a `behaviour`: whether a field in it is `submitted`, `validated`, and
  `reachable`. `disabled` is none of the three; `readonly` is all of them.

  The declaration is checked against the engine that implements it, so it cannot drift into being a
  comment with a type on it.

- 62575e9: The `inlineError` part is named by the class renderers actually emit. It was declared as
  `mdy-inline-error-icon` — the Angular component's _selector_, not a class — so the part was
  unlocatable on all thirteen kinds that declare it, and no theme styled the name either. It is now
  `mdy-control__inline-errors`, which both adapters emit and three themes style.

  Its semantic changes from `status` to a new `image`: the inline error is an icon carrying its
  message as an accessible name, not a live region. The message already reaches assistive technology
  through the control's `aria-describedby`, and both adapters had independently chosen `role="img"`.

  Two further corrections the same fixture exposed:

  - The inspector compared a state's _name_ against the class suffix, so every state whose modifier is
    spelled differently — `hasError` becomes `--has-error` — was rejected as an invented class. It now
    translates through `MDY_STATE_MODIFIERS`.
  - `mdy-inline-errors`, `mdy-control__inline-errors-icon` and `mdy-control__inline-errors-tooltip`
    join the shared vocabulary. A renderer emitted all three and the contract knew none of them.

  `allowedClasses` is removed from the DOM inspector options. Nothing passed it; a renderer that needs
  a class of its own namespaces it under `adapterPrefix`.

  **Breaking.** `inlineError`'s class changes from `mdy-inline-error-icon` to
  `mdy-control__inline-errors`, and its semantic from `status` to `image`. Nothing emitted the old
  name — that was the defect — so no first-party renderer changes; a theme or a custom renderer
  selecting on it matched nothing before and still matches nothing, but the contract now names what is
  really on screen.

- f998046: The inspector sees what a widget renders, not only what a caller names

  `inspectWidgetDom` built its view of the DOM from the caller's part map alone. A part missing from
  that map was looked up nowhere: a mandatory one surfaced as `PART_MISSING`, but an **optional part
  that was actually rendered was skipped entirely** — its element type, classes, containment and order
  all unchecked. A caller could silence any check by omission, without meaning to.

  Unmapped parts are now resolved from the DOM by the classes the contract gives them, over the same
  scope every other check uses, so the map is an override rather than the definition of what exists.
  Measured on one adapter, five rendered parts were invisible this way.

  Two defects surfaced immediately, both in the inspector:

  - **Containment only ever tested the first parent.** A part whose parent repeats — a calendar cell in
    one of six rows, a check inside one of many chips — was compared against parent number one and
    reported as mis-parented if it lived anywhere else. Any resolved parent now satisfies it.
  - A part the contract marks `repeated` must be mapped with **every** element it rendered; mapping one
    of many made each of its children look mis-parented.

- f759e3d: The DOM contract is now checked with the overlay open.

  Every conformance suite inspected widgets at rest, and a resting overlay widget renders none of its
  popup. **Forty-five parts across six kinds** — the listbox and its options, the calendar grid and its
  cells, the clock face — had their classes, parents, order, semantics and cardinality checked nowhere
  at all. `overlayOnlyParts` names them, which is what made the scope a measurement rather than a
  guess; 38 of the 45 are rendered by an open widget and are now inspected.

  Defects it found, all in shipped renderers:

  - **Lit's calendars had no grid semantics.** Rows carried `role="row"` and weekdays
    `role="columnheader"`, but the grid had no `role="grid"` and the day cells no `role="gridcell"` —
    rows floating outside any grid, which is not a structure assistive technology can navigate. Plain
    had it right, which is how the contract was confirmed rather than assumed.
  - **Four Lit overlays never named what they controlled.** The datepicker, daterange, timepicker and
    multiselect openers carried `aria-expanded` and no `aria-controls`, and the popups they open had no
    id to name. The reference is emitted only while open, so a closed overlay does not dangle.
  - **Lit's select trigger dropped `role` and `aria-describedby`** from the projection it otherwise
    reads attribute by attribute — the third defect of that shape.
  - **Lit's multiselect label named a `<div>`**, which `label[for]` cannot resolve. It now names the
    search button, the opener the contract declares.
  - **Lit's colour palette put `role="listbox"` on the panel that positions it** rather than on the
    grid of swatches whose children are the options.
  - **Plain's pickers rendered no calendar frame.** Lit and Angular both emit
    `mdy-datepicker__calendar` and two themes lay it out, so Plain's date pickers were arranged by
    rules that could not reach them.

  Three contract corrections came out of it: `mdy-overlay-backdrop` and `mdy-timepicker-segment-label`
  were emitted by renderers and declared nowhere, and `right` becomes a declared popup placement state
  — an adapter's own comment recorded that it had to spell that class as a literal "because the catalog
  declares no alignment state".

  The multiselect's value area is declared before its header. That order used to fall out of the
  sequence the part names happened to be written in, which is not a decision, and it put the
  placeholder after the affordance that changes it — which no renderer does.

- df563d4: The optional parts that only exist once something is supplied are built and checked for the first
  time, and building them found three contract defects.

  `clear` no longer hangs from `fileItem`. Every renderer puts one clear button beside the file list,
  because clearing empties the field rather than one row — the contract asked for it inside an item.
  `mdy-file-name` and `mdy-file-meta` join the file kind's presentation classes; both were rendered and
  neither was declared.

  Plain gains the two affordances it never had. `loading` on select and multiselect shows on the
  control, matching the other adapters, so its state matrix no longer reports the state as undrivable.
  `prefix` and `suffix` render on the free-text kinds when the field supplies content for them — an
  empty affix is a gap the theme still spaces, so they appear only when there is something to put in
  them. Both arrive as optional properties on the dynamic field config.

  Counter mode was the same story. `optionStep` and `optionCount` exist only on a multiselect in
  `"multi"` mode and no fixture had ever used it, which is why `mdy-chip--centered` was declared and
  its opposite `mdy-chip--counter` was not. `optionCheck` stops being mandatory: a counter chip has a
  count between two steppers and no tick, so requiring it asked every counter-mode renderer for an
  element that means nothing there.

  New coverage, each falsified by breaking the renderer it checks: a file field with files chosen, a
  text field with both affixes, Lit's slotted affixes, and the value-chip presentation the multiselect
  catalogue declares as its compact alternative — declared, styled and reachable through
  `multiselectChipClasses`, and until now never once constructed.

- 6d000c1: A popup says which side it landed on, in the one name the contract gives it

  The catalog has declared `above` and `overlay` as states of every popup part for some time. No
  renderer used them. Angular and Lit each spelled the same idea as `mdy-overlay-panel--above` /
  `--overlay` on a wrapper element — a name the catalog never gave and no stylesheet has ever
  matched — and `@modyra/plain` wrote `data-placement` instead. One decision, three spellings, none of
  them styled.

  The cost was not theoretical. The foundation carried a rule that reversed a multiselect's popup when
  it opened upwards, so the filter box sits nearest the control the user just clicked. It was keyed on
  the overlay panel's `--above`, which nothing emits, so **an upward-opening multiselect has always put
  its filter at the top, furthest from the pointer.** Coordinates cannot express that: `top` and `left`
  put the box somewhere, they cannot tell a stylesheet which way it went.

  `overlayAnchoringFor(kind)` now carries the `kind` it was asked about. `anchorOverlay` does not read
  it — placement is geometry — but a renderer holding an anchoring now holds everything needed to name
  the result, so `@modyra/plain` reflects the placement through `partClasses(kind, "popup", …)` with no
  change at any call site. `below` carries no class, exactly as the catalog documents, so an ordinary
  popup is spelled like one nobody has placed.

  `MdyPopupWidgetKind` is derived from the catalog — the kinds whose contract declares a `popup` part.
  Asking `partClasses` for a checkbox's popup now fails to compile rather than at runtime, and a widget
  that gains or loses a popup changes the type by changing its own definition. A test asserts anchoring
  and a popup part always travel together, since `overlayAnchoringFor` reports the narrowed kind on the
  strength of the anchoring guard alone.

  The foundation's reversal rule is re-keyed onto the contract's name and applies for the first time.

  **Angular and Lit still emit `mdy-overlay-panel--*` as of this changeset.** They are unchanged here
  and no worse than before — the class was unstyled then and is unstyled now. Moving them onto the
  contract needs the panel to learn which widget it is holding, which is renderer plumbing rather than
  a stylesheet change; the batches that follow do it, and by release no adapter emits those names.

- 026cf08: The slider colours its track

  Reported: the slider's bar never filled. Two things were wrong, and each one alone was enough.

  `@modyra/plain` never wrote `--mdy-slider-fill-pct`, so the gradient sat on its `0%` fallback no
  matter where the handle went. It writes it now, on the control, which is the element the gradient is
  composed on.

  Even written, nothing painted it. `.mdy-input-wrapper input:not(.mdy-checkbox)` sets `background:
transparent` to flatten a text control's frame, and at `(0,2,1)` it erased the split track composed
  on `.mdy-slider` at `(0,1,0)` — for every renderer, not only plain. The slider joins the checkbox in
  that exemption: both draw themselves.

  Then it filled to the wrong place. A range input's handle travels by its **centre**, from `thumb/2`
  to `100% - thumb/2`, so a stop written at `ratio × 100%` follows the element rather than the handle
  and misses it by `thumb × (ratio − 0.5)` — measured at −10px, 0px and +10px across the range, right
  only at the midpoint. The stop is now `thumb/2 + ratio × (100% − thumb)`, taken from
  `--mdy-slider-thumb-size`, so a theme that resizes the handle stays aligned for free.

  That correction has to happen in CSS, because the handle's size is a theme token and a renderer that
  knew it would be drawing the theme. CSS can only do it given a unitless number: `calc()` cannot
  divide by a percentage to recover `0.3` from `30%`.

  **`--mdy-slider-fill-pct` is therefore no longer the property to write.** Renderers write
  `--mdy-slider-fill`, a ratio in 0–1. Anything that _reads_ `--mdy-slider-fill-pct` keeps working — it
  is still declared, derived from the ratio on the control itself. Anything that _writes_ it directly
  no longer has an effect and should move to `--mdy-slider-fill`.

  How far along the value sits is now `sliderFillRatio` in `@modyra/widgets`, one calculation instead
  of one per adapter. Angular and Lit had disagreed about a range with no width — Angular answered
  `0`, Lit divided by a nudged denominator — and `0` is the answer that degrades to an empty track
  instead of an arbitrary one. A value that is absent or not a number fills to the minimum rather than
  painting `NaN`.

- a613ac8: A range, a colour and a file field announce their state

  `daterange`, `colors` and `file` are rendered without a widgets controller — the range policy, the
  colour transitions and the file selection all live in `@modyra/widgets`, and the renderers own only
  DOM and events. What went with that split by accident was the accessibility projection: nothing
  built one for these three, so they applied the _static_ part contract and nothing state-driven.

  The state matrix caught six rows of it — `aria-invalid` and `aria-disabled` absent on all three. The
  hole was wider than the rows. There was no `aria-required` and no `aria-describedby` either, so the
  error list was rendered, styled, and tied to nothing: a screen reader was never told a range was
  invalid, and never told why.

  `projectFieldShellA11y` is new in `@modyra/widgets` — the shared half of `projectFieldA11y` with the
  input's own concerns left out, since `type`, `inputmode`, `autocomplete` and `readonly` all belong
  to a text control and none of these three kinds is one. The Plain renderers apply it, and the shell
  label now names a control on all three.

- cf497e7: Milestone C begins: one canonical observation, answered by three renderers.

  `canonicalWidgetSnapshot` reduces a mounted widget to what the contract can say about it — which
  parts are on screen, what each part's role is, which _part_ every reference resolves to, the field
  states, the value, who owns focus, and whether the overlay is showing. `MDY_CANONICAL_AT_REST`
  declares the expectation once and `compareToCanonical` reports the difference in the contract's own
  words.

  Two rules keep it canonical, and both had to be enforced against my own first attempt:

  - **It may not know which adapter it is looking at.** Parts are found by the classes the contract
    gives them. A snapshot that needed telling would not be canonical, and the suite on top of it would
    be three suites.
  - **No ids.** Every adapter generates its own, so a relationship records the _part_ an attribute
    lands on. That an id matches is an implementation detail; that the label points at the control is
    the contract.

  Getting the reduction right meant deciding what counts as an observation, and the differences between
  renderers were the teacher every time:

  - **A hidden subtree is not observed.** One renderer mounts its overlay eagerly and hides it, another
    builds it on open. The roadmap leaves that free, so counting hidden elements made two identical
    widgets look different.
  - **`aria-hidden` is not hiding.** It means "do not announce", not "do not render" — a select's arrow
    is decorative and still part of the anatomy.
  - **Open-ness comes from `aria-expanded`, not from the DOM's own hiding.** One adapter sets `hidden`,
    another leaves the panel attached under `visibility: hidden`, a third detaches it, and only the
    first is visible to an inspection without layout.
  - **A portalled overlay is found through the relation that names it.** Scanning the document for
    something popup-shaped picks up a neighbour's panel the moment two widgets are mounted.

  Select at rest now produces the same observation on Plain, Lit and Angular, with an empty divergence
  ledger on all three. `aria-describedby` is deliberately not part of that expectation: at rest, with
  nothing to describe, whether it names an empty description box depends on a free choice, and two
  renderers disagreeing about it are both right. It becomes normative once there is something to say.

- e403b6d: The clock is the timepicker's picker, in every renderer

  The dial was Angular's alone: the other renderers showed two number fields, and the framework-free
  one had no container either, so its popup had no width of its own and stretched to fill the viewport.
  The catalog now names the whole anatomy — `container`, `content`, `dialFace`, `dialHand`,
  `dialNumber`, `modeToggle`, `action` — and the foundation places a number from the `--index` it
  carries, so a renderer draws the clock rather than inventing one.

  `MdyTimepickerFieldState.viewMode` is part of the state, with a `set-view-mode` intent: which face
  the popup shows decides what it contains and how tall it is, so a renderer keeping it privately would
  be deciding the widget's anatomy. Every opening starts on the clock, on the hours.
  `timepickerDialNumbers` gives the numbers on the face — the hours, or the minutes in fives with 0 at
  the top — and `timepickerSelectedDialValue` marks the nearest five, so a draft of 07 highlights 05
  rather than nothing.

  The framework-free renderer draws the clock and picks from it: it reports where the pointer is, and
  the angle becomes a time through the contract's `set-from-angle`, the same snapping Angular's clock
  uses. Picking an hour hands over to the minutes, so one gesture sets a whole time. The numbers are
  labels, not controls — the foundation makes them `pointer-events: none`, and the face owns the
  gesture.

- f7e0c7c: A read-only control can still be reached

  `disabled` and `readonly` were two independent booleans, and fourteen call sites across the
  controllers each wrote their own combination of them. They did not agree. Most wrote
  `disabled || readonly`, which is correct for changing a value and wrong for everything else.

  One of them was actively harmful: the multiselect applied a **native `disabled`** to its search box
  for read-only fields, taking the control out of the tab order. A read-only field's whole purpose is
  that you can still reach it, select its text and copy it — and the search box does not even change
  the value, it filters what is shown, which a user who may read the field must be able to do.

  There are only two questions, and they are now named:

  - `blocksValueChange(interactivity)` — true for `readonly` and `disabled`. Input, toggling,
    stepping, clearing, confirming a picker: anything that writes.
  - `blocksFocus(interactivity)` — true for `disabled` alone. The native `disabled` attribute,
    `tabindex`, and anything deciding whether the control can be reached.

  Widget state carries `interactivity` alongside the derived `disabled`/`readonly` booleans, so a
  renderer reading either still works. `setReadonly()` remains an imperative escape hatch for a
  renderer with no form behind it, and can now only ever _reduce_ what is permitted — it cannot
  re-enable a field the form disabled.

  **Breaking.** `MdyInteractivity` — `"enabled" | "readonly" | "disabled"` — replaces the independent
  `disabled` and `readonly` booleans on controller options and field state. Callers reading either
  boolean should read `interactivity`, or use `blocksValueChange` / `blocksFocus`, which answer the two
  questions the fourteen hand-written combinations were each guessing at.

- 095fff8: Milestone B, batch 3: the contract says what a widget _does_.

  `MDY_WIDGET_TRANSITIONS` declares, per kind, which user action moves an overlay between open and
  closed, and whether closing returns focus to the opener. The anatomy said a select has a popup and
  the state contract said it may be open; neither said that clicking the trigger opens it or that
  Escape closes it. Those are the parts a user experiences, and they existed only as the behaviour of
  two shared functions.

  The table is written independently of those functions rather than derived from them — a declaration
  read out of the implementation it checks is not a check — and `overlayLifecycleTransition`, which all
  three renderers route through, is held to it. `widgetKeyIntent` is held to it too, but that function
  has no adapter consumer: every renderer implements its own key handling.

  Declaring it alone would have proved nothing, so all three adapters now **replay** the transition
  against a real DOM: open the overlay, press Escape where focus actually is, and assert the opener's
  `aria-expanded` — the contract's own statement of open-ness, and the one signal every adapter
  carries. Five shipped defects turned up, none of them visible to any existing check:

  - **Plain's daterange and colours** bound Escape inside a popup that never takes focus, so the
    handler could only fire if the user had already reached into it. Both could be opened from the
    keyboard and not closed.
  - **Plain's timepicker** had no Escape handler at all.
  - **Lit's multiselect** defined a correct Escape handler and never bound it — unreachable code.
  - **Lit's timepicker and colours** had the same popup-only binding as Plain's.

  Angular had none: it closes on Escape on every overlay kind.

- 77f2095: Name every control's parts in the contract, so a theme has a stable hook for each one and an
  adapter never has to invent a class: slider (`mdy-slider-container` / `mdy-slider` /
  `mdy-slider-value`), checkbox and toggle (`mdy-checkbox__control`, `mdy-toggle__control`), radio and
  segmented (group, option, control, label), select and multiselect (trigger, value, arrow, popup,
  search, list, option, chips, chip). The select's filter is now a contract part of its own: it is an
  input at the top of the popup, not typing over the trigger, so the committed value stays visible —
  Plain renders it that way and the DOM gate accepts a portalled popup as the contract's own portal
  capability rather than a containment violation.
- 92d6155: Move HEX normalization, invalid draft preservation, preset selection and active-color comparison into Widgets.
- 6bff3da: Move datepicker modal draft, confirm and cancel transitions into Widgets while leaving Angular responsible only for rendering and DOM focus execution.
- bbb575e: Move datepicker bounds validation and canonical value transitions into Widgets, removing duplicated Angular dirty and touched mutations.
- 8061d1d: Move date-range modal draft, completeness, confirm and cancel transitions into Widgets.
- de65e03: Move date-range normalization, bounds, filter and endpoint-order transitions into Widgets and route Angular dirty/touched state through the shared bridge.
- 93a65aa: Move file accept, size, count, single/multiple, rejection and clear transitions into Widgets.
- 2388e2a: Move multiselect overlay keyboard, active-option navigation, close and restore-focus decisions into Widgets.
- cf9b772: Move multiselect toggle, counter, clear and overlay selection transitions into Widgets and remove duplicated Angular mutations.
- dc7acff: Move segmented option navigation and selection transitions into the framework-agnostic Widgets contract.
- e6e592d: Move overlay open, toggle, outside interaction, Escape, destroy, announcement and restore-focus decisions into Widgets.
- c136ad1: Move scalar input, selection, dirty, touched, disabled and readonly transitions into a shared framework-agnostic Widgets controller, and make Angular scalar renderers dispatch intents through that controller.
- 0b4298b: Move select keyboard decisions and native value transitions into the framework-agnostic Widgets contract.
- 847f436: Move select option normalization, parking and restoration into Widgets and remove the final renderer ownership exception.
- 9b2646a: Move timepicker clock hour, minute, period and dial snapping transitions into Widgets.
- fd6e967: Move timepicker draft, confirm, cancel and typed-input transitions into Widgets and route dirty/touched state through the shared bridge.
- 4206be3: Establish the complete canonical Widgets catalog and machine-verifiable Angular ownership matrix while preserving the protected Angular semantic UI surface.
- b4b236d: Make filtering part of the contract: an option a query does not match is projected as `hidden`
  (plus a `--hidden` class) by the select and multiselect controllers, so every renderer filters
  identically by applying the part instead of reimplementing the match. The theme stops its own
  `display` from beating `[hidden]` on options and chips.
- d91dca1: Establish versioned, typed structural anatomy and conformance helpers for the framework-agnostic Widgets UI contract, with Angular's current semantic UI surface protected as the migration baseline.
- ff10fc7: Replace self-declared widget completeness with typed anatomy, runtime controllers, source evidence, and observable Angular contract consumption while preserving the protected Angular UI surface.
- d17ea98: Nest the catalog anatomy (a control now hangs off its wrapper, an error item off the error list)
  and mark the control and its container required, then add `assertWidgetDomContract` /
  `inspectWidgetDom` to `@modyra/widgets/testing` — a framework-agnostic runtime check that rendered
  DOM matches the contract's classes, containment, order and ARIA.
- 5a66c4a: Declare outside-pointer dismissal in the contract: every widget that owns an overlay reports
  `capabilities.dismissOnOutsidePointer`, and the decision stays `overlayLifecycleTransition`, so a
  pointer landing outside closes by default and a popup that should not be dismissible has to say so.
  Plain wires it through one shared helper for the select, the pickers, the date range and the colour
  palette.

### Patch Changes

- 6f09012: A disabled select, datepicker or timepicker is really disabled

  The state matrix caught these as `STATE_NOT_APPLIED`: the widget said `aria-disabled="true"` and the
  control stayed operable. A disabled datepicker still accepted a typed date, a disabled timepicker
  still accepted a typed time, and a disabled select's trigger still opened its listbox. Assistive
  technology was told one thing and the keyboard did another.

  The three projections now emit the native `disabled` alongside the ARIA, which is what the
  multiselect trigger has always done — the inconsistency had no reason behind it. The select trigger
  also gains `aria-invalid`, which it computed for its classes and never exposed.

  Every adapter that applies the projection's attribute map inherits this. Adapters that hand-write
  their bindings do not, and Angular already binds `[disabled]` and `aria-invalid` on these kinds by
  hand, so it is unaffected.

- cd22e96: An opener names the popup it opens

  Select and multiselect have always declared the full relation: the control that opens the overlay
  says it has one, whether it is showing, and _which_ one. The pickers and the colour field declared
  the first two and never the third — the trigger said `aria-haspopup="grid"` and `aria-expanded`, and
  named nothing, so nothing tied opener to popup for assistive technology.

  `aria-controls` is now declared in the datepicker and timepicker a11y projections, so every adapter
  inherits it, and Plain's daterange and colours wire their own toggles to their popups' ids.

  `MDY_POPUP_OPENERS` also changed to say where the relation actually lives. The pickers follow the
  combobox pattern — the typeable control carries `role="combobox"`, `aria-expanded` and now
  `aria-controls`, and the calendar button beside it is a second affordance for the same popup — so
  the opener is the control, not the button. Colours and daterange are the exceptions and really are
  opened by their toggles.

- 1d3a104: `applyPart` no longer removes classes it did not add

  It rebuilt the whole `class` attribute from a baseline captured on the first call, so any class a
  host added afterwards — a framework binding toggling a state class, most often — was erased on the
  next apply. Nothing broke visibly: the element still rendered, just without the class.

  It now tracks the classes it put on the element and takes back only those. A contract that names no
  classes, which is every projection-driven part, leaves `class` alone entirely.

- 808293d: Record the extended catalog anatomy in the completeness evidence (the boolean wrapper, the
  multiselect wrapper, the calendar's weekday header and week rows, the colour picker's ordering) and
  gate it permanently: `npm run test:contracts` runs the golden Angular surface, the completeness
  evidence, the widgets suite, the framework-free renderer's catalog and DOM conformance and the
  readiness audit, and CI runs it alongside the Studio suite.
- f580d4b: Take the Lit elements' vocabulary from the contract: each element declares its widget kind and
  reads root, shell and part classes from `MDY_WIDGET_CONTRACTS` instead of repeating literals, and
  its ids follow the shared id policy. The supporting-text container is always rendered with the id
  the controllers describe the control by, so `aria-describedby` no longer dangles. Angular emits the
  contract's boolean control class for the same parts, and a jsdom conformance suite holds the Lit
  elements to the same runtime DOM gate as the other adapters.
- f5ee72d: No package names one it must not know about, and an audit keeps it that way.

  `scripts/audit-package-independence.mjs` runs in `test:contracts`. The rule it enforces:
  `@modyra/core` and `@modyra/widgets` are the contract and name no adapter at all; an adapter may name
  itself and nothing else. Siblings are peers, not references.

  It found **58 comments** across five packages, all the same shape — "modeled on Angular's real
  component", "the same structure the themes style for the Angular renderer", "the answer Angular
  kept", "Plain and Angular come through `current`". A framework-free renderer explaining its anatomy
  by naming the framework one is the same inversion as the contract doing it, one layer down; and a
  contract that cites a consumer is describing the wrong thing.

  The import graph was clean throughout, which is why none of this was caught: nothing here is a
  dependency, so nothing objects at build time. The audit checks file names too — that half is what an
  `angular-ui.json` sitting in the widgets package would have failed.

  `plain` counts only when spelled `@modyra/plain`, because it is also an ordinary adjective: a plain
  button, a plain array.

- 6f6ed4e: One placement policy: a popup that moves rather than one that shrinks

  Reported as a preference for how Angular's overlays behave while the page scrolls. Measured, the
  adapters were not doing the same thing at all — they reached `anchorOverlay` through two different
  doors, and the two are different policies:

  - `current` — plain and Angular. The coordinates follow the anchor; the _shape_ is the decision
    taken when it opened, and the side changes only once it has genuinely stopped fitting.
  - `lock` — Lit. The side it opened on is pinned and the **height is re-measured every frame**, so a
    popup scrolling towards the bottom of the window shrinks and its content goes behind a scrollbar.

  Lit now passes `current`, unconditionally. It used to pass `lock` only when the caller supplied both
  `lockPosition` and `lockAlignment`, so it sometimes stabilised nothing at all. Its panel state
  carries the whole decision rather than just the side and the edge it landed on: the height is the
  part that was being re-measured, and holding a decision means holding all of it.

  `lock` remains, documented as what it is — pin the corner, let the box shrink — and no adapter uses
  it. The difference between the two is now asserted rather than left to be discovered: at the same
  scroll position, on the same popup, `current` keeps 452px and `lock` cuts it to 188px.

  `stabilizeOverlayPlacement` is the pivot of all of this and had only ever been reached through
  `anchorOverlay`, so three of the facts its docstring claims had no test: the shape is held while
  `fits` is reported against the room of _this_ frame; a modal popup is not un-modalled by room
  appearing around an anchor it stopped chasing; the width, alone, still follows the anchor. Each is a
  separate branch and each now has one.

  The Lit tests assert this from the adapter's own state, because "all three adapters agree" is a
  claim about three call sites, and a test of the shared function cannot make it.

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

- 9d7b426: Give the boolean controls the anatomy Angular and Lit already render: one clickable
  `.mdy-checkbox` / `.mdy-toggle` wrapper holding the input, the drawn `.mdy-toggle__track` >
  `.mdy-toggle__thumb`, and the text after it. A switch is a checkbox input with `role="switch"`, and
  the wrapper — not the input — carries the component class. The theme's Plain-only
  `.mdy-switch-control` and input-drawn checkbox rules are gone with the markup that needed them.
- e4ff1ac: Emit ARIA states as `"true"` / `"false"` strings everywhere, so a renderer that writes the
  attribute verbatim cannot produce `aria-required=""`. Adds a framework-free catalog demo
  (`npm run demo:plain`) that renders all seventeen kinds under every packaged theme and reports the
  live DOM-contract verdict on screen.
- a3c662e: A read-only control no longer announces itself as disabled

  Every a11y projection emitted `aria-disabled` as `state.disabled || state.readonly`, so a field a
  form had marked read-only told assistive technology it was disabled. It is not: a read-only control
  takes focus, its text can be selected and copied, and it is submitted with the form. Announcing it
  disabled tells a screen-reader user they cannot interact with something they can.

  `aria-disabled` now reflects `disabled` alone, in all seven projections. `aria-readonly` carries
  read-only, and only on the kinds that declare the state — a slider, a checkbox and a radio group
  have no read-only rendering and now say nothing rather than `aria-readonly="false"`.

  **What this does not change, and is worth knowing.** Modyra still treats the two states identically
  in every respect it controls: the same intent blocking in eleven places, both kept in
  `form.value()`, both validated. In HTML a disabled field is neither submitted nor validated, and a
  read-only one is both. That difference is real and is not implemented — it changes submitted
  payloads, so it is planned separately rather than shipped here.

- b3aa842: The 24-hour face really shows twenty-four hours, and the keyboard can be reached

  Three things stood between the previous change and it working, and only one of them was the change.

  **A component stylesheet was quietly overruling the foundation.**
  `timepicker-renderer.component.scss` carried its own copy of `.mdy-timepicker-dial__number` —
  byte-for-byte the foundation's rule, transform included. Component styles are
  emulated-encapsulation, so they wear an attribute selector and outrank the foundation wherever the
  two speak: the inner ring drew at the _outer_ radius and every second hour sat on top of a first
  one. Twenty-four numbers were there all along, twelve of them hidden behind the others. Removed —
  the foundation said the same thing — and measured after: outer radius 100, inner 60.

  **Nothing gave the dial focus.** The face has been focusable since it became a slider, but
  `restoreOverlayTriggerFocus` runs on _close_, so opening the picker left focus on the toggle and the
  first arrow went to the page. The dial takes focus when the picker opens on it, and when a user
  switches to it from the number boxes.

  Focusing on open is not enough on its own, so **the arrows now work from anywhere in the clock** —
  except a text input, because the hour and minute boxes have their own arrow handling and taking their
  keys would make them impossible to correct. The difference matters: reach for Confirm to commit and
  the arrows would otherwise go dead. The handler lives on the clock root, not on the face as well;
  left on both, a keydown on the face would bubble and turn the hand twice.

  **And the mark could land on the wrong hour.** `timepickerSelectedDialValue` still answered the
  12-hour hour while the face offered 0–23, so at 14:00 Lit and plain marked `2`. It takes the format
  now and answers in the units the face shows — the same rule that decides which numbers are on it,
  because the numbers and the mark disagreeing is only a matter of time otherwise. Tested for every
  hour of the day, and for midnight and noon, which is where an off-by-twelve hides.

  The demo test compares the two pickers against each other rather than against remembered numbers,
  and it scopes to the picker it opened: a closed overlay panel is `visibility: hidden`, which still
  has a box, so "the first face with a height" finds the picker nobody opened. That mistake cost two
  measurements before it was noticed.

- 1008e4e: The two questions left open by the role work, answered from evidence.

  **Lit's colour palette stops borrowing the swatch's class.** Two buttons carried
  `mdy-colors__primary-picker` while the contract declares `nativePicker` singular. Reading what the
  themes do with that class settled it: it is written for the control's swatch — `width: 3rem`,
  `align-self: stretch`, a fixed swatch that fills the input wrapper — and the palette's button is a
  text button reading "Custom…". It was not deliberate reuse; it was a text button wearing a swatch's
  geometry. It now carries `mdy-button`, which both themes style and the contract already declares
  shared, so nothing new is published and the conformance fixture no longer has to say which of two
  elements is the part.

  **The multiselect's `aria-required` is recorded as a gap rather than restored.** Neither
  `role="group"` nor `role="button"` supports the attribute, and the widget renders its options as
  toggle chips in a group by a documented choice rather than as a listbox. The important part is that
  removing it lost nothing: an attribute a role does not support is not announced, so the requirement
  never reached assistive technology on this widget — the invalid markup only made it look as though it
  did. Closing it properly needs a visually-hidden "required" in the label, which is shared CSS that
  does not exist yet. The reasoning now sits in the projection so the attribute is not quietly put back.

- 4b2560b: Complete normalized Angular structural parity evidence for overlay, temporal, color and file controls.
- d981a2f: Add explicit per-renderer contract-part and ARIA projection evidence and make Patch 3 readiness fully enforceable.
- 3846236: Replace the stale Patch 3 readiness heuristic with explicit per-renderer behavior evidence, shared overlay checks and the first normalized Angular structural parity fixtures.
- 9c8a238: Emit the canonical class vocabulary from the widget controllers: `mdy-description` becomes
  `mdy-supporting-text`, `mdy-error` becomes `mdy-control__errors`, the control part carries no
  `mdy-input` class of its own, and `aria-modal` is emitted as the string `"true"`. Plain builds its
  field shell from the contract (so a radio group is `mdy-renderer--radio-group`, as in Angular and
  Lit) and no longer stacks a duplicated class on a part.
- 0310e27: `@modyra/widgets` stops holding one adapter's material, and a test now keeps it that way.

  `contract-baseline/` held `angular-ui.json` — a record of the Angular renderer's own surface, whose
  metadata names `packages/angular/src/lib/{control,renderers}` as its source — and an `angular-dom/`
  directory beside it. They sat in the framework-agnostic package's own baseline directory, next to
  what the _catalogue_ declares. Nothing imported them, so nothing complained: the import graph was
  clean the whole time, which is exactly why this kind of inversion survives. They now live in
  `packages/angular/contract-baseline/`, where the surface they describe is.

  `widget-completeness.json` stays: it records this package's own anatomy.

  `independence.spec.mjs` asserts both halves of the rule — no file in this package may be named after
  a package derived from it, and no comment may cite one as the contract's reference. It found twelve
  comments in the tests that an earlier sweep of `src/` had missed, all of the same shape ("modeled on
  Angular's real component", "the answer Angular kept"). A contract that explains itself by naming one
  of its consumers is describing the wrong thing.

  Also fixes a real defect the equivalence work exposed: Plain's multiselect applied the projection's
  `trigger` part wholesale to its search button, so the button carried `mdy-multiselect` — the
  catalogue's class for `inputWrapper` — and one class named two elements. The button now takes the
  part's semantics without its classes.

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
- Updated dependencies [df563d4]
- Updated dependencies [1644bf5]
- Updated dependencies [ec3d8ca]
  - @modyra/core@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [318e721]
- Updated dependencies [1bb844f]
  - @modyra/core@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [c7dadfb]
- Updated dependencies [7554cc8]
- Updated dependencies [fc22197]
  - @modyra/core@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [fd1e9d8]
  - @modyra/core@0.2.0

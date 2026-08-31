# @modyra/core

## 2.5.0

### Minor Changes

- 6efa698: The breaking section, consolidated

  `contract:diff --since v2.4.0` classifies this release **major**: 35 major entries against
  275 minor. **It ships as a minor anyway, deliberately**, and this section is where that debt is
  paid: the number does not warn you, so the text has to.

  For `@modyra/plain`, `@modyra/lit` and `@modyra/angular` there is no debt — they are below 1.0,
  where semver already permits breaking changes in a minor. It is `@modyra/core` and
  `@modyra/widgets`, moving 2.4.0 → 2.5.0, that carry breaking changes under a number which by
  convention promises none. Read this section before upgrading those two; a version range that
  admits 2.5.0 will take it without asking.

  The individual changesets carry the bumps; this one carries the migration, so the release page has
  one place to read instead of 303.

  ## Removed from the public surface

  **`timepickerDialAria`** — exported from `@modyra/widgets` at 2.4.0, gone now. It returned the
  dial's ARIA shape at runtime; that shape is now **declared** in the contract:

      timepickerDialAria("hour", …).role === "slider"    // 2.4.0, computed for the dial face
      MDY_WIDGET_CONTRACTS.timepicker.hourControl.role    // "spinbutton", declared

  These are not the same element renamed. Per ADR 0145 the dial face **lost its interactive role
  altogether** — a `slider` that Tab could not reach, announcing a value the hour box was already
  speaking. The hour and minute boxes kept the `spinbutton` role they always had; what is new is
  that the contract now declares it instead of a helper computing it.

  So there is no replacement call. Read the role from the contract, and expect nothing on the face.

  **`MdySelectA11yProjection.listbox`** — the type survives, the member does not. It is now
  `options`. A consumer that reads `.listbox` off the projection fails to compile; nothing about
  this is visible in a changeset that speaks only of contract parts, which is why it is stated here
  as a member.

  ## Parts renamed, and the two aliases that exist

  `listbox` became `options` on both `select` and `multiselect`. Both keep a resolving alias under
  the old name.

  **The alias covers the name and not the position.** `multiselect.options` also changed parent —
  `root` → `popup` — and `select.option` moved from `listbox` to `options`. Code that resolved the
  part by name keeps working; code that walked to it by position does not, and the alias will not
  tell it so.

  ## Parts removed with no alias possible

  `multiselect.header` and `multiselect.searchButton` have no element behind them any more. An alias
  would resolve to nothing, which is worse than a name that fails loudly — so there is none. This is
  not an alias withheld; it is an alias that cannot be written.

  The search button's relations went with it: `aria-describedby` → errors and supporting text,
  `aria-controls` → popup. `label[for]` now targets `trigger`.

  ## Parts that became required

  `multiselect.trigger`, `multiselect.wayBackAction`, `multiselect.clearAll`,
  `multiselect.announcement`, `select.options`, and `file.clear` (previously optional).

  Left optional, a renderer could omit them, and for `clearAll` and `wayBackAction` that omission
  _is_ the defect the decision removes: a control that appears and vanishes under a hand already
  moving toward it. Presence follows what the widget can do, never what it is currently showing.

  ## Roles and elements changed

      datepicker.calendar    none → dialog
      daterange.calendar     none → dialog
      timepicker.popup       none → dialog
      timepicker.hourControl none → spinbutton
      timepicker.minuteControl none → spinbutton
      multiselect.chips      none → grid          parent inputWrapper → box
      multiselect.chip       none → gridcell      element button → container, parent chips → chipRow
      colors.toggle          element button → presentation

  `multiselect.inputWrapper` no longer carries the `mdy-multiselect` class. It is not kept as an
  alias: two elements under one name is the ambiguity the change removes, and keeping the class
  would reinstate it.

  ## Parents moved

      slider.value           root → track
      multiselect.placeholder inputWrapper → trigger
      file.clear             dropzone → content
      file.fileList          dropzone → content
      file.rejected          dropzone → content

  A stylesheet or query that descends from the old parent no longer reaches these. The part names
  are unchanged, so resolving by name is the migration.

- d0a6f15: The nesting limit holds at the door a document never passes through

  A layout may hold sections inside sections, and `MDY_LAYOUT_MAX_DEPTH` has capped that at six since
  nesting arrived. The cap was applied by the document reader and by nothing else, so a structure
  assembled in code nested as deep as it liked and mounted in silence — and the same form was legal or
  not depending on how it had been written down.

  `assertLayoutWithinDepth` is now exported and applied wherever a layout arrives already built:
  `mountMdyForm` in `@modyra/plain`, and the `layout` input of Angular's dynamic form. It throws,
  naming the depth, the path at which the structure passed the limit, and the reason — there is no
  document to annotate and no partial result worth returning.

  **Migration.** A call passing a layout deeper than six rendered a form before and raises now. Nothing
  else changes: a document is still read the way documents are read, keeping what it can carry and
  reporting what it dropped.

  The limit is about what a person can be asked to answer rather than what a browser can draw — nesting
  costs the machine nothing measurable, which is exactly why the reason had to be written down. ADR 0160
  records it, along with what raising it would take, since the obvious question about any limit is
  whether it can be lifted.

- 4e7ba99: The line under a control can be written, and an empty one takes no room

  **Every field drew a supporting-text slot, named it with `aria-describedby`, and nothing could put
  words in it.** The slot was the promise and the half that keeps it was missing: no field type carried
  the text, and the shell's element was fed from a projection that has an id and classes and no
  content. A screen reader following the reference arrived at an empty element, which is worse than no
  reference at all.

  `MdyDynamicFieldBase.supportingText` is the missing half — a format, a limit, why the field is there.
  Not an error: an error is a verdict on the value and comes and goes with it, and this is a property of
  the field that does not change when the value does.

  **And an empty slot now takes no height, in the renderer that was reserving it.** Three renderers gave
  three answers to what sits under a field, so one stylesheet laid out three different forms:

  ```
                       gap between two controls, before → after
  plain                84 → 56      an empty errors list at 24px, plus 24px of slot margins
  lit                  60 → 56      an empty supporting-text slot
  angular              56 → 56      neither
  ```

  Plain rendered `.mdy-control__errors` at full height with nothing in it, and both it and Lit reserved
  the supporting-text slot. Reserving height for a message before there is one is defensible — it stops
  the form jumping when one appears — but reserving it in one renderer of three is not a choice, it is a
  disagreement. All three answer the same way now, on every stylesheet.

  The element is hidden rather than removed, because `aria-describedby` names its id unconditionally:
  removing it leaves the reference pointing at nothing, which is the defect one step worse than the one
  being fixed.

- 07b3ec8: A picker can be told which view to open in

  `MdyDynamicDateField` gains `viewMode?: "dial" | "input"` — timepicker only, absent opening on the
  dial. The controller has honoured `viewMode` since 2.4.0 and restores it when the picker closes, so
  this names the view the field _has_ rather than the one it started on; what was missing was the route
  from a document or an attribute down to it. Angular, Lit and Plain each gain the matching input, and
  Angular's dynamic form forwards the document's value.

  A view that is not one of the two is reported as `MDY_DYNAMIC_UNOPENABLE_VIEW` and dropped, leaving
  the field opening on the dial.

  `MDY_TIMEPICKER_DEFAULT_FORMAT` is published beside `MDY_TIMEPICKER_INITIAL_VIEW`, and the four
  renderer sites that each spelled `"24h"` out now read it. Two copies of the _view_ default had
  already drifted past ADR 0116 — Lit's resting state and Angular's clock component still opened on the
  twelve-hour clock — which is what a default written four times does and what tests cannot see, since
  a default is only read when nothing else answers.

  `timepickerPlaceholder(format)` is published for the same reason one field over: the hint was written
  out in two renderers and absent in the third, so one document told a person what to type in two
  adapters and nothing in the other. Plain now shows it.

  Migration: none. A document that says nothing behaves exactly as before.

- f962df5: A colour preset can carry the name it is known by

  A hexadecimal is not a name. Read out, `#4361ee` is six characters somebody has to hold in their head
  to compare with the next one — so a panel of ten was, to anyone who could not see it, ten strings that
  differ in the middle.

  `presets` now takes `{ value, label }` as well as a string, and the renderers announce the label.

  **This library ships no names for its own defaults, deliberately.** A generic palette naming `#4361ee`
  would be guessing, and an approximated colour name is worse than the hexadecimal because it claims a
  meaning it does not have while the hexadecimal claims none. The knowledge lives where the palette
  does: a team's colours have names, and this is where they say them. An entry with no label is still
  announced by its value — poor, and honest.

  **Migration.** `MdyDynamicColorsField["presets"]` widens to `ReadonlyArray<string | MdyColorPreset>`.
  A document that writes strings is unaffected; code that _reads_ a parsed document and assumed
  `string[]` now has two shapes to answer, and `colorPresetsOf` normalises either into value and name.

- ca7a0fa: `MdyDynamicFormConfig` is the family, not version one

  The type described version 1 alone — `{ version: 1; fields }` — so a consumer typing their document
  against the name the package advertises was _required_ by the compiler to write the one version the
  parser had just stopped accepting. The migration ADR 0136 carries — set `"version": 2` — was not one
  the published type allowed.

  It is now the versions this contract has. `MdyDynamicFormConfigV2`, `V3` and `V4` remain for a
  consumer who wants to say which one they wrote, and `MdyDynamicFormDocument` is unchanged in meaning.

  Verified in both directions against the built package: a document declaring `version: 2` compiles, and
  one declaring `version: 1` is refused by the compiler as it is by the parser.

- 59e7af2: A verdict is said to somebody who has been at the field

  Two renderers disagreed about when a refusal reaches a person, and each was half right. plain showed
  every error the moment the form was mounted: a required field nobody had reached was painted red and
  told them so, which is being told off for arriving. lit showed none until the field was touched: a
  value arriving from a draft or a server that the field cannot hold left the control marked wrong with
  the reason withheld — over something the person never typed and cannot correct without being told.

  **Neither could do better, because nothing distinguished the two kinds of refusal.** A rule the person
  has not answered yet and a value already in the field are both "invalid" and are not the same news.

  - **`MdyFieldError.origin` gains `"shape"`**, and `valueShape` marks its refusals with it. A validator
    can now declare the origin of what it refuses; where it declares none, the origin is `"validation"`
    as before. **If you switch exhaustively on `origin` with no default, add the case.**
  - **`errorsVisible` answers the question it was always asked**: shown once the field is touched, or
    immediately for a refusal about what is already there — `shape`, `server`, `entry`. A person can
    neither cause those by inaction nor see the reason unless it is said.
  - **`visibleErrorsOf` is exported**, because nine plain call sites were each deciding it separately.
  - **`aria-invalid` follows what is shown, not what is wrong.** A control marked wrong beside a message
    nobody rendered is a verdict with no explanation. Every field projection reads the same rule.

  Also in lit, found by the specs this unblocked: a multiselect never marked itself touched on blur, a
  checkbox's label carried no error class, and a native select pointed `aria-describedby` at nothing —
  so its refusal was announced with no way to read it.

- e65f631: The order of what was chosen can be changed, and by a keyboard first

  A multiselect's value has kept arrival order all along, and nothing could change it: reordering meant
  removing and re-adding, which can put a value last and nowhere else — and only from the option list,
  rather than from the chip in front of the person.

  `move-selected` is the one intent that moves a chosen value, so the keyboard and a drag are two doors
  onto the same thing rather than two mechanisms that can disagree about what an order is. It moves the
  _distinct_ values in the order the strip draws them, and a value taken three times moves as one thing,
  because the chip a person is dragging is the quantity. `to` is clamped rather than refused: a control
  asking for one past either end means "as far as it goes", which is what holding an arrow down does.

  `MDY_WIDGET_KEYBOARD` gains `Alt+ArrowLeft` and `Alt+ArrowRight` at `intent: "reorder"`, declared for
  any kind whose anatomy holds a `chips` part. `Alt` because the bare arrows already belong to wherever
  focus is — a strip is scrolled with them, a list is walked with them — and a key that means two things
  depending on where you are is a key nobody trusts.

  A binding carries `by: -1 | 1` rather than leaving a renderer to read the key, because _earlier_ is not
  _left_: the strip runs in the writing direction, so in a right-to-left document `ArrowLeft` moves a
  chip later. A renderer reading the key would have to know that; reading the direction, it does not.

  `MdyDynamicOptionsField.reorderable` decides whether any of it is offered, and it is **off by
  default** — most lists have an order nobody chose, and a set of filters has nothing to rearrange.

  Angular's dynamic form now forwards `searchable` and `reorderable`: it forwarded neither, so both were
  capabilities a document could declare and that renderer alone could not reach.

- fc493c5: The layout nesting limit rises to 32, because it was on the wrong axis

  `MDY_LAYOUT_MAX_DEPTH` was six, on the argument that nobody answers a question whose applicability
  depends on six earlier answers. ADR 0160 stated that plainly so it could be contradicted, and it has
  been: the argument is about **conditionality** and the constant limits **arrangement**.

  Six nested sections are "Address → Billing → Registered office". Measured, the field at the bottom of
  them is active, visible and conditional on nothing — there is no memory cost because there is no
  earlier answer to hold. Meanwhile a chain of eleven rules, each gating on the answer before it,
  mounts with no refusal at all: the axis the argument defends was never limited.

  The cap stays, at 32, as what it was really doing — a bound against a structure arriving from outside
  that would otherwise drive unbounded recursion through a parse. It remains a constant for the reason
  it always was one: a limit an attacker's input can raise is not a limit.

  **Migration.** A structure between seven and thirty-two levels now mounts where it was refused.
  Nothing that was accepted becomes refused. A consumer reading the constant rather than writing `6`
  follows this without editing anything.

  ADR 0161 supersedes 0160, which is kept: its reasoning is what makes the new record legible, and the
  argument it makes would justify a limit on rule chains, where there is none today.

- 052db3e: Two judges of one address

  An `email` field is judged twice: by `<input type="email">`, which the kind renders, and by the form.
  The two disagreed in both directions.

  - `a@b` — the browser accepts it, the library refused it, so a person was told a valid address is
    wrong.
  - `ünicode@example.com` — the browser refuses it, the library had no objection, so inside a native
    `<form>` the submission was blocked with nothing on the page to explain why.

  **The `email` validator is the platform's rule now**, written out from the HTML standard: deliberately
  permissive where the browser is permissive, deliberately ASCII because the browser refuses anything
  else. A stricter rule is a rule the control does not enforce, and every difference between them is a
  form that says one thing and submits another.

  **And the kind carries it.** `kind: "email"` attaches the same rule through `kindValidators`, so a
  document that declares the kind and no validators is no longer a field the browser judges alone. A
  document that also writes `validators: { email: true }` adds the same rule and the same sentence,
  which the engine already says once.

  **If you relied on the old rule** — a required dot, non-ASCII accepted — that behaviour is gone; the
  control never agreed with it.

- ad85b8b: Version 1 of a dynamic form document is no longer accepted

  Three runtimes read this contract and only TypeScript accepted `version: 1` — the Rust and Java
  readers have 2, 3 and 4. A version two of the three refuse is not a version the contract has; it is
  one parser being lenient, and a document that builds in one place and does not exist in the other two
  is what a cross-runtime contract exists to prevent. ADR 0136 records the decision.

  Migration, and it is one line: a document declaring `"version": 1` declares `"version": 2`. Nothing
  else about it changes — version 1 differs from 2 in the envelope's number and not in the fields.

  The refusal says which version it refused, which versions this contract has, and what to write
  instead. A bare field array is unaffected: it declares no version, it is the shape most callers pass,
  and it is still read.

### Patch Changes

- ff00fb6: A control whose form has ended is out of play

  A framework destroys a model and removes its nodes at two different moments. In the window between
  them the controls are live: they take text, the browser paints it, and the write is refused — the
  form keeps the value it ended with and will never submit the other one. Nothing on the page said so.

  `destroy()` now takes every field out of play, and a handle handed out before the end answers
  `interactivity: "disabled"` instead of falling back to `"enabled"` when its record is gone. Renderers
  already read that verdict, so the controls grey out wherever they are drawn.

  Migration: a consumer reading `disabled()` or `interactivity()` from a handle after `destroy()` gets
  `true` / `"disabled"` where it used to get `false` / `"enabled"`. Values, `getValue()` and
  `submitValue()` are unchanged — they still answer with what the form held when it ended.

- 3a15797: A guard claims only what the door takes

  `isPathRef` answered on the `path` member alone, so it was the one operand guard that said nothing
  about what else the object carried. `{ path: "a", self: true }` was handed to a consumer as a path
  reference while `validateExpression` turned the same operand away — a guard published for telling the
  shapes apart claiming one the contract will not accept.

  It asks `namesOneThing` now, as `isSelfRef`, `isRootRef` and `isContextRef` already did. One operand
  names one thing (ADR 0092), at every door that reads it.

- d8b3b54: A rule already anchored at both ends is written into `pattern` unchanged.

  `<input pattern>` is implicitly anchored, so a rule that is not anchored is padded — `a+` becomes
  `.*(?:a+).*` — and the group is what keeps an alternation from binding across the padding. A rule
  that already carries `^` and `$` needs neither: it was still wrapped, and `^[A-Z]+$` reached the DOM
  as `(?:^[A-Z]+$)`.

  Nothing a browser does changes. What changes is what a person reads — in the DOM, in a screenshot, in
  a report of what the control asks for — and `constraints().pattern` now returns the rule as it was
  declared. Padding and its group are unchanged wherever a rule is not anchored at both ends.

- 0883045: An argument refused where it arrives

  `field(initial, validators, options)` stored whatever was put in the second position. The third
  argument is the one a reader reaches for — `sensitive`, `when`, `sanitize` all live there — so the
  ordinary mistake is passing it second, and the constructor said nothing: the failure arrived from
  inside `createForm` as `node.validators.some is not a function`, naming a member of a node the author
  never wrote, about a call two doors back.

  It is refused at the door now, in the words of the call that made the mistake: what was passed — an
  object, one function, `null`, a string — and where it belongs. ADR 0057 decided this for the
  list-taking setters; the rule had reached the setters and not the constructor.

## 2.4.0

### Minor Changes

- 5262ad2: A timepicker in a document can name its clock

  `MdyDynamicDateField` gains `format?: MdyTimeFormat` — `"12h"` or `"24h"`, `timepicker` only, absent
  meaning the 24-hour clock ADR 0116 made every renderer's default. Until now the format was reachable
  only as a renderer parameter, so a document-driven form had one clock available and no way to ask for
  the other; the stored value is `HH:mm` either way, and this decides what is drawn and how typing is
  read.

  Plain's field dispatcher and Angular's dynamic form both forward it. A `format` on a kind that draws
  no clock, or a value that is neither of the two, is reported as
  `MDY_DYNAMIC_UNHONOURABLE_FORMAT` and dropped, leaving the field drawing the default.

  Migration: none. A document that says nothing behaves exactly as before.

  Two fixes travel with it. The hour segment's announced range is now taken from `timeFieldBounds`,
  the same source its native `min`/`max` come from — a 24-hour face had been declaring `max="23"` to
  the browser and `aria-valuemax="12"` to a screen reader. And a two-digit segment box no longer keeps
  a third character: text wider than the field it holds is refused, while a two-digit value outside the
  clock's range is still kept and marked, which is what ADR 0063 asks for.

- 2dfa37b: A draft left unread says so, under `MDY_DRAFT_NOT_RESTORED`

  A stored draft whose recorded form shape is not this form's is left where it is rather than restored
  — that is ADR 0107, and it is right: the form that wrote it can still read it. What was missing is
  that nothing said so. A consumer could not tell a key holding **nothing** from a key holding work
  this form declined to read, and the two need different answers: the first is a fresh start, the
  second is somebody's typing still on disk that nothing will offer them again.

  The shape moves for ordinary reasons — a field added, a collection row arriving from a server — so
  this is not a tampering path. The neighbouring case already reports per field: a draft entry the form
  cannot hold arrives on `onViolation` as `draft-shape` with the path, and the rest is restored. A whole
  draft going unread was the quieter half of the same story.

  `MDY_DRAFT_NOT_RESTORED` is published beside `MDY_DRAFT_KEY_IN_USE`, and reaches a `diagnostics` sink
  by code and the console by sentence, as the other draft diagnostics do. The message names `version` in
  the draft options, which is the deliberate spelling of "this shape change was intended".

- 841f0f9: A granularity a document can actually ask for

  The contract, the controller and the dial all honoured a declared granularity and nothing could
  declare one. A capability no consumer can reach is a capability nobody has.

  - **A document**: `granularity` on a `timepicker` field, in the v2, v3 and v4 JSON schemas. The
    parser refuses one it cannot honour, names the member at fault, and keeps the field — taking the
    form away over a refinement removes something the user can see, over a rule they cannot. The
    refusal reaches a diagnostics sink as `MDY_DYNAMIC_UNHONOURABLE_GRANULARITY`.
  - **Angular**: `[granularity]` on `<mdy-control-timepicker>`, carried down to the segments so the
    hour and minute boxes announce their own `step`, `min` and `max` — the platform's own spinner then
    offers what the field offers.
  - **Lit**: a `granularity` property.
  - **Plain**: read from the field descriptor, so a mounted document carries it.

  The validation moved from `@modyra/widgets` to `@modyra/core`, because a document is parsed before
  anything renders it and two copies of "does this step divide its unit" is the shape a contract exists
  to prevent. `@modyra/widgets` re-exports the same names, so nothing importing them moves.

  Also fixed while it was found: the parser **deleted** an unhonourable granularity from the document
  it was given. The document belongs to the caller, and a parser that edits it leaves a second read of
  the same object answering differently from the first — the rule the file already stated about
  duplicate options, broken one function away from where it was written.

- 53ecc1a: A hand you can see thinking

  A dial that offers only some times has to snap, and snapping alone hides what it is doing: the hand
  jumps to a number the finger is not on, and whether that was the rule or a missed press is not
  something the screen says.

  So there are two hands. **The real one points at the value, including while a finger is moving** — it
  used to follow the pointer, which on a face offering every time is the same thing and on one that
  snaps is not: the hand sat between two numbers and jumped on release, so the one thing saying what is
  chosen spent the whole gesture saying something else. **A faint one follows the pointer** whenever the
  two are apart, carrying both its angle and its ring, because it answers "what happens if I release
  now" while the real hand answers "what is chosen".

  A picker that offers every time never draws one: its numbers are 6° apart, so the finger is never off
  them. `timepickerDialGhost` decides; no renderer does.

  `animateHand` — on the field in a document, an input on Angular, a property on Lit — makes the hand
  move rather than jump. **Off by default**, because a hand in motion is briefly not where the value is,
  and on a face that snaps the two would disagree for the length of the transition. The duration is
  `--mdy-sys-motion-duration-fast`, the system's own, and `prefers-reduced-motion` turns it off.

  `MDY_TIMEPICKER_RING_BAND` is published: how far either side of the inner ring's radius still counts
  as reaching for it, as a fraction of the gap between the two painted radii. A fraction rather than an
  expression so that tightening it is one guarded number rather than an edit to the rule.

- 6d90b06: A dial that shows which of its stretches carry nothing

  A face declared with `minuteStep: 15` draws four numbers and the other 356° of the ring look exactly
  like them — continuous, uniform, and offering nothing. The granularity is real and invisible, and the
  only way to find it is to try.

  `showUnavailable` — on the field in a document, an input on Angular, a property on Lit — dims the
  stretches the granularity took away. **Off by default**, so a face that declares nothing is unchanged.
  Named for what it shows rather than for how it looks, because a theme may express it as an arc, an
  opacity, or something else.

  `MDY_WIDGET_CONTRACT_VERSION` moves to **5**: a timepicker's dial gains `dialUnavailable` and
  `dialUnavailableArc`, which sit between the face and the hand — so a renderer built against 4 draws
  them nowhere. The plain and lit contract audits were re-read against the change rather than having
  their pins widened, and neither asks about parts, so both pass unchanged.

  Each ring answers for its own radius: the inner one is drawn on a smaller circle, so a same-sized
  digit covers more of it and its dead stretches are wider. A single set of arcs drawn for both would
  be wrong on one of them.

  The Angular demo gains three cases — a quarter-hour face with its dead slices shown, a three-hour
  face where both rings have their own, and one with the hand animated. Those are the cases no
  automated tier can ask about: no host renders Angular in a browser, and a drag under real pointer
  capture is not something jsdom produces.

### Patch Changes

- a0ab5de: A patch through a list inside a list keeps the cells it did not name

  `patch()` names cells, and a list nested inside an **array** row was the one place that stopped being
  true: every cell the body left out came back as its declared initial, replacing what the person had
  entered. One body naming only `v`, the same inner list under four containers:

      outer = array    [{"v":"NEW","w":"z"},  {"v":"V2","w":"z"}]     ← w lost
      outer = record   [{"v":"NEW","w":"W1"}, {"v":"V2","w":"W2"}]
      outer = group    [{"v":"NEW","w":"W1"}, {"v":"V2","w":"W2"}]
      no outer         [{"v":"NEW","w":"W1"}, {"v":"V2","w":"W2"}]

  The cause is the order things happen in. Writing an array row goes through `setAll`, which rebuilds
  the subtree — so by the time the inner collection's own manager is asked to merge, it has no rows
  left to merge against and every unnamed cell is a new row's initial. The value handed to `setAll` has
  to be complete already, so the row merge now walks into nested collections instead of replacing them:
  a list merges its rows by index, a record by key, and a row past the end is new and taken as it came.

  `W1` and `W2` were the person's data and `"z"` was a value the form had never held.

## 2.3.0

### Minor Changes

- 20c69d0: A 24-hour picker can be set to every hour its own face shows

  Reported from use: _there is no way to set a time before 13:00, as if pinned to PM._ It was symmetric
  — a picker seeded at `09:00` could not reach the afternoon either — because the working copy is
  canonically 12-hour, `period` is the only route to the other half of the day, and a 24-hour picker
  correctly has no period control. `set-hour` refused everything outside 1–12, and refused it by
  returning nothing, which is why it survived the life of the feature.

  Every other surface already spoke 0–23: the face draws `00` and 13–23, `timeFieldBounds` answers
  `{min: 0, max: 23}`, `acceptTimeField` accepts `"13"`, the End key asks for 23. Only the seam that
  writes took 1–12, so the typed segment was as stuck as the dial.

  - `set-hour` takes the hour in the picker's own format — 1–12 for `12h`, **0–23 for `24h`** — and the
    controller derives the half of the day. Midnight is `0`, noon is `12`.
  - `set-from-angle` gains `ring?: "outer" | "inner"`, optional, because the same direction is 3 on the
    outer ring and 15 on the inner one. `dialHour(angle, ring)` in `@modyra/core/datetime` is the
    arithmetic; `timepickerDialRing(face, x, y, format)` in `@modyra/widgets` is the hit test.
  - An hour or minute the clock does not have is refused with an `announce` rather than in silence.
  - `viewMode` defaults to `"input"` and is a controller option; opening returns to what the host
    configured instead of a hard-coded view. The dial is one toggle away.

  `set-hour 3` on a 24-hour picker now means three in the morning rather than "the third hour of
  whichever half the draft was in". A 12-hour picker is unchanged. Anatomy does not move, so
  `MDY_WIDGET_CONTRACT_VERSION` does not either. See ADR 0115.

## 2.2.0

### Minor Changes

- 27224d8: A bound written beside a field is enforced, not only drawn

  A number's limits can be written twice, and both render `min`/`max` on the control — so a browser
  refuses what a person types either way. Only one of them was a rule:

  ```jsonc
  { "kind": "slider", "max": 50 }                    // drew the range, enforced nothing
  { "kind": "slider", "validators": { "max": 50 } }  // enforced
  ```

  A prefilled `150` against `max: 50` left the form holding 150 while the page showed the thumb at its
  maximum, `aria-invalid="false"`, no message — a person sees a slider at 50 and sends three times
  that. A tampered draft carrying a value outside the bound restored into a form that called itself
  valid and submittable, which is the threat model the security guide names in those words.

  `min` and `max` beside a `number` or a `slider` now compile to the same validators the explicit
  spelling does. An explicit `validators` entry still wins where both are written. The rule is
  generated from the field's declared bound and never from the control's drawn range, because the range
  is already derived from the rules — deriving the rule back from it would close a loop.

  A document that declared a bound beside a field and relied on it being only a hint now has a form
  that reports values outside it. `step` is unchanged: the validator vocabulary has no `step`, so it
  still speaks only to the keyboard. Recorded as
  [ADR 0066](../docs/architecture/0066-a-bound-beside-the-field-is-a-rule.md).

- 3fa4c1a: Declaring rows into a collection no longer costs more per row the more rows there are

  Two questions scoped to a path were answered by a scan of the whole form: the gates covering a path
  were found by walking every registered gate, and an array's reconciliation read every field name the
  form holds to keep the ones under itself. A collection registers a gate and runs that effect, so a
  form holding a collection per row paid both once per row — the cost of a bulk write grew with the
  square of the row count. Measured on orders holding ten lines each, per order: 1.12 ms at 25 orders,
  1.63 at 100, 3.56 at 200.

  Gates are now looked up at the path's own ancestors, and `MdyFormEngine` keeps the child segments
  under each prefix and answers `childSegmentsUnder(prefix)` from them. Per order after: 0.55, 0.41,
  0.58 — flat.

  `MdyCollectionHost.childSegmentsUnder` is optional, so a host implemented against the published
  interface keeps working and is asked `fieldNames()` as before. `MdyFormEngine` gains the method,
  which is additive. See ADR 0101.

- d2cdcaa: A collection nests without a limit

  An array may now hold another array, and a form may nest as deep as it needs — in a typed schema and
  in a parsed document alike. The one-positional-level rule and the eight-level cap are gone, together
  with the node-count cap on documents; the document validator's schema walk is an explicit stack, so a
  deep document is answered on its own merits rather than overflowing while being read. See ADR 0043.

  **Breaking, for consumers that read a descriptor's `item`.** These properties widen:

  | Type                     | `item` was                    | `item` is             |
  | ------------------------ | ----------------------------- | --------------------- |
  | `MdyAnyArrayDescriptor`  | field or group                | `MdyAnyRowDescriptor` |
  | `MdyAnyRecordDescriptor` | field or group                | `MdyAnyRowDescriptor` |
  | `MdyDynamicArrayNode`    | field, group or record        | `MdyDynamicNode`      |
  | `MdyDynamicRecordNode`   | field, group, record or array | `MdyDynamicNode`      |

  A `switch` over `item.kind` that handled `"field"` and `"group"` exhaustively now has cases it does
  not: a row may be a collection of either kind. Building descriptors through `array()`, `record()`,
  `group()` and `field()` is unaffected — those calls accept everything they accepted before.

  Also fixed, and the reason the campaigns went red on this shape: replacing a nested collection in
  place left the fields of the subtree it replaced behind, so a reorder above a nested list duplicated
  that list into the row that moved and the row that arrived.

- 039059c: A commit word answers for the control a person types in

  `MDY_VALUE_CONTRACTS`' `commit` column had two words and had never been compared against a widget. Two
  kinds disagreed with it.

  **A daterange is neither.** One endpoint writes nothing — a start with no end is not a range — and the
  second writes both. Not `live`, because the first click does not write; not `confirm`, because there
  is nothing to confirm. `MdyValueCommit` gains **`complete`**: the field changes when what the user is
  building becomes a value at all, which is the sentence `completeRange()` already makes from the other
  side.

  **A colours field has two controls that commit differently.** The native swatch writes on every choice;
  the hex box holds `#11` and writes on blur or Enter, because `#11` is not a colour. One word per kind
  cannot say both, so the word answers for the control the label names and a keyboard types into — the
  one a person can leave half-finished. `colors` is therefore **`confirm`**, with no change in behaviour:
  what changes is that the published answer is now true for the control it describes.

  Adding a member to a published union breaks an exhaustive `switch`, and anything branching on
  `colors.commit === "live"` takes the other branch now.

- 3f0787e: An expression can name its own value, the form it is in, and a fact the host supplies

  Three operand forms join `{path}` — `{ self: true }`, `{ root: true }` and `{ context: "key" }` —
  which is the whole of what the language gains under ADR 0092. A clause written once for the item of
  a collection can read _its_ value, because the row has no name until somebody creates it; a
  row-level condition can reach back out to the form; and a host can supply role, tenant or today's
  date once for the application rather than per form.

  `evaluateExpression(expr, value, scope?)` takes the scope; without one none of the three is
  available, and an expression naming one answers **false** — the direction that keeps a field out of
  play rather than showing it. `expressionContextKeys(expr)` lists the keys a document reads, so a
  host can be asked for them before a form is built, and `expressionPaths` is unchanged: none of the
  three is a field path.

  Also: `equals` and `notEquals` are SameValueZero in both halves of the vocabulary. The tree's
  `equals` was `Object.is`, the flat rule's was `===`, and both spellings of `in` were SameValueZero —
  so `NaN` (what a number field holds when it is given text it cannot read) and `-0` got three
  different verdicts across four doors, and a `rules` entry deciding whether a field is in play
  decided opposite ways depending on which slot an author wrote it in.

- a9dcdb4: A document's pattern cannot make the form stop answering

  `validators.pattern` is a string that arrives from a CMS, a saved project or a POST. The engine
  checked that it parses and never what it costs:

  ```
  (a+)+$   against thirty characters and a miss   ->  12.6 seconds
  ```

  Each further character roughly quadruples the work, and `^(a|a)*$` and `^(a*)*$` behave the same. A
  match is synchronous, so it is not one slow field — it is the thread, between two keystrokes.

  A pattern whose shape backtracks exponentially is now refused the way one that will not parse
  already was: **nested unbounded repetition** (`(a+)+`, `(a*)*`) and **repeated alternatives that can
  match the same text** (`(a|a)*`, `(a|ab)+`). The parser reports the new diagnostic
  `MDY_DYNAMIC_PATTERN_TOO_COSTLY` and **keeps the field** — one rule the engine will not run is not a
  reason to take an input away from the person filling the form.

  The check reads structure, not speed, because JavaScript cannot bound a match's cost from outside it.
  It is deliberately conservative: bounded repetition is left alone, and alternatives it cannot read
  cheaply are allowed rather than refused on suspicion. Twelve ordinary patterns — email, IBAN, phone,
  URL, zip, word alternation — are pinned as unaffected.

  Typed schemas are untouched: `pattern(new RegExp(...))` in your own module is your code.

  Found by `battle-tests/adversarial/security/document-patterns.battle.test.mjs`. Recorded as
  [ADR 0050](https://github.com/modyra/modyra/blob/main/docs/architecture/0050-a-document-cannot-make-the-form-stop-answering.md).

- d95d4c4: A document may nest a collection, in every SDK

  `MdyDynamicRecordNode.item` now accepts a record or an array, and `MdyDynamicArrayNode.item`
  accepts a record: the document contract expresses what the runtime already runs. One rule is
  enforced everywhere — a path crosses **one** positional level, so an array below another array is
  refused where it is written, as `MDY_DYNAMIC_INVALID_ARRAY` or `MDY_DYNAMIC_INVALID_RECORD`
  depending on which collection found it.

  **Migration.** Both `item` types are unions with two more members, so an exhaustive `switch` over
  `node.item.node` stops compiling until it answers for `"record"` and `"array"`. A reader that only
  descends recursively needs no change. Documents already valid stay valid; nothing that parsed
  before is refused now.

  The JSON Schemas (`spec/dynamic-form-v2.schema.json`, `v3`), the Rust SDK (a `DynamicNode::Record`
  variant) and the Java SDK (`"record"` among the schema node kinds, with its rows named by key in
  the flat view) accept the same documents and refuse the same shape with the same codes.

- d470286: A document can say when — Contract v4

  A document could condition a field only through `rules`, which are form-level and name a leaf. A
  condition on a cell inside a collection row — the arrangement where the row is a template and its key
  does not exist yet — was not expressible at all, and was registered as a limit rather than a defect.

  Contract v4 gives a node its own `when` (a field and a group) and a field its `asyncWhen`, written as
  the expression language batch 1 completed. A clause is read against **what encloses it**: inside a
  row that is the row, so one clause written once for a template answers per row, and `{ root: true }`
  is how it reaches back out to the form. `requiresContext` declares the facts the document expects
  from the host; `buildDynamicFormSchema(schema, { context })` supplies them and **refuses to build**
  when a key the document reads is missing, because a condition that cannot be read decides `false` and
  the fields it guards would never appear.

  No public slot changed type: the compiler turns a document's expression into the closure
  `MdyFieldOptions.when` already takes. A v3 document is a v4 document with the version raised, and
  `rules` is untouched. The parser refuses a clause that is not an expression
  (`MDY_DYNAMIC_INVALID_CONDITION`), a path nothing enclosing the clause declares, and a context key
  the document did not declare (`MDY_DYNAMIC_UNDECLARED_CONTEXT`). Published as
  `spec/dynamic-form-v4.schema.json`. ADR 0092.

- 6d31da6: A form is stopped from replacing another form's draft even when its own shape contains the other's.
  The guard asked "is every stored path one I declare", which answers yes for a superset — so a second
  form with one field more read the first's work as its own and overwrote it, silently. A draft now
  carries the shape of the form that wrote it (`MdyFormEngine.shapeKey()`, the paths it was built with,
  hashed), and a form that does not have that shape keeps no draft under the key and says so. A draft
  written before this carries no shape and falls back to the path comparison, so nothing stored
  already becomes unreadable.
- 6bc3df5: A draft entry no field of that kind could hold is dropped and reported

  The draft shape check is named among the always-on structural protections, with one exemption:
  _fields without a declared initial restore as-is_. What actually disabled it was an initial of
  `null` — and `null` is not the absence of a declaration, it is what the value contract declares for
  every kind with no empty of its own. So seven kinds of seventeen skipped the check: a script on the
  origin could write `{"x":{…}}` into the stored draft and a `number`, a `select` or a `datepicker`
  restored it whole, which is the type confusion the check exists to stop. `daterange` skipped it for
  the mirror reason — its own empty is an object, so any object matched.

  A field now declares the shape its kind takes, and a kind that chooses from a list declares the
  values it offers — an option's shape is "anything non-nullish" by design, so only the list can tell
  a legitimate option carrying an object from a hostile one. Both travel on the descriptor and reach a
  collection's rows, which is where a draft is most likely to name something nobody declared.

  **Breaking.** `MdyFieldDescriptor` and `MdyAnyFieldDescriptor` gain required `shape` and `options`
  members: code building a descriptor as an object literal rather than through `field()` needs them.

- 404109c: A draft is not a linked signal

  Asked whether the reactive contract should grow a linked signal — a writable
  signal that resets when its source changes — the four places that looked like it
  turned out to be three things.

  Two were caches and stale, and a plain `computed` removed them. Two are drafts,
  and a linked signal would make them **wrong**: a draft is what protects a choice
  in progress from what arrives elsewhere, so resetting it when the value changes is
  the yank it exists to prevent — a calendar jumping to a range that came from the
  server while the user is choosing one. They re-seed on _open_, which is an event,
  not a dependency.

  So `linked` does not enter `MdyReactivity`, and `capabilities.writableComputed`
  leaves it: a capability every one of the eight adapters answered `false` and no
  consumer ever asked about. Adapters that spelled it delete the line.

  Recorded as ADR 0034, including the check the decision does not have: nothing
  asserts that an external write during an open popup leaves a draft alone.

- 5f8a35c: A draft is not replaced by one belonging to another form

  Two live forms sharing a draft key meant the last save took the whole envelope: one person's typing
  was gone from the only place it was kept, in silence, and reopening their form restored nothing
  because the draft under their key described fields they did not have.

  A form now refuses to replace a stored draft holding paths it does not declare, reports
  `MDY_DRAFT_KEY_IN_USE` once, and leaves the other form's work where it is. Restoring is unchanged,
  and a form reopening its own draft — or a second tab of the same form — still replaces it. ADR 0088.

- 8dde798: A draft is a convenience: it can fail, expire and be discarded without taking the form with it

  Four defects on one path, found together and repaired together.

  **A storage that refuses to be read took `createForm` with it.** Safari in private browsing throws on
  access, an enterprise policy throws, a blocked third-party context throws — and a draft is optional, so
  failing to read one now means there is no draft, never that there is no form. The write side was
  already swallowed for this reason; `clearDraft()` follows the same rule, and what it promises about
  the _form_ holds whether or not the entry could be deleted.

  **`ttlMs` believed whatever `savedAt` said.** A stamp that is missing, is not a number, or sits further
  ahead than a clock can explain is not an age — and an expiry a draft can opt out of by lying is not an
  expiry. A stamp within five minutes of the future is a clock; beyond that it is a claim, and it is no
  longer carried forward on later writes either, which is what made an impossible age permanent.

  **`clearDraft()` did half of what it documents.** It removed the entry and left `getChanges()`
  reporting every edited field, so a `PATCH` built from it sent exactly what the caller had decided to
  discard. It re-baselines now, through `rebaselineToCurrentValue()` — published, because a consumer who
  saves by another route wants the same thing.

  **A restored draft was an undoable step.** A form opened on a draft offered, as the first thing to
  undo, something the user had not done — and taking the offer wrote the empty form back over the draft,
  because the draft follows the model. History now starts from the restored state. The restored edits
  are still changes against the values the form was built with, so `getChanges()` is unaffected.

- 95bb48b: A field that says it is a secret is treated as one

  `sensitive` was declared by the Dynamic Form Contract, type-checked by the parser and offered by the
  editor, and nothing that protects a value read it: a field marked sensitive was written to draft
  storage in clear text and printed in full by the devtools panel.

  It is now a property of the field — `field(initial, validators, { sensitive: true })`, or the
  document's flag carried onto the descriptor — and the form excludes those paths from drafts, the
  panel masks them, and `form.sensitivePaths()` publishes the list for anything else that copies values
  out. ADR 0089.

  **Breaking.** `MdyFieldDescriptor` and `MdyAnyFieldDescriptor` gain a required `sensitive` member:
  descriptors built as object literals rather than through `field()` need it. A field already marked
  sensitive in a document stops being autosaved, which is the repair.

- f00ead6: A file the field turned away is something the page says

  `fileSelectionTransition` reports what a pick refused. Nothing showed it: a field declaring
  `accept="image/*"` given a `.txt` left the page unchanged in `@modyra/plain` — same text, no message,
  no live region — and `@modyra/angular` emitted `filesRejected` for a host to catch and said nothing
  itself. `@modyra/lit` was not applying the policy at all: it wrote the raw pick, so a refused file
  appeared in the list as though it had been taken, and `accept`, `maxFileSize` and `maxFiles` meant
  nothing there.

  **`MDY_WIDGET_CONTRACTS.file` gains an optional `rejected` part**, `role="status"`, beside the file
  list rather than inside it — the list is the value, and a refused file is what did not become part of
  it. **`MdyI18nMessages` gains `fileRejected(names)`**, which takes the list and returns the sentence,
  in all five published tables: the join is a locale's decision, not a renderer's.

  **`MdyFormAdapter` gains `reportEntry(name, problem)`.** The previous release put `reportEntry` on the
  field handle; a handle is built over an adapter, and Angular's could not implement the handle contract
  without this. Both additions are required members — an implementer of either interface adds one.
  Spreading over `MDY_I18N_MESSAGES_DEFAULT` is unaffected.

  `@modyra/lit` and `@modyra/angular` now write what the transition answers rather than rebuilding a
  shape beside it, so a single-file field holds a list in every renderer. A page relying on lit ignoring
  `accept` will find that it no longer does.

- 1783afc: `MdyDynamicCollection` now carries `item`, one row's shape flattened with names relative to the row,
  and `buildFlatFormSchema` builds rows from it where the flat fields say nothing. A collection a
  document declares with no rows contributed no fields, so a form rebuilt from the flat pair had no
  template: it accepted `upsert` or `push` and held an empty object, reporting the row as present in
  `keys()` and absent in `getValue()`. Pairs stored before this keep building — `item` is optional, and
  a collection whose rows exist is still described by its rows. See ADR 0095.
- 3ff02a3: A form reports what it could not do

  A form degrades rather than failing: an async check a reactivity cannot run is skipped, a draft
  without effects is not started. Measured side by side, a form whose uniqueness check never ran and one
  whose check passed are identical on `valid`, `canSubmit`, `pending`, `errors` and `submitValue()`.

  The vocabulary for saying so was already published — `MdyDiagnostics`, `createConsoleDiagnostics`,
  `createSilentDiagnostics`, and the codes — and nothing took a sink: the only option accepting one
  belonged to an adapter's reactivity. **`createForm` now takes `diagnostics`.** The sink replaces the
  console rather than doubling it, and a degradation is reported whether or not this is a development
  build: a check that is not running is not a development-time nicety.

  **`setInitialValue` accepts an ancestor path**, moving every leaf beneath it to its current value. A
  collection's keys are data — a row a user added has a path nobody could have written down — so an API
  that names only leaves could never move the baseline of what a user built. Same question as `exclude`
  in the draft options, same answer.

  **`rebaselineToCurrentValue()` is on the form.** It was published on the engine and announced in a
  release note, and the engine behind a form is not the consumer's to reach.

- d89c221: A handle belongs to its form, not to the computation that asked for it

  On `@modyra/solid` a nested collection's cell read `null` for the life of the form while the value
  was correct, and a handle taken from a positional collection kept reporting the row it held before a
  `move`:

  ```js
  form.f.orders.upsert("o1", { customer: "Ada" });
  form.f.orders.row("o1").lines.push({ sku: "S-1", qty: 3 });
  form.f.orders.row("o1").lines.at(0).sku.value(); // null — getValue() has "S-1"
  ```

  A handle is made of computations and outlives the read that asked for it: a row handle is built
  inside its collection's `rows` computation, a cell handle inside whatever the consumer was computing
  when it called `cell()`. Solid owns a computation by the computation that created it, so the owner
  re-running disposed the handle, and a disposed computation keeps answering with the value it last
  held — `null` when the row's fields were not registered yet.

  `MdyFormEngine.runOwned(build)` builds such an object under the form's own scope, and row and cell
  handles use it. A runtime that does not own computations has no scope and calls the builder directly,
  so nothing changes for it.

  Every headless adapter now declares a nested collection in its own suite, which is what caught this.

- c521845: A masked row in `mdyFormSnapshot` says why it is masked: `"declared"` when the schema calls the
  field sensitive, `"guessed"` when only its name looks like a secret, `"caller"` when the panel's own
  predicate decided. The panel printed the same bullets for both, and they mean different things — a
  declared secret is kept out of drafts and copies, a guessed one is protected in the panel and nowhere
  else, so a draft writes it to storage in clear. The devtools panel carries the reason as the title on
  the value cell. Nothing about what is masked changed, and the draft still withholds only what was
  declared: guessing what to keep out of storage is the defect from the other direction.
- 599695f: A member a version predates is named, not ignored

  Version 1 of the Dynamic Form Contract is a flat field list: `layout`, `rules` and `validations` are
  not in its vocabulary. An envelope that carried one had it dropped without a word — so an author who
  wrote rules against the wrong version number got a document the parser called clean, a lint with
  nothing to report, and a form where the rules simply were not there. All three places they could have
  learned were quiet.

  `parseDynamicForm` now reports `MDY_DYNAMIC_UNSUPPORTED_VERSION` against the member's own path,
  naming it and the version that has it. A v1 document that stays inside its vocabulary is unaffected,
  and the same members at version 2 or 3 are read as before.

  In strict mode this refuses the document, which is what strict mode means: a partly valid document is
  never accepted, and a document whose rules will not run is exactly that.

- d443319: The parser reports a member the contract does not declare — on a field, its validators, an option, a
  rule, a validation or a layout node — as `MDY_DYNAMIC_UNKNOWN_MEMBER`, at the path where it is
  written. The published JSON Schema closes every one of those objects and an editor says so while a
  document is typed; a document from a CMS, a model or a server meets neither, and the parser was the
  one check it did meet. It reports rather than drops, so a document written against a newer contract
  still renders in lenient mode; a strict parse — what a publishing gate asks for — refuses it. The
  member lists are published as `MDY_DYNAMIC_MEMBERS`, and `npm run test:contract-schema` holds them
  against every published schema in both directions: `spec/dynamic-form-v2/v3/v4.schema.json` were
  missing twelve members of a field, including `mode`, `searchable`, `accept` and `presets`. See
  ADR 0097.
- 5b5b2df: A document can write what its own rules say when they refuse

  The cross-field slot has carried a mandatory `message` since it existed, with the reason beside it:
  _a validation nobody can read is a field that will not submit for no stated reason_. A field's own
  rules had no such slot, so the one sentence a person must read to get any further was the one an
  author could not write — and a document is the surface written by people who do not write code.

  `validators.messages` names the rules a field declares — `required`, `email`, `min`, `max`,
  `minLength`, `maxLength`, `pattern` — and each takes a sentence. Optional, because the framework has
  one for every rule in the form's own language; a key that names no rule, or a message nobody can
  read, is refused where the document is read. Both published schemas carry the slot.

- 0994475: A field name a widget id cannot be built from is refused where names are checked, instead of at
  render time by another package. `isSafeFieldPath` — the guard published for a consumer to check
  with — called `a b` and `a__b` safe, `createForm` held them, and the widget layer then threw when it
  asked for the field's part ids: whitespace turns an `aria-labelledby` into two references that
  resolve to nothing, and the delimiter makes an id that cannot be taken apart. A document naming one
  has always been refused at the door; a form written in code now gets the same answer at the same
  place.

  **Breaking for a form whose field names carry whitespace or `__`.** Such a form could not render in
  any adapter — the refusal came from `assertUsableWidgetId` — so what changes is where it is refused.
  Rename the field, or, if the name is data rather than a name, put it in a collection: a row key is
  data and is spelled into an id rather than refused.

- 86bda68: A field may not be named `toString`

  A form's value is an ordinary object, so a field with that name becomes a data property of it and
  `ToPrimitive` is left with nothing callable: `` `${form.getValue()}` `` and `String(form.getValue())`
  throw `Cannot convert object to primitive value` — in the consumer's own code, with a message naming
  neither the field nor the document that declared it. `JSON.stringify` is unaffected, which is why it
  went unseen.

  The name is refused at the document door, where the field is dropped with a diagnostic, and at the
  typed door, where it throws as other invalid names do. **This removes a capability**: a document
  declaring such a field rendered before and now loses it. The migration is to rename the field; there
  is no way to keep the name, because the collision is with the language.

  One name rather than a list: `ToPrimitive` tries `valueOf` then `toString`, so shadowing `valueOf`
  alone changes nothing and shadowing both is unreachable once `toString` is refused. See ADR 0113.

- b1874dd: A nested collection reaches every package that restates it

  `@modyra/core` allows a collection inside a collection at any depth. Three packages a consumer
  imports could not express that, and their suites were green throughout.

  **`@modyra/angular`** re-declares `array()` and `record()` so their handles carry Angular signals, and
  both still constrained a row to a field or a group:

  ```ts
  array(group({ lines: array(group({ sku: field("") })) })); // ok in @modyra/core, refused here
  ```

  They now take what the engine's take. The refusal bites when a row **is** a collection — a collection
  inside a group inside a row was always legal, since a group's children have always been able to hold
  one. `@modyra/studio-target-angular` generates code against these factories, so a project whose row
  is a collection generated Angular code that did not compile.
  `MdyAnyRowDescriptor`, `MdyAnyRecordDescriptor`, `MdyRecordDescriptor` and `MdyRecordHandle` are
  exported too: the array half was nameable and the record half was not.

  **`@modyra/zod`** mapped a collection's element to a group or a leaf, so `z.record(z.array(...))` and
  `z.array(z.array(...))` became one opaque value where the schema declared a list. A row is now read
  exactly like a schema key. Shapes the engine has no node for — tuple, set, map — still degrade to a
  leaf.

  **A document made of arrays** built a form whose nested collections held no rows. A row's value
  arrives flat, so a collection inside it is keyed `"0"`, `"1"` — what a record holds and what an array
  refuses — and `buildFlatFormSchema` seeded it unchanged. The value read as correct in structure and
  was empty in fact: `@modyra/plain` mounted one control out of three for a three-level document.
  Seeds are now shaped against the descriptor at every depth, so a list inside a keyed row and a keyed
  row inside a list each keep their own shape.

  **`MdyAnyRowDescriptor` is exported** from `@modyra/core`: it is the constraint of the public
  `array()` and `record()` factories, and a consumer writing a helper over row descriptors could not
  name it.

  **A nested collection's value now has the same type as a top-level one.** `MdyArrayItemValue`
  returned `ReadonlyArray` and `Readonly<Record>` for a collection directly inside a collection while
  `MdyFormValue` returned mutable ones a level up — the same value, two types depending on the depth it
  was read at. Nothing changes at runtime; a nested list is no longer typed readonly.

  Recorded as [ADR 0046](https://github.com/modyra/modyra/blob/main/docs/architecture/0046-an-adapter-states-no-less-than-the-engine.md).

- 0a96145: The contract says a password is not a text field: `MDY_WIDGET_CONTRACTS[kind].controlType` names the
  native control a kind is drawn with, and `concealed` — on the widget contract and on
  `MDY_VALUE_CONTRACTS` — says the control does not show what is typed into it. The one difference
  between the two kinds was said nowhere a renderer could read it, so every adapter kept a private map
  from kind to input type and the failure mode of one that does not is a password in clear text.
  `@modyra/plain` reads the contract instead of its own map. Both members are optional; nothing an
  adapter does today breaks. See ADR 0099.
- e59d37c: A patch names cells in a positional collection too

  `patch({ list: [row] })` replaced the row: every cell `row` did not name was rebuilt from the field
  declaration's initial — not what the person typed, not what the row started as, but what a row
  created from nothing gets. The keyed collection was already right on the same call, so a change set
  fed back through `patch` restored a keyed row and overwrote a positional one.

  A row a patch carries is now written over the row that is there, cell by cell, driven by the schema
  so an object-valued leaf is still replaced whole. The list itself is unchanged in meaning: its length
  states which rows there are. A row past the end is new and taken as it came. The same holds for a
  collection reached through a patched keyed row.

  A caller who used a partial row to mean "and clear the rest" must now name the cells to clear, which
  is what the keyed collection has always required. `MdyNestedCollection` gains `patchFrom`. See ADR 0103.

- 551320a: A positional collection's submitted value keeps the positions the form holds

  `submitValue()` left out disabled fields, and a row whose fields were all disabled therefore
  contributed no key at all — so the list built from what remained was shorter, and every row after the
  missing one was sent at a position it does not occupy. A server reading `list[0]` after the first row
  was locked read the row the person can see below it. Nothing in the payload said so and no type
  moved.

  A row that contributed nothing is now submitted as `{}` at the index it holds, so
  `submitValue().list.length === getValue().list.length` for every array in the form. The field promise
  is unchanged — a disabled field contributes no key, at any depth — and keyed collections are
  untouched: an absent key stays absent.

  A consumer that assumed every row in a submitted list was populated will now see `{}` for a row that
  sent nothing. No API changes, so the type surface and the contract snapshot are unmoved; this is a
  change to what a payload means and lands as a minor for that reason. See ADR 0100.

- e6b35e4: A change set says which row of a positional collection changed

  `getChanges()` is documented as ready for a PATCH, and for a keyed collection it composed into
  something a server could act on. For a positional one it was a compacted list of the changed rows,
  with nothing saying where they were:

  ```
  edit index 0   { list: [{ t: "EDITED" }] }
  edit index 1   { list: [{ t: "EDITED" }] }   the same body
  edit 0 and 2   { list: [{ t: "A" }, { t: "C" }] }   reads as 0 and 1
  ```

  A server applying it by position wrote the wrong row in two cases out of three.

  An index _is_ the identity of a positional row, so a partial list is not a partial PATCH — it is an
  ambiguous one. A positional collection with any change is now carried **whole**, which is the shape
  `MdyFormPatch` already declares for an array: whole-item, where a record's branch is deep-partial. A
  keyed collection is unchanged.

  The comparison is untouched — a row is still compared against its own initial, so removing a row does
  not report every row after it as changed. What is added is the rows that did _not_ change, which is
  what makes the position of the ones that did readable.

  A PATCH carrying a long positional collection now carries all of it. Recorded as
  [ADR 0072](../docs/architecture/0072-a-positional-change-set-carries-its-whole-list.md).

- 29849b2: A record's row may hold a record

  The first nesting the runtime can execute, and the first ADR 0040 enables:

  ```ts
  const form = createForm({
    orders: record(
      group({ customer: field(""), lines: record(group({ sku: field("") })) })
    ),
  });
  form.f.orders.upsert("o1", { customer: "Ada", lines: {} });
  form.f.orders.row("o1").lines.upsert("l1", { sku: "SKU-1" });
  ```

  The row's collection is a collection, not a cell: it has `keys`, `upsert`,
  `remove`, `rename` and rows of its own, and it is resolved on each read so a row
  removed and declared again is answered by the manager it has now.

  Removing the parent takes the whole subtree — values, fields and async runners —
  and a descendant nobody mounted still decides the form's validity.

  Everything else is still refused, and still when the form is built rather than
  when a row arrives. The message says what a row may hold, so the supported set
  is readable from the failure.

- 8ad9612: A form that speaks a language refuses in it too

  A document declares `locale`, and the parser takes it seriously — a malformed tag is refused rather
  than degraded — and it reached the month names, the first day of the week and every word the widget
  catalogue says. It stopped at the refusals: an Italian form with an Italian calendar answered
  _This field is required_, which is the one line a person has to read to get any further.

  `validationMessagesForLocale(locale)` publishes the refusals in the five languages the widget
  catalogue already speaks, and a document's own validators are built with the language the field
  declares. A tag nobody translated falls back to its language and then to English, so a form always
  refuses in a language rather than in nothing.

- c5f854a: A refusal the server sent reaches somebody, however it is addressed

  A submit action returns errors to refuse, and its argument is whatever an application derived from a
  server's answer. Three ordinary shapes vanished:

  ```js
  await form.submit(async () => [{ message: "Already registered" }]); // no path at all
  await form.submit(async () => [{ path: "", message: "…" }]); // the form, explicitly
  await form.submit(async () => ["Already registered"]); // a bare message
  // each: no error anywhere, the field still valid, the draft cleared
  ```

  All three were dropped by the guard that drops a hostile path — `isSafeFieldPath` refuses an empty
  string and refuses `undefined` — so a refusal was discarded as if it were an attack. A person pressed
  Send, the server said no, and nothing appeared.

  A path that is absent, `null` or `""` now means the form. A bare string is a message about the form.
  A return that is not a list becomes one form-level error instead of surfacing
  `errors.filter is not a function`, and the development channel says what the contract is. A message
  that is not a string no longer reaches a page as `[object Object]`: it is replaced by a readable
  sentence and what it held is kept on `payload`.

  An unsafe path is still dropped and still reported as a security violation — that is the one case
  where losing the message is the lesser harm.

  A shape that used to vanish now shows a message, which may appear in a place that was previously
  empty. Recorded as [ADR 0060](../docs/architecture/0060-a-refusal-reaches-somebody.md), which also
  states what is left: `@modyra/plain` renders no surface for a form-level error, so on that renderer
  these reach `lastSubmitErrors` and no further.

- c395a2c: A renamed row stays where it is, and the value agrees with the handle

  `rename` is defined against `remove` followed by `upsert` — what only it can keep is the state the
  user produced. It also did what that pair does and appended the row:

  ```js
  form.f.orders.upsert("b", { ref: "A1" });
  form.f.orders.upsert("c", { ref: "A1" });
  form.f.orders.rename("b", "a");
  // keys(): ["c", "a"]   — the row a user renamed jumps to the bottom of their table
  ```

  A keyed collection was keeping two orders: the key list `keys()` answers, and the order a row's
  fields sit in, which is what the flat value is read out of. Nothing else diverged them — `upsert` on
  an existing key, `remove` and remove-then-upsert all had both answers agreeing.

  A rename now leaves the row where it is, and `getValue()`, `submitValue()` and `getChanges()` say so
  too. Remove-then-upsert still appends, which is the difference the two operations exist to have.
  `MdyFormEngine` gains `orderRowsUnder`, so a collection rather than the engine decides the order of
  the rows under its path. `MdyCollectionHost` declares it too; that interface is not on any entry
  point, so implementing it is this repository's business and not a consumer's.

  A consumer diffing serialized output across a rename now sees the key change and nothing else move.
  Recorded as [ADR 0058](../docs/architecture/0058-a-rename-moves-a-key-not-a-row.md).

- 2882c66: A record's row may hold an array, and a form's nesting has one published limit.

  Phase B of the nested-collections ladder: a `record()` row may now declare an
  `array()` — an order whose lines are positional, a line whose allocations are a
  list. The row owns it like any other subtree: it is created with the row,
  removed with it, and restored whole by undo.

  An array's row still holds no collection: its rows are positional, so a
  descendant's whole path moves on every insert, remove and move (ADR 0040).

  Nesting is capped at 8 levels, collections included — the number the document
  validator has published since before collections could nest. A deeper schema is
  refused where the form is built.

- 2dd4cff: `getChanges()` now reports a field the form's baseline never had, so a row a user added is in the
  patch even when no cell of it was edited. A row's cells take the value the row arrived with as their
  initial, so nothing about a new row differed from its own baseline: `reset()` threw the row away
  while `getChanges()` said there was no change, and a `PATCH` built the documented way never carried
  the rows a user made. A rename carries baseline membership with the row, and
  `rebaselineToCurrentValue()` — or `setInitialValue` on the collection — makes rows already there the
  form's own starting point. See ADR 0096.
- afb6d57: A rule a document writes is a rule the form keeps

  The Dynamic Form Contract's `rules` array was read by the parser as behaviour — an undeclared effect,
  an undeclared operator, a target that is not a field and a condition on a field that is not there are
  each refused, and in strict mode the whole document goes with them — and then nothing applied one.
  Every reference to a document's rules in the workspace was inside the parser.

  The end of it is the payload. Same field, same value, same page, and the only difference is which path
  disabled it: through the field handle the form sends `{"customerType":"person"}`; by the document's
  rule it sends `{"customerType":"person","taxId":"SSN-123-45-6789"}`. A document saying "disable the tax
  id for a private customer" produced a form that sent it.

  **`applyDynamicRules(form, rules)`** is the sibling `buildDynamicValidations` already had.
  `visible`/`hidden` take the field out of play — not asked for, not validated, not submitted;
  `enabled`/`disabled` leave it in the form and stop it being answered. Two rules naming one field
  compose rather than replace.

  **`mountMdyForm` accepts `rules`** and applies them, so the documented path carries the whole document:
  `mountMdyForm(container, result.fields, { layout: result.layout, rules: result.rules })`. A host that
  does not pass them gets what it got before.

  **`evaluateRuleCondition(when, value)`** is published beside `evaluateExpression`. The rule predicate is
  flat and its vocabulary is wider than the expression tree's — `in`, `notIn` and the two "or equal"
  comparisons exist only here — and a host rendering its own controls can now ask the question the
  binding asks instead of reimplementing ten operators. An operator nobody declared answers `false`;
  comparisons are between two numbers or two strings, so an ISO date rule works and nothing is coerced.

  The generated-forms guide no longer says that no renderer applies rules.

- 6712836: A secret is excluded by the name a person writes

  The draft guide instructs, in bold, to always `exclude` passwords, card numbers and tokens. `exclude`
  matched an exact leaf path and nothing else — and a card number lives in a list, where the row key is
  data. Of the four ways a consumer writes that intent, the only one that worked was `["cards.a.pan"]`:
  the spelling nobody can write before the user has added the row. `["cards"]`, `["cards.*.pan"]` and
  `["pan"]` all left the number in `localStorage` in plain text, and nothing about the form afterwards
  looked wrong.

  An entry is now matched four ways: the exact path; an **ancestor** (`cards` excludes the subtree); a
  **pattern**, where `*` stands for exactly one segment (`cards.*.pan`); and a **bare name** with no dot,
  which excludes any cell of that name wherever it sits.

  The matching is deliberately generous, and that is the decision: an entry excluded by mistake costs a
  convenience, an entry persisted by mistake is a card number that survives a logout. `exclude: ["name"]`
  will keep `person.name` out too — write a full path when you need precision.

  Both directions as always: the same matcher answers on save and on restore, so a tampered draft
  carrying an excluded path still restores nothing.

- cfa1ec6: A surface you can read from the entry point

  Four `export *` published seventy-four symbols nobody could enumerate without opening four files,
  forty-seven of them from the least curated module in the package. Neither the type-surface audit nor
  the coverage audit was measuring a surface anyone had chosen — they were measuring whatever those
  files happened to contain.

  They are named exports now, and the proof that the enumeration is complete is that the type surface
  did not move: 581 shapes before and after.

  `MDY_FIELD_KINDS` and `MdyFieldKind` are on the entry, so a consumer can ask what a field can be
  without going through the document parser that used to own the list.

  `MDY_DYNAMIC_DIAGNOSTICS` makes the code table data. Codes were derived by substring-matching English
  error messages, so rewording a sentence renamed a code somebody was matching on and nothing objected.
  The coupling is not removed — the phrases still have to appear in the messages — but it is written
  down and checked: every named code is driven by a document that must produce it, and rewording a
  message without updating the table fails two tests by name.

  One thing the tests now state that the types did not: `ok` reports whether the _envelope_ was
  understood, and the counts report what happened to the _fields_. A document whose every field was
  refused is `ok: true` with `fields: []`, so a consumer reading only `ok` mounts nothing and believes
  it succeeded.

- c228019: A rule about a field the schema does not have is refused, not attached

  One transposed letter made a working form unsendable:

  ```js
  form.addValidators("emial", [required()]);
  form.state.canSubmit(); // false — and submit() never calls its action
  ```

  Nothing renders a control for a path the schema never declared, so the rule can never be satisfied.
  The error sat on a path nothing was bound to: a filled-in form, a dead Submit button, and no message
  anywhere, `devWarnings: true` included.

  `addValidators`, `upsertValidators`, `upsertAsyncValidators` and `setInitialValue` now refuse a path
  the form does not describe, naming it. A collection's cells still count as declared before their row
  exists, because a control mounting ahead of its row is ordinary.

  The check is the typed form's, not the engine's: `MdyFormEngine` has no schema, and a field coming
  into being because something asked for it is how a declarative adapter builds a form.

  `upsertValidators` on an undeclared path used to attach a rule that could be removed again by key.
  That undo is withdrawn deliberately — the dead Submit is the same through either door, and an escape
  hatch only helps someone who already knows what happened.

  The three interactivity setters are unchanged: given a _group_ path they do nothing rather than
  reaching the fields inside it, and refusing an undeclared path without answering that would fix half
  a door. Recorded as
  [ADR 0064](../docs/architecture/0064-a-typed-form-refuses-a-path-it-does-not-declare.md).

- 7cbcd34: A form does not send a field that says it cannot be read

  A date or time a control cannot read is kept on screen and explained — and the value the field holds
  is `null`, which no rule objects to unless the field is required. So the page and the form disagreed:

  ```
  type "not a date", leave the field
    the page     aria-invalid="true", "That could not be read…", the text still there
    the form     valid, submittable
    the submit   { "when": null }
  ```

  A server received a field left empty while the person was looking at the opposite. The submit path
  was not at fault — the same field marked `required` disables the button — it was an error the verdict
  could not see.

  **`MdyFieldHandle` gains `reportEntry(problem)`:** a control says that what it holds does not
  represent what was entered, in the words a person reads, or `null` once the two agree again. The
  engine folds it into the field's errors, so `valid()`, `canSubmit()` and every error list see it.

  Anything implementing `MdyFieldHandle` implements one more member — a test double, an adapter
  building its own handle. Handles produced by `createForm` are unaffected.

  A form that used to submit `{ when: null }` while showing an error now reports itself unsubmittable
  until the entry is corrected or cleared. Recorded as
  [ADR 0073](../docs/architecture/0073-a-verdict-a-person-can-see-is-one-the-form-counts.md).

- 4914abd: An array's row may hold a record, rebuilt atomically.

  Phase C of the nested-collections ladder: an `array()` row may declare a
  `record()` — an order line whose allocations are keyed by lot. `insert`,
  `remove` and `move` rebuild the descendant under its new index: values follow
  the row, and touched/dirty do not, exactly as an array's own rows have always
  behaved (ADR 0040).

  The rule that replaces the old blanket refusal is **one positional level per
  path**: an array below another array is refused where the schema is written,
  including below a record an array's row declared, because two positional levels
  make a descendant's path move for two reasons nothing can tell apart.

- bf0c12e: `oneOf` recognises an option by what it holds, so a draft's round trip is not tampering

  A draft is written as JSON and read back as JSON, and `oneOf` compared options with `Object.is`:

  ```js
  const OPTIONS = [
    { id: 1, label: "One" },
    { id: 2, label: "Two" },
  ];
  field(null, [oneOf(OPTIONS)]);

  // user picks OPTIONS[0]           → valid
  // draft saves, form reopens       → { id: 1, label: "One" }, a different object
  //                                 → "not an offered option", form invalid
  ```

  A user who left a form half-filled and came back was told their own choice was not on the list, with
  no way out but to pick the same thing again.

  `oneOf` and `eachOneOf` now compare an object option by its members, recursively — for the shapes
  JSON round-trips: plain objects, arrays, dates and primitives. A class instance, a `Map` or an option
  carrying a function keeps identity comparison.

  **The guard is exactly as strict.** A member missing, a member added, a member of the wrong type, a
  member differing in case, an id that was never offered, a bare label instead of the option — all
  still refused. Two structurally identical options in one list do become indistinguishable, which is
  the correct answer to the question `oneOf` asks.

  `getChanges()` is unchanged and still compares leaves with `Object.is`.

  Found by `battle-tests/adversarial/persistence/option-identity.battle.test.mjs`. Recorded as
  [ADR 0051](https://github.com/modyra/modyra/blob/main/docs/architecture/0051-an-option-is-recognised-by-what-it-holds.md).

- e30a985: An error says where it came from, and the panel prints that

  The devtools panel promises each error is prefixed with its origin — `[validation]`, `[async]`,
  `[cross-field]`, `[server]` — and printed the error's `kind` instead, which for a server refusal is
  whatever the server chose. The ordinary shape, `{ path, message }`, arrived as **`[unknown]`** in the
  one tool built to say where things come from; a refusal that called itself `validation` was printed
  exactly like a rule this form had run.

  `MdyFieldError.origin` is the form's own knowledge — which list the error arrived in — and the panel
  prints it, falling back to `kind` only where nothing set one.

- 9190e59: A condition nobody can read does not open a section, and cannot hang the form

  `MdyExpressionOp` is a closed set of twelve, and the two functions that read it disagreed about a
  thirteenth:

  ```js
  validateExpression({ op: "eqals", … }, "when")   // ["when: unknown operator \"eqals\""]
  evaluateExpression({ op: "eqals", … }, value)    // true
  ```

  A section meant to appear for one country was shown to everyone, and the values inside it went into
  the payload — from one transposed letter. An unknown operator now evaluates to `false`: a question
  with no answer is not answered with the one that opens.

  The same asymmetry carried a cost. ADR 0050 gates patterns arriving through a document's
  `validators.pattern`; `matches` is the **second** door a pattern arrives through, and it had no gate.
  A `when` is read every time the form is read, so `(a+)+$` there does not make a slow form — it makes
  one that stops answering between two keystrokes. `evaluateExpression` now applies the same cost
  refusal and the same length cap, and `validateExpression` reports both the way it already reports an
  unknown operator.

  An operator among the twelve with nothing to compare — `equals` with no operands, `and` with none to
  join, `not` with nothing to negate — is unreadable too and answers the same way. So is an expression
  that is not one at all: `null` and a bare string used to raise from inside whatever read the form
  last, the submit button included, and a `matches` pattern that does not compile did the same.

  An expression nested past the depth cap is **not** covered: that cap limits what a document may
  carry, not what a caller may evaluate.

  This reverses a documented default: an unreadable condition used to keep a section visible. A
  validation whose condition cannot be read still never fires; a section whose condition cannot be read
  now never shows. Recorded as
  [ADR 0069](../docs/architecture/0069-an-unreadable-condition-does-not-open.md).

- 0f9cf08: A runtime that declares no comparator decides change with `Object.is`

  The published conformance suite had a case for a _declared_ `equal` and none for the comparison a
  runtime makes when nothing is declared, so `===` and `Object.is` were both conformant. They differ on
  two values: `===` calls `0` and `-0` the same and `NaN` different from itself, so a number field
  written `-0` over `0` re-renders nothing and one holding `NaN` re-renders on every write of the same
  `NaN`.

  `runReactivityContractTests` now requires `Object.is`. An adapter for a runtime whose native default
  is `===` must override it — `@modyra/solid` did not, despite a comment claiming otherwise, and now
  passes `Object.is` to `createSignal` and `createMemo`. Vue, React, Preact and Svelte were measured
  and already agreed.

  An adapter outside this repository that ran the suite and passed may now fail; the failure predates
  the case. See ADR 0104.

- e4182c0: The colour arithmetic ships with the themes it generates

  `@modyra/core/color-utils` and `@modyra/core/theme-compiler` move to
  `@modyra/styles`, which gains a JavaScript entry beside its stylesheets. Between
  them they were 1065 lines — the second and sixth largest files in a package
  described as a form engine — and nothing in that engine ever executed one of
  them.

  Measured before moving, because a move that grows a dependency edge is worse than
  the misplacement it fixes: `color-utils` imports nothing, `theme-compiler` imports
  only `color-utils`, no package imported either, and `@modyra/styles` had no
  `@modyra` dependency at all. A leaf moving to a leaf; the graph cannot grow a
  cycle from it.

  Migration, for the thirty-one names that leave core:

  ```diff
  -import { MDY_PALETTE_MODELS } from "@modyra/core/color-utils";
  -import { compileMdyTheme } from "@modyra/core/theme-compiler";
  +import { MDY_PALETTE_MODELS, compileMdyTheme } from "@modyra/styles";
  ```

  Their tests move with them and run as `npm run test:styles`, which is part of
  `npm run test` — a move that leaves its tests unreachable has deleted them
  without saying so.

  Recorded as ADR 0035, including the check it does not have: nothing enforces that
  the two modules stay dependency-free, which is the property the move rests on.

- cd62884: An abstraction you can substitute something for

  `MdyFormRegistry` was declared inside the engine's own file, beside its only implementation, and both
  collection managers imported the concrete `MdyFormEngine` and called eight methods that were on no
  interface at all — `registerPathGate`, `refreshPathGate`, `peekField`, `ownField`, `disownField`,
  `fieldNames`, `getField`, `errorsFor`. The interface described the class; nothing could be put in its
  place, and nothing said so.

  - `MdyCollectionHost` names what a collection actually needs from the form that holds it: a control
    claims one field, a collection creates and destroys a range of them and answers for which are in
    play. Both managers now depend on it, and a test drives them against a double that is not the
    engine — behind a `Proxy` that throws on any method the contract does not have.
  - `MdyFormRegistry` and `MdyPathGate` moved to `contracts/`, out of the implementation file.
  - `MdyReactivity` and its neighbours moved to `reactivity-contract.ts`; the reference runtime and its
    module-level scheduler live in `vanilla-reactivity.ts`. Nine modules that only name the types no
    longer pull four hundred lines of scheduler to do it.
  - `MDY_FIELD_KINDS` is a leaf module. `MdyValueKind` was `(typeof MDY_DYNAMIC_FIELD_KINDS)[number]` —
    this library's canonical type derived from a constant inside a JSON parser, which also closed a
    cycle between three modules that compiled only because the build erases type-only edges. The
    document format names the vocabulary now instead of owning it, and a test fails if the re-export
    ever forks.

  `MdyArrayManagerDeps.engine` and `MdyRecordManagerDeps.engine` are typed `MdyCollectionHost` rather
  than `MdyFormEngine`. The differ reads that as major and it is worth stating plainly: for anyone
  _constructing_ these deps it is a widening — the engine satisfies the interface — and for anyone
  _reading_ `deps.engine` expecting the engine's other methods it is a narrowing. Neither type is on
  the package entry. Undoing it would mean undoing the inversion, which is the point.

- 59c70fe: Every kind consumes the controller written for it — and the registry that made one of them silent

  Adoption reaches 45/45 and projections 48/48. The last two were the clocks: both
  kept the draft the timepicker's controller owns, which is the one kind whose value
  contract says `confirm`, so the draft is real and belongs where the contract put
  it.

  **`registerHandleOwner` is public.** `observerFor` was already, and it reads a
  registry nothing public could write to — so an adapter building a handle of its
  own could not say which runtime owns it. Angular's declaratively named controls
  build exactly such a handle, registered it in the neighbouring _form_ registry by
  mistake, and `observerFor` fell back to a vanilla runtime whose signals an Angular
  computed cannot see. The controller's state changed and the template never
  re-rendered: the clock's hand would not move, and nothing failed anywhere else,
  which is the silence that registry exists to end.

  `applyWidgetCommands` joins the Lit overlay runtime. Which command opens a popup,
  closes it and gives focus back is the same three for every kind, and the three
  renderers that adopted a controller had written the loop identically.

- 211ee54: History crosses structural changes.

  `undo()` and `redo()` now act on the value as it is at the moment of the call:
  a row declared, removed or renamed — at any depth, nested collections included —
  is undoable immediately, not only after the reactivity's scheduler has run.
  A removed subtree comes back whole; a rename is one step. The boundary is
  unchanged: only the value is restored — touched, dirty and verdicts are not,
  and a restored row revalidates as a fresh declaration (ADR 0041).

- 3fa4c1a: A row that sends nothing takes the shape of the row it stands for

  A positional row that contributed no field is submitted at the place it occupies, and it was
  submitted as `{}` whatever the row was. A collection of leaves — `array(field(""))`, a list of words
  — then carried an object where a word goes, so a receiver validating a list of words rejected the
  whole payload rather than the one position it could not read.

  The placeholder is now the empty form of the row's own declaration, taken from the schema: `{}` for
  a row of cells, a list of the same length for a row that is itself a list, and `undefined` for a row
  that is a single value (`JSON.stringify` writes that as `null`, which is all an array can carry).
  `undefined` rather than `null` so a withheld row is not mistaken for a field the person cleared.

  `MdySubmittedValue` says this now: a positional row is `MdySubmittedItemValue<I> | undefined`, and a
  row of cells is the partial of its own schema rather than the complete value. `MdySubmittedItemValue`
  is newly exported. Code reading `submitValue()` on a form with a positional collection may need to
  handle a missing row — which is the case that was silently misreported before. See ADR 0100.

- 000f195: A handle is observed by the runtime that owns it

  The defect had been diagnosed, fixed and documented once already — and the fix reached two callers
  out of roughly seventeen. `CHANGELOG.md` records what it costs: a binding that builds a fresh
  `vanillaReactivity()` to observe a handle works only because vanilla's tracking is global to the
  module, and silently never re-renders for a handle owned by another form.

  `observerFor(handle, requested?)` is the one place that reads the ownership registry, so a caller no
  longer has to know it should. Every field controller and every field renderer now resolves through
  it; a runtime passed in explicitly is honoured rather than replaced, because a host with its own
  scheduling has a right to be believed.

  `MdyCrossRuntimeObservationError` and `MDY_CROSS_RUNTIME_OBSERVATION` were declared when the defect
  was first found and constructed by nothing, which is why the other fifteen went unnoticed. They are
  now raised when a caller observes a handle through a runtime that does not own it.

  The select hooks keep their own runtime, and say why: that controller takes options and a callback
  rather than a field, so there is no form whose runtime it could observe through.

  Also in this release, for the suites rather than the library:

  - `settleFor(beat, hostFlush?)` and `MDY_PAINT_BEATS` — when a renderer's DOM catches up with a
    write, declared by the renderer instead of guessed per fixture. Plain's twenty milliseconds turn
    out to have been one task all along.
  - Lit and Angular drive the lifecycle contract, which one renderer had been carrying alone.

- bd8a9ed: The calendar's questions about its bounds, asked once

  `isMonthOutOfRange`, `isYearOutOfRange` and `calendarYearRange` join
  `@modyra/core/datetime`. Angular and Lit each carried their own copy of all
  three, and Lit carried two copies — its range picker is its date picker,
  copied — so four implementations decided which months a picker greys out and
  which years it offers.

  They are asked of a month and a year rather than of a date, which is the part
  that was easy to get wrong: the first of a month can fall before `min` while most
  of that month is reachable, so testing the first day hides a month the user is
  allowed to pick in.

  The Lit calendars also stop recomputing month and weekday names through `Intl`.
  `buildDateLocale` has produced both all along.

- 357316c: One call is one step of history, and a restored row comes back where it was

  Undo is a promise about states: every step on the way back is somewhere the person was. A collection
  on the path broke it twice.

  A write that changed several rows cost one press per row. `record.setAll` with three rows took three
  undos to return, and each press in between showed a table with some rows written and some not —
  while `record.patch` on the same handle, `array.setAll` and `form.patch` all cost one. `reset`,
  `setValue`, `record.setAll({})` and a restored draft never returned at all: the rows came back one at
  a time, reversed. All of them now record one entry, and `MdyCollectionHost` gains `mutate` so a
  collection tells its host that a bulk write is one change.

  A row a restore brought back arrived last, because restoring declares it again and a row declared
  again is a new row:

  ```js
  upsert("a");
  upsert("b");
  upsert("c");
  remove("a");
  undo();
  // keys(): ["b", "c", "a"]   — was
  // keys(): ["a", "b", "c"]   — is
  ```

  A whole-value write now carries the order it holds, through an undo, a redo and a draft alike.

  Undo counts change: a consumer pressing undo three times after a three-row `setAll` now goes three
  steps further back. Nothing published stated the old count, and the intermediate states are no longer
  reachable — which is the point.

  Recorded as [ADR 0059](../docs/architecture/0059-a-step-of-history-is-a-state-the-form-was-in.md).

- 7997644: One door per name, and nothing published before it is used

  **The surface was not what it was measured to be.** The audit that snapshots the public type surface
  read every emitted `.d.ts` in `dist`, so it counted 623 shapes when a consumer could reach 26
  subpaths — `FieldRecord`, `AsyncValidatorEntry`, `define` and `MdyWidgetShape` were all reported as
  public and none of them is on an entry. It now resolves the names through the TypeScript checker
  starting from the `exports` map, which is the only definition of the surface that a consumer sees.
  The first honest number is 581 shapes.

  **A name is reachable from one subpath.** 82 of `@modyra/core`'s 155 symbols could be imported by
  two paths, and the adapters had divided themselves between the aliases: `calendarKeyboardTarget` from
  `/ui` and `/keyboard`, `CalendarDate` from `/datetime` and `/date-utils`. Every duplicate was an
  aggregate published beside the granular files it re-exported, and the aggregate wins because it names
  a domain rather than a file. `scripts/audit-public-doors.mjs` now fails on a name with two doors.

  Removed from `@modyra/core`, each redundant with the entry or with the aggregate that keeps it:

  | removed                       | import from                 |
  | ----------------------------- | --------------------------- |
  | `@modyra/core/form`           | `@modyra/core`              |
  | `@modyra/core/validation`     | `@modyra/core`              |
  | `@modyra/core/dynamic-config` | `@modyra/core`              |
  | `@modyra/core/date-utils`     | `@modyra/core/datetime`     |
  | `@modyra/core/time-utils`     | `@modyra/core/datetime`     |
  | `@modyra/core/date-locale`    | `@modyra/core/datetime`     |
  | `@modyra/core/icons`          | `@modyra/core/ui`           |
  | `@modyra/core/keyboard`       | `@modyra/core/ui`           |
  | `@modyra/core/options-utils`  | `@modyra/core/ui`           |
  | `@modyra/core/i18n`           | `@modyra/core/localization` |

  Removed from `@modyra/widgets`, all three wholly contained in the entry:

  | removed                    | import from       |
  | -------------------------- | ----------------- |
  | `@modyra/widgets/ids`      | `@modyra/widgets` |
  | `@modyra/widgets/runtime`  | `@modyra/widgets` |
  | `@modyra/widgets/commands` | `@modyra/widgets` |

  `@modyra/widgets/testing` no longer re-exports `portalRootFor`; the runtime needs it and it has been
  on the package entry since it moved there.

  **Two audiences, two doors.** The entry offers what a renderer draws with — part ids, root classes,
  projections, controllers, the interactivity predicates. The tables a theme or a conformance checker
  reads move to `@modyra/widgets/vocabulary`: `MDY_WIDGET_STATES`, `MDY_WIDGET_STATE_SUPPORT`,
  `MDY_WIDGET_STATE_CONTRACTS`, `MDY_CANONICAL_UI_CLASSES`, `MDY_CSS_PROPERTY_NAMES`,
  `MDY_SHARED_UI_CLASSES`, `MDY_STATE_MODIFIERS`, `MDY_LABELABLE_TAGS`, `MDY_FIELD_SHELL_STRUCTURE`,
  `widgetSupportsState`, `widgetStateMatrixSize`. The types a presenter implements stay on the entry,
  because that is where a renderer reaches for them. The unused `@modyra/widgets/contract` subpath,
  which published those same types a second time, is gone.

  **Nothing is published before an implementation uses it.** Seven names were added while the
  controllers behind them were being written and no renderer consumes them yet, so they leave the entry
  and return with the renderer that takes them up: `createColorsFieldController`,
  `createFileFieldController`, `createSelectFieldController`, `createPointerDrag`, `dragPointOf`,
  `daterangeFieldPartIds`, `daterangeFieldRootClasses` — with `MdyDragPoint`, `MdyPointerDrag` and
  `MdyPointerDragOptions`, which described the last two. All remain in the package; the modules that
  declare them are unchanged.

- 89e7d14: A form from a flat field list, built in one place

  `buildDynamicFormSchema` meant two things. In `@modyra/core` it takes the nested node a document
  declares; in the React binding it took the flat list a parse produces — a different function with the
  same name. The framework-free renderer had a third under `buildFormSchema`, a **superset** that also
  rebuilds collections, and the Angular one inlined a fourth. Three implementations of one rule can
  differ, and the only way anyone would have found out is a user reporting that the same document
  behaves differently in two renderers.

  `buildFlatFormSchema(fields, collections?)` and `applyFlatValidators(form, fields, key?)` are that
  rule, named for what they take. The superset behaviour is the one that survived: a path cannot say
  whether `lines.0` came from an array or a record keyed by digits, so the collections are passed rather
  than guessed. The nested builder keeps its name — renaming a working export to make room for a new
  one is a break with no gain.

  `applyFlatValidators` asks for the one method it uses rather than a whole `MdyTypedForm`: one of the
  three callers passes a component that owns a form, and a signature wider than its use turns a working
  call into a cast.

  `useMdyField` now applies the verdict rule. `errors` is what the field **shows** — a field the form is
  not asking about shows none — and `heldErrors` is what it still carries, for a debugging view.
  `showsAsInvalid` and `errorsVisible` come with it. The rule landed in the renderers a while ago and
  had never reached the hooks.

- 621866a: A flattened path now rebuilds every collection it crossed.

  `buildFlatFormSchema` turns a collection declared inside another collection's row
  (`orders.o1.lines` inside `orders`) into a real nested descriptor — the first row
  describes the child's item, and each row's leaves seed it through the parent's
  initial. Plain's `mountMdyForm` walks such paths the way each collection is
  addressed, so `orders.o1.lines.l1.sku` mounts a real control two collections deep.
  One-level documents build exactly as before.

- e16ed4f: The storage a browser already has is taken as it is

  The draft guide says the default storage is `localStorage`. A consumer reading that and then naming it
  — for a different key prefix, a session instead of a local, a wrapper that counts writes — passes
  `window.localStorage`, which is the object the sentence names. `MdyDraftStorage` is
  `{read, write, remove}` and Web Storage is `{getItem, setItem, removeItem}`; nothing published
  converted between them, and the mismatch was not refused. The first read threw
  `this._storage.read is not a function`: a private field, from a stack inside the engine, about an
  argument the caller had passed.

  `draft.storage` now takes either shape. A Web Storage is adapted at the boundary, with its methods
  bound to the object they came from. Anything that is neither is refused where it is passed, naming
  what was expected.

  `MdyWebStorageLike` is published for the second shape, and `MdyDraftOptions.storage` widens to
  `MdyDraftStorage | MdyWebStorageLike`.

- b137ea2: The UI contract lives in one package

  `@modyra/core/ui` is removed. The icon geometry, the keyboard policy a listbox
  and a calendar answer to, and the option filter move to `@modyra/widgets`, which
  is what ADR 0006 said they were all along.

  The reason is worse than misplacement: **`@modyra/widgets` imported them from the
  engine, in five files.** The package that is the UI contract was reaching
  sideways for its own material, and the three renderers each imported the same
  door directly — so a widget's keyboard had two plausible homes and every consumer
  picked one.

  ```diff
  -import { calendarKeyboardTarget, filterOptionsByQuery, MDY_ICONS } from "@modyra/core/ui";
  +import { calendarKeyboardTarget, filterOptionsByQuery, MDY_ICONS } from "@modyra/widgets";
  ```

  `listboxNavigationIndex` is gone with it. It was `listboxNextIndex` re-exported
  under a second name, so one function answered to two depending on which renderer
  was asking; the name it has is `listboxNextIndex`.

  Recorded as ADR 0036, including the check it does not have: nothing forbids a new
  UI module appearing in the engine tomorrow.

- 55dd238: The words a widget says belong to the widget contract

  `@modyra/core/localization` is removed. The forty-one UI strings and their five
  locales move to `@modyra/widgets`: a search box's placeholder and a clock's
  confirm button are what a widget _says_, and the engine has no opinion about
  either.

  The subpath goes with them because nothing else was left in it — `buildDateLocale`
  had already moved to `@modyra/core/datetime`, where the calendar that reads a
  locale lives.

  ```diff
  -import { MDY_I18N_MESSAGES_IT } from "@modyra/core/localization";
  +import { MDY_I18N_MESSAGES_IT } from "@modyra/widgets";
  ```

  What this makes possible and does not yet do: the tables had exactly one consumer
  while they sat in the engine. The framework-free and Lit renderers hardcode
  English, so the same button reads "Open the calendar" in one, "Open date picker"
  in another and "Toggle calendar" in the table neither of them opened. They can
  reach it now; they still do not.

- 3b6ecac: `required` and `isEmpty` agree about what empty means

  A form asks _has this been answered?_ in two spellings, and they disagreed: on a consent checkbox
  nobody had ticked, the form refused the submit with _This field is required_ while a rule reading
  `isNotEmpty` on the same box revealed the section it guarded — failing in the direction that opens.

  Emptiness now follows the kind's value contract in both halves. `false` is empty (a checkbox's
  contract says absence is not one of its values, so "not ticked" is how that field says _nothing
  yet_), an object whose every member is empty is empty (a `daterange` before either end is picked),
  and `0` stays an answer — the slider's thumb is always somewhere, which is the agreement the rest was
  made to match. ADR 0094.

  **Migration.** A rule written as `isNotEmpty` over a boolean used to fire whatever the box held; it
  now fires when the box is ticked.

- bd05055: Two rules that each show a field show it

  `applyDynamicRules` composed both effects over _switched off_: a field was out if any rule said so.
  For the negative effects that is what an author means. For the positive ones it inverts them —
  `visible when C` is _off unless C_, and two of those compose to "off unless C₁ or off unless C₂",
  which is in play only when **both** hold. An author writing "show this for a business, and also for a
  charity" got a field nobody was ever shown, submitted for nobody.

  A positive rule is a way in and any one of them is enough; a negative rule is a veto and holds whatever
  else is true. A veto still beats a way in.

  **A rule's `value` is checked against the operator that will read it.** Four of a rule's five members
  were guarded and the one the operator actually consults was not: `greaterThan` against an object, `in`
  against a string, `notIn` against a number all parsed clean in strict mode and then answered the same
  thing forever. A rule that can never fire is indistinguishable from a rule nobody wrote. Comparing
  dates is comparing strings, so a comparison on a date field requires a full ISO date — `"2026-2-01"`
  sorts before `"2026-1-10"`, and the zero padding is what hides it. The published v2 and v3 schemas say
  the same thing, so the document a schema validator accepts is the document the parser accepts.

  **`in` and `notIn` are complements.** Answering `false` to both when the value is not a list made the
  careful spelling give the same answer as the one it was written to be safer than.

  **`MdyExpressionOp` gains `in`, `notIn`, `greaterThanOrEqual` and `lessThanOrEqual`.** The flat rule
  predicate had four operators the expression tree did not know, so a document could write an operator
  nothing published could check. One vocabulary now answers both shapes. Adding members to a published
  union is breaking for an exhaustive `switch`.

- e7b5f9c: Disabling a section disables what is in it

  A schema could put a section out of play — `group(children, { when })` takes it out of the payload
  and puts it back. The imperative door could not: `setDisabled`, `setReadonly` and `setInactive`
  honoured only leaves, at every level and in both kinds of collection.

  ```js
  form.setDisabled("billing", () => !wantsBilling());
  form.f.billing.iban.disabled(); // false
  form.submitValue(); // billing is still in it
  ```

  Nothing was said. Someone who wrote that had done what the documentation shows, and the first
  evidence was on a server.

  What a binder says about a path is now answered by every field under it — a group, a collection, a
  row. The verdict is composed when a field is asked rather than pushed down when the call is made, so
  a row declared _after_ the sentence was spoken is covered by it too. `disabled` still wins over
  `readonly` at any depth.

  This is a behaviour change in the direction of the call working: code that named a container
  believing it worked starts working, and code that named one by accident now sees a section leave the
  payload. Recorded as
  [ADR 0065](../docs/architecture/0065-what-is-said-about-a-path-is-said-about-what-is-under-it.md).

- bb37b4e: A binding made from a form's handle ends when the form does

  `createFieldStore` opens an effect over a handle's signals, and a component on `useSyncExternalStore`
  subscribes to it. The store exposed its own `destroy` and that worked — but a component's cleanup and
  the form's `destroy()` race on unmount, and the consumer does not get to order them. A store still
  notifying after the form ended re-renders a component against a form that is gone:

  ```js
  const store = createFieldStore(form.f.rows.cell("a", "code"));
  store.subscribe(onChange);
  form.destroy();
  cell.set("anything"); // onChange fired again
  ```

  `MdyTypedFormBase.onDestroy(teardown)` is the affordance a binding uses to say it belongs to a form:
  teardowns run when the form is destroyed, in registration order, each isolated so one that throws
  neither stops the others nor the engine. It returns a release function, and registering on a form
  that is already destroyed runs the teardown at once — a binding built from a dead form's handle is
  dead too.

  `@modyra/react` and `@modyra/preact` register their field stores with it. Calling `store.destroy()`
  yourself still works and releases the registration, so a store you ended is not held by the form.

  Found by `battle-tests/adversarial/lifecycle/adapter-store-after-destroy.battle.test.mjs`. The other
  adapters bind through their own framework primitives and were not measured; the same question applies
  to any binding that outlives its form.

### Patch Changes

- 435a31a: A baseline moves at every level a caller can name

  `setInitialValue` took an ancestor path in the previous release and landed at some levels and not
  others: a row worked, a leaf worked, the **collection itself** did nothing and said nothing, and a
  **group** threw — with the wrong reason, `"which this form does not declare"`, sending a reader to look
  for a typo in a name they had spelled correctly.

  The collection is the level that matters: it is the one name a consumer can write without knowing what
  the user created. A phantom field sits at a collection's own path to carry collection-level errors, so
  the question "is there a field here" answered _leaf_ for exactly that level. Descendants are now
  looked for first, whether or not a field exists at the path itself.

  A group is declared, and the form now says so: what a caller may _do_ with one differs per method, but
  whether it exists is not in question.

- 76509d3: `mutate` refuses a callback that has not finished

  `mutate` exists for one promise — one history entry, not three — and it keeps it under every shape a
  batch takes, except one:

  ```js
  form.mutate(async () => { set(a); await …; set(b); await …; set(c); });
  // three undo steps, nothing said
  ```

  The batch closes when the synchronous part ends, so every write after the first `await` lands outside
  it and the caller gets exactly the history `mutate` exists to prevent. TypeScript does not stop it: a
  function returning `Promise<void>` is assignable where `void` is expected. And nothing on the calling
  side can see it — `mutate` returns `void`, so awaiting it waits for nothing, and the only symptom is
  counting undo steps.

  A callback that returns a thenable is now refused, at the call. The check reads the **return value**
  rather than a thrown error, because an async function that fails after an `await` does not raise —
  it returns a rejected promise, which is the same reason the defect is invisible to whoever writes it.

  Every other shape is unchanged: nested `mutate` still collapses into the outermost, a callback that
  throws still keeps the write it made before throwing, and a callback that changes nothing still
  records no entry.

- d2cdcaa: A disabled or readonly binding travels with its row

  `setDisabled` and `setReadonly` lived on the field record, keyed by path — and a row's path is not
  its identity:

  - a keyed row renamed from `a` to `b` arrived without the binding, and the cell the consumer had
    excluded was **submitted** again;
  - a positional row moved from index 0 to index 1 left the binding at index 0, where it suppressed the
    cell of whichever row arrived there — a value silently absent from the payload, and another
    silently present.

  Everything else a row carries crossed both — value, touched, dirty, verdicts — and a binding made
  before a row exists already waits for it, so a binding is row state rather than a subscription to a
  spelling. It now travels with the row across `rename`, `insert`, `remove` and `move`.

  What travels is the value, not the signal: the signal belongs to a control bound to the old path, and
  a control stays where it is while rows move under it. A control that follows its row states its
  binding again on the next render. See ADR 0044.

  Every handle a form hands out is also registered with its owning runtime now — collection handles and
  row trees as well as field handles — so `observerFor` no longer falls back to a fresh runtime, and
  observing one through a foreign runtime is reported rather than silently accepted.

- 894699d: A bound narrows the year picker instead of greying it out

  `calendarYearRange` widened past whatever it was given: `Math.min(min, …, 1920)`
  and `Math.max(max, …, 2120)` meant the floor was always at most 1920 and the
  ceiling always at least 2120. A field accepting 2020 to 2030 offered **207
  years**, 196 of them rendered and disabled.

  A bound is a bound now. Where there is none the span stays wide enough for a
  birth date and a far maturity, and the year on screen is always present either
  way — a view can sit outside the bounds when a value arrives from a draft or a
  server, and a picker that cannot show where it is has no way back.

  All three renderers read this one function, so all three narrow.

- f297a3c: A repeated group is refused for ambiguity, not for a variable body alone

  Refusing every repeated group whose body can match different lengths caught the exponential shapes
  and deleted ten of twenty patterns from a corpus of what form authors actually write — an IPv4
  address, a hostname, a slug, a grouped card number, a person's name — each measured flat against its
  own near miss out to two hundred characters.

  What the cheap ones have is a boundary the stretchy part cannot stand in for, so the division between
  one repetition and the next falls in exactly one place. The check reads that seam now: a body ending
  stretchy is pinned unless the ending accepts everything the body's first element does; a body ending
  fixed is pinned unless the stretchy part before it accepts everything the ending does. `\d{1,3}\.`
  is pinned — a dot is not a digit. `.*a` is not — a dot _is_ an `a`.

  `^(a+)+b$`, `^(a+){15}b$`, `^(a{1,10})+b$`, `(.*a){20}$` and `^((ab)+)+$` are still refused; a body
  this cannot take apart still is too. See ADR 0050.

  Also: `escapeLiteral` no longer escapes `-`, which is only special inside a character class and is an
  invalid escape under the `u` flag — so a hyphen compiled to nothing and `([a-z]+-)*` was refused for
  that alone.

- 09b1c21: Reading a form no longer depends on the order its fields were created in. A group, a collection and a
  section each carry a field at their own path so that what is said _about_ them — a condition, an
  error — has somewhere to live, and that field's value is always `null`. Assembling the value wrote
  paths in creation order, so when such a path was created _after_ the fields under it — which is what
  `setInactive` on a section does — its `null` replaced the whole branch, and `getValue()` threw
  "Flat value does not match schema shape" on a form that held everything it should. A path that names
  a branch no longer overwrites it.
- 6e53749: A call that could not do anything says so

  `devWarnings` is documented as reporting "the calls that could not do anything", and five doors that
  take a field name accepted one nobody declared, did nothing with it and said nothing: `patch`,
  `patchValue`, `record.upsert`, `record.patch` and `setDisabled`. A typed consumer is covered by their
  compiler; these are the doors where the keys come from data — a document, a server response, a saved
  project — and there a typo is indistinguishable from a write that landed, because the form shows what
  it already held either way.

  Each now names what it ignored, in the sentence `setValue` already used.

- 25d004c: A change set no longer carries a cell the form disabled

  `getChanges()` carries a positional collection whole, so that a server applying the patch by index
  knows which row is which. It read those rows from `getValue()`, which holds every cell disabled or
  not — so a value something had decided must not travel left through the change set while
  `submitValue()` correctly withheld it. The flat and keyed halves were already right, which is what
  kept this looking like a detail.

  The carried rows now come from the form's submittable fields and go through the same
  position-keeping walk a submit uses, so the two doors agree cell for cell. A change set may
  therefore contain a partial row, or `{}` where every cell of a row is out of play — the shape a
  submit already produced. See ADR 0102.

- 57c68d8: A check a document keeps is one that can fire

  Two rules the parser accepted and the engine could never run.

  A `validators.pattern` the platform cannot compile — `[` — passed strict mode with nothing said: the
  cost gate answers about a pattern that runs too long, and one that does not run at all went through,
  so a publishing gate approved a rule that would never exist.

  And a validation whose condition read the empty path. The empty path is the whole form value, a
  rule's `field` has never accepted it, and the half that did produced a check comparing the form
  object to a scalar — false for every value the form can be driven to. Both halves now refuse it, and
  the message names `{ "root": true }`, which is the operand that reads the whole form.

- de7e122: A path can hold live claims and waiting ones at the same time — one control bound before the row
  existed, another after. When a whole-value write ended the row, the count moving into waiting
  replaced what was already waiting instead of adding to it, so two bound controls became one.
  Releasing one of them then emptied the path while a control was still bound, and the bindings kept
  under that name — the disabled and readonly signals a consumer sets — went with it: a cell excluded
  from the payload was back in it for the row that arrived next. The same loss happened one level down,
  where a replaced nested collection ended its leaves' claims outright rather than putting them back
  in waiting.
- 45eb775: A correct document does not report that something was rejected

  The counter added so `acceptedCount + rejectedCount` describes the document treated a collection as a
  declaration that failed to become a field. It is neither:

  ```
  a leaf and a record   accepted 1, rejected 1, diagnostics []   collections ["rows"]
  ```

  A correct document reported that something had been lost, with nothing to look at — while the same
  result handed the author a `collections` list naming exactly the thing the count was about.

  A collection is _understood_, not lost: it is reported by path and kind, and its cells are not flat
  fields because a document cannot name rows that do not exist yet. It now counts as neither accepted
  nor rejected, so a rejection always has a reason beside it.

- 7ac08a7: A condition whose `operands` is not a list is refused with a diagnostic instead of throwing out of
  the reader. The shape guard recognised a _missing_ clause and not a malformed one, so
  `{ op: "equals", operands: "x" }` — the shape a missing pair of brackets takes, and what a model
  generating JSON produces — reached `.forEach` and raised `operands.forEach is not a function`,
  naming neither the document nor the field nor the clause, in lenient mode as well as strict. Lenient
  is the mode a consumer chooses precisely to survive a document they do not control.
- 4892a49: A constraint written where constraints do not live is reported

  `validators: { required: true }` is the contract's spelling. `required: true` on the field is what an
  author — or a model writing the document — reaches for instead, and the parser kept it, nothing read
  it, and the form had no rule where its author believed there was one: no validation, no `required()`
  on the handle, no `aria-required`, `ok: true` in strict mode. The same for `email`, `minLength`,
  `maxLength` and `pattern`.

  The nuance is what made it hard to learn: `min` and `max` at that level _do_ work, because they are
  legitimate members of a number field, so the same word meant two things depending on the level, and
  only for some words.

  A property whose name is a validator the contract declares, appearing where validators do not live,
  is now reported (`MDY_DYNAMIC_MISPLACED_VALIDATOR`). Unknown members are still ignored, which is what
  lets a v3 document be read by a parser that predates v3 — this is narrower: the contract already owns
  these names.

- d9203ee: `acceptedCount` and `rejectedCount` add up for the documents a host actually receives: the walk that
  counts what a document declared stopped at ten thousand declarations, so a document refused whole
  after declaring fifty thousand fields reported having lost 9,999 of them — a number short by a factor
  of five for a host reading the counts to see how much of a generated document survived. The bound
  stays, an order of magnitude higher, and a document past it now carries
  `MDY_DYNAMIC_COUNT_INCOMPLETE`: the counts are a floor and say so.
- 2904441: A pattern from a document is refused for a variable body, not only an unbounded one

  `dynamicPatternRefusal` looked for repetition with no ceiling and left a counted one alone. A ceiling
  on the outer repetition does not bound the work — it writes the exponent as a number instead of
  leaving it as the length of the input. Measured in a killable child process, milliseconds by input
  length:

                        24     26     28     30      32
      ^(a+){15}b$       85    284    960   3063   >8000
      ^(a{1,10})+b$     85    339   1353   5385   >8000
      (.*a){20}$       408   1714   6592  >8000

  Thirty-six characters is minutes, and the match is synchronous, so it is the whole thread.

  The check now reads two things: a group's body is _variable_ when it holds a quantifier whose minimum
  and maximum differ, and a group is _repeated_ when what follows it may apply twice or more, counted
  or not. A variable body repeated is refused. `(\d{2}){3}` and `(?:ab){3}` are not — a fixed-length
  body gives the engine one way to divide the input.

  A pattern refused now that was accepted before is a rule the author must rewrite; a variable body is
  necessary for the blowup but not sufficient, so a shape like `(ab?){3}` is refused without being
  exponential. See ADR 0050.

- ccde959: A declaration that raises while it is read leaves nothing behind

  A row's value is not always plain data. An ORM entity behind a lazy association, or a proxy over a
  store, raises when a column nobody loaded is read — and the key was committed to the collection
  before the row's fields were registered, so a caller who caught that error was left with two public
  reads disagreeing:

  ```js
  form.f.rows.upsert("bad", {
    get code() {
      throw new Error("not loaded");
    },
  }); // throws
  form.f.rows.keys(); // ["ok", "bad"]
  form.getValue().rows; // { ok: … }   — "bad" is not there
  ```

  A positional collection said it twice as plainly: `length()` counted the row, the value did not have
  it.

  A declaration is atomic now. If reading the value raises, a key that was new is withdrawn and a list
  goes back to the rows it had, then the error is rethrown — a rewrite of an existing row already left
  the row it was rewriting, and that is now the rule for all of them.

  Two things decided alongside, both previously unstated:

  - **A row reads the object it was given, prototype chain included.** A class instance or an ORM
    entity keeps cells on its prototype, and a row built from one has to see them. Untrusted shapes
    enter through other doors — a document, a draft, a patch — which are filtered to the paths the
    schema declares.
  - **A polluted `Object.prototype` no longer answers for a schema.** The normaliser read its
    accumulator through the prototype chain, so `Object.prototype.note` set by anything else on the
    page made `createForm({ note: field("") })` fail with `Schema key "note" is declared twice` — a
    message naming a defect in a schema that had none.

- 1c164b7: A row's template can name its own sibling in `asyncDependsOn`

  A row is a template: declared once, instantiated per key. A cell naming its sibling can only write
  the name that sibling has _inside_ the row, and that name was resolved against the form root, where
  it does not exist — so the only spelling that re-ran the check was `rows.a.code`, which a template
  cannot write, because it precedes every row and is shared by all of them. There was no correct way
  to declare a cross-field server check inside a collection.

  A `dependsOn` name now falls back to the row that encloses the clause. The absolute path is tried
  first, so nothing that resolves today resolves differently.

  A finding reported under a document's tree also names the field by the key its parent gave it, rather
  than by the placeholder the leaf reader uses.

- 5440e08: A draft discarded while the store is still reading stays discarded

  `createHydratedDraftStorage` answers reads from a cache it fills in the background. A write landing
  during hydration was already protected — it is newer than what the store held — and a removal was
  not:

  ```js
  const store = createHydratedDraftStorage({ backend, keys: ["draft"] });
  store.remove("draft");
  store.read("draft"); // null
  await store.ready;
  store.read("draft"); // "older, from the backend" — it came back
  ```

  An absent cache entry meant two different things during hydration: never set, and thrown away by the
  user. The guard read both as the first. In an app that restores a draft on startup — what
  `docs/guides/react-native.md` documents this store for — a user who presses discard before startup
  finishes finds the draft again.

  The store now tracks the keys removed while hydration is in flight and drops the arriving value for
  them. A write clears that state: a write is newer than the removal that preceded it.

  Found by `battle-tests/adversarial/persistence/hydrating-store.battle.test.mjs`.

- b9897fb: A tree document is told what a flat document is told

  The same defect written as a flat list and as a v2 tree got two answers, and the tree — the shape the
  current spec describes and a CMS sends — got silence:

  ```
  a kind nobody declared     flat: MDY_DYNAMIC_UNKNOWN_KIND       tree: kept 0, nothing said
  a select with no options   flat: MDY_DYNAMIC_OPTIONS_REQUIRED   tree: kept 0, nothing said
  a costly pattern           flat: MDY_DYNAMIC_PATTERN_TOO_COSTLY tree: kept 1, nothing said
  ```

  `strict` approved a document whose only field it had dropped — `ok: true, fields: [], diagnostics:
[]` — because `ok` follows the diagnostics and there were none. Strict mode is the check documented
  for saving a contract or accepting one into a registry.

  The tree walk now reports through the same sink the flat list does, with the leaf's own path. And the
  counts describe the document rather than what survived it: `acceptedCount + rejectedCount` equals what
  was declared, including for a schema refused before the walk runs — three children entering and
  nothing coming back used to report `rejectedCount: 0`.

  `strict` now refuses documents it used to approve. Recorded as
  [ADR 0071](../docs/architecture/0071-a-document-is-answered-the-same-in-both-its-shapes.md).

- f22d828: A document the parser accepts is one the engine can build

  A tree of nested collections deep enough passed `parseDynamicForm(…, { mode: "strict" })` with
  `ok: true` and no diagnostics, passed `buildDynamicFormSchema`, and then made `createForm` raise:

  ```
  RangeError: Maximum call stack size exceeded
  ```

  Around five thousand levels for a record, more for an array — a threshold that belongs to the stack
  rather than to the contract. The error carries no path, cannot be caught by name, and looks exactly
  like a defect in the caller's own code.

  [ADR 0043](../docs/architecture/0043-a-collection-nests-without-a-limit.md) removed the depth cap on
  purpose and made the document walk **iterative** for exactly this reason — _"a deep document is
  parsed or rejected on its own merits instead of overflowing"_. The shape check that runs when a
  collection is built stayed recursive, so the promise held on the way in and broke on the way out.

  It walks over an explicit stack now. A document the parser accepts builds, at any depth it accepts.

- f47ef54: A document nested past what the walk can carry is refused, not thrown out of

  `flattenDynamicForm` walked a document's schema recursively, so a document nesting fifty thousand
  groups raised a `RangeError` out of `parseDynamicForm` in both modes — an exception carrying no path,
  catchable by no name, and indistinguishable from a bug in the caller's own code. The layout half of
  the same parser has always answered with a diagnostic.

  The walk is an explicit stack now, in document order, so the parser's own refusals are what a deep
  document meets.

- 69b18ae: A door that takes a schema refuses what is not one, by name

  `createForm`, `buildFlatFormSchema`, `buildDynamicFormSchema` and the Zod bridge all took a schema and
  none of them checked it. Sixteen ways of getting it wrong produced JavaScript internals:

  ```
  createForm("nope")                  TypeError: Cannot convert undefined or null to object
  buildFlatFormSchema(42)             TypeError: fields is not iterable
  buildDynamicFormSchema(null)        TypeError: Cannot read properties of null (reading 'children')
  createZodForm(z.array(…))           TypeError: Cannot convert undefined or null to object
  ```

  Three different mistakes answered by one sentence naming neither the argument nor the call, which a
  consumer cannot tell apart from a defect in the library.

  Two were worse than an internal: `createForm(42)` and `createForm(true)` **built** — a form with no
  fields that reported itself valid and submittable.

  Each door now refuses by name and says what a schema is. A field list checks its entries too: an entry
  that is not an object, or names nothing, is reported instead of reaching a path check that reads
  `.length` off `undefined`. `createZodForm` and `buildZodTree` say that a form's schema has to name its
  fields, and to wrap the shape in `z.object({ … })`.

- 6690972: A hydrating draft storage does not let a form overwrite the draft it never saw

  `createHydratedDraftStorage` answers a read before hydration with `null` — "no draft", never a stale
  one — and that is documented. What was not is the other half: a form built without awaiting `ready`
  restored nothing, the person typed, the debounce fired, and the write went through the cache to the
  backend **over the draft that was still in flight**. Their earlier work was gone from the only place
  it was kept, and they were never shown it.

  A write for a key that has not hydrated is now kept in the cache and not flushed: the live form sees
  what is being typed, the stored draft survives, and the key writes through as normal once its value
  has arrived. A `remove` still goes through — it is a decision about the key itself — and leaves
  nothing for a later write to overwrite, so that write is not held back either.

- a51d3db: A save reads the draft it is replacing, and its stamp never goes backwards

  A draft key names the **form**, not the window — that is what makes a draft survive a reload — so two
  tabs of one form share it by design. A tab that had been open a while replaced a draft another view
  had saved a minute later, and stamped the replacement with the earlier time:

  ```
  tab A saves         savedAt …957878
  another view saves  savedAt …018229   ← newer
  tab A saves again   savedAt …958629   ← the record went backwards 59 seconds
  ```

  Losing the other draft is a defensible last-write-wins. The stamp is not: it is the only field a
  later reader has, and it said the opposite of what happened.

  A save now reads what is there first. The typing in front of the person still wins — discarding what
  someone is writing to keep what they are not is the worse answer — but replacing a more recently
  saved draft is reported on the development channel, and the stamp is never earlier than the one it
  replaced.

  Each write costs one read of a key the form already owns. Recorded as
  [ADR 0068](../docs/architecture/0068-a-draft-does-not-go-backwards.md).

- d51b2fa: A form does not restore a draft belonging to another form

  A stored draft records the shape of the form that wrote it, and the write side reads it: a form
  refuses to overwrite an envelope whose shape is not its own. The read side never looked, so the draft
  the writer had declined to replace was the one the reader restored — one person's unsent text
  appeared pre-filled in another person's form, and was submitted from there. Nothing was tampered
  with: both envelopes were written by this library and both shapes were recorded.

  Restore now asks the same question. The entry is left where it is rather than removed — it belongs to
  another form, which can still read it — and the write side then refuses the key under
  `MDY_DRAFT_KEY_IN_USE`. An envelope recording no shape is still restored: it is this form's own
  earlier work as far as anything can tell. See ADR 0107.

- cec751a: A value the draft cannot read does not take the form down

  Deciding whether a value may be stored walked it with `Object.values`, which _reads_ every member —
  so a field holding an object with a throwing getter raised out of the debounced write, from a timer
  nobody is awaiting, and took the form with it.

  The walk reads keys and takes each member in a guard. A member it cannot read is a member it cannot
  store either, so it answers the question the same way a `File` does: this value is not written to the
  draft.

- 0c3a770: A document's finding names the entry it is about, not the array it is in

  Every per-field diagnostic carried `path: "/fields"` — the line the array opens on:

  ```
  a duplicate name, three fields down   written on line 6, reported on line 3
  a kind nobody declared, deep in list  written on line 7, reported on line 3
  a name that is a path, on the last    written on line 6, reported on line 3
  ```

  So a two-hundred-line document assembled by a CMS sent the reader to the same line whichever entry
  was wrong, and an editor's underline stopped being worth more than the console message it duplicates.

  A finding reported while a field is being read now carries `/fields/<index>`. An envelope-level
  refusal — an unsupported version, a body that is not a list — still carries `/fields`, because it is
  about the list.

  **A duplicate names the second occurrence.** The first is legitimate until the second exists, and the
  second is the one a reader has to change.

  Nothing in `@modyra/eslint-plugin` changes: it walks the literal as far as the path reaches and
  underlines the deepest node it got to, which is why a more precise path lands correctly with no edit
  there — and the console message gains the same precision for consumers who never install it.

  Found by `battle-tests/adversarial/tooling/`.

- f47ee5e: A form built with `autoActivate: false` and hydrated before it is activated now writes its draft when
  it starts. The draft baseline — "what the user has not changed" — was taken at the deferred start,
  so everything written between construction and `activate()` became part of it and the first draft
  waited for an unrelated edit. React and Preact construct with `autoActivate: false`, so a form filled
  from a payload in the tick it was built kept nothing until the user typed, while a form that paused
  and resumed wrote on resuming. The baseline is now taken when the start is deferred, which is where
  the form's own value still is.
- b6a1325: A key the schema never declared cannot enter a typed form

  Three lines of public API were enough to make a form unable to say what it would submit:

  ```js
  const form = createForm({ name: field("") });
  form.patch({ evil: 1 });
  form.submitValue(); // threw: [modyra] Flat patch does not match schema shape
  ```

  `patch()` takes whatever a consumer received, and an undeclared member became a field. `getValue()`
  then answered with a key outside `MdyFormValue<S>` — the shape its type promises — and the next
  `submitValue()` threw on the shape check, permanently.

  The same key arrives through a restored draft, which is the door that matters: the default draft
  storage is `localStorage`, plain text and writable by every script on the origin, so a form could be
  bricked, and `fieldNames()` given a name of the writer's choosing, by data at rest. A
  document-driven renderer draws from `fieldNames()`.

  Both doors now hold the schema's line. A patch keeps only the members the schema describes, as
  `setValue()` always has. A draft restores only what the form declares — a field it owns, or a path
  inside one of its collections, so a restored order still gets its lines back. Used without a schema,
  the engine still lets a draft create fields; that is what an undeclared form is for.

- 7f847da: A form that has ended answers with one voice

  A destroyed form reported `canSubmit() === true` while `submitValue()` answered `{}` — so
  `if (form.state.canSubmit()) send(form.submitValue())` posted an empty payload from a teardown path —
  and a write arriving in the same beat landed on the handle only, leaving a control showing a value and
  an error about a form that held neither.

  `canSubmit()` is now `false` once destroyed, `submitValue()` answers from what was captured at the
  end as `getValue()` already did, and a late write is refused and reported. Reads still answer;
  nothing throws. ADR 0091.

- 3233dd4: A stored draft holding a deeply nested value is dropped and reported like any other draft the form
  will not take, instead of throwing out of `createForm`. `localStorage` is writable by any script on
  the origin, and `JSON.parse` reads a deeply nested document without difficulty — so the value arrived
  whole and the check for values a draft must not carry recursed once per level until the stack ended.
  The application got no form at all, on every load, until someone cleared the key. The walk is
  iterative, and costs a string in storage nothing to attempt.
- 1b76a2c: A field name longer than a path may be is refused at the flat door too

  `MDY_MAX_DYNAMIC_PATH_LENGTH` is 512, and it is a _length_ rather than a depth for the reason written
  where it is declared: a path is the payload key, the draft key, the widget id and a string every
  renderer carries per field, so the cost of a name is paid at every read of every value.

  The nested door held documents to it. The flat door did not — a name of 513 characters, or of a
  hundred thousand, was accepted with no diagnostic — and the flat door is the one an untrusted
  document arrives at: `fields: [{ name, kind, label }]` is the whole of version 1 and the field half
  of every version since.

  Both doors now refuse under the same code, `MDY_DYNAMIC_PATH_TOO_LONG`. A document carrying such a
  name loses that field, as it already did through the other door.

- a2a2bda: `buildDynamicFormSchema` keeps the path limit the parser reports on: a field whose declared path is
  past `MDY_MAX_DYNAMIC_PATH_LENGTH` is left out, and a group or collection left with nothing goes with
  it. The parser dropped such a field and the builder built it, so a consumer rendering the reported
  fields and holding data in the built form submitted a value with no control on any screen. Strict
  mode also stops refusing a document for a **warning**: it refuses on errors, so
  `MDY_DYNAMIC_COUNT_INCOMPLETE` — a fact about how much the reader counts, not about the document —
  no longer turns a document with nothing malformed in it into zero fields. See ADR 0043's amendment.
- 7c8e0b4: A control bound to a row a list does not have waits for it

  An array's rows follow its **value**: a write below its path is a row of it, which is how a restored
  draft or an undo brings one back. A _claim_ is not a write, and the two were indistinguishable at
  the level the reconciliation read, so binding a control to `items.1.sku` on an empty list:

  - created two rows, one of them a hole `getValue()` could not describe — it threw
    `Flat value does not match schema shape`;
  - put a row nobody declared into `submitValue()`, with a null cell.

  A virtualised table binding a row before its data arrives is exactly that call.

  A list now answers what a keyed collection answers: a claim waits for the row, and binds when it
  arrives. A value written below the path still grows the list to receive it, so drafts and undo are
  unchanged, and a row's fields now end when the collection stops admitting them rather than when a
  control releases its claim.

- eab4653: A structural change to a list resets the rows it moves, and only those

  An array rebuilt every row on every structural call — remove them all, register them again. That is
  invisible for values and expensive for everything else attached to a row:

  - a control bound to a row nothing moved **lost its claim**, and with it what a binder had said about
    the cell, so a disabled column came back enabled and was **submitted** after a push at the other
    end of the list;
  - `push` cleared the touched and dirty marks of every existing row, so the errors a form only shows
    on a visited field vanished when the user added a line;
  - `remove(9)` on a list of three — which removes nothing — did the same.

  Rows that survive a change are now written in place, and only the rows the change actually moved are
  marked clean: none for a push, from the insertion point for an insert, from the removal point for a
  remove, across the span for a move, all of them for a whole-value write. An out-of-range removal is
  no longer a change at all.

  Also fixed alongside: `submitValue()` and `getChanges()` threw `Flat patch does not match schema
shape` for any list whose row carried a disabled cell or a partial change, because the shape guard
  demanded complete rows from a value that is partial by definition.

- ade50ff: A mistake the parser reports at the top of a document is reported inside a row

  The document walk knew a node's shape and left what a _field_ declares to the flat reader, which
  never sees a cell inside a collection. So a `kind` nobody declared, or a `validators.pattern` that is
  a number, parsed clean in every mode at any depth below a row — and then met `buildDynamicFormSchema`,
  which throws, at the point where a person is already waiting.

  Every check a field gets in a flat list now applies wherever the field is, reported at its own path.

- a336b22: A field name a renderer will refuse is one the document is told about

  A widget id is built from a field's name, and the renderer refuses two things in one sentence: the
  id delimiter, and whitespace — both because `aria-describedby` is a space-separated list of ids, so
  either one splits a reference into pieces that resolve to nothing.

  The parser enforced one of them:

  ```
  "a__b", "__b"     refused where the document is read
  "a b", "a\tb"     accepted, kept, and never rendered
  ```

  An author ran `mode: "strict"`, was told the document was fine, saved it, and the field never
  appeared. Whitespace in a field name is now refused where the delimiter already was, with the same
  reason — and both messages name the widget id the rule is about, so the author learns why rather than
  only that.

  Every other name that mounts is unaffected and measured: quotes, colons, brackets, accented letters
  and a long name all associate their label and resolve their descriptions.

- 7c53545: A name the contract refuses at one door is refused at every door

  `buildFlatFormSchema` refused a field name carrying whitespace, the id delimiter or a prototype key;
  `buildDynamicFormSchema` — the tree route, the one a parsed document goes through — took the same
  name and built a form from it. Which pair of functions a consumer called decided whether their
  document worked, and a name that reaches a widget id needs the same answer either way: whitespace
  splits an `aria-describedby` reference into several, each resolving to nothing.

  The rule now lives in one place (`assertSafeDynamicName`) and both routes read it.

- 896f37b: A field name refused by the flat door is refused for the reason it was refused

  `isSafeFieldPath` grew to refuse whitespace and the id delimiter, which closed a real asymmetry — and
  made two of the three specific reasons in `assertSafeDynamicFieldNames` unreachable, because it was
  asked first and its message is the catch-all:

      "a b"     said "must not be a prototype key"   the defect is a space
      "a__b"    said "must not be a prototype key"   the defect is the id delimiter

  The verdict was right in every row and the reason was wrong in two, sending a reader to look for a
  prototype key inside `"a b"` — and disagreeing with what the parser says about the same name, which
  is the agreement `guards.ts` exists to keep.

  Each reason is now asked for by name. Pollution stays first, because `__proto__` also carries the id
  delimiter and the prototype chain is what matters about it; the specific reasons follow; the general
  path check is last.

- abb242d: A name that cannot be seen, and a path without a limit

  Two doors on the same string.

  **A name carrying an invisible character** was accepted — zero-width space, BOM, an RTL override, a
  directional isolate — so a document could declare `amount` twice, once really and once invisibly, and
  the duplicate check that exists precisely for names that collide saw two different names. The
  framework knows this class exactly: `sanitize: "text"` strips it from every **value**, and
  `security.md` explains why with `"admin‮"`, which looks like `admin` and is not. A name never met
  the sanitizer, and a name is what a value is filed under.

  **A path had no limit.** A hundred thousand nested groups parsed clean in 65ms and produced a field
  whose name was two hundred thousand characters. Nesting stays unbounded — a form's shape is the
  author's business — but a path is the payload key, the draft key and the widget id, and every read of
  that value carries it: `MDY_MAX_DYNAMIC_PATH_LENGTH` is 512, reported as `MDY_DYNAMIC_PATH_TOO_LONG`.

- bc1cc05: The devtools snapshot no longer prints what it masks

  `mdyFormSnapshot` masked a sensitive field's value and carried its error messages verbatim:

  ```js
  password: field("hunter2", [(v) => [`"${v}" is not long enough`]]);
  // value:  "•••"
  // errors: ['[validation] "hunter2" is not long enough']
  ```

  Bulleted in one column, readable in the next. Quoting what was rejected is the most ordinary way to
  write a validation message, and a server message is not the consumer's to rewrite at all.

  A masked field's value is now taken out of every error on that field — lists and numbers included,
  longest occurrence first — while the message itself is kept, because why a field is invalid is what a
  panel exists to show.

  A snapshot's values also go through `mdyFormSerialize` now, so a `File` reads as
  `[File: name (size bytes)]` rather than as `{}`, which is what the devtools guide already promised.

  Found by `battle-tests/adversarial/security/devtools-masking.battle.test.mjs`. Recorded as
  [ADR 0048](https://github.com/modyra/modyra/blob/main/docs/architecture/0048-a-panel-does-not-print-what-it-masks.md).

- 1c8e529: A snapshot describes a `Map`, a `Set` and an `Error`, and stops before the stack does

  `mdyFormSerialize` exists because a `File` carries no `toJSON`, so passing it through read as `{}` —
  the same as a field nobody filled in. Three more values had exactly that shape: a `Map` holding
  entries, a `Set` holding members and an `Error` carrying a message all serialized to `{}`. Somebody
  opens the panel to find out why a form is wrong, and the panel answered a different question. They
  are described now — `[Map: 1 entry]`, `[Set: 2 members]`, `[Error: boom]`.

  And the walk has a ceiling. Every other walk in this library has one — a path is 512 characters, an
  expression is 32 levels — and the one without was the walk whose whole promise is that reading a
  form's value never fails: at eight thousand levels it raised `Maximum call stack size exceeded`. It
  does not take a hostile value to get there, only a recursive structure from an API or a tree an
  editor built. Past 512 levels the value reads `[Too deep]`, beside `[Circular]` and `[Unreadable: …]`.

- ecca49f: A patch member that is not an array no longer deletes the rows

  `form.patch({ items: response.items })` is how a list arrives from a server, and a response that
  omitted the list hands the form an `undefined` — a `null` arrives the same way. Every row of the
  array was deleted, silently: no diagnostic, no error, nothing to notice until the next save.

  The keyed collection beside it already read such a member as saying nothing about rows, and both
  managers document that rule for whole-value writes. Only the patch path turned it into an empty
  array.

  A patch now hands the collection the value as it came: an array replaces the rows, anything else
  changes nothing, and a keyed collection reports a shape it cannot use rather than reading it as "no
  rows". Rows leave because their owner said so.

- 2e005a4: A control offers the rule's pattern, and cannot loosen it

  Two halves of one defect. `<input pattern>` is implicitly anchored — a browser reads it as `^(?:…)$`
  — and a rule's expression is not, so a rule of `a+`, which accepts any value _containing_ an `a`,
  became a control that refused `xax`: the control turned away a value the form accepts and told the
  person to match a format nobody wrote. `MdyFieldConstraints.pattern` is now the rule said the way the
  platform reads one, padded at whichever end carries no anchor, so every renderer writes the same
  attribute.

  And a control's own pattern replaced the field's outright, so a control offering `^.*$` over a rule of
  `^[a-z]{4,}$` invited exactly what the form was about to refuse. A control may ask for less and never
  for more: its pattern is taken unless it can be **shown** to loosen — a probe the rules refuse and it
  accepts. Absence of a counterexample is not a proof, and that limit is written where the probes are.

- 892c01b: A positional collection takes a whole-number position written as text. A position arrives from a
  `data-` attribute, a route parameter or a form control, and every one of those hands it over as a
  string: refusing them alongside the values that name no position at all — `NaN` from a failed parse,
  `undefined` from a lookup that missed — made `remove("1")` a call that changed nothing. What is still
  refused is text that is not a number and a number that is not whole, which is the finding this
  guard exists for.
- e35174d: Every published `MDY_*` constant is frozen all the way down

  Twenty-two of the thirty-six already were; sixteen were not, and five of those were frozen on the
  surface only — an array frozen around live objects is a table anything sharing the page can rewrite
  one entry at a time. The kind lists, the diagnostic table, the icon geometry, the four locale message
  tables and the widget relation, transition and keyboard tables are now frozen at every level, with
  `Object.freeze` written where the value is built rather than through a new shared helper.

  Nothing in this repository mutated any of them, and the documented way to change UI strings is
  `provideModyraLocale(locale, { overrides })` or a table of your own — so nothing documented is taken
  away. `contract:diff` and `test:type-surface` are unmoved, which is what says no `as const` was lost.

- 5e32e40: A field that leaves play abandons the question asked about it

  A server run is abandoned when the value stops being acceptable. A field **leaving play** is the other
  way the same thing happens, and it was not: the request stayed in flight, `pending` stayed true and
  `canSubmit` stayed false — for a field that is neither validated nor submitted. The person had
  switched a section off and was waiting for the answer to a question about a field they could no longer
  see; with a server that never answers, permanently.

  Leaving play now abandons the run, clears the pending state, and moves the run id so a late answer
  lands on a run nobody is waiting for. Coming back into play asks again.

  The watcher is a second effect rather than a condition inside the runner, and that is the point: a
  field becoming **read-only** is still being asked about, and a runner that woke on every interactivity
  change would cancel and restart a question the form never stopped asking.

- 626ec0a: A refusal names the choices in the words the person can see

  `oneOf` builds the sentence a rejected choice reads, and it built it out of the values:

  ```js
  oneOf([
    { id: 1, label: "One" },
    { id: 2, label: "Two" },
  ]);
  // "Value must be one of: [object Object], [object Object]"

  oneOf([]); // "Value must be one of: "   — a sentence that ends at its colon
  ```

  Object options are ordinary — a domain writes `{ id, label }`, and the value contracts admit them —
  so the first told a person their choice was not among two things it did not name. The second is the
  restored-draft case: a saved choice measured against a list that has not arrived yet, refused
  correctly and explained with nothing after the colon.

  A field compiled from a document now names its options by their **labels**, which is what the person
  can match against the list in front of them. `oneOf` and `eachOneOf` render an object option as what
  it holds rather than as `[object Object]`, and an empty list says `There are no choices to pick from.`
  instead of trailing off.

  `oneOf(values, message)` is untouched: a caller with better words keeps them.

- a0f68a9: A layout refusal names what was wrong, not a field that was right

  Every reason a layout node could be refused arrived at the reader as one code:

  ```
  a v3 placement in a v2 document   MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE, twice, and every
                                    name it referenced resolved
  a layout nested past the cap      the same code, naming a field the document declares
  a node with no `id`               the same code again
  ```

  An author reading it went looking for a misspelled field in a document whose fields were all correct.
  A refusal that names a cause the document does not have costs more than a vague one: it spends the
  reader's time on the wrong file.

  Each reason now carries its own code and sentence — `MDY_DYNAMIC_UNSUPPORTED_VERSION` for a construct
  the declared version precedes, `MDY_DYNAMIC_INVALID_LAYOUT` for a shape or a depth, and
  `MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE` only for a name the document does not have.

  The refusals themselves are unchanged: the same documents are refused, and only what they are told
  has moved.

- 618a7d0: An option value the published schema allows is one the parser takes, and a refusal's advice works

  Three things a refusal or a schema said were not true.

  **The published schemas allowed three scalar option values; the parser took an object, an array and
  `null` as well.** An author whose editor underlined an option got a runtime that accepted it. ADR 0051
  makes an object option deliberate — an option is keyed by what it holds — so the schemas now allow
  `object` too, and the parser refuses `null` (which cannot be told apart from no choice) and arrays
  (which the schemas do not allow). Both readers of a document now agree.

  **`buildDynamicFormSchema` told the caller to write `parseDynamicForm(document).schema`.** There is no
  `schema` on a parse result: following the instruction produced `undefined`, which produced the same
  refusal again. It names the document's own `schema` now — which is what the caller had before parsing.
  And the two shapes the refusal exists for, `{}` and `{ node: "group" }`, reached an internal instead
  of it: a root group with no children is refused by name too.

  **`setValue` said "Pass {} to empty the form deliberately".** `{}` returns every field to its
  _initial_, which ADR 0057 decided on purpose and states in its own consequences — so the message and
  the record disagreed about the same call, and the message is what a caller reads while deciding. It
  now says what `{}` does.

- 906115b: A cross-field verdict that decides `valid` can be read

  A form-level validator attributes its errors to field paths, and a keyed collection's paths are
  data — a rule about rows names `rows.a.code`, computed from a server response or a list of ids. When
  the row leaves while the rule still names it, or when the path never had a field at all, the error
  kept deciding `state.valid()` and `state.canSubmit()` and was returned by no public read: not
  `errorsFor` at its own path, not the form's own bucket, not the submit event.

  A form that will not submit and cannot say why is the one state a consumer cannot render.

  Such an error now surfaces at the form — `errorsFor("")` — which is where a _server_ error whose path
  matches no field has always surfaced, for exactly the same reason. Errors naming a live field are
  unchanged: they read at that field, as before.

- df8db70: A path is an instruction a row's shape can refuse

  A draft is written flat and read back flat, and a row named by a path the collection does not have yet
  is created to receive it — that is how a saved order gets its lines back. It also makes the path an
  instruction, and a draft lives where every script on the origin can write it.

  One extra segment was the whole attack. `lines.a.b.sku` asks for a row `a` holding a `b` holding a
  `sku`; there is no row `a` and no `b` inside a row, and both were made. The collection then held a row
  of a shape its own template never described, and with no field there to be invalid the form reported
  itself **valid, submittable and without errors** — while `submitValue()` threw `Flat patch does not
match schema shape` and `submit()` threw a raw `TypeError` from inside the engine.

  A collection now creates a row for a path only when its template declares the cell that path names: a
  group answers for its named children, a field for nothing below it, and a nested collection for its own
  subtree. A path the template does not declare is ignored and named in a development warning, rather
  than thrown — a form that refuses to open because storage holds a bad key is a denial of service with
  extra steps.

  An honest draft is unaffected: the row and its value come back as before.

- 9133c94: A row's value is shaped by its template, not by which control mounted first

  Declaring a row admitted the claims of controls waiting on it before the row registered its own
  fields, so a cell someone had mounted early was created first — and the row's value came back with
  its keys in that order. `{ note, code }` for a table whose second column happened to render first,
  `{ code, note }` for the same schema rendered the other way.

  The order is data: it is what a serialized payload carries, what a signature over that payload
  covers, and what a snapshot test compares. Rows now register their fields from the template before
  waiting claims are admitted, so the shape follows the schema and nothing about the rendering can be
  read out of the value.

- e712ea0: A row is taken apart as one change, like it is declared

  Declaring a row was made atomic; ending one was not, and they are the same hazard. On
  `@modyra/solid`, taking a row apart raised:

  ```js
  form.f.rows.upsert("r", { a: "A" });
  form.f.rows.rename("r", "q"); // [modyra] Flat value does not match schema shape
  form.f.rows.remove("r"); // the same
  form.f.lines.remove(0); // and the positional half, through setAll too
  ```

  A row ends cell by cell, so a runtime whose computations run eagerly reads the form between two of
  them and finds a shape the schema does not describe. A keyed collection's `remove` and `rename` are
  now one change each, and a positional collection batches the whole rebuild — ending rows included —
  rather than only the registration half.

  Every headless adapter's suite now renames, removes and rebuilds a two-cell row on its own
  reactivity. Found by `battle-tests/differential/runtimes/`, which could not even reach its handle
  comparison on Solid because the scenario renames a row first.

- 2066daa: A row's cells land as one change, so eager runtimes can declare a collection

  `@modyra/solid` could not declare a collection row with more than one cell:

  ```js
  createForm(
    { rows: record(group({ code: field(""), note: field("") })) },
    { reactivity: solidReactivity() }
  );
  form.f.rows.upsert("a", { code: "A" });
  // [modyra] Flat value does not match schema shape
  ```

  A row registers its cells one at a time. Solid's computations run eagerly, so one of them re-read the
  form between two cells and found a row holding some of them — a shape the schema does not describe,
  and a read that raises. One cell worked, which is why it survived: the adapter's suite runs under
  `--conditions=browser`, and nothing in it declared a collection.

  Both managers now register a row, and a whole-value rebuild, inside `batch()` where the runtime
  reports it. A runtime without batching behaves exactly as before, and the rollback added alongside
  still restores if reading the value raises.

  This was every Solid consumer with a collection. The other eager runtimes were not affected in
  measurement, but the change protects them by construction rather than by their scheduling.

- 9133c94: A row declared without a value carries the template's initial values

  `upsert(key)` states that a row exists without stating its contents, and a keyed collection's item
  descriptor is what a row is. Declaring a row that way read the row back from the engine first — and
  a row that does not exist yet reads as `null` for every cell, so the row arrived as a row of nulls
  instead of the row the template describes.

  The difference was visible in the submitted payload and in every control bound to a cell that should
  have started at its declared initial. `upsert(key, {})`, `patch` and `setAll` were already correct,
  so the same collection produced two different rows depending on which call declared them.

  Re-declaring a row that already exists is unchanged: `upsert(key)` on a declared row still keeps what
  the row holds.

- c8f3eb4: A row that carries a collection ends when its declaration is replaced

  Re-declaring a row replaces what is there — an `upsert` on a key that already names a row is not a
  patch. It held for a row of plain cells and not for a row carrying a collection of its own:

  ```js
  form.f.orders.upsert("a", { ref: "first", lines: [] });
  form.f.orders.row("a").lines.push({ sku: "S1", allocations: [] });
  form.f.orders.upsert("a", { ref: "second", lines: [] });
  // lines: [{ allocations: [], sku: null }]   — the line survived, its cell nulled
  ```

  A collection registers a field at its own path so that errors attributed to the collection have
  somewhere to surface. That field is not a leaf, so tearing a replaced subtree down by its leaves left
  it behind, and a field under a row is a row as far as the reconciliation is concerned: it declared
  the row again, holding nothing. One level deeper the form could not be read at all — `getValue()`
  threw `Flat value does not match schema shape`.

  Both managers now end the collections below a subtree they replace, at any depth, and
  `MdyNestedCollection` gained `collectionPathsNow()` to answer for them. Measured on five shapes: a
  list or a map inside a row, a map of rows, three positional levels, and the row of plain cells that
  was already correct.

  Found by `battle-tests/regressions/a-row-that-would-not-go.battle.test.mjs`; it also closes the
  keyed-nested and history generative campaigns, which had been reporting this class through a longer
  sequence.

- fe06a63: Two values that hold the same thing are the same value

  ADR 0051 lets an option carry an object, and a document carries its options in one place and the rule
  that names one in another — two hand-written literals, or two results of a single `JSON.parse`, never
  the same object. Compared by identity, a rule over such an option could not come true for any choice
  the document itself declares, and strict mode accepted it: a `visible` rule that revealed nothing
  ever, or a `hidden` rule whose field was shown to everyone with its values in the payload.

  `equals`, `notEquals`, `in` and `notIn` now compare objects and arrays by what they hold, in both
  halves of the vocabulary, depth-capped like the tree around them.

- 7695d89: A `required` that cannot refuse anything is reported

  A kind whose empty is a usable value starts at a value `required` accepts, so the rule can never
  refuse anything — `slider` is the one, and `schema.ts` says so in words. The parser took it in
  silence, so an author wrote `required` to make a choice compulsory, shipped, and the form was
  submitted by somebody who never touched the control: not a lost value, a constraint believed in and
  absent.

  Reported as `MDY_DYNAMIC_CONSTRAINT_CANNOT_FAIL`, and asked of the **kind's** empty rather than the
  field's declared initial — a row that starts with values in it is not a field whose rule cannot fail.

- 7f739f7: A validator with no `else` no longer takes the form down with it

  This is what a person writes, and it returned `undefined`:

  ```js
  field("", [
    (value) => {
      if (value === "taken") return ["Already taken"];
    },
  ]);
  form.state.valid(); // TypeError: Cannot read properties of undefined (reading 'map')
  ```

  The throw came from inside the computed every read of `valid()` goes through, so the form existed and
  could not be asked anything — not its validity, not through a renderer, not by a submit — with a stack
  pointing at the engine while the mistake sat in the consumer's own rule. The asynchronous half of the
  same idiom failed more quietly: every good value marked invalid, with the word `"undefined"` shown
  next to the field.

  `undefined` and `null` now mean no messages. A bare string is one message. Anything else — a boolean,
  a number, an object, or a list holding one — reports the value as unchecked and names the shape on the
  development channel, rather than passing the value as though the rule had run.

  `false` is read as unreadable, not as "invalid": guessing otherwise would add a second way to answer a
  rule that no adapter knows about. Recorded as
  [ADR 0061](../docs/architecture/0061-a-rule-that-says-nothing-says-nothing.md).

- 70ccff8: A rule with a bug in it is a verdict, not an outage

  A synchronous validator that threw let the write through and made `state.valid()` throw instead — and
  every later read, so the form could not be rendered. An `asyncValidators` function that threw before
  returning a promise escaped the chain the same way, and an `asyncWhen` predicate that threw took
  `createForm` with it.

  Each now behaves like the `serverValidator` path that always worked: the thrown message becomes an
  error on the field and the form stays readable, a predicate that throws lets the check run rather
  than deciding, and the engine's own refusals (`MdyComputedWriteError` and its siblings) still
  propagate by name. ADR 0090.

- 02bbad2: A run in flight when the form is paused still reaches a terminal state

  `deactivate()` tore the async runner down, which aborted a run already in flight: the promise
  resolved into a form nobody was listening to, `pending` never settled, and `canSubmit` stayed false —
  so the submit button of a form the user had finished filling in never came back, and `activate()` did
  not bring it back either. The environment the feature exists for is React Strict Mode's immediate
  mount→unmount→remount, where a validator debounced at zero is in flight exactly then.

  A pause now lets a run land: its answer is about a value a pause does not change, which is what
  "resumes exactly where it left off" means. Resuming no longer re-asks a question already answered for
  the same value and the same dependencies — and a dependency that changed is still a new question.

- e2ad213: A sanitizer asked for badly is refused, not silently the one that does nothing

  `sanitize` defaults to `"off"`, deliberately — and that default made every way of getting the option
  wrong indistinguishable from not having asked for it:

  ```js
  createForm(schema, { security: { sanitise: "strict" } }); // the British spelling
  createForm(schema, { security: { sanitize: "stict" } }); // a typo in the value
  field("", [], { sanitize: "stict" }); // the same, per field
  // markup kept, nothing said, an XSS defence off
  ```

  The profile names are a closed set, so a member outside it is not a preference — it is a request for
  something that does not exist, answered with the least protective member of the set.

  A profile that is not one of `off`, `text`, `strict` or a function is now refused, naming what was
  asked for, at the form and at the field alike. `security` refuses a key it does not have, and an
  option the form does not read — `{ sanitize: "strict" }` written at the top level instead of inside
  `security` — is reported on the development channel.

  Not sanitizing by default is unchanged: a consumer who asks for nothing still gets nothing. What is
  refused is asking for something that does not exist.

- 7c299e2: The pattern check reads the seam wherever it falls, and compares words whole

  A hold-out corpus found a hole in each direction. Refused that should not have been: a list of words
  — `(foo|bar|baz)+`, `(GET|POST|PUT)+` — because two alternatives start with the same letter, and a
  quoted comma-separated list, because the comma at the end of its body is something `[^"]` can take
  while the quote before it is not. Accepted that should not have been: `([A-Za-z]+[0-9]*)+`, whose
  pinning digits may all be absent, and `([^x]+[^y]+)+z$`, which has no boundary anywhere and holds the
  thread past a second and a half at thirty characters.

  So the seam is read in every place it falls — trailing elements that may contribute nothing are
  dropped first, the boundary is looked for across the whole fixed run after the stretchy part, and a
  body that ends stretchy is ambiguous when two stretchy elements inside it can take the same
  character. Literal alternatives are compared whole rather than by their first character; what makes
  them ambiguous is one being a prefix of another. See ADR 0050.

- 717a69e: A `sensitive` field's value is masked in its messages too, whatever shape the value has

  `mdyFormSnapshot` masks a `sensitive` field's value and removes it from that field's messages —
  masking a value and reprinting it in the next column does not mask it. It collected the literals to
  remove from strings, numbers, bigints and arrays, and a form value can also be an **object**, in
  which case it collected nothing:

      a string            rejected "•••"                                  masked
      an object           rejected {"start":"hunter2…","end":"hunter2…"}   PRINTED
      an object in a list rejected [{"pan":"hunter2…"}]                    PRINTED

  This reaches shipped kinds with no custom validator: a `daterange` holds `{ start, end }` and its own
  contract check quotes the end it could not read; `file` holds descriptors and `multiselect` may hold
  object option values. The value column and the errors column of one row disagreed about whether a
  value is a secret.

  Objects are walked now, values only and never keys — a masked key would make every message naming the
  field unreadable — with the existing longest-first ordering kept so a value containing another leaves
  no fragment behind, and a cycle guard so a self-referential value cannot hang the panel.

- e7e15c7: A secret in a collection row is treated as one

  `sensitive` reached a leaf and a leaf inside a group, and stopped at a collection boundary: a row's
  cell was printed in the panel, missing from `sensitivePaths()`, and kept out of the draft only when
  some unrelated field happened to share its name. A row is where a form most often holds a secret — a
  card per row with its CVV, a beneficiary per row with their tax id — and it is declared once, by the
  template.

  Two repairs: a row's cells declare the flag when the row is created, and the draft asks for the
  declarations on every read and write rather than copying them once (a row created later was invisible
  to a set taken before it existed). Declared secrets now match by exact path or subtree, never by bare
  leaf name — which also stops an ordinary column vanishing from a restored draft because a field
  elsewhere was a secret.

- 2bf8290: A server is asked only about a value the field's own rules accept

  Typing a tax id one group at a time — `minLength(11)`, a pause between groups — sent four requests,
  for `""`, `"I"`, `"IT"` and `"IT1"`. The form already knew all four were too short to be a tax id,
  and asked anyway.

  The debounce is not the answer: it limits how _often_ a settled value is sent, and a settled prefix is
  still a prefix. `when` could suppress them, and doing so means restating in a second predicate what
  the field has already declared — two truths that drift in silence the moment `minLength` changes.

  An async validator now runs only when the field's own synchronous rules accept the value. It is the
  rule Angular's `AbstractControl` follows and the one line missing from the comparison table, so a
  consumer arriving from there brings the assumption with them.

  A field whose value its own rules refuse reports nothing pending and holds no stale async verdict —
  an answer about a value that is no longer there is not an answer about this one. A visible
  consequence: an empty required field shows no spinner, because no check is running.

  Recorded as [ADR 0070](../docs/architecture/0070-a-server-is-asked-about-a-value-the-field-accepts.md),
  which keeps the alternative that loses: `when` is documented for exactly this and it asks a consumer
  to restate in a second predicate what the field already declared, so the two drift the moment the
  bound changes.

- 095e9ef: A stray member is reported on a layout slot, and at every depth

  `MDY_DYNAMIC_MEMBERS.layoutSlot` had no reader. A slot — `{ref, at}`, a field and where it sits — is
  the one node where the member carries the meaning: `at` says which column the field takes at which
  size, so a slot written `att` is a placement that never happens, and the document parsed clean in
  strict mode with the misspelling kept in the parsed layout and handed to whatever draws it.

  The layout was also only checked at its top. A row inside a section inside a row could carry a member
  nothing reads and nothing said so.

  The parser now walks the whole layout tree and reports at the path where the member is written —
  `/layout/0/columns/1/0` rather than `/layout/0`. A document that parsed clean in strict mode may now
  be refused; what it carried was already unread. See ADR 0097.

- 9f45e15: An envelope member no version of the contract has is reported as `MDY_DYNAMIC_UNKNOWN_MEMBER`. A
  document reaching for something the contract does not do — a `computations` slot beside the schema,
  say — parsed clean, rendered, and quietly did not do it. The check joins the five slots ADR 0097
  already covers; a member an _older_ version predates keeps its version finding, which is the more
  useful sentence.
- c7b25ce: A nested collection is read, written, renamed and restored with the row that owns it

  The row readers still stopped at a collection, so the operations that read a
  whole row and write it back could not see one: `rename` threw, and `setAll` and
  `patch` would have dropped what they could not read.

  They descend now, through the manager that owns the nested rows rather than
  through the declaration, which names no keys:

  - **rename** carries the whole subtree, and a child renamed inside one parent
    leaves the identically-named row under another parent alone;
  - **setAll** replaces — a row it does not mention goes, subtree included;
  - **patch** merges — a subtree it does not name stays where it was;
  - a **restored draft** rebuilds both levels.

  Recorded rather than fixed: undo does not cross a structural change. It does not
  at one level either, so nesting neither introduced this nor worsened it, and the
  test says so at both depths instead of leaving a skip that reads like a pass.

- 0879e90: A value of the right shape is still held to what its kind can carry, and a narrowed step offers nothing the field refuses

  Two halves of "a control may ask for less and never for more".

  **The value.** Three kinds carry a string with a form — a date is ISO `yyyy-MM-dd`, a time is
  `HH:mm`, a range is two dates — and only the _shape_ was checked, which for all three is `string`. So
  a datepicker restored from a tampered draft held `"not a date at all"`, `"9999-99-99"` or an ISO
  _datetime_, and the form called itself valid and submittable. The value still reaches the model — a
  form reports a shape it does not expect as a verdict rather than refusing the write — and now the
  verdict exists.

  **The step.** `narrowConstraints` took the higher of two steps, reading "asks for less" the way `max`
  does. A step is a lattice, not a limit: 3 over a field of 2 offers `3` and `9`, which the field
  refuses, so a person could stop on a value their own form rejects. The coarser lattice containing
  both is the least common multiple — over 2 and 3 it is 6.

- 44a23e5: `remove`, `insert` and `move` on a positional collection leave the list alone when the index is not a
  position. An index is computed — from a route parameter, a `data-` attribute, a lookup — and the
  mistakes that produce no number at all (`NaN` from a failed parse, `undefined` from a lookup that
  missed, `null`) passed the bounds check and `splice` then read them as 0: the one shape of mistake
  that yields no number deleted the first row and its values, where `-1`, `99` and `Infinity` already
  changed nothing. `insert` and `move` put the row at the front for the same reason.
- daf38f2: A control draws the value the model was allowed to hold

  `patchValue` is public, a draft is data, and a server's answer is data: a multiselect or a file field
  can be handed a string, a number or an object. The engine's own shape gate is what should object —
  the model holds it, the field is invalid, `canSubmit` is false — and that verdict only arrives while
  the control is still drawing.

  Two places read the value as a list without asking: `optionsWithUnrecognizedValues` guarded emptiness
  where its singular sibling guards shape, and `@modyra/lit`'s multiselect and file elements mapped over
  whatever they were given. Each threw from inside the effect that draws the widget, and an effect that
  throws stops running — so the control kept whatever it was showing _before_ the write, with
  `aria-invalid="false"` and an empty error list. The person had nothing to read and nothing to correct.

  A value that is not a list is now one value, which is what the singular form has always done. The
  shape gate then has something to object to, visibly.

  `optionsWithUnrecognizedValues`' `values` parameter widens to accept a bare value. The type-surface
  audit classifies that major; my own reading is that widening a parameter breaks no caller, and the
  stricter classification is the one that ships.

  `evaluateRuleCondition` compares two calendar dates as dates. Text order agrees with calendar order
  only while every part is zero-padded — `"2026-2-01"` sorts before `"2026-1-10"` — and a document
  cannot reach that, because the parser refuses an unpadded date on a date field. This function is
  published on its own, and a caller comparing a date out of their own model has no parser in between.

- d6a97f6: Removing an asynchronous validator takes its verdict with it. The memo that stops a resumed form from
  re-asking a settled question remembered the value, the watched dependencies and the wake counter, but
  not the validators the answer came from — so removing one looked like the same question again and the
  memo answered from the run before, leaving the error a removed check had reported on a field nothing
  was checking any more.
- ca1c6c3: A document whose `version` this reader does not have is refused as a version: it reports
  `MDY_DYNAMIC_UNSUPPORTED_VERSION` at `/version` naming the version it carries, in both the flat and
  the tree form. A tree document from a publisher one version ahead was refused as a malformed field
  list, sending its host hunting for a broken field that does not exist. The flat reader also accepts
  version 4 — v4 is v3 plus per-node conditions — and its message names all four versions instead of
  three.
- aa3574c: A whole value that names none of the form's fields is refused, not obeyed

  `setValue` refuses a string, a number, `null`, `undefined` and an array. An object was the one shape
  it let through, and a wrong-shaped response is an object:

  ```js
  form.setValue({ emial: "x" }); // one transposed letter
  form.getValue(); // every field back to its initial
  form.state.valid(); // true
  ```

  The rule that a field the value does not name returns to its initial then emptied the form, silently,
  with nothing said on either channel — which is the erasure the argument check was written to close.

  A whole value naming none of the form's fields now throws, and names the keys it did not recognise.
  `setValue({})` is unchanged: it is the spelling for emptying a form deliberately, and it is what a
  caller who means that writes. A value naming some of them writes those and reports the rest on the
  development channel, because a server that renamed one field is the ordinary way this happens.

  Recorded as an amendment to
  [ADR 0057](../docs/architecture/0057-an-argument-is-refused-where-it-arrives.md), whose Security
  section claimed a protection the decision did not yet deliver.

- c464e35: An argument is refused where it arrives, instead of failing somewhere else

  Seven public entry points accepted a value they could not use, returned normally, and left the form
  to fail on a later read with a message naming an engine internal.

  ```js
  form.setDisabled("rows.a.code", true); // the documented shape is () => true
  form.state.valid(); // TypeError: disabledSignal(...) is not a function
  ```

  `setDisabled`, `setReadonly` and `setInactive` now refuse anything that is not a zero-argument
  function, naming the parameter and what to wrap. `addValidators`, `upsertValidators` and
  `upsertAsyncValidators` refuse anything that is not an array of functions. TypeScript declared these
  parameters all along, so a typed consumer is unaffected — this is the adapter-facing surface, where a
  framework's ref reaches the engine untyped.

  `setValue` refuses a string, a number, `null`, `undefined` or an array: none of them is a whole form
  value, and every one of them used to empty the form while `state.valid()` went on reading true. A
  field the new value does not name now returns to its initial rather than to `null`, which is the rule
  `reset()` already follows — `explainValueMismatch` called the old result `text cannot hold null`. A
  consumer who relied on `setValue` to null a field that declares an initial must now write the null.

  `setInitialValue` refuses a baseline of a different shape from the one the schema declared. An
  initial is what `reset()` returns to and what `dirty` measures against, so one the field cannot hold
  is a form that can never be clean and can always be reset into a value its own contract forbids.

  Recorded as [ADR 0057](../docs/architecture/0057-an-argument-is-refused-where-it-arrives.md), which
  states the residual gap: a field whose schema declared `null` accepts any initial, because a typed
  schema carries no kind to check against.

- bbf6081: A list grows to receive the next row, not to reach a number

  A draft is read back flat, and a path for a row the list does not have yet made the list grow to reach
  it. `tags.5` on a list of one produced `["t", "", "", "", "", "X"]` — five entries nobody typed — and
  the number came from storage, which anything on the origin can write. It is not linear: a list of
  50,001 took five seconds to restore and a large enough index stopped the form opening at all.

  A positional collection now grows by the row a path names and only when that row is the next one. A
  write that legitimately carries a list carries every index in it.

  **A flat write is applied in path order**, numerically where a segment is a number. Object key order
  is the order a document happened to be serialised in; sorting makes a write's effect the same
  whichever order it arrives in, which is what lets a list grow one row at a time without depending on
  how storage was written.

- b5c81b7: An object with no members is not empty

  ADR 0094 made an object whose every member is empty read as empty — a `daterange` before either end
  is picked. The rule caught `{}` with it, and `{}` is a form root before any field exists rather than
  a field nobody filled in, so the root of a form stopped reading as a value that exists.

  Emptiness now needs something to be empty _of_: a value with members, all of them empty.

- 315a533: A document's predicate reads what a field could name

  `MdyExpression` addresses fields by path and was the one door that did not consult the engine's path
  guard:

  ```js
  evaluateExpression(
    { op: "isNotEmpty", operand: { path: "constructor" } },
    {}
  ); // true
  validateExpression(
    { op: "equals", operands: [{ path: "__proto__" }, 1] },
    "doc"
  ); // no issues
  ```

  An empty form has no cells, and a predicate asking about one answered `true`, because the read walked
  the prototype chain. Nothing is written and nothing is polluted — what moves is which branch a
  document says applies: a rule that should never fire fires, a section that should be hidden shows.

  `validateExpression` now applies `isSafeFieldPath` to every `{path}` operand, so a document carrying
  `__proto__`, `prototype` or `constructor` is refused where it is read; `expressionPaths` omits them,
  since a path the engine will not register is not a dependency; and `evaluateExpression` answers from
  the value's own properties.

  `""` is unchanged and still means the root value, which is how a form-level rule reads the whole
  object.

  Found by `battle-tests/adversarial/security/expression-paths.battle.test.mjs`. Recorded as
  [ADR 0047](https://github.com/modyra/modyra/blob/main/docs/architecture/0047-an-expression-reads-what-a-field-could-name.md).

- 30d8a97: An initial value is checked where the document declares it

  A collection's initial was measured against its own shape — a record wants an object, an array a list,
  each refused by name — and a field's was measured against nothing. `{ kind: "text", initialValue: 42 }`
  passed in the strictest mode there is and produced a form that was invalid before anybody touched it:
  `{"a": 42}`, `valid: false`, _"This field holds string"_ on a value the user never entered and cannot
  see how to correct.

  The knowledge was already published and used one layer later — `explainValueMismatch` is the sentence
  the engine says about a value that arrives at runtime, and a declared initial is that value arriving
  earlier. Both parser doors now say it: the flat field list and the schema tree.

  `buildDynamicFormSchema` drops an initial its kind cannot hold and names it in a development warning,
  starting the field from the kind's own empty value. Dropped rather than thrown: a form is the thing a
  person is looking at, and refusing to build one takes the whole page away.

- c0e0348: An operand that names more than one of `{path}`, `{self}`, `{root}` and `{context}` is refused where
  an expression is validated, and each guard answers `false` for it. One carrying two was claimed by
  two guards at once and parsed clean, so which half it meant was decided by the order a reader
  happened to ask in — a document meaning one thing here and another in the Rust or Java reader of the
  same contract, on a document all three accept. A context key of no characters is not a context
  reference either: the guard now agrees with the validator that has always refused it. See ADR 0092's
  amendment.
- 49cebaa: An operand that claims to be a reference and is not decides nothing, and the panel describes what it cannot read

  Three repairs to the same rule — _a question with no reading is not answered with the one that opens_:

  - `{ context: 123 }`, `{ self: "yes" }`, `{ root: 1 }`, `{ path: 4 }` reached the literal branch and
    were compared as the objects they are — never empty, never equal — so `isNotEmpty` answered `true`
    and a section governed by a misspelled operand was shown to everyone. They now decide nothing, the
    way an unknown operator does. An object with none of those members stays a literal: an option's
    value may be an object and a membership list is an array.
  - `isPathRef` required the member to be _present_; `{ path: 4 }` then took the read down inside
    `memberAccess`, where a number has no `split`.
  - A context key that throws when read — the bag belongs to the application, so in a real one it is a
    store, a signal or a Proxy — no longer takes the whole form read with it.

  And `mdyFormSerialize` describes a value it cannot read, as it already described the ones it cannot
  carry: an accessor that raises becomes `[Unreadable: <member>]` with the rest of the object intact, a
  `toJSON` that fails names itself, and an object that refuses enumeration is described rather than
  raising. The panel is what a developer opens when something is already wrong.

- 7d5dc5b: An option a field does not read is reported, the way a form's is

  `createForm` names an option it does not know — the decision that a misplaced one must be said was
  already taken, and for this reason: it is indistinguishable from not having asked. `field()` did not
  follow it, and the contrast lived inside a single option:

  ```
  sanitize: "strict"    the value is sanitized
  sanitize: "stict"     refused by name, at construction
  sanitise: "strict"    built, never sanitized, nothing said
  ```

  `sanitise` is the British spelling and the ordinary way to get it wrong, and it left a field
  unsanitized while its author believed otherwise. `asyncDebounce` for `asyncDebounceMs` is the same
  shape at a different cost: every keystroke reaches the server.

  Said rather than refused, because the bag grows with the library.

- 8802f09: An option `createForm` does not read is reported to the diagnostics sink when one was given, under
  `MDY_UNSUPPORTED_ADAPTER_OPTION`, instead of only to the console. A consumer who supplies a sink
  asked for these as events, and this was the one degradation that could reach nothing else — the first
  thing a host wants routed, since a misplaced option looks exactly like not having asked.
- 67aa107: An option list the contract cannot read is refused where the rules are compiled

  A host that assembles its own fields — rather than parsing a document — could hand `select`, `radio`,
  `multiselect` or `segmented` an option list of bare strings. Each option's `value` is then
  `undefined`, so the compiled rule rejects every value, and the sentence a person read was:

  ```
  Value must be one of: undefined, undefined
  ```

  A prefilled value arrived rejected, with `aria-invalid="true"`, for a list the author believed they
  had declared. Omitting the list entirely was worse: `Cannot read properties of undefined (reading
'map')`, an engine internal surfacing on a caller's mistake.

  `parseDynamicForm` already refuses both with `MDY_DYNAMIC_OPTIONS_REQUIRED`; the compiler now agrees.
  It throws rather than dropping the field, because a caller on this path has no document to report a
  diagnostic about — the parser has a channel and uses it, and this door does not.

  An empty list is still accepted: a select whose choices arrive later is legitimate, and the published
  schema allows it.

- 85ff99a: An overlapping alternative is refused however it is written

  The pattern guard compared a repeated alternation's branches by their first characters, and gave up
  at a character class — so the same ambiguity written as a class walked through:

  ```
  ^(a|a)*$          refused
  ^([a-z]|[a-z])*$  allowed — 279ms at 22 characters, 4.5s at 26
  ^(\w|[a-z])*$     allowed — 338ms / 5.4s
  ```

  Roughly ×16 per four characters: the exponential signature, not a slow pattern. The last one is what
  makes it ordinary rather than contrived — nobody writes `(a|a)`, and people do write "word characters
  or letters" without noticing the second is contained in the first.

  Branches are now compared by **what they accept**: a class, a class escape (`\w`, `\d`, `\s`), a dot
  and a literal are four notations for a set of characters, and two branches are ambiguous when their
  sets share one.

  The line that keeps this usable is unchanged and pinned: `^([a-z]|[0-9])+$`, `^([a-z]+|[0-9]+)$` and
  `^(.|\n)*$` are **not** refused — a digit is not a letter, and `.` does not match a newline. A branch
  beginning with a nested group or a backreference stays undecidable and allowed.

  Found by `battle-tests/adversarial/security/overlapping-alternatives.battle.test.mjs`, which also
  pins the boundary.

- ad86c08: Asking for strict either gets strict or gets told

  `parseDynamicForm(document, { mode: "STRICT" })` — or a bare `"strict"` where the options object
  belongs, or `null` — was read leniently and answered `ok: true`. A publishing gate asks for strict
  precisely so a partly valid contract does not go out, and a typo in the request turned that gate into
  a pass.

  A mode this reader does not know is now reported (`MDY_DYNAMIC_UNKNOWN_PARSE_MODE`) and makes `ok`
  false. It is a report rather than a throw, because this parser's whole design is a report.

- 5589197: A value a kind cannot hold is refused by whichever builder made the form

  `buildDynamicFormSchema` attaches each kind's shape guard to every leaf it makes; `buildFlatFormSchema`
  attached none. Both are published, and the flat one is where `flattenDynamicForm`'s output goes — so
  the same document, flattened and rebuilt, stopped refusing values its kinds cannot hold. Measured:

      datepicker holding "not a date at all"    tree: invalid    flat: valid

  A value from outside the control is where this lands — a tampered draft, a server response, a
  scripted write — and the form called itself valid and submittable, depending only on which of the two
  builders the consumer called.

  `buildFlatFormSchema` now attaches it too. It is not one of the document's validators — those stay in
  `applyFlatValidators`, a separate call by design — it is what the _kind_ is, exactly as the `shape`
  option beside it already was.

- 9f29b19: The cross-runtime guard survives a second copy of the package

  `observerFor` catches a binding observing a handle through a runtime that does not own it, by reading
  a module-level `WeakMap` of owners. A module-level map is per module _instance_: two copies of
  `@modyra/core` in one dependency tree — what a package manager builds whenever two dependents need
  versions it cannot deduplicate — are two registries, so a handle registered in one is unknown to the
  other. `observerFor` reports only when it can see an owner that differs, so an unknown handle is one
  it says nothing about, and the guard turned itself off in exactly the tree it exists for.

  The registry is now keyed by `Symbol.for("modyra.handle-registry")`, so every copy loaded in one
  realm shares one pair of maps, and read defensively so a copy of another version with a different
  shape is not trusted. See ADR 0105.

- bda72f8: A name the contract refuses at one door is refused at every door

  The name rule has three halves — a safe path segment, no id delimiter, no whitespace — and only the
  flat field list applied all three. A tree child and a collection's row key were checked for the
  prototype half alone, so `{ children: { "  ": … } }` parsed clean where the same name in a flat list
  was dropped, and a row key like `"a b"` flattened into a path `buildFlatFormSchema` then refused —
  one document, two build routes, two answers.

  The whole rule now applies wherever a document names something (`isSafeDynamicName`), so which shape
  an author wrote no longer decides whether their mistake is caught.

- d2e0d7f: A keyed collection keeps one declaration order. Two operations move a key without adding or removing
  one — an undo that puts a row back where it was, and a rename that gives a row the old key's place —
  and both wrote the new order into the list `keys()` reports while the declared set kept the order the
  keys were first declared in. The set is what a whole-value write and the value itself read, so a form
  looked correct until the next `setAll`, which restored an order the user had already undone —
  arbitrarily far from the operation that caused it. `keys()` remains the only surface that can answer
  the question at all: a value is a plain object, and JavaScript puts an integer-like key first however
  it was written.
- 556517c: A field reports each message once, however many rules say it

  The kind's own shape guard is attached by the schema `buildFlatFormSchema` produces _and_ by
  `applyFlatValidators`, which applies a document's validators — and calling both is what the flat
  route documents. A field holding the wrong shape then reported `This field holds number` twice, once
  per call.

  Two rules that say the same sentence are one thing for the person to fix, so a field's synchronous
  errors are reported once per distinct message. Nothing about which rules run changes.

- 4749edc: An empty array in a patch says so while it is still recoverable

  `form.patch({ rows: {} })` changes nothing and `form.patch({ list: [] })` empties the list. Both are
  their kind's reading — a keyed collection merges by key, so an empty object names none; a positional
  one is carried whole, because an index _is_ a row's identity and a partial list would be an ambiguous
  PATCH rather than a partial one — and the difference is invisible until a consumer who learned the
  first writes the second and loses their rows.

  The behaviour is unchanged, deliberately: the array branch of `MdyFormPatch` is already declared
  whole-list, and making `[]` a no-op would leave no spelling for "this list is now empty" in a patch.
  What changes is that the destructive reading is no longer silent — in development, emptying a
  non-empty positional collection through `patch` names the collection, the number of rows, and the
  reason the two kinds differ. The guide's operation table and its collections section say the same.

- eacc848: One set of layout sizes, not four spellings of it

  `base | sm | md | lg` was written four times: once as the document's type, twice
  as inline arrays validating that document, and once more as the keys of the
  widget contract's breakpoint table — whose comment said it was mirroring the
  other, by hand.

  The set is declared once, in the layer both reach, and derived from there.
  `MdyLayoutBreakpoint` and `MdyLayoutSlotPlacement` are now aliases of the
  document's types rather than restatements of them; they resolve to exactly what
  they resolved to before, so no consumer changes.

  Adding a size is now a compile error until every table carries it, and removing
  one is a compile error at the declaration. The constraint sits inside
  `Object.freeze` rather than on the binding: a literal handed to a call is no
  longer fresh, and an annotation there would accept a key the union had dropped —
  which caught the addition and missed the removal.

- 83e94a5: A value is sanitized the same number of times whichever door it came through

  Every write that went _through_ a collection ran the field's sanitizer twice: `setInitialValue`
  sanitized into the baseline and the record then seeded itself from that baseline through the
  sanitizer again. Those are the doors a form is _populated_ by — a server response, a loaded record, a
  row added.

  It was written off on the grounds that a sanitizer is idempotent. DOMPurify is; escaping is not, and
  escaping is what a text sanitizer does, so four load-and-save rounds with nobody touching the field
  turned `Tom & Jerry` into `Tom &amp;amp;amp; Jerry` — a value nobody typed, with no moment at which
  anyone got it wrong.

  A declared initial is sanitized once, where it is declared; re-baselining a collection no longer
  rewrites a value the field is already holding.

- 50e1211: One visit declares a row, and a record's cells are owned like an array's

  Both collection managers wrote the same recursive walk — sanitizer, initial
  value, validators, composed conditions, async runners — and the copies had
  already drifted: only the array told the form that the row _owns_ its cells, so
  the sentence `MdyCollectionHost` states about ownership was true of one
  collection and not the other.

  Nothing in the value showed it, because the path gate refuses a removal before
  ownership is consulted. That is how the difference survived, and it is why the
  rule is now asserted for both kinds rather than assumed from one.

  The walk lives in `collections/register.ts`, recursive over a row's shape, with
  what to do about a collection inside a row handed in by the caller — the part
  the two kinds do not share, and the part still being built.

- 2707f44: A path is in play only when every collection above it admits it

  The engine answered a path from the first gate whose prefix matched, in
  registration order. With one collection that is the collection; with two, a
  child registered before its parent admitted paths the closed parent refused —
  neither the innermost nor the outermost, but an accident of construction order.

  Gates compose now, outermost first: refused if any of them refuses, and a
  whole-value write is offered to the outer collection before the inner one is
  asked anything, because a row cannot be declared inside a parent row that does
  not exist.

  It is the sentence `conditions.ts` already states about sections, over a
  different set of ancestors.

- 87ff0a4: `MdyFormPatch` lets a patch name one cell of one row

  `patch()` merges what it carries into a keyed collection and leaves the cells it does not name
  alone — that is what the record manager does and what the type's own description ("deep partial of
  the schema value") says. The record branch of `MdyFormPatch<S>` nevertheless required the complete
  row, so `form.patch({ rows: { a: { sku: "A" } } })` did not compile against a row that also declares
  `qty`, and a consumer had to cast to write the documented call.

  The branch is now a deep partial of the row. Positional collections are unchanged: a whole-array
  write states which rows there are, so it still takes complete item values.

  Found by typechecking a consumer installed from a packed tarball under `strict`.

- 3c7f88f: `getValue()` and the `value` signal answer after `destroy()`

  `destroy()` removes every field, so building the value from the engine's flat map produced a shape
  the schema does not describe and the read threw `[modyra] Flat value does not match schema shape` —
  for every schema shape, including a plain one.

  Teardown is a read path. A renderer unmounts while a computed evaluates once more, a component logs
  what it held, a cleanup handler saves it: all of them read a form that has just been destroyed, and
  an internal invariant's message is not an answer.

  Both now return what the form held when it was destroyed. `submitValue()`, `state`, `fieldNames()`
  and `getChanges()` already answered and are unchanged.

- d9583ff: `mdyFormSerialize` describes a `BigInt` instead of raising on it

  `JSON.stringify` refuses a `BigInt` outright, so a form holding one stopped every reader of its
  value that serialises — including the devtools panel, whose render effect froze on its previous
  paint. It is now described the way a `File` is, `10n` becoming `"[BigInt: 10]"`, which keeps it
  distinguishable from the number `10`.

  No migration: values that serialised before are unchanged.

- d51b2fa: The browser battle tier builds the stylesheet it copies

  Second missing build in the same chain: with core built, the host build reached
  `packages/styles/dist/modyra-default.css` and found nothing there. `battle:browser` and
  `battle:browser:ci` now build styles too. Verified by deleting `packages/core/dist` and
  `packages/styles/dist` and running the CI script in its exact form: 191 green, 59 red, 0 new.

- 8e5fef8: The browser battle tier builds the engine before reading it

  `battle:browser` and `battle:browser:ci` began at `build:plain`, which compiles widgets and plain and
  not core. On a fresh checkout — which is every CI run — `@modyra/core` had no `dist`, so the browser
  tier failed at its first compile with 81 "Cannot find module '@modyra/core'" errors and never reached
  a battle. Locally it passed because a previous build had left the directory there, which is the same
  trap the node tier's own gate exists to catch.

  Both scripts now build core first. Measured with `packages/core/dist` moved aside: 81 errors before,
  0 after.

- c8c8470: `canUndo` and `canRedo` answer for the value as it is now

  `undo()` records any change the snapshot effect has not seen before it pops, so a row declared,
  removed or renamed is undoable in the task that changed it. The two signals a consumer binds an
  Undo and a Redo button to were still answering for the last state the scheduler had seen.

  The gap was reachable from ordinary code: a click handler that adds a line and a toolbar that
  re-reads its own state run in the same task, so `canUndo()` read `false` while `undo()` would have
  removed the row. Its mirror lit a Redo button after an edit that had already invalidated the redo
  stack, offering an operation that did nothing.

  Both are now derived from the current value rather than stored, so the affordance and the operation
  answer the same question. The cost is one value comparison per read after a change, on signals a
  consumer reads to paint a button.

- e712ea0: A document the contract accepts is a document the engine builds

  Removing the document's depth cap made `validateDynamicSchema` iterative, because untrusted input
  must not decide how much stack the engine uses. The walks that run _after_ it were left recursive, so
  a deep document passed every check the contract offers and failed when it was used:

  ```js
  parseDynamicForm(deep); // ok, no diagnostics
  flattenDynamicForm(deep.schema); // ok
  createForm(buildDynamicFormSchema(deep.schema)); // RangeError: Maximum call stack size exceeded
  ```

  A stack overflow is not a refusal a consumer can act on: it names no path, cannot be caught by kind,
  and is the same error their own bug produces.

  `buildDynamicFormSchema`, `walkSchema`, `collectItemPaths`, the collection-validator registration
  walk, the row-shape check and the schema normaliser now walk over explicit stacks. A document nesting
  100,000 levels parses, builds and creates a form.

  **What is still bounded**: instantiating a row at _every_ level, since each level's manager builds
  the next while its own call is on the stack. Measured, that holds past 200 levels and gives way
  somewhere before 1000 — against forms that hold two or three levels in practice. The limit is the
  runtime's stack rather than a rule of the contract, so no number is pinned in a test.

  Found by `battle-tests/adversarial/security/nesting-depth.battle.test.mjs`.

- 5029184: The guides describe the whole-value write the engine performs

  ADR 0057 changed what `setValue` does with a field the passed object does not name — it goes back to
  its **initial** rather than to `null` — and said so in its own consequences. Two published guides went
  on saying the old thing:

  ```
  docs/guides/troubleshooting.md   "fields absent from the passed object are reset to `null`"
  docs/guides/typed-forms.md       "schema fields absent from `v` are reset to `null`"
  ```

  The troubleshooting one costs more, because it sits under _"Why did my value reset to null after
  `setValue()`?"_ — a person reads it while already confused, is told to look for a `null`, and finds
  the field's initial.

  Both now describe the write that happens, and both mention the other half of the same decision: a
  whole value naming none of the form's fields is refused rather than obeyed.

- ca1c6c3: `spec/dynamic-form-v2/v3/v4.schema.json` no longer require `name` on a field written in the tree
  form: there the parent's key is the name, which is why the type declares
  `field: Omit<MdyDynamicField, "name">`. The published schema demanded the member the type removes, so
  an editor — `apps/vscode/package.json` points every `*.form.json` at it — underlined a working
  document, and following the editor meant writing a name the parser does not read. The flat list still
  requires it, where the field carries its own name. `npm run test:contract-schema` now reads the v4
  schema and the v4 fixture corpus, and takes each version's slots from that version's own type, so
  `requiresContext` is a slot the gate knows about.
- 07bea5d: The published document schemas nest the way the engine does

  [ADR 0043](https://github.com/modyra/modyra/blob/main/docs/architecture/0043-a-collection-nests-without-a-limit.md)
  removed the one-positional-level rule from the engine and the parser. The **published JSON Schemas
  kept it**: `spec/dynamic-form-v2.schema.json` and `v3` accepted a record as an array's row and
  refused an array, with the reason written in the description.

  So a consumer validating a document against the schema Modyra publishes was told their document was
  invalid while `parseDynamicForm` accepted it — the two answers a contract exists to keep identical,
  disagreeing about the shape the release's headline feature is _for_.

  Both schemas now admit a collection of either kind as a row, and `spec/fixtures/dynamic-form/v3/positional-nesting.json`
  carries the shape that distinguishes them: an array whose **item is an array**, as against one
  reached through a group, which was always legal. `scripts/audit-contract-schema.mjs` fails on that
  fixture against the old schema, naming it — so the two verdicts are checked against each other rather
  than assumed to agree.

  The Rust and Java SDKs still enforce the removed rule and are reported separately.

- c849c60: The Rust and Java SDKs nest the way the engine does

  [ADR 0043](https://github.com/modyra/modyra/blob/main/docs/architecture/0043-a-collection-nests-without-a-limit.md)
  removed the one-positional-level rule from the engine, and the published SDKs kept enforcing it —
  the same divergence the JSON Schemas carried, one layer further out and shipped as a package:

  ```
  {"node":"array","item":{"node":"array", …}}     MDY_DYNAMIC_INVALID_ARRAY
  {"node":"array","item":{"node":"record",
                          "item":{"node":"array", …}}}   MDY_DYNAMIC_INVALID_RECORD
  ```

  An author whose document the runtime accepts was told by their SDK that it was invalid. Both now
  accept a collection of either kind as a row, at any depth.

  **Rust also carried the removed depth cap**, and its walk was recursive — where a document deep
  enough would end the process rather than raise something a caller can answer. It walks over an
  explicit stack now, with no cap, matching what the engine's own parser was changed to.

  **Java's cap moves from 8 to 100 and is named for what it bounds.** Its walk is still recursive, so
  the limit is about what this parser can process rather than about the contract — stated as such in
  the code. A residual divergence remains at depths no arranged form reaches: the engine accepts more.

  The `positional` flag that carried the old rule is gone from both rather than threaded through inert,
  and each SDK's test for it now states the rule that replaced it, with a refusal it still makes
  asserted in the same run.

  Verified: `cargo test` 11 passed, `./mvnw test` 22 passed.

- 2b04e24: Eighteen subpaths removed at a patch version

  `@modyra/core` goes from twenty subpath entries to six and `@modyra/widgets` from
  six to three. Under semver that is a major; it ships as a patch because the
  library has no consumers and every import that would break is in this repository
  and was updated alongside.

  The complete migration table and the reasoning are ADR 0039 — including why this
  is bounded to one release rather than a habit, and how "no consumers" was
  established rather than assumed.

  Three subpath families moved to a different package (`@modyra/widgets` for the UI
  vocabulary, `@modyra/styles` for the colour arithmetic); the rest were entries
  whose every export was already reachable from the package's main entry, so they
  were a second door rather than a second surface.

- 4bc6e19: A document declaring `version: 1` reports `MDY_DYNAMIC_DEPRECATED_VERSION`: no published schema
  describes v1, no fixture measures it, and the Rust and Java readers of this contract do not have it.
  It is a warning, so a v1 document still parses and still renders — a bare field array, which declares
  no version at all, is unaffected. A v2 or v3 document carrying `requiresContext` is reported too: it
  arrived with v4, and all three readers now say so.
- 74dbda3: `getChanges()` withholds a field that is out of play, as `submitValue()` does

  Both answer _what leaves this form_, and they disagreed: a field taken out of play — by a document's
  rule, by `setDisabled`, or by `setInactive` — was withheld from `submitValue()` and carried by
  `getChanges()`, so a PATCH built the documented way sent exactly the value a submission refuses to.

  The value is still held and still reported by `getValue()`, which is the total read.

- 8347116: A document offering one value twice is told so

  Two fields sharing a name are refused, because a name builds an id and two ids that collide stop
  being addressable. An option's value builds an id the same way — `s__option__pro` — and nothing
  checked it, so `[{pro, "Pro monthly"}, {pro, "Pro yearly"}]` parsed clean, kept both, rendered one,
  and left a submitted `"pro"` naming two different things.

  The later duplicate is dropped with `MDY_DYNAMIC_DUPLICATE_OPTION`, the way the later of two fields
  with one name is. Values are compared by what they hold, so two objects declaring the same members
  are one option however they were written, and the document the caller passed is never edited.

- 9133c94: A `disabled` or `readonly` binding survives the row it was made on

  A keyed collection lets a control bind before its row is declared — a cell handle exists and stays
  inert until the key arrives, and a claim waits with it. What a control said about the field did not
  wait: `setDisabled` and `setReadonly` lived on the field record, which the row owns, so the binding
  was dropped when the row arrived and again whenever a row was removed and re-declared under a
  control that never moved.

  The result was a field the binder believed was disabled, enabled and **submitted**. That is a
  payload difference, not a cosmetic one.

  Bindings are now kept beside the record, keyed by path, and re-applied to every record built for that
  path. They last as long as something is bound there — a claim, or a claim waiting for its row — and
  are released with the field when nothing is.

- 14d74cc: `acceptedCount + rejectedCount` is what the document declared

  The pair is worth reading because it lets a caller tell "three fields, one refused" from "two
  fields". For a document whose fields all live inside collections it said neither:

  ```
  v3/nested-collections.json   accepted 0, rejected 0   — it declares five fields
  v3/positional-nesting.json   accepted 0, rejected 0   — it declares four
  ```

  Both are published fixtures, both parse cleanly, and both have their collections found and reported.
  A field inside a collection is declared and legitimately never becomes a flat field — a document
  cannot name rows that do not exist yet — so `fields` cannot answer for it, and the pair was the one
  place that could.

  The count now descends into collections, and a rejection is counted from what was **reported** rather
  than from the difference between declared and kept: counting the difference would call every
  collection cell a rejection, and a correct document would read as having lost everything.

  A collection itself still counts as neither — it is understood, and reported by path and kind.

- c48c9c1: A bulk write into a keyed collection costs what its rows cost: 2,000 rows in one `setAll` went from
  about 1,600ms to about 70ms, and the per-row cost stopped growing with the row count. Three things
  were quadratic and each was paid once per row: the gate over the collection was re-read after every
  row, walking every claim and every field the form holds; the published key list was copied for each
  key; and `fieldNames` was a list copied for each field created. The gate is re-read once per bulk
  write, the key list is published once from the set that already answers `has()`, and `fieldNames` is
  derived from the fields the engine holds behind a version counter, so a reader inside a batch pays
  for the list once instead of once per row. Nothing about what the collection holds changed.

## 2.1.2

### Minor Changes

- 34d5023: A document's collections survive the flattening: an array reads back as a list.

  The dynamic contract carries a nested form as fields named by path, and ADR 0031 left one limit open
  in writing: a path cannot say whether `lines.0` was an array row or the record key `"0"`, so only
  groups were reconstructed and a document's array came back as an object keyed `"0"`, `"1"`.

  It is not recoverable from a path, and it never needed to be — the document knows.
  `parseDynamicForm` now reports the collections it walked, `{ path, kind }` per array and record,
  beside the fields it flattened. `@modyra/plain`'s `buildFormSchema` and `mountMdyForm` accept them and
  build real `array()` / `record()` nodes: a document's array reads back as a list, a record keyed
  `"0"` stays a record, and each row keeps its own values.

  `flattenDynamicForm(schema)` is the walk that reports both; `flattenDynamicSchema` keeps its
  signature and returns the fields alone. `collections` is optional on `MdyDynamicFormParseResult` and
  always present at runtime, so a consumer's stand-in keeps compiling and a caller that ignores it gets
  exactly the previous behaviour.

  `@modyra/react`'s dynamic form still reconstructs groups from the field list alone — the same change
  against a different builder, left for a batch of its own.

  See ADR 0031, amendment "a collection survives the flattening".

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

## 2.1.1

### Patch Changes

- 2e29f30: A control mounted before its row is declared now binds when the row arrives.

  Rendering a keyed collection column by column means a cell can reach the DOM before whatever owns
  the collection has declared its keys. The contract has always said such a control renders empty and
  binds when the row arrives; in Angular it stayed empty forever, because whether a path is open is
  answered from the collection's own set — deliberately not a signal, so that writes do not tie
  unrelated computations to a collection's shape — and a binding that resolved its field once never
  re-asked.

  `MdyFormAdapter` now carries `fieldNames`, the membership signal the engine already maintained, as an
  **optional** member: an adapter with no notion of membership has nothing to report, and a binding
  reads its absence as "membership never changes". No existing adapter has to change. A binding that
  finds no field depends on it only while it has none, so a bound control is not woken by every
  registration in the form.

  See ADR 0026, amendment "asking again when the row arrives".

- 2e29f30: A numeric bound is stated once, and the control offers what the rule already says.

  `min()` and `max()` now carry the bound they enforce, and a field reports the range its own
  validators state through `MdyFieldState.bounds` and `MdyFieldHandle.bounds`. The number control of
  every renderer offers that range at the keyboard unless the control narrows it: `[minValue]` in
  Angular, the `min`/`max` attributes in Lit, `min`/`max` in a framework-free field config. Where two
  rules bound the same field the tightest wins — each was added to exclude something.

  Until now the range had to be written twice, once as a validator and once on the control, and
  nothing checked that the two agreed. An application that wrote only the validators offered no
  constraint at all at the keyboard; one that wrote only the control accepted the value and failed on
  submit.

  Also new: `integer()`, for a field that holds a count, an identifier or a quantity of things — `1.5`
  used to report itself valid and fail wherever the value was finally parsed, with no field to name.
  A bounded integer composes: `compose(integer(), min(0), max(255))`.

  `minLength()` and `maxLength()` now accept `string | readonly unknown[] | null`. They already
  tolerated empty at runtime; the type refused the `string | null` an optional text field actually
  holds, and forced a cast.

  **Breaking, released as a patch**: nothing depends on this library yet, so the version is kept low
  deliberately. `MdyFieldHandle` gained a required `bounds` member. Every handle the library produces
  has one, so reading code is unaffected; code that **constructs a handle by hand** — a test double, a
  custom adapter — must add `bounds: computed(() => ({ min: null, max: null }))`, or the field state's
  own `bounds` where it wraps one.

- c47d0ac: A computed derives a value and writes nothing — the rule is now in the reactivity contract.

  The vanilla graph allowed a signal to be written inside a `computed`; another reactivity the engine
  runs on refuses that outright. So shared code could pass every test on one adapter and throw under
  another — the cross-framework variation this contract exists to prevent. Nothing in `@modyra/core`
  or `@modyra/widgets` was doing it, checked across every computed in both.

  Writing a signal while a computed recomputes now throws `MdyComputedWriteError`. `untracked` does not
  lift the ban — it says "do not depend on what I read", not "this is no longer a computed" — and an
  **effect** is unaffected: acting on a change is what an effect is for, including one that runs while
  a computed is being read.

  **Breaking for anyone implementing `MdyReactivity` outside this repository**:
  `MdyReactivityCapabilities` gains a required `pureComputeds`, so an adapter will not compile until it
  answers. Report `true` only if the graph actually refuses the write; `false` means it will not
  notice, and is never permission to do it. The shipped adapters answer: vanilla `true` (it enforces),
  Angular `true` (Angular enforces it itself), Vue and Solid `false`.

  See ADR 0032.

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

- 6581883: A field name is a path in a schema, so a flattened document mounts into a readable form.

  The dynamic contract carries a nested form as a flat list of fields named by path: a group becomes
  `shipping.city`, a keyed collection becomes `lines.12.name`. A schema built from those names keyed
  them literally, which described a form one level deep against a value two levels deep — so the form
  rendered, accepted typing, and threw `Flat value does not match schema shape` at the first
  `getValue()` or submit. Every nested document mounted with `@modyra/plain` or React's dynamic form
  was unreadable; Angular was unaffected, its dynamic component registering declarative controls where
  a name has always been a path.

  A schema key that spells a path now declares the structure it describes — at the root, inside a
  group, and inside a collection's item — and two declarations of the same group are one group in
  either order. A name that would be both a field and a group is refused by name instead of resolved
  in silence. Only groups are reconstructed: a path cannot say whether `lines.0` was an array row or
  the record key `"0"`, so a form that must round-trip a list declares `array()` or `record()` itself.

  `assertSafeDynamicFieldNames` is now exported from `@modyra/core`: the rules a name must satisfy —
  no empty segment, no prototype key, no id delimiter, no name twice — are checked where a field list
  is turned into a form, in one place rather than per adapter. `@modyra/react`'s dynamic form also
  stops carrying its own table of empty values and reads the contract's, which is what made a number
  field there start at `0`: a value `required` could never fail, where every other adapter started it
  at `null`.

  See ADR 0031.

- 2e29f30: `when` — a field the form only asks about under a condition.

  A schema is static and a form is not. A field belonging to a branch the user did not take is
  declared like every other one, so a `required()` on it makes the form permanently invalid, with the
  offending field nowhere on screen to explain why. The workaround was to move the rule out of the
  schema and rebuild it in application code.

  ```ts
  reason: field("", [required()], {
    when: (_value, form) => form.kind === "detailed",
  });
  ```

  While the condition is false the field is **inactive** — which is what a disabled field already
  means here, not a fourth state: not validated by the form, not submitted, and its value kept, so a
  branch the user leaves and returns to still holds what they typed. The predicate receives the
  field's own value and the whole form value.

  A control's `[disabled]` binding and the schema's condition are separate inputs to one state, so
  neither can silently cancel the other.

  Data-only documents already expressed this with a rule of effect `disabled`, and still do.

  **Breaking, released as a patch** — nothing depends on this library yet — and all in surfaces
  that only the library constructs:

  - `MdyFieldDescriptor`/`MdyAnyFieldDescriptor` gained a required `when` member. Code that builds a
    descriptor literal instead of calling `field()` must add `when: null`.
  - `MdyFormRegistry` gained `setInactive`. A hand-written registry must implement it; forwarding to
    nothing is a valid implementation for a registry with no notion of conditional fields.

- cf498d8: A control bound with `[field]` reads the form that handle came from.

  `[field]` names a path, and the state behind that path was resolved against whichever `<mdy-form>`
  enclosed the control. Two forms on one page — a dialog over a list is the ordinary case — share
  every path they have in common, so a handle from one form displayed inside the other showed the
  wrong value and wrote what the user typed into the wrong model, with nothing said about it.

  A handle now carries the form that built it (`handleFormOf`, beside the existing
  `getFieldHandleOwner`), and a control bound to one reads that form. A `name` binding is unchanged:
  it has no handle, so the enclosing form is the only thing that could answer.

  The framework-free and Lit renderers were never affected — they are handed a handle and hold no
  ambient form to confuse it with.

- 985685b: A field holding `NaN` is no longer valid, and `valueShape` is public.

  `NaN` is the value every comparison lets through: `NaN < 0` is false, `NaN > 9` is false, and it is
  neither null nor blank. A number field holding one therefore reported itself **valid** — and
  `JSON.stringify` writes `NaN` as `null`, so a form that declared `required()` said it was fine and
  sent nothing at all. That is the worst of both answers, and it was reachable from a server response,
  a restored draft or a scripted `set()`.

  `required()` now refuses it — there is no answer there — and `min()`/`max()` refuse it too, because a
  value that cannot be compared is within no bound. A field with no rule keeps whatever it is given:
  the model is still not repaired behind anyone's back.

  **`valueShape` is now exported.** A data-only document has always had it applied automatically, so a
  `number` field refuses a string and a `text` field refuses `42`; a typed schema could not even ask
  for it. TypeScript refuses the wrong type at compile time, but a value arriving from a server, a
  draft or a cast does not pass through TypeScript — and this is the rule for that.

  Also filed, not fixed: **a field the form is not asking about still paints as failing** (finding T in
  `docs/contract-gaps.md`). A disabled field keeps its own verdict and every renderer shows it, while
  the form reports itself valid — so a conditional section of required fields is a block of red boxes
  for something nobody is being asked. `invalid` is a declared state of every kind, asserted by a
  139-pair matrix and carried by the committed screenshots, so changing what it means beside `disabled`
  is a contract change rather than a patch.

- b048e2c: The devtools panel masks a sensitive field inside a collection, and stops showing dates as `{}`.

  The panel's own rule is that it "must never become the easiest way to shoulder-surf a password":
  values whose path looks sensitive — `password`, `token`, `secret`, `card`, `cvv`, `ssn`, `iban`, plus
  whatever `[maskFields]` names — are replaced with `•••` in the table and in the JSON view. The JSON
  view treated an **array as a leaf**, so it handed back its rows whole: a password inside a collection
  row was printed in clear, and an `[excludeFields]` path naming a row's field was ignored. The table
  was right, because it asks by field path; only the view that gets copied into a ticket leaked. Rows
  are now walked by their indexed path, so one rule answers for both views and a listed path may name
  `items.0.password`.

  `mdyFormSerialize` (`@modyra/core/serialize`) exists so a `File` does not stringify to `{}` — but
  rebuilding every object property by property discarded `toJSON`, which made it _lose_ what plain
  `JSON.stringify` keeps: a `Date` came out `{}`, and so did every domain type that defines `toJSON` to
  be storable. A value that defines `toJSON` now keeps the answer it already gives, `File` is still
  described first (it has no `toJSON`, and a polyfill adding one must not change how a file reads), and
  a value that refers back to itself is described as `[Circular]` instead of exhausting the stack.

- d5c1774: A row handle follows the reorder, instead of the record it was born with.

  `form.f.items.rows()` is recomputed from the row count, and a structural change destroys every row's
  fields and registers them again. An operation that keeps the count — `move` above all — therefore
  handed back **the same handle objects, pointing at records the engine had already destroyed**.

  The consequence was not cosmetic. The arrangement the guide shows binds `rows()[i]` to a control, so
  after a drag the control displayed the value the row held _before_ the move, and what the user typed
  into it went into a destroyed record: the model never changed, and nothing said so.

  Row handles are now built the way a keyed collection's cells already were — resolving the field by
  path on every read — which is what makes a handle survive a rebuild by construction. Measured
  unchanged on the benchmarks and the form-scale budgets.

  `record()` was never affected: its cells have resolved by path since they existed, which is why
  sorting the demo's keyed table has always been safe.

- 94474e4: A field a schema declared is no longer destroyed by the control that showed it.

  A renderer claims a field when it mounts a control and releases it when that control is destroyed —
  an `@if` closing, a wizard step leaving, a tab switching. The engine took the last release as
  permission to delete the field, and then:

  ```js
  form.fieldNames(); // the field is gone
  form.getValue(); // throws: "Flat value does not match schema shape"
  form.state.valid(); // true — nothing left to fail
  ```

  A form that crashes on read and calls itself valid, from an arrangement every application has.

  The engine already refused to do this inside a keyed collection, and its reason applies one level
  out: _the field belongs to the row, not to the controls that happen to be showing it._ A field a
  schema declared belongs to the schema. It is now recorded as owned — by the typed form for its
  fields and groups, by an array manager for the leaves of a row — and a control releasing its claim
  releases the showing of the field, never the field.

  **A field a control invented still dies with it.** In the declarative mode `name="adhoc"` is the only
  place a field is ever mentioned, so the control is its owner; making those immortal would fill a
  long-lived form with ghosts. That case is asserted alongside the others.

  Only Angular could reach the defect in practice — the framework-free and Lit renderers never call
  `removeField` — but the cause was in the engine, and so is the fix.

- 039b0b9: A theme's `selector` and `model` are validated, like its `seed` and `name` already were.

  `compileMdyTheme` refuses a seed that is not a colour and a name that is not an identifier, and
  derives the default selector from that validated name. An **explicit** `selector` went in unchecked
  and is interpolated into the generated stylesheet six times, so one closing brace ended the rule and
  everything after it became CSS the theme's author never wrote:

  ```
  @layer mdy.themes {
    } body { display:none } .x { {
  ```

  `@modyra/core/theme-compiler` is a public subpath with no callers inside the repository — it exists
  to be used from outside, and the obvious use is compiling a theme per tenant, where the colour and
  the selector come from data. There that was persistent CSS injection.

  A selector may no longer contain `{`, `}`, `;`, `@` or a comment sequence: each of those leaves the
  position a selector occupies. Everything a theme actually uses is unaffected — `.acme`, `#app`,
  `:root`, `[data-tenant="acme"]`, comma-separated lists, combinators — and the CSS generated for an
  unchanged theme is byte-for-byte what it was. This keeps interpolated text inside its position; it
  does not decide which selectors a caller should accept from someone else.

  An unknown `model` now says so and lists the models that exist, instead of arriving as
  `TypeError: Cannot read properties of undefined (reading 'light')` three calls further down.

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

- c090eac: An array shrinks as well as grows, so undo stops leaving a row behind and a draft stops resurrecting one.

  The engine writes flat paths, and a field absent from a whole-value write is set to `null` rather
  than removed — it cannot know a path belongs to a row that should cease to exist. `onReplace` exists
  for that: a whole-value write hands each collection the paths it carried, so a row it does not
  mention is gone. A keyed collection implemented it; an indexed one did not, and reconciled on the
  engine's list of field _names_, which a restore never changes.

  Two user-visible failures came from it. Undoing a `push` left the row in place with its fields at
  `null` and killed the redo — the restored value no longer matched the snapshot that was asked for, so
  the history recorded it as a fresh edit — which lost what the user had typed and left a row they had
  not created. And a draft saved after deleting a row brought that row back on the next visit, carrying
  its seeded value: real data the user could submit without noticing.

  `MdyPathGate.isOpen` is now **optional**. A collection that does not govern existence omits it —
  nothing below the prefix is refused, a control mounting still creates the field, and the field stays
  its owner's to remove — and registers only to hear the shape of a whole-value write. Pruning is
  restricted to whole-value writes: a draft that excludes a key, a patch that names one field, or a
  cell being typed into says nothing about how many rows there are and prunes nothing.

  See ADR 0026, amendment "an indexed collection states its shape without governing existence".

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

- df1aaeb: The purity error names where you are, and the guide says of a validator what it said of a condition.

  Writing a signal inside a computed is refused (ADR 0032), and the message said so — to someone whose
  code contains no `computed`. The three places this library puts one are ordinary API surface: a
  validator's body, a `when` predicate, and a field claimed while a value is being read. The error now
  names them as examples, so the reader can go from the exception to the line.

  `docs/guides/typed-forms.md` said a `when` predicate must be a pure function of its arguments and
  said nothing of the kind about validators, which answer to the same rule. It does now — including
  what to do instead (an effect that watches the field), and the property verified while writing this:
  the guard leaves the form usable. The read that threw throws again while the cause is there, the
  value stays readable, and the form behaves exactly as before once the write is gone.

  Also fixed: a duplicated `## Async validation` heading in the same guide.

- c47d0ac: The library comparison stops claiming a feature no competitor has.

  `docs/guides/comparison-form-libraries.md` marked "keyed collections" ✗ for every other library,
  Angular included. Angular has `FormRecord`: a collection with dynamic keys, added and removed at
  runtime. The row now reads `~` for Angular and says what is actually different — `FormRecord` has no
  way to rename a key while keeping the control's value and state — with the API cited.

  A row was added for the property that matters in a long table and is easy to miss in a feature list:
  who decides that a row exists. react-hook-form's own documentation says `useFieldArray` "relies on
  inputs being mounted and unmounted to manage its internal state"; in Modyra a row exists because it
  was declared, so a row scrolled off screen keeps its value and still counts against validity.

  A comparison table is a claim about other people's work. This one was wrong in our favour, which is
  the worse direction.

- 2a38f16: `MdyGroupOptions` is exported, so `group(children, { when })` can be typed by name.

  The guide's new sections are executed rather than asserted: `docs/examples/typed-forms/` now runs
  the conditional field, the conditional section with its composition, a predicate reading a nested
  sibling, and every trap listed under `bounds` — the tightest bound winning, a `compose()` hiding its
  own, and a non-finite bound being ignored while its rule still runs.

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

## 2.1.0

### Minor Changes

- 0b64826: A keyed collection reports the calls it could not carry out, and stops holding what nobody is using.

  Four calls used to do nothing and say nothing, which is the shape of a bug that reaches production
  intact — the code looks right and the data quietly is not what the author believes:

  - **`setAll` handed something that is not an object emptied the collection.** A stray `undefined`
    from a response erased every row. It now declares nothing and says so; `setAll({})` is still how
    you empty one deliberately.
  - **`patch({ key: 5 })` on rows that are groups was ignored**, so a caller believed it had written.
  - **`rename` onto a taken key, or from a key that does not exist**, was a silent no-op. The data was
    never at risk; the silence was.
  - **`cell(key, "typo")`** returned a handle that could never bind. It now names the parts the row
    actually offers.

  Cell handles are held weakly, so a table churning provisional keys no longer accumulates one handle
  per key it ever rendered. Identity across `upsert → remove → upsert` is unchanged: a weak reference
  keeps exactly what a mounted control is holding.

  All of it goes through the host's development channel, so `devWarnings: false` silences these like
  everything else.

  **Breaking only for implementers.** `cell()` became generic with `unknown` as its default, so every
  existing call keeps the type it had; a hand-written implementation of `MdyRecordHandle` needs the
  generic signature. `MdyFormEngine.warnDev` is new and public for the same seam.

- ba5f5f9: A control can be named without a visible label.

  A cell in a table and a control in a toolbar get their meaning from a column header or an icon,
  which a screen reader never reaches — and until now the only name a control could have was a visible
  label. Building a table made the gap concrete: every cell announced itself as "edit" and nothing
  about which line or column it belonged to.

  `ariaLabel` supplies the name, and only while nothing visible carries one:

  ```html
  <mdy-control-text
    [field]="rows.f.lines.row(key).item"
    [ariaLabel]="'Item, row ' + key"
  />
  <mdy-text-field aria-label="Item, row 12" .field="${cell}"></mdy-text-field>
  ```

  ```ts
  renderField(
    container,
    { name: "item-12", kind: "text", ariaLabel: "Item, row 12" },
    cell
  );
  ```

  A visible label already names the control natively, so the two can never disagree — the failure
  WCAG 2.5.3 is about. The Dynamic Form Contract carries the slot too, so a data-only document can
  declare it, and both spec schemas describe it.

  Found while doing this: the Angular renderers bound `aria-label` **twice** on the same control, the
  second copying the visible label. One attribute now has one binding.

- faf3275: The Dynamic Form Contract has a `record` node, beside `group` and `array`.

  ```json
  {
    "node": "record",
    "item": {
      "node": "group",
      "children": { "name": { "node": "field", "field": { "kind": "text" } } }
    },
    "initialValue": {
      "12": { "name": "Espresso" },
      "tmp:1": { "name": "Cornetto" }
    }
  }
  ```

  A document declares a row's shape and the rows it starts with; which rows exist afterwards remains
  the application's word, because a document describes a form rather than a session. It flattens to the
  dotted paths every renderer already consumes (`lines.12.name`), so no renderer needed changing, and
  `buildDynamicFormSchema` turns it into a typed `record()`.

  Row keys are validated as path segments: one that carries a `.` or a prototype-polluting name is
  reported as `MDY_DYNAMIC_UNSAFE_NAME` and rendered by nothing. `spec/dynamic-form-v2.schema.json` and
  `spec/dynamic-form-v3.schema.json` describe the node, so an editor reading `$schema` underlines a
  malformed one.

- 3d8391b: A restored draft no longer brings back a row the user deleted.

  A draft is written as a flat value, and a removed row is expressible there only as an absence — so a
  restore replayed the values it carried and left the schema's own seeded rows standing. The user
  deleted a line, came back, and found it again: worse than losing work, because it looks like the form
  disagreed with them.

  `MdyPathGate` gained an optional `onReplace`, and the engine tells every keyed collection the whole
  shape a snapshot carried. A row the snapshot does not mention is one that was removed before it was
  written, so it stays removed; rows the snapshot adds still arrive. `MdyFormEngine.restoreValue` is
  the call that does both, and drafts use it.

  Also in this change:

  - **A collection inside a collection is refused where it is written.** A document nesting a `record`
    in an `array` passed the parser and produced a schema that threw on the first row; the parser now
    reports it, and building the form refuses it rather than waiting for a row to arrive in front of a
    user.
  - **`cell()` states its value type**: `cell<number>(key, "qty")`. The default is still `unknown`,
    because the part is a runtime string — `row(key)` remains the typed way when the part is known,
    and is what a typed control should be bound to.

  **Breaking only for implementers.** `MdyPathGate` gained an optional `onReplace`, and
  `MdyRecordManagerDeps` a required `warn` — the seam the typed form uses to build a collection.
  Constructing an `MdyRecordManager` by hand means passing one
  (`warn: (message) => engine.warnDev(message)`). Every consumer-facing call is unchanged.

- 8b88c9f: `record()` — a third structural node, for a collection whose keys are data.

  `group()` keys rows at compile time and `array()` keys them by position. `record()` keys them by a
  value the domain owns, so a row survives sorting and filtering, carries the id the server gave it,
  and — the case an array cannot serve — lets **the controls of one row be mounted apart**, as a table
  rendering column by column does.

  ```ts
  const schema = { rows: record(group({ name: field(""), qty: field(0) })) };

  form.f.rows.upsert("a3f9", { name: "Espresso", qty: 2 });
  form.f.rows.cell("a3f9", "name").set("Ristretto"); // one control of one row
  form.value().rows; // { a3f9: { name: "Ristretto", qty: 2 } }
  ```

  A row exists because `upsert` declared it, never because a control mounted: a control on an
  undeclared key waits and renders empty, unmounting one keeps the value, and validity belongs to the
  declared row — so sorting or filtering a table cannot turn an invalid row valid. `remove(key)` is the
  only way a row's value goes away. ADR 0026 records why.

  Also fixed, found while building this: `MdyFormEngine.getValue()` did not depend on _which_ fields
  exist, so a form value read while a collection was empty stayed empty after rows arrived.

  **Breaking only for implementers.** `MdySchemaPaths` gained a required `recordPaths`. Reading the
  result of `collectSchemaPaths` is unaffected; declaring the interface yourself means adding the member
  (`recordPaths: new Set()` preserves today's behaviour). `walkSchema`, `flattenPatch` and
  `numericKeysToArrays` take new optional parameters and are unchanged when omitted. Nothing a consumer
  of `createForm`, `record()` or a handle calls has changed, which is why this is a minor rather than
  the major the type-surface audit reads it as.

### Patch Changes

- 206b0b3: `has()` and `validOf()` on a record handle answer inside a computed.

  Both read the declared-key set, which is deliberately a plain `Set` — the path gate consults it from
  the engine's write paths, where touching a signal would tie an unrelated computation to a
  collection's shape. That is right for the gate and wrong for a caller: a template writing
  `rows.has(key)` got the answer that was true when it first ran and never another one, and the first
  read being correct is what made it hard to notice.

  They now read the key signal to depend on it and the set to answer it, so the cost is unchanged and
  every member of the handle reads live.

- 495ff44: A record's rows survive a draft restore and an undo.

  Drafts and history write a flat value straight into the engine, and the gate that stops a mounting
  control from declaring a row was refusing those writes too — a restored draft came back with its rows
  missing. A value arriving for an undeclared path is now offered to the collection that owns it, which
  declares the row; a control mounting still declares nothing. `MdyPathGate` is exported for adapters
  that own keyed paths of their own.

## 2.0.0

### Major Changes

- 2037ba5: Fix two latent bugs found during security audit:

  1. **Custom sanitizer exception handling**: Custom sanitizers that throw exceptions now fail gracefully instead of crashing the form. Errors are reported through the violation telemetry hook and the original value is preserved.

  2. **Array manager field cleanup**: Orphaned array row fields that accumulated during undo/redo cycles are now properly cleaned up. The reconciliation effect now detects and removes rows that have disappeared from the value but were still registered in the engine, preventing memory leaks.

  Behaviour is unchanged for normal operations, but the **type surface is not**: reporting the new
  failure added `"sanitizer-error"` to `MdySecurityViolationKind`, which is a closed union in a return
  position — `MdyValueSecurityResult.actions[].kind` — and is also what `MdySecurityPolicy.onViolation`
  receives. A consumer that switches exhaustively over either, with an `assertNever` default, stops
  compiling. `npm run test:type-surface` classifies it major, and that is what it is.

  Migration: handle `"sanitizer-error"` alongside `"sanitized"` and `"max-length"`. It reports that a
  custom sanitizer threw; the original value was preserved, so treating it like `"sanitized"` is wrong
  — nothing was stripped.

### Patch Changes

- 3161bad: A collected diagnostic is no longer also written to the console.

  `parseDynamicForm` installs a sink and returns every finding in
  `result.diagnostics`, which is the channel its callers read. It was also writing each one to
  `console.warn`, so a caller that asked for the findings got them twice — once where it looked and
  once where it did not. A tool parsing a document per keystroke turned that into a stream.

  `warnDev` now writes to the console only when nothing is collecting. `parseDynamicFields` installs no
  sink and is unchanged: there the console is the only channel a dropped field has, which is what the
  dev-mode warnings in the guides describe.

  Migration: a caller relying on `parseDynamicForm` to log is reading `result.diagnostics` instead —
  each entry carries `code`, `severity`, `path` and `message`, which is more than the console line had.

## 1.0.0

### Major Changes

- 27c1222: A reactivity says what it is.

  `MdyReactivity.id` and `.kind` were optional, marked "optional until every adapter is migrated". Every
  adapter has been migrated for some time: `vanilla`, `vue`, `react`, `solid`, `preact`, `svelte` and
  `angular` all declare both, measured by calling each factory and reading the fields.

  They are required now. 1.0 should not freeze an interface that describes a migration which is over —
  an optional field every implementation supplies is a field consumers must still write a branch for.

  - **`id`** identifies a reactivity by symbol rather than by name. Two adapters can both call
    themselves `"react"`; only the symbol says whether they are the same one. The headless adapters
    share vanilla's symbol deliberately — they _are_ vanilla underneath.
  - **`kind`** is what it calls itself, for diagnostics.

  **Migration:** an implementation of `MdyReactivity` written outside this repository must add both.
  Every adapter shipped here already has them, so nothing changes for anyone consuming one.

  **Classification.** `contract:diff` reports `patch` — it snapshots the widget catalogue and cannot
  see the reactivity interface. Shipped as `major`: a required field added to an interface consumers
  implement is exactly the asymmetry `docs/contract-compatibility.md` calls major.

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

### Minor Changes

- 0a23bfd: The conformance suite checks that a declared equality capability is actually honoured.

  `capabilities.signalEquality` and `capabilities.computedEquality` are declared by every adapter and
  were verified by nothing. The one check that mentioned them asserted they are **booleans** — not that
  a `true` means anything. An adapter that accepts `options.equal` and drops it on the floor passed:
  the shape is right, the types are right, and the option is silently ignored.

  That is the "accepted but unhonoured option" the adapter contract was written to prevent, and the Vue
  adapter's own source flags it as the risk it deliberately avoided. Nothing was checking.

  Two capability-gated tests now do: a comparator that calls every value equal must suppress the write
  and must notify nothing. Every adapter passes — the suite had simply never asked. Removing the
  comparator from an adapter's `signal()` fails the new check and nothing else.

  Solid also moves onto the conformance suite directly, with a harness whose scope owns the effects the
  suite creates and is genuinely destroyed. That is 2 of 6 adapters off the compatibility shim.

- e8b586a: A date field can name its own locale.

  `MdyDynamicDateField` and `MdyDynamicDaterangeField` gain `locale`, `firstDayOfWeek`, `minDate` and
  `maxDate`. Until now the contract had no locale surface at all: `mountMdyForm` could not pass one,
  every renderer fell back to `navigator.language`, and Plain's `renderDatepickerField` carried an
  `options` parameter its own mount path could never populate — reachable only by a host calling the
  renderer directly.

  `navigator.language` is the _visitor's_ preference, not the form's. A booking form for an Italian
  office should show an Italian calendar to a visitor whose browser is in English, and only the form
  knows that.

  ```ts
  mountMdyForm(host, [
    { name: "when", kind: "datepicker", label: "When", locale: "it-IT" },
  ]);
  // L M M G V S D, in an en-US browser
  ```

  All four are optional and unset behaves exactly as before, so no existing form changes.

  `parseDynamicFields` validates them, because these arrive from config files rather than from typed
  code. The locale check is the one that matters: a malformed tag does not degrade — `Intl` throws a
  `RangeError` — so a config carrying `"en_US"` would have taken the form down at mount rather than
  rendering an approximate calendar. `firstDayOfWeek` must be an integer from 0 to 6, the dates must
  be real ISO dates (`2026-02-30` is rejected), and `minDate` may not follow `maxDate`.

  A field failing any of these is dropped with a development warning, the same way a `number` field
  with `min` above `max` already was.

- 76f4e7e: Cross-field validation is expressible in the Dynamic Form Contract, and a contract's tree can be built into a running form.

  Two additions, both filling gaps that forced callers to work around the contract rather than through it.

  **`validations`** — a new optional slot on `MdyDynamicFormConfigV2`, carrying `{ when, message, target? }`.
  `rules` could only show, hide, enable and disable, and its predicate is flat: one field, one operator,
  one value. A rule that _invalidates_ has a message and needs a tree, so "shipping is required when the
  country is not IT and the total is over 100" had nowhere to go. `when` is an `MdyExpression`, a
  portable predicate over the form value with twelve enumerated operators, addressed by path — no
  `eval`, no `new Function`, and `matches` takes its pattern only from a literal so a form's own data
  cannot choose the regular expression. Malformed expressions are reported by `parseDynamicForm`
  alongside calendar options and number bounds, never thrown at runtime. `buildDynamicValidations`
  turns them into ordinary `crossField` validators, deriving each one's dependencies from the condition
  so the two cannot disagree.

  **`buildDynamicFormSchema`** — builds a form from the contract's schema _tree_, keeping its groups and
  arrays. `flattenDynamicSchema` answers a different question: it produces one flat list of dotted names
  for a renderer drawing a sequence of controls, and in doing so fixes each array at however many rows
  its initial value happened to have. That is correct for drawing and wrong for running — a row the user
  adds afterwards has no descriptor. Until now the contract could _describe_ a nested form that nothing
  could _instantiate_, so anything needing a live nested form had to read some other model instead.

  Both are additive. A document that declares no `validations` parses exactly as before.

- 7bafd3d: The reactivity conformance suite checks that a destroyed scope stops the effects it owns.

  `@modyra/core/testing` already asked whether a scope fires its cleanups and cascades to its children.
  Neither question reaches the guarantee a scope exists for: **that what was created inside it stops.**
  An adapter whose scope registers nothing passes both of the old checks and leaks every effect a form
  ever made.

  Every adapter in the repo passes the new check — the suite had simply never asked. It fails when the
  ownership registration is removed from an adapter, which is the point.

  Vue now runs the conformance suite directly rather than through
  `core/test/reactivity-contract.mjs`. That shim hardcodes `destroy: () => {}` and a flush that
  resolves immediately, so an adapter tested through it is never asked to tear anything down and never
  asked to flush anything real. Vue's harness supplies a scope that owns every effect the suite makes
  and Vue's own `nextTick`.

  Worth knowing for anyone writing an adapter harness: `options.scope` is the ownership channel.
  `scope.run()` enters the reactive context and does not, on its own, transfer ownership.

- 3bb85a6: A select declares whether it filters.

  `searchable?: boolean` joins the option-based field config, defaulting to `false`. It selects one of
  two interaction models, and they are different controls to anyone not using a pointer:

  - **`false` is a listbox** — no filter box, focus stays on the trigger, typing accumulates into a
    typeahead that jumps to the first matching option.
  - **`true` is a combobox** — focus moves into the search input on open, typing filters.

  Both drive the list with `aria-activedescendant` rather than moving focus into it.

  It is contract data rather than a renderer input because the alternative is what exists today: it was
  a component input in two adapters, absent from the third and from the document format, so one widget
  had three behaviours and one of them matched a single character of any typeahead. A renderer cannot
  honour a distinction it has no way to read.

  Both SDKs carry it, for the reason `mode` did: a document that loses it describes a different
  control.

  [ADR 0018](https://github.com/modyra/modyra/blob/main/docs/architecture/0018-a-select-declares-whether-it-filters.md)
  records the two models and what each renderer owes them.

  **Classification.** `contract:diff` reports `patch`: it snapshots the widget catalogue, and this is a
  field on the _form_ contract, which it cannot see at all. Shipped as `minor` for an additive optional
  field — the same blind spot as finding **K**, in a part of the surface that finding had not yet
  reached.

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

- 0d3fa5f: `@modyra/core/async-draft-storage` — drafts on a Promise-based store.

  `MdyDraftStorage` is synchronous by design: a field writes a draft while the user types, and there
  is nothing useful to hand a caller that cannot wait. React Native's standard storage is
  Promise-based, so the two never met. The React Native guide documented the workaround — hydrate a
  `Map`, read and write it synchronously, flush in the background — and said it was "not built, not
  tested here". This is that adapter, built and tested; the guide now links to it.

  ```ts
  const storage = createHydratedDraftStorage({
    backend: AsyncStorage,
    keys: ["checkout-draft"],
  });
  await storage.ready;
  ```

  No new dependency: the backend is an argument, so anything with `getItem`/`setItem`/`removeItem`
  returning promises works — AsyncStorage, an IndexedDB wrapper, or a test double.

  Two semantics the shape does not make obvious, both chosen deliberately and both covered by a test
  that fails when they are reversed:

  - **A read before hydration finishes returns `null`** — "no draft", never a stale or partial one. A
    synchronous read cannot block, and restoring the wrong draft is worse than restoring none. `ready`
    exists so a caller can wait before restoring, and a write that lands during hydration wins over
    what the store held: the user is allowed to be faster than the disk.
  - **A failed flush is never thrown into the form and never loses the draft.** The value stays in the
    cache, so the user keeps typing and the next write retries it. `onError` reports it; without one
    the failure is silent, which is the bargain the default `localStorage` storage already makes with
    quota errors.

- 75d2553: Text on a filled surface is light while light is readable.

  An `on-` colour was whichever of black and white had the higher WCAG 2 contrast ratio. That ratio's
  luminance formula weights blue at a fourteenth of green, so it rates dark text on a saturated colour
  far above what a reader experiences — and it put black text on a saturated blue in every theme.

  Measured, and consistent rather than marginal:

  | background | ratio, white | ratio, black | ratio picks | perceptual metric picks |
  | ---------- | ------------ | ------------ | ----------- | ----------------------- |
  | `#3B82F6`  | 3.68:1       | 5.71:1       | black       | white                   |
  | `#7067FF`  | 4.14:1       | 5.07:1       | black       | white                   |

  Across 112 pairs of a derived palette the two disagree on 37, always in that direction.

  **The rule is now: light while light clears a floor, the higher ratio below that.** The floor is
  `MDY_ON_COLOR_FLOOR`, newly exported from `@modyra/core/color-utils` — the one addition to the public
  surface. Following the perceptual metric without a bound was rejected on measurement: it puts 36 of
  those 112 pairs under AA, the worst at 2.96:1.

  `onColorFor` had the same defect. It is exact rather than estimated, and it returned black for
  `#3B82F6` too, because it was maximising the same ratio — so precomputing a palette would not have
  avoided this.

  **The floor is below AA for normal text, deliberately**, and above the 3:1 that AA asks of large text
  and UI components. [ADR 0015](https://github.com/modyra/modyra/blob/main/docs/architecture/0015-light-text-while-it-is-readable.md)
  states the cost and what to do about it under a strict audit.

  **Migration:** a host that sets its own `on-` colours sees no change. One deriving them sees light
  text where it saw dark on saturated mid tones — including `--mdy-sys-color-on-primary`, which the
  datepicker's selected day and every filled control read.

### Patch Changes

- 3068258: `@modyra/core` no longer names an adapter in its dev warnings.

  Three warnings — `enableHistory()`, `enableDraft()` and async validators — told the reader to
  "construct it with an Injector" "with the Angular adapter". A package naming its own dependent
  inverts the dependency direction in prose while the import graph stays clean, and the advice was
  wrong for every other adapter.

  They now point at whichever reactivity adapter the caller is using. Dev-only (`MDY_DEV`), so nothing
  ships differently in production.

- 08cb845: Every adapter's conformance suite runs the reactivity that package actually exports.

  `@modyra/preact`, `@modyra/react`, `@modyra/svelte` and `@modyra/lit` each ship a named
  `*Reactivity()` — core's graph re-tagged with their own `kind`, which the capability matrix
  introspects. **Every one of their conformance files ran `vanillaReactivity()` instead.** The export
  consumers import was covered by nothing, and a re-tag is a spread: the one shape that silently drops
  a member.

  It does now, plus a check that the re-tag still carries every member. Removing `createScope` from
  one of them fails eleven tests; before this it failed none.

  The backward-compatibility shim `core/test/reactivity-contract.mjs` is **gone**. It existed to adapt
  the old `runReactivityContract(name, factory)` signature for "every adapter package's own
  `test/reactivity.test.mjs`", and no adapter uses that signature any more. It also hardcoded
  `destroy: () => {}` and an immediate flush, so nothing tested through it was ever asked to tear down
  or to flush.

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

- 342f396: These packages are now compiled by TypeScript 7.

  Nothing about the published API changes, and that is checked rather than asserted: both compilers
  emit all twenty-one projects and the results are compared file by file. Across 464 files the only
  difference is the order in which the members of a string-literal union are printed in
  `catalog.d.ts` — the same type either way. The contract snapshot is unmoved, and the Angular package
  still builds through its own TypeScript 5.9 toolchain from these declarations.

  The Angular package and Studio's embedded compiler stay on TypeScript 5.9, which their peer ranges
  and its package exports require.

- 1a99bbb: The SDKs carry the multiselect mode, and say what they ignore.

  `mode` has been in the Dynamic Form Contract all along, and neither SDK modelled it. Java's
  `MdyDynamicOptionsField` had no such component and `@JsonIgnoreProperties(ignoreUnknown = true)` on
  top; Rust's `Field` had no such member. So a server that parsed a form and re-emitted it **silently
  turned a counter multiselect into a toggle one** — and now that the widget contract picks an anatomy
  by that value, the re-emitted document describes a different widget than the one it was written as.

  Both SDKs now carry it, and both are tested by round trip rather than by inspection.

  **`@JsonIgnoreProperties(ignoreUnknown = true)` is gone from all five field records.** An SDK that
  reports success on a document it did not understand is the same silence one level up. The policy is
  now stated once in the parser instead of five times on the records, and unknown properties are
  **reported** as `MDY_DYNAMIC_UNKNOWN_PROPERTY` diagnostics rather than dropped — lenient enough that
  a document written against a later contract still parses, honest enough that nothing disappears
  without a word.

  Rust also validates the value: an unrecognised mode is `MDY_DYNAMIC_UNKNOWN_MODE`, and a mode on a
  kind that has none is `MDY_DYNAMIC_UNEXPECTED_MODE`. A mode nothing describes is worse than none,
  because the widget contract would check the field against no anatomy at all.

  The five headless adapters are unaffected: they render no markup, so no anatomy depends on the mode
  there.

## 0.5.0

### Minor Changes

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

- 2ce4ef1: A third way to derive a palette, and a tonal model for the two that were already there

  Modyra derived a palette two ways: OKLCH arithmetic and Material's HCT, both live in the browser
  through relative colour syntax. A perceptual model cannot be expressed that way, because it asks a
  question CSS has no way to answer at paint time — how much chroma sRGB can actually show at this
  lightness and hue — and then moves lightness only as far as a minimum perceptual distance requires.
  So it compiles instead. `@modyra/core/theme-compiler` turns one seed into complete light and dark
  `--mdy-sys-color-*` sets, solved independently rather than one lifted from the other, and
  `@modyra/styles/salience.css` is the first theme it produced.

  It sits on its own subpath, not in the root barrel: it is build-time code, and re-exporting it took
  the core entry from 14.7 KB to 18.0 KB gzip against a 15 KB budget.

  The live models gain `tonal`, which ramps the brand hue deep-to-pale instead of rotating it, and
  per-role chroma floors so a muted brand still derives a visible accent instead of collapsing into
  grey. Colours that are actually neutral stay neutral: below c = 0.005 the hue is numerical noise,
  and amplifying it would invent a brand colour nobody chose.

  Fixes `--mdy-sys-color-tertiary` resolving to nothing on every model but `tonal`. The floors are
  read with `max()` on every model, so the one that was declared only where it bites made the whole
  declaration invalid at computed-value time everywhere else — measured empty in Chromium under
  `brand`, `monochrome` and `triadic`.

- 9e8cbad: Milestone B, dimension 6 completed: the value lifecycle, and the doorway it was missing.

  A dynamic field now guards its own shape. `oneOf` already whitelisted the option kinds against a
  value that did not come from the widget — a restored draft, a network config, a scripted `set()` —
  and every other kind had no such guard: a text field handed `42` reported itself **valid**, because
  every rule it owned asked whether the value was _empty_ and none asked whether it was a string.
  `valueShape` closes that, derived from `MDY_VALUE_CONTRACTS` rather than restated per kind.

  It deliberately leaves nullish alone. Whether a field may be empty is `required`'s question, and
  answering it here too would make an optional field invalid for holding nothing.

  The rest of the dimension — how what a field holds changes — is pinned rather than added, because
  the engine already had it right: a programmatic write does not make a field dirty, touched and dirty
  are independent of validity, and `reset` restores the value and clears both. Those semantics come
  from the engine every adapter shares, so pinning them once pins them for all three.

  **Why here and not as an event surface.** The three adapters have no common one — Angular emits
  component outputs, Lit one custom event, Plain callbacks — and `MdyUiCommand` is a list of effects a
  host performs, not events it observes. What dimension 6 actually enumerates is the value lifecycle,
  and that lives on the field handle.

- 879b5e9: Every renderer measures its popup before placing it

  Angular, Lit and the framework-free renderer now hand `anchorOverlay` the popup's own size, so the
  contract can put it where the content shows whole instead of falling back to the minimum-space rule.
  Each measures once — when the popup opens, with `scrollHeight`/`scrollWidth`, which report what the
  content wants whatever the box is currently clamped to — and holds that size while it stays open:
  re-measuring during scroll would feed the clamped box back into the decision that clamped it. The
  panel is not in the DOM on the frame the popup opens, so each renderer takes the measurement as soon
  as it is and places it again, still within the opening.

  `ComputedPosition["coords"]` carries `maxWidth`, and `getOverlayStyles` emits
  `--mdy-overlay-max-width`, so Angular's panel applies the same width ceiling the other two get from
  the foundation.

  `computeOverlayPosition` and `computeCoordsForAnchor` are deprecated. They are a second placement
  policy that no renderer calls: they know nothing of the popup's size, so they pick a side with
  enough room rather than the side where the content fits.

- c4ca77d: Add `daterange`, `file` and `colors` to the dynamic field union, so the Contract covers every
  `@modyra/widgets` catalog kind. The change is additive: parsers on earlier versions drop the new
  kinds in lenient mode and reject them in strict mode.
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

- 05c5665: A disabled field is no longer submitted or validated

  `disabled` and `readonly` were the same thing in everything but name. Both blocked interaction
  identically, both were kept in the submitted value, and both were validated. The standards say
  otherwise, and had done all along: a disabled control is neither submitted nor validated, and a
  read-only one is both.

  **Interactivity is now one value, not two flags.** `MdyFieldState.interactivity` is
  `"enabled" | "readonly" | "disabled"`, and `disabled`/`readonly` are derived from it, so the
  meaningless `disabled && readonly` combination cannot be represented. If a form sets both, disabled
  wins: it permits strictly less, and a question the form is not asking cannot also be one it is
  asserting an answer for.

  **Two value types, because there are two concepts.** `form.value()` and `form.getValue()` stay
  total — that is the live editing model, and drafts, history and cross-field validators all read it,
  so a field must not vanish from it just because it happens to be disabled. `form.submitValue()` is
  new and returns `MdySubmittedValue<S>`, which is what actually leaves the browser. `submit()`'s
  callback now receives that type.

  `MdySubmittedValue<S>` is optional at every level the schema declares and no deeper: a leaf inside a
  group can be disabled on its own, so groups recurse, while an object-valued _leaf_ like a date range
  is submitted whole or not at all. `MdyFormAdapter` gained a second type parameter for it, defaulting
  to `Partial<T>`, so adapters that do not know their schema are unaffected.

  **What changes for you.**

  - A form containing a disabled field now sends less. Read the submitted value defensively; the type
    will tell you where.
  - A form blocked by a disabled required-empty field now submits. That case was unfixable by the
    user, who could not type into the field either.
  - `MdyFormSubmitEvent.value` and `onSubmit` callbacks are typed as the submitted shape.
  - A read-only field is unaffected: still submitted, still validated, still focusable.

- 242551e: What a field holds when it holds nothing is now the contract's answer, not a renderer's.
  `mdyEmptyValueFor` moves the per-kind table into `@modyra/core`, where `required` already lives —
  two adapters answering the question separately is how one form validates differently in each.

  Two defects were sitting in the old table, both measured:

  - **A required number field could never fail.** It defaulted to `0`, and zero is a number the user
    may well mean, so `required` accepted a field nobody had filled in. It is now `null`.
  - **A slider started outside its own range.** It defaulted to `0` whatever its `min`, so a slider
    bounded 10–20 sat at 0 until the first drag. It now starts at its minimum.

  The slider is the one kind whose empty value is a real one, and deliberately so: a thumb is always
  somewhere, so an untouched slider reads as filled. Every other kind is now rejected by `required` at
  its empty value, and a test asserts exactly that across the whole kind list — which is the check that
  would have caught the `0`.

  `<mdy-dynamic-form>` used the same function instead of spelling the defaults per kind in its
  template — a third table, which defaulted only checkbox, toggle and multiselect and left a number
  field `undefined`.

  **Breaking for `@modyra/plain`**: a `number` field with no `initialValue` starts `null` rather than
  `0`, and a `slider` starts at `min`. Set `initialValue` to keep the old behaviour. The same applies to `<mdy-dynamic-form>`, where a
  number field previously started `undefined` and a slider ignored its `min`.

- d568743: A second palette engine: Material 3's HCT, alongside Modyra's OKLCH

  `deriveHctPalette` reproduces Google's algorithm — CAM16 hue and chroma over CIE L\* tone — next to
  the existing OKLCH derivation. Nothing about the OKLCH functions changed; this is an addition.

  **Implemented from scratch rather than depended on.** No new dependency: CAM16 under Material's own
  default viewing conditions (D65, adapting luminance 11.73, background L\* 50, average surround,
  illuminant not discounted), the sRGB↔XYZ matrices, and an HCT solver.

  The solver is the part worth knowing about. CAM16 inverts analytically, but **HCT does not**,
  because its tone is CIE L\* — a property of Y — while CAM16 inverts from its own lightness J. So
  `hctToHex` bisects J until the resulting Y matches the tone asked for, then walks chroma down until
  the colour fits in sRGB. Most hues cannot hold chroma 84 at tone 40; asking and taking what fits is
  what Material does too. This is also exactly why the OKLCH engine, not this one, is the one
  `modyra-base.css` mirrors: OKLCH inverts in closed form and therefore fits in a stylesheet, and a
  bisection does not.

  Checked against the values Google publishes for the `#6750A4` baseline rather than against itself:
  source HCT comes out hue 298.98, chroma 47.86, tone 40.08 where M3 documents ~299/48/40; **primary
  `#6750a4` and secondary `#625b71` are exact**, tertiary is `#7e5260` against `#7d5260`, and the
  primary palette's tone stops give `#22005d` and `#e9ddff` against M3's `#21005d` and `#eaddff` — one
  unit of 255 in each. Error comes out `#ba1a1a`, which is what hue 25 / chroma 84 / tone 40 actually
  produces; the older `#B3261E` predates that palette being generated.

  **`on-` colours are tone stops, not measurements.** M3 declares that on-primary _is_ tone 100 and
  on-primary-container _is_ tone 10, and never computes a contrast ratio at run time — the guarantee
  comes from tone distance instead. Modyra's `onColorFor` measures both candidates and keeps the
  winner. Predictable versus adaptive, and the module says so where it matters.

  **HCT numbers are not OKLCH numbers.** CAM16 is an appearance model with stated viewing conditions
  and corrections for the Helmholtz–Kohlrausch and Abney effects; OKLab has neither. Their hue angles
  are different quantities and their chroma scales differ by two orders of magnitude (0–0.4 against
  0–120). Never pass one's output to the other's constructor.

  A test prints both engines side by side for four sources, because the difference is the point rather
  than a defect. It shows M3 _assigning_ tone and chroma where Modyra _scales_ them: seeded with a
  light yellow, the OKLCH model keeps a light primary at lightness 0.91 while M3 pins it to tone 40 and
  returns a dark olive; M3's error is `#ba1a1a` for every source, while Modyra's keeps the red hue and
  takes its weight from the brand. An M3 palette looks like an M3 palette whatever seeded it, and a
  Modyra palette still looks like the colour you chose.

  Use `deriveHctPalette` to match a theme exported from Material Theme Builder; use `derivePalette` to
  theme Modyra.

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

- 6aab031: The relational maths behind a palette, at `@modyra/core/color-utils`

  A palette is not a list of colours, it is one colour and a set of relationships. Modyra's already
  was — measured in OKLCH, the stock secondary sits at the primary's hue +24°, the tertiary at +96°,
  the error at a fixed red with 0.83× the primary's lightness. Those relationships were real and
  frozen as hex literals, so picking a new brand colour left the rest of the palette where it stood: a
  green brand still got violet chips and coral accents.

  This module holds the relationships as numbers, so the palette can follow. `modyra-base.css` will
  hold the same numbers as custom properties and let the browser do the arithmetic live; a later test
  binds the two copies together, because two copies of a number is exactly what drifts.

  Four models ship — `brand` (default), `monochrome`, `complementary`, `triadic` — each a set of hue
  offsets and chroma/lightness multipliers, nothing more. `brand` uses round +30°/+90° rather than the
  measured +24°/+96°, so the stock palette shifts slightly and deliberately.

  **Error keeps a pinned red hue** and takes only its weight from the primary. It is the one colour in
  a palette whose meaning is not decorative, and an error that has gone green because the brand did is
  no longer an error.

  OKLCH rather than HSL: HSL's "lightness" is not lightness — `hsl(60 100% 50%)` and
  `hsl(240 100% 50%)` claim the same 50% while one is blinding and the other nearly black, so rotating
  hue in HSL changes perceived brightness and the derived palette comes out uneven.

  **Contrast is the part CSS cannot check for itself**, so it lives here: `contrastRatio` is WCAG 2.1,
  and every `on-` colour is chosen by measuring both candidates rather than guessing. Three findings
  came out of writing that, each from a test failing rather than from reasoning:

  - **The lightness pivot was wrong.** Solving for where black overtakes white puts the crossover
    between 0.508 and 0.590 OKLCH lightness, mean 0.562 — not the 0.62 first assumed. At 0.62 an
    indigo of lightness 0.607 was handed white text at 4.09:1, under AA, when black gives 5.07:1.
  - **The `on-` colour must be decided from the _painted_ colour, not the requested one.** A rotated
    hue at full chroma often lands outside sRGB, and clipping it back moves its lightness: a tertiary
    asked for at 0.551 was painted at 0.579, so judging the request chose white where the thing on
    screen wanted black.
  - **No constant pivot can be right for every hue.** With one, five pairs in the test sample landed
    under AA despite 4.64–4.87:1 being available to them. Measuring both candidates and keeping the
    better clears AA for every model and every primary tested. `contrastPivot` stays in the model as
    the stylesheet's approximation of this rule — the stylesheet has no way to compute a luminance —
    and what that approximation costs will be measured in a browser rather than assumed.

  The margin is genuinely thin at mid lightness: a colour sitting on the crossover has only ~4.6:1
  available whichever way it goes. That is a property of black and white text on mid-tone backgrounds,
  not something a better pivot could fix.

  No new package and no build change — this follows the existing `@modyra/core/time-utils` subpath
  pattern. Nothing renders differently yet; this batch establishes the numbers.

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

- fc6327f: Remove the deprecated surface

  **Breaking, and it rides the minor.** The workspace is pre-1.0 and every package moves together, so
  this lands as `0.5.0` rather than claiming a `1.0.0` the framework has not earned — Lit still has no
  config-driven form, and contract-v2's `rules` are parsed but reach no renderer. Pin exactly if you
  depend on any of the removed names.

  **`@modyra/core/overlay-position` is gone.** It held the placement policy Modyra had before there was
  a contract — it never knew how big the popup was, so it chose a side with _enough_ room rather than
  the side where the content fits, and could not report whether the popup would scroll. `anchorOverlay`
  in `@modyra/widgets` replaced it and is what all three renderers have used for some time. The
  subpath export is removed from `package.json` and the module no longer re-exports through
  `@modyra/core/ui`.

  Replacements, all in `@modyra/widgets`: `computeOverlayPosition` → `anchorOverlay`;
  `computeCoordsForAnchor` → `anchorOverlay` with `lock`; `getOverlayStyles` → `overlayStyleProperties`;
  `ComputedPosition` → `MdyOverlayPlacementResult`; `OverlayPosition`/`OverlayAlignment` →
  `MdyOverlayPlacement`/`MdyOverlayAlignment`; `OverlayPositionConfig` → `MdyOverlayAnchorOptions`.

  **`MdyReactivity.canEffect` is gone, and `capabilities` is now required.** `canEffect` existed as a
  guaranteed answer to the one question the engine cannot do without, standing in while `capabilities`
  was still optional. Every adapter declares capabilities now — Vue, Solid and Angular natively, React,
  Preact, Svelte and Lit through `vanillaReactivity()` — so there is one way to ask and the alias is
  unnecessary. Read `capabilities.effects` instead.

  A custom adapter needs two changes: drop `canEffect`, and declare `capabilities`. The engine reads it
  through `reactivityRunsEffects()`, newly exported, which treats a reactivity assembled without
  capabilities as "no effects" — the same answer `canEffect: false` gave — so a JavaScript caller
  degrades to skipped async validators, drafts and history rather than a crash.

- 61271c5: `required` understands every kind's own empty value, and a half-set range is invalid

  `required` only recognised `null`, `undefined`, a blank string and an empty array, so every kind
  whose empty value is another shape escaped it entirely. An unchecked required checkbox, an off
  required toggle and a required date range with both ends unset all reported themselves **valid** and
  submitted. Plain, Angular and Lit each recorded this independently in their state matrices before
  the cause was identified — three adapters describing one validation defect.

  `false` now counts as empty, matching HTML, where `<input type="checkbox" required>` unchecked does
  not satisfy the constraint. A toggle whose "off" is a genuine answer should simply not be marked
  required.

  A `{ start, end }` pair with neither end set now counts as empty too.

  **`completeRange` is new, and it is not the same rule.** A range is one value with two halves, so
  half of one names no interval at all — it is wrong whether or not the field is required. Every
  `daterange` carries it automatically, through the same mechanism that already constrains a select to
  its declared options. An optional range may be left entirely empty; it may not be left half-set.

  **What changes for you.** A form with a required checkbox left unchecked, or a required range left
  blank, stops passing validation — it was passing before and should not have been. A form with a
  half-entered range now shows an error where it previously accepted the value silently.

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

- ec3d8ca: Milestone B, batch 1: the contract says what a field holds.

  `MDY_VALUE_CONTRACTS` declares, per kind, the runtime shape of the value, whether it may be absent,
  and whether interaction writes through or edits a draft until confirmed. `explainValueMismatch` names
  why a value does not belong in a field rather than returning a colour, and
  `matchesValueShape` answers the shape question on its own.

  This is the dimension the widget specification had no declaration for at all: every other one —
  anatomy, semantics, relations, states — was contract data somewhere, and "what does this field hold"
  was agreed implicitly by the engine, the validators and three renderers.

  Implicit agreement cannot be checked, and the cost was measured. A state-matrix fixture used one
  empty value for every kind, so `daterange` received `""` where two endpoints belong and was rejected
  for being an empty string rather than for being an empty range — its row was green because of the
  fixture. All three adapters now assert their fixtures against the declared shape, and reintroducing
  that fixture fails the suite.

  The commit mode is bound to behaviour rather than described: a confirm-mode kind is asserted to leave
  the field untouched until it is confirmed, and a live-mode kind to write through on the interaction.
  Asserting only one side would leave the two modes indistinguishable.

  Two defects surfaced the moment the check ran. Every fixture drove `slider` empty as `null`, which is
  a state the kind cannot be in: a thumb is always somewhere. Correcting it showed that `required`
  alone can never fail on a slider, so `slider × invalid` had been green because the state was
  unreachable, not because the renderers were right — the fixtures now give it a validator that can
  fail. `file` was driven with `null` and `""` where an array belongs.

### Patch Changes

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

- 9864d9a: The palette follows the colour it is derived from

  `modyra-base.css` now derives secondary, tertiary and error from `--mdy-sys-color-primary` in OKLCH,
  with the model selected by `data-mdy-palette` on the root or on any subtree. Four ship — `brand`
  (default), `monochrome`, `complementary`, `triadic` — each nothing but hue offsets and chroma and
  lightness multipliers, written as plain custom properties.

  Before this, choosing a brand colour moved the primary and left everything else where it stood: a
  green brand still rendered violet chips and coral accents, in every theme, measured. Dark mode was
  worse than that — it restated secondary and tertiary from the fixed reference colours, so a chosen
  colour worked in the light theme and quietly stopped applying in the dark one. Both derive now.

  `brand` uses round +30°/+90° where the stock palette measured at +24°/+96°, so its colours shift
  slightly and deliberately.

  **Contrast is derived too, and this is the part that was actually broken.**
  `--mdy-sys-color-on-primary` was `color-mix(primary, cloud 95%)` — 95% white whatever the primary
  was, which on a light brand colour is white text on a light background. Each `on-` colour now reads
  the colour it is named for and resolves to black or white against it.

  Getting that right took three measured corrections, none of which were visible from reading the code:

  - **CSS has no conditional**, but `clamp()` on lightness makes a step. The slope has to be steep:
    at ×100 a colour landing within 0.01 of the threshold resolved _inside_ the clamp — one measured
    at lightness 0.5559 produced a mid grey, the worst text colour available on any background.
  - **A lightness threshold cannot stand in for a luminance one.** WCAG weights green at 0.72 and blue
    at 0.07, so a blue and a green of identical OKLCH lightness are nowhere near equally bright; a
    constant pivot picked the wrong side 38 times in 1080 samples. Luminance is estimated instead as
    `l³ · (1 + 0.85·c·cos(h − 179°))` — exact for a grey, fitted for the rest — which is wrong 16
    times in the same 1080, all within 0.0075 luminance of the crossover where the two choices are
    worth the same. `pow()` and `cos()` are both older than the relative-colour-syntax baseline, so
    this costs no support.
  - **The `on-` colour must be judged on the _painted_ colour, not the requested one.** A rotated hue
    at full chroma often leaves sRGB, and clipping it back moves its lightness.

  Everything sits inside `@supports (color: oklch(from white l c h))`. Relative colour syntax needs
  Chrome 119, Safari 16.4 or Firefox 128; an older browser keeps exactly the palette it renders today
  rather than losing its colours.

  **Derivation is a default, not a cage**: a theme declaring `--mdy-sys-color-secondary` outright still
  wins, and there is a test that says so.

  The stylesheet's estimate is an approximation and `@modyra/core/color-utils` is not — it measures
  both candidates and is exact, which is the guarantee for generating a theme ahead of time. The new
  `e2e/palette.spec.ts` measures what a browser actually paints, through a canvas rather than a second
  implementation of the colour maths, and asserts the approximation never falls far from the best
  colour available. A test parses the stylesheet and compares every number against
  `MDY_PALETTE_MODELS`, because two copies of a number is exactly what drifts.

- 1644bf5: Both SDKs read Contract v3

  Studio emits `version: 3` the moment a layout places a slot per breakpoint. Neither SDK could read
  the result:

  - **Rust** refused it on the version alone — `expected contract version 2`, before a field was
    read — and its untagged `LayoutChild` could not deserialize a `{ref, at}` slot at all, so even an
    accepted version would have failed the whole document.
  - **Java** fell through every branch of `parse`'s envelope check and returned a failed result, and
    `validLayoutNode` rejected a slot object as an invalid shape.

  A form authored responsively therefore exported to something neither server could parse.

  Both now accept v3 as what it is: v2 plus per-slot placement, with every other envelope member read
  exactly the same way. Both refuse placement where no column can honour it — outside a `columns` row,
  or naming a track the row does not have — matching the TypeScript parser rule for rule, and both
  still refuse a version they have never heard of.

  Rust also gains two things it was quietly dropping: `at` on a `columns` row (v2's own track counts,
  absent from the struct, so a responsively-authored row round-tripped back to one arrangement) and
  `at` on a section.

  The guarantee is a shared fixture, `spec/fixtures/dynamic-form/v3/placement.json`, parsed by all
  three implementations in their own suites — the same arrangement this repo already uses for v2, and
  what stops the three drifting apart again.

## 0.4.0

### Minor Changes

- 318e721: Add Dynamic Form Contract v2 with data-only layout sections/columns,
  declarative visibility/enabled rules, structured strict/lenient parser
  diagnostics, a machine-readable JSON Schema, shared conformance fixtures,
  and the initial `modyra-contract` Rust crate. Contract v1 and the legacy
  `parseDynamicFields()` API remain supported.

  Add a runnable Rust `reqwest` POST example that sends a Contract v2 form
  submission and prints both raw and typed API responses, including normalized
  422 validation errors and optional bearer-token authentication.

  Add an Axum form API example and connect the existing Angular dynamic-form
  demo to it: Rust maps checkout business configuration to Contract v2 JSON,
  Angular validates and renders it, and completed values are posted back to
  Rust with success or normalized server-error output.

  Extend Contract v2 with recursive `group` and `array` schema nodes. The
  strict parser validates structural limits and flattens accepted nodes to the
  dotted/indexed paths consumed by the Angular dynamic renderer. Rust now emits
  the original checkout shape (`shipping` group and `items` array) and omits
  absent option fields from JSON instead of serializing them as `null`.

- 1bb844f: Reactivity/adapter API redesign (`piano-modyra-reactivity-adapter-api.md`), all additive:

  - `MdyReactivity` gains optional `id`/`kind`/`capabilities` (honest, per-adapter, never claiming an unimplemented guarantee), `createScope()`/`MdyReactiveScope` (ownership with idempotent, cascading destroy), typed errors (`MdyUnsupportedCapabilityError`, `MdyCrossRuntimeObservationError`, `MdyDestroyedScopeError`, `MdyAdapterContractError`, `MdyActivationError`) and structured diagnostics (`MdyDiagnostics`, `MDY_*` codes). `canEffect` stays as a deprecated alias.
  - `vanillaReactivity()` is the reference implementation: real `batch()`, `flush()` and `observe()` (a selector-based subscription that only fires on an actual change), built on a redesigned shared-drain effect scheduler that settles chained effect triggers within one flush/batch instead of needing one microtask per hop.
  - `MdyFormEngine`/`MdyTypedFormBase` gain `form.mutate(fn)` — coalesces a burst of field writes into exactly one history entry regardless of whether the adapter's effects run synchronously (Vue/Solid) or are scheduler-deferred (vanilla/Angular); delegates to a real runtime `batch()` when the adapter reports it.
  - `MdyFormEngineOptions.autoActivate` (default `true`, unchanged behavior) plus `activate()`/`deactivate()`: pause/resume draft persistence, history recording and async validators without losing any state (field values, undo/redo stacks, draft baseline). `@modyra/react` and `@modyra/preact`'s `useMdyForm` now construct with `autoActivate: false` and call `activate()`/`deactivate()` from their effect instead of destroying on unmount — tolerant of React/Preact Strict Mode's dev-only double-invoke and safe during SSR (activation only ever runs client-side). **Behavior note**: the hook no longer calls `form.destroy()` automatically on unmount; call it yourself if you need a hard, final teardown (releasing field records) rather than a pause.
  - `@modyra/angular`'s adapter hardened: `effect()` without an `Injector` now throws a typed error by default instead of returning a silent no-op (`unsupported: "report"` opts back into graceful, diagnosed degradation); declared capabilities; `equal` propagated to Angular's native `signal()`/`computed()`; `onError` now actually respected (previously silently ignored).
  - Fixed a real, if latent, bug in `@modyra/react`/`@modyra/preact`: `createStore()` used to build a fresh `vanillaReactivity()` to observe a field handle, which happened to work only because vanilla's tracking is module-global — it silently never re-rendered for a handle owned by a different adapter's form. Now resolves the owner via a new handle-ownership registry (`getFieldHandleOwner()`).
  - Fixed a real pre-existing bug found while building `mutate()`: `undo()`/`redo()` restore a value through the same non-atomic multi-field write path `mutate()` guards against, so a synchronous-effect adapter could see 1-2 spurious extra history entries mid-restore.
  - Fixed a scheduler bug found while auditing error handling: an effect throwing without `onError` used to abort the shared drain loop, silently starving sibling effects scheduled in the same batch.
  - New `@modyra/core/testing` subpath (`runReactivityContractTests`, `MdyReactivityTestHarness`) — the conformance suite adapters are tested against, now a documented public API instead of an internal test helper.
  - New `docs/guides/reactivity-adapter-guide.md` and a generated `docs/reactivity-capability-matrix.md` (`npm run docs:reactivity-matrix`).

## 0.3.0

### Minor Changes

- c7dadfb: Whole-entry slimming (roadmap phase J). The root entry `@modyra/core` now re-exports only the form engine (typed forms, validation, security, dynamic config, reactivity): **10.7 KB min+gzip** measured, down from 17.2 KB (−38%). Satellite utilities are no longer re-exported from the root — they remain in the package via their curated subpath entries: `@modyra/core/datetime`, `/localization`, `/ui` (icons, keyboard, options-utils, overlay-position), `/serialize`, `/devtools`, `/i18n`, `/dynamic-config`. **Migration:** change e.g. `import { formatDate } from "@modyra/core"` to `import { formatDate } from "@modyra/core/datetime"`. The framework adapters (`@modyra/react`, `/vue`, `/lit`) re-export the core surface via `export *`, so the same migration applies to satellite names previously reached through them (e.g. `mountMdyDevtools` now comes from `@modyra/core/devtools`). Also new: compile-time `__MDY_DEV__=false` define strips dev warnings in production builds (esbuild/rollup/vite), and a CI guard (`test:core-bundle`) now budgets the whole entry (11 KB) and the realistic surface (10 KB) so the comparison-doc numbers can't silently regress.
- 7554cc8: Injection prevention at the engine's write choke point. New `security` form option: sanitization profiles (`"text"` strips control/bidi/zero-width characters, `"strict"` also strips markup characters), per-field overrides and custom sanitizer functions via `field(..., { sanitize })`, `maxValueLength` string caps, and an `onViolation` telemetry hook. Always-on structural checks: restored draft entries are shape-validated against the declared field type, and submit-returned errors with prototype-polluting paths are dropped. Sanitization is opt-in in 0.x (`"off"` by default) and covers every write path — user input, `patch`/`setValue`, draft restore, array operations. See `docs/guides/security.md`.
- fc22197: Option whitelisting (client-side anti-tampering). New `oneOf`/`eachOneOf` validators: a select offering "one"/"two" now rejects a scripted `set("three")`. Option-based dynamic fields get the whitelist automatically — `buildDynamicFieldValidators()` constrains `select`/`radio`/`segmented` values and every `multiselect` element to the declared `options`, and `<mdy-dynamic-form>` uses it, so CMS/LLM-generated configs are tamper-resistant with zero extra code. `docs/guides/security.md` gains a trust-model section: client checks are defense-in-depth, and the same schema can gate the API server-side (isomorphic pattern with `@modyra/zod`).

## 0.2.0

### Minor Changes

- fd1e9d8: Add typed field arrays via `array()` — repeatable rows with
  `push`/`insert`/`remove`/`move`/`setAll`, wired through
  `@modyra/angular/adapter` and `@modyra/zod` (`z.array()`).

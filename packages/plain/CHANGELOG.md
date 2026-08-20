# @modyra/plain

## 0.9.0

### Minor Changes

- c0b44a8: A calendar has three views, and the contract now says so

  Two renderers had grown a month picker and a year picker; one had not, and nobody
  had decided that. The seven class names they used were identical and in no
  catalogue, so they agreed by copying rather than by contract, and neither picker
  carried a role, an `aria-selected` or anything else a screen reader could read —
  the day grid is a `grid` of `gridcell`s and the views that replace it were a run
  of bare buttons.

  `MdyCalendarViewMode` (`days | months | years`) joins the state of both calendar
  controllers, with `set-view-mode`, `select-month` and `select-year`, and
  `calendarViewAfterPick` states where choosing lands: a year narrows to its months
  and a month to its days. Every opening starts on the days, which is what the
  timepicker's own view mode already did.

  Eight parts join the catalogue — `monthPicker`, `monthCell`, `yearPicker`,
  `yearCell` for each kind — carrying the classes the renderers already used, and
  `projectCalendarViewA11y` / `projectCalendarPeriodCellA11y` project them.

  **The framework-free renderer gains the views.** Paging a month at a time put a
  birth date thirty clicks away.

  Two things the gates caught rather than review: a `grid` with no accessible name,
  which the conformance kit rejected — the label is a default now rather than an
  option a renderer can forget — and four state classes no theme paints, so a cell
  declares only `selected` and a refused period carries the native `disabled`.

- d03419c: A control a document did not label is named by its field

  A label is optional in a document — deliberately: the published corpus declares fields without one,
  and refusing them would invalidate the material that documents the contract. But a control with no
  accessible name is announced as its role and nothing else, and
  `MDY_SEMANTICS_REQUIRING_NAME` already says some roles may not be.

  `fieldAccessibleName({ ariaLabel, label, name })` is the order, in one place so every renderer answers
  the same: what a host wrote for the control, then the visible label, then the **field's own name**.

  The fallback is not a poor one. A document's field name is a single segment — a dotted path is refused
  where the document is read — and in the published corpus the names _are_ the label's words: `city`,
  `zip`, `email`, `first`, `last`, beside labels reading `City` and `ZIP`. Announcing `city` announces
  the word the author would have written; announcing nothing announces "text box".

  `@modyra/plain` names the element a person operates rather than the one it was handed — a slider
  arrives wrapped in its track, and a name on the wrapper is a name the control does not carry — and
  names a checkbox and a toggle, whose words sit beside the box rather than in a `<label for>`.
  `@modyra/lit` takes the same order.

  `nameIsAFallback` answers whether the name came from the field rather than from words for a person,
  so a host that wants to report it can.

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

- a219a90: `mountMdyForm` takes a `draft` option

  Draft persistence is a headline of the engine — debounced autosave, restore on load, field exclusion,
  four claims — and it is the _form's_ option. This renderer builds the form itself and had nowhere to
  put it: `mountMdyForm(container, fields, { draft: { key } })` was accepted without a word and nothing
  was ever written. The other renderer takes its options straight to the form, so the same call kept a
  draft there, which is what made this a missing slot rather than a feature that does not work.

  `draft` is now passed to the form this mount builds, as `createForm` takes it — a key or the whole
  `MdyDraftOptions`.

- 0a6d296: A popup that opens says so

  `overlayLifecycleTransition` answers `announce: "opened" | "closed" | null` for every open and close,
  and the words are published in five message tables. `@modyra/angular` read the field; `@modyra/plain`
  and `@modyra/lit` read neither. In a page: the datepicker opens, `aria-expanded` becomes `"true"`, and
  no live region receives anything. `aria-expanded` answers someone who asks the control — a popup drawn
  in the top layer is exactly the case where nobody who was not asking is told it appeared.

  Both renderers now announce where they show and hide the popup, in the element's own language, once
  per edge. Neither announces during teardown: an element being disposed is not a popup a person closed.

  **`setOverlayOpen` returns `boolean`** — whether this call is the moment the popup opened or closed —
  so a renderer that reflects its open state on every render can tell a change from a repaint. The first
  call for a popup is its initialisation and answers `false`. A caller ignoring the result is unaffected;
  anything implementing that signature now returns the flag.

  `MDY_SHARED_REGION_ATTRIBUTE` marks the renderer-wide live region. One region serves every widget and
  has to outlive all of them — created and removed around a message, it is a region the screen reader
  was not watching when the text arrived — so `inspectUnmount` no longer counts it as an element an
  instance left behind.

  `MdyFieldElement.messages` is public in `@modyra/lit`: the overlay controller speaks for the element
  and reads the element's table rather than resolving a second one.

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

- b75b5d3: A date or time a control cannot read is kept where it can be corrected, and explained

  Typing `14:30` into a timepicker erased it. The value went `null`, `aria-invalid` stayed `false`, and
  nothing was said — in both browser renderers, for a date and for a time alike:

  ```
  typed        into         outcome
  14:30        timepicker   text erased, value null, nothing said
  banana       timepicker   idem
  not a date   datepicker   idem
  31/02/2026   datepicker   idem
  ```

  `14:30` is the case that decides it: it is how most of the world writes a time, the control's default
  locale is 12-hour, and the only way to learn that was to guess. Nothing erased the text — an
  unparseable entry committed nothing, and the next sync rewrote the input from a value that had not
  changed.

  A control now hands the text to its controller as text (`{ type: "type", text }`) and the controller
  decides: empty clears, readable commits through the same door the calendar or the dial uses,
  unreadable is **kept and explained**. Keeping without explaining would leave a field that looks
  accepted holding a value it never took — which is what `acceptTimeField` already refuses one level
  down.

  **Breaking.** `MdyDatepickerFieldState` and `MdyTimepickerFieldState` gain `entryText` and
  `entryUnreadable`; `MdyI18nMessages` gains `entryUnreadable`, shipped in all five locales. A renderer
  that builds one of those state objects, or a host that supplies a complete message table instead of
  spreading `MDY_I18N_MESSAGES_DEFAULT`, adds them:

  ```ts
  const messages = {
    ...MDY_I18N_MESSAGES_DEFAULT,
    noResults: "Nessun risultato",
  };
  ```

  `parseEntry` is optional, so a controller built without one leaves typed entries alone as before.

  The daterange is unchanged and has the same defect: its entry has two ends and needs a state shape of
  its own. Recorded as
  [ADR 0063](../docs/architecture/0063-a-value-a-control-cannot-read-stays-where-it-can-be-corrected.md).

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

- 023d6c7: A widget announces the refusal it makes

  Twelve of the seventeen kinds refused every change while read-only and said nothing about it. The
  control was focusable, submitted, counted for validity, looked exactly like an editable one, and the
  only feedback was that nothing happened.

  The previous decision — `readonly` declared only where a value is typed — was right when nothing
  enforced it: an `aria-readonly` on a checkbox, next to a native attribute HTML ignores, is a claim the
  DOM contradicts. Every kind's controller now asks `blocksValueChange` before carrying out an intent, so
  the claim is true and the silence is the defect. `MDY_WIDGET_STATE_SUPPORT` declares `readonly` for
  sixteen kinds and `ARIA_STATE_CARRIERS` names the carrier for each.

  **The native attribute is bound only where the platform acts on it** — a text-entry input or a
  textarea, never a range, a checkbox, a colour, a file input or a `<select>`. That half of the earlier
  finding survives as a rule, and the conformance check no longer demands an attribute the browser drops.

  `file` declares no read-only state: its picker is the browser's, its value is a `FileList` a page
  cannot write, and its role has no `aria-readonly`. What is expressible there is that the affordance is
  unavailable, so its browse control is disabled while the field stays in play.

  Three controllers kept `readonly` in a local signal a host had to set, while reading `disabled` and
  `interactivity` from the handle — a field the form had marked read-only refused through one path and
  reported itself editable through the other. They derive it from the handle now.

  `MdyFieldShellFlags` gains an optional `readonly`. A theme selecting on `[aria-readonly]` will match
  kinds it did not before.

- c3b519f: The three places one adapter still answered for itself

  **Angular binds the shared light-dismiss listeners.** Two renderers had been
  unified onto `bindLightDismiss` and the third kept its own six, which is how the
  set drifted in the first place — one of them was deciding on `click` alone, which
  the policy documents as the tail of a gesture rather than the gesture.

  **Angular draws the contract's backdrop.** It had a `<div>` in its own template
  with the colour written inline, so it was the one adapter not using the element
  the contract draws and the theme paints. Dismissing it needs no handler of its
  own: a click on the backdrop is a click outside, which the shared policy already
  answers.

  **The framework-free renderer can be told.** It returned a teardown and nothing
  else, so `setOptions` and `setBounds` — which the controllers take, and which the
  other two adapters pass through — had no door here at all: an option list
  arriving from a fetch could not reach a mounted chooser, and a range narrowing
  because a sibling was answered could not reach a mounted calendar. The teardown
  now carries the updaters its kind supports, so every existing caller keeps
  working and the result is still the function it always was.

  Its option rows are rebuilt when the list is replaced. They were built once at
  mount, so the DOM outlived the list it came from.

- 4678b59: Modal is where a popup sits, not when a field commits

  `variant: "modal"` did four things at once: a backdrop, a modal header, reading a
  **draft** instead of the value, and a Cancel/Confirm row. The first two are
  presentation; the last two are commit semantics — and they contradicted the
  kind's own value contract, which says `commit: "live"` for both the date picker
  and the range picker. The anatomy even declared an `actions` part for them, so
  the contract disagreed with itself in writing.

  **The placement was already there.** ADR 0023 named it the modal placement
  (`placement: "overlay"`) and it was reached only when neither side had room.
  `anchorOverlay` now takes `forceModal`, so a host can _ask_ for it — one door,
  consumed by all three renderers, which already call that function.

  **`variant` keeps only its presentation meaning.** The draft, the confirmation
  and the `actions` part go: choosing a date writes it, and the second pick of a
  range closes and writes it, whatever the placement.

  Migration: `variant="modal"` still covers the viewport and still draws the modal
  header. A product that relied on Confirm to commit no longer has it — the value
  is written when it is chosen, which is what `MDY_VALUE_CONTRACTS` said all along.
  `MDY_WIDGET_CONTRACTS.datepicker.parts.actions` and its daterange twin are gone;
  the timepicker keeps them, because it is the kind that confirms.

  `scripts/audit-commit-affordance.mjs` is the check that would have caught this: a
  kind declared `live` may not declare a confirmation part, and no renderer may
  draw the classes of one for it. Both halves read from the source of truth, so a
  kind that changes its commit mode carries the check with it.

- 621866a: A flattened path now rebuilds every collection it crossed.

  `buildFlatFormSchema` turns a collection declared inside another collection's row
  (`orders.o1.lines` inside `orders`) into a real nested descriptor — the first row
  describes the child's item, and each row's leaves seed it through the parent's
  initial. Plain's `mountMdyForm` walks such paths the way each collection is
  addressed, so `orders.o1.lines.l1.sku` mounts a real control two collections deep.
  One-level documents build exactly as before.

- ea534af: A refusal that names no field now has somewhere to be shown

  A failed network call, a service that is down, a cross-field rule only a server can check: they
  arrive with no path, and the engine keeps them. No renderer had anywhere to put them — `@modyra/plain`
  and `@modyra/lit` never read `lastSubmitErrors` at all, and `@modyra/angular` read it only in its
  devtools panel. A person pressed Send, the answer was no, and they saw their fields exactly as they
  had left them.

  `@modyra/widgets` now declares the form's own parts — `MDY_FORM_SHELL_STRUCTURE`,
  `MDY_FORM_SHELL_CLASSES`, `MdyFormShellPart` — and `formErrorsOf` is the one rule for what belongs in
  them: the errors no field will show. The region is a `status`, it sits before the fields, and it is
  rendered empty so that a screen reader already watching it announces what arrives.

  `@modyra/plain` renders it from `mountMdyForm` and `@modyra/angular` from `MdyFormComponent`, both of
  which own the form's own DOM. `@modyra/lit` has no form element, so it ships one to place:

  ```html
  <mdy-form-errors .form="${form}"></mdy-form-errors>
  ```

  `@modyra/styles` paints the region bordered rather than bare — a field's error is read next to the
  field it is about, and this one has to say what it is about by itself.

  `mountMdyForm` inserts the region as the container's first child, so anything counting a form
  container's children sees one more. Recorded as
  [ADR 0062](../docs/architecture/0062-the-form-says-what-no-field-can.md).

- 294ff44: The framework-free and Lit renderers read the message tables

  Both wrote their own English. The same control was "Open the calendar" in one,
  "Open date picker" in the other, and "Toggle calendar" in the table neither of
  them opened — forty-one strings and five locales with exactly one consumer.

  **Framework-free**: every renderer that shows a word takes an optional trailing
  `messages`, and `renderField` fills it in. A field that declares a `locale` now
  speaks it without any extra wiring: the tag that formats a date and the tag that
  names a button are the same tag.

  **Lit**: `MdyFieldElement` gains a `locale` property and a `messages` getter, so
  every element inherits both. The two calendars had a private `locale` getter of
  their own; it is now the base's fallback rather than a third answer.

  Some visible words change with this, because the table's wording wins:
  "Confirm" becomes "OK", "Choose a file" becomes "Select file", "Clear" becomes
  "Clear selection".

### Patch Changes

- ac052bc: A chip, a handle and a numeric kind, each named once

  `MDY_CHIP_CLASSES` gains `removable`. The Material theme has styled
  `.mdy-chip--removable` all along and the contract never named it, so the one
  directive that applied it was deciding for itself what a removable chip is. The
  Angular chip directive and the multiselect template now take every chip class
  from the table; between them they spelled ten.

  Angular stops restating `MdyArrayHandle` and `MdyRecordHandle` member by member.
  Both are derived from the engine's handles the way `MdyFieldHandle` already was,
  for the reason that file already gives: the copy drifted the moment the engine
  gained a member, and satisfied the local idea of the type while throwing at
  runtime. `cell` stays narrowed, because the handle it returns carries this
  framework's signals.

  The framework-free renderer asks the value contract which kinds hold a number
  instead of listing them again, and takes its daterange and timepicker part
  classes from the catalogue rather than from seven string literals.

- f76eeb3: A closed calendar and a closed colour palette hold nothing. The popup element itself stays — built on
  the first open and alive as long as the field, which is the lifecycle the renderers keep — but what
  was inside it stayed too: six weeks of day buttons announced as a grid and eight swatches announced
  as options in a listbox, all of them tabbable, in a widget nobody had opened. They are built again
  when it opens, which is what a month change already did. The calendar grid is now named by the month
  it shows rather than by the numbers inside it, which is a name that survives being empty.
- a300af5: A field wears the state classes its kind declares

  Three states the contract names and this renderer did not apply.

  **Open.** `MDY_FIELD_STATE_CLASSES` lists `open` beside `touched` among a renderer root's states and
  names the class it takes, and nothing applied it: a select, a datepicker, a timepicker and a colours
  field with their popup showing looked exactly like ones with it closed, so a theme had nothing to
  style. All six overlay kinds carry it now.

  **A refused field's label.** The label's error class read `shownErrorsOf`, which waits for the field
  to be touched, while the control's `aria-invalid` does not — so a control marked wrong sat beside a
  label that said nothing. Both now answer the same question. A checkbox has no shared shell to apply
  it, so it toggles the class itself.

  **A lifted label.** A datepicker holding no date compared `selectedDate !== ""` against a value that
  is `undefined` when nothing is selected, so an empty field's label was lifted as though it were full.

- 833a5f6: A gesture is bound once, and Lit stops deciding on the tail of it

  `bindLightDismiss` joins `createLightDismiss`: the policy decides whether an
  interaction dismisses, and this is the six listeners that feed it. Written per
  renderer, the set drifted — one bound `pointerup` and the other did not, leaving
  that one to decide on `click` alone, which the policy's own documentation calls
  the tail of the gesture rather than the gesture. A release outside that produced
  no click never dismissed.

  `createPointerDrag` returns to the package entry, taken up by the Angular and Lit
  clock dials, whose document listeners were byte-identical. The framework-free
  renderer keeps its own: it uses `setPointerCapture`, which retains the pointer
  that leaves the dial without any document listener at all.

  The Lit multiselect stops writing its own toggle, increment and decrement — a
  third form matching neither of the other renderers — and the Lit datepicker stops
  accepting a typed date outside its own bounds, which its grid already refused.

- 0a96145: The contract says a password is not a text field: `MDY_WIDGET_CONTRACTS[kind].controlType` names the
  native control a kind is drawn with, and `concealed` — on the widget contract and on
  `MDY_VALUE_CONTRACTS` — says the control does not show what is typed into it. The one difference
  between the two kinds was said nowhere a renderer could read it, so every adapter kept a private map
  from kind to input type and the failure mode of one that does not is a password in clear text.
  `@modyra/plain` reads the contract instead of its own map. Both members are optional; nothing an
  adapter does today breaks. See ADR 0099.
- 117ecba: `applyOverlayProperties` — a placement is written when it changes, not on every pass

  A renderer re-applies an open popup's placement on every render pass, and most
  of those writes set a custom property to the value it already holds. That is not
  free: a custom property write invalidates style on the element and everything
  inheriting from it, which for a popup holding a calendar is its whole subtree.

  Measured on a calendar switching to its year view: **six writes per pass became
  zero**, because the placement genuinely does not change — the contract holds the
  decision it opened with.

  The framework-free and Lit renderers consume it. Angular does not need it: it
  binds a computed style object, and the framework already skips what has not
  changed.

- 9cd8dc2: The daterange and colours openers take their popup promise from the contract

  `aria-haspopup` is announced _with_ the control, before anything opens, and a person decides whether
  to open it from that word. Nineteen places across three adapters wrote it as a literal and one read
  the contract's projection — so two renderers of one widget could say different words about it, and
  nothing compared them.

  These two now ask: `MDY_POPUP_OPENERS` carries `promises` per kind, and `applyOpenerPromise` reads it
  through `projectOverlayOpenerA11y`. The colours field was promising a listbox where the contract says
  listbox and the panel renders one, and the daterange a grid — both are now whatever the contract
  says, wherever it changes.

- 8c92015: A number field that is emptied holds nothing, not zero

  `MDY_VALUE_CONTRACTS.number` declares the kind nullable: empty is a value a numeric field can hold and
  the one it starts from. The renderer read the box through `Number(text)`, and `Number("")` is `0` — so
  clearing the field supplied a quantity nobody typed, showed it in the box, and carried it to the wire:
  typed 7, cleared, submitted `{"qty": 0}`.

  For a quantity that is an order line of zero, for a price it is free, for a discount it is all of it.
  And because the box _shows_ the zero, noticing means re-reading a field you have just emptied.

  Empty is now nothing, text that is not a number is nothing, and a number is itself — which is what
  `@modyra/lit` already did for the same kind through the same public call.

  Read from the text rather than `valueAsNumber`: that property is unimplemented in some DOM
  implementations this renderer runs in, where it answers `NaN` for a box that plainly holds a number.

- be91a76: The framework-free range picker stops deciding what a range means

  `createDaterangeFieldController` has existed since the controllers batch and no
  renderer consumed it. The framework-free one now does: which pick starts a range
  and which closes it, what the bounds refuse, and which cells fall between the
  ends are its answers.

  Two of those were wrong here. The cells were painted by comparing ISO strings —
  a fourth opinion on a question three other places already answered — and they
  were drawn from the committed value, so the highlight could not follow the
  pointer before anything was decided. The controller paints from `previewed`,
  which is what that distinction exists for.

  Typing a range and clicking one now commit through the same two intents, so they
  cannot diverge.

- 9fab18e: A daterange keeps what is typed into it. Its two text inputs took keystrokes and discarded them: a
  well-formed range typed into them left the value at `{ start: null, end: null }` and both boxes
  empty, so a person who typed a range, tabbed away and saw nothing had no way to learn that the
  calendar was the only door. Both renderers did it, so the repair is in the shared controller: a
  `type` intent carries one end as **text**, `parseEntry` reads it in the host's locale, a half-written
  range is held as a half-written range, and text the field cannot read stays on screen in
  `state.entryText` where it can be corrected instead of being erased on the way out.

  **Breaking for a consumer that builds `MdyDaterangeFieldState` itself**: `entryText` is a required
  member, as it already is on the datepicker's state. Reading the state is unaffected. A renderer that
  parses text itself and dispatches only on success should dispatch `{ type: "type", end, text }`
  instead — that is what made an unreadable entry vanish.

- 7cd79cc: A timepicker holds a time the form can hold. It committed the value in the notation it displays, so
  a twelve-hour picker — the default — handed the form `"02:30 PM"`, which is not what
  `MDY_VALUE_CONTRACTS.timepicker` declares a time is: the field was invalid the moment it was
  answered, with "This field holds a time (HH:mm)" beside a value the user picked from its own dial,
  and the payload carried a notation nothing downstream parses. The value is canonical `HH:mm`
  wherever it is held; which notation a person reads is the field's own, projected as
  `state.display`.

  **Breaking for a consumer that builds `MdyTimepickerFieldState` itself**: `display` is a required
  member. A renderer should paint `state.display` rather than `state.value`, which is what keeps a
  twelve-hour control from showing a twenty-four-hour time.

- 9a7c524: A slider's track spans the number the form holds

  A slider spans something whether or not a document declares a range, and the default turned into a
  misrepresentation:

  ```jsonc
  { "kind": "slider", "initialValue": 150 } // no bound declared
  // the form holds 150, the page draws a track ending at 100 and puts the thumb there
  ```

  `step: 5` did the same to a value of 7 — the platform snaps a range input to a multiple — and neither
  case said anything, because neither is a rule: no bound was declared, and the validator vocabulary
  has no `step`. Both renderers had invented the same `?? 100` separately, so they agreed about a lie.

  `sliderTrack(constraints, value)` is now the one place the range is decided. It widens to include the
  value **only where nothing was declared** — a declared `max` is kept, because the attribute is the
  native guard and a value past it is refused with a message since the bound became a rule. A `step`
  that would move the thumb off the value is dropped.

  The drawn range is no longer a constant: a slider with no declared bound and a large value draws a
  track that reaches it. `nativeConstraintAttributes` and `MdyFieldShellA11yOptions` take an optional
  `value`; omitting it keeps the previous behaviour, which is right for every kind that draws no track.

  Recorded as [ADR 0067](../docs/architecture/0067-a-track-spans-what-the-field-holds.md), which also
  states the ordering Lit now depends on: a range input clamps its value to the bounds it carries when
  the value is assigned.

- 1f91ae2: An entry a control cannot read is an error like any other

  ADR 0073 made an unreadable date or time entry a real error of the field. The paint did not follow:
  both renderers still asked the control's own state whether to look invalid, which is outside every
  rule the form applies to its errors.

  Two opposite halves of one hole. `@modyra/plain` kept announcing `aria-invalid` and kept the message
  on the page after the field was **disabled** — a control nobody can touch, still reported as wrong to
  a screen reader. `@modyra/lit` painted the message without ever reporting the entry, so the control
  was never marked invalid at all: visible to whoever can see it, absent for whoever cannot.

  Both now report the entry to the form and read the verdict back through `showsAsInvalid` and
  `shownErrorsOf`, which is where "a field out of play has no verdict" lives. The same field made wrong
  by an ordinary rule already obeyed that in both renderers; the entry error now does too.

- 7e1b5a5: Every option a document declares is one a person can reach. An option's key — and the id built from
  it — came from its value, so two options a document declares with the same value produced one key,
  one element and one id: a list of three offered two, and the one that vanished was the second. The
  controller now gives each painted option a key of its own and publishes them as
  `MdySelectState.optionKeys`, in the order the options are painted. Selection still follows the value,
  so two options that say the same thing remain one choice, and the parser still reports the duplicate
  as the document defect it is.

  An option value carrying whitespace or the id delimiter is percent-encoded where it becomes part of
  an id: `aria-activedescendant` and its family are space-separated lists of ids, so an option valued
  `New York` produced a reference to two elements that do not exist and pointed a screen reader at
  nothing.

  **Breaking for a consumer that builds `MdySelectState` itself**: `optionKeys` is a required member. A
  renderer keying options by value should read it instead.

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

- 92b7f7b: One backdrop, drawn by the contract and painted by the theme

  `.mdy-overlay-backdrop` is in `MDY_SHARED_UI_CLASSES` and no theme painted it, so
  the token beside it — `--mdy-overlay-backdrop-bg`, with a dark ramp — was
  declared and read by nothing. What the three renderers did instead was three
  different things: Angular wrote `rgba(0,0,0,0.32)` inline, so no product could
  change how its modals dim; Lit drew the element under _every_ open popup,
  dropdowns included, which is why painting it would have dimmed the page behind a
  select; and the framework-free renderer drew none at all, so its modals never
  dimmed.

  The theme paints the class now, and `setOverlayOpen` draws the element when the
  placement is modal — `syncOverlayBackdrop` for a renderer that learns the
  placement a moment after showing the popup, which is what measuring first means.
  "A modal dims what is behind it" is not a rendering decision each adapter gets to
  make differently.

  `audit-contract-style-coverage` also reads `MDY_SHARED_UI_CLASSES` now. It
  enumerated parts, popup, portal, shell, layout and chip and skipped the table of
  classes belonging to no single kind, so nine classes the contract declares were
  reported as outside it and sat in the allowlist for that reason alone.

- 8514984: Executing widget commands, written once

  Eight adapters had the same command executor: collect focus and scroll into a queue, run everything
  else now, drain the queue after the host has rendered. What differed was the id of a live region and
  one call — `queueMicrotask`, `requestAnimationFrame`, `afterNextRender`, `host.updateComplete.then`.

  `createCommandRuntime({ announcerId, defer })` in `@modyra/widgets` is that function. Each adapter
  passes its own beat and writes nothing else, which is also where the difference becomes visible: the
  framework-free renderer's `defer` runs immediately, because it writes to the document itself and has
  nothing to wait for.

  Two more shapes every binding was writing itself:

  - `subscribeController(controller, reactivity, notify)` — watch a controller and hand back the
    teardown for it and the subscription. Six of the eight hooks in the two hook-based adapters watched
    `state` alone and were right by coincidence: every controller's view is currently a function of its
    state, and the contract does not promise it.
  - `fieldCommandHandlers(handle)` — what a control with no overlay gives a command executor. `setOpen`
    is a no-op rather than absent, because one vocabulary means answering the question rather than
    crashing on it.

  `MdyAngularCommandHandlers` and `MdyLitCommandHandlers` are aliases of `MdyWidgetCommandHandlers`
  instead of member-by-member copies, which is what the other five adapters always did.

  A guard moved upstream with the code: the framework-free renderer checked for `scrollIntoView` before
  calling it, because the DOM implementation every adapter's suite runs under does not have it. That
  check now protects all of them.

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

- 4af560a: Where a calendar's header goes, decided once

  `calendarViewOnToggle` states it: from the days the header opens the **years**,
  because someone reaching for it wants a date far from the month on screen — a
  birth date, a maturity — and walking through the months to get there is the
  paging the views exist to avoid. From anywhere else it goes back to the days.

  Two renderers had agreed on that by accident. A third, written later against the
  same contract, chose the other order — which is the same defect this batch exists
  to close, committed while closing it. All three ask now.

  The renderers also stop keeping their own three strings for which view is
  showing. `MdyCalendarViewMode` is the vocabulary, so the translation between it
  and a local `"calendar" | "month" | "year"` — written four times, and the whole of
  what those four copies were — is gone.

- 483d9b7: A teardown releases what it was observing, and the check can see when it does not

  `renderField` hands back a teardown and nothing asserted it. Only the whole-form entry point was
  covered by the lifecycle suite, so the entry point a host uses when it composes its own layout — one
  field at a time — had its most important obligation unchecked. It is now asserted for all seventeen
  kinds.

  `inspectUnmount` gained the case it could not see. It compared the document before and after a poke,
  and swallowed every throw as "the handle refused, and refusing is correct". That is true of a handle
  and false of an effect: an effect still subscribed after teardown does run, reads a form that is
  gone, and raises — leaving nothing in the document, so the check read the leak as a clean teardown.
  `MdyUnmountObservation.errorsAfterDispose` supplies what the runtime reported, and
  `MDY_LIFECYCLE_ISSUE.effectThrewAfterUnmount` names it.

  `renderField` also documents which runtime it observes on. The default builds a fresh one, which is
  right for a field rendered alone and wrong for a field belonging to a form: two runtimes over one
  handle are two schedulers with no ordering between them, and only one of them stops when the form
  does. Pass `form.reactivity`.

- 010fa6a: The lifecycle inspector has now rejected something

  `mutation-suite.spec.mjs` held nineteen mutations and every one struck the DOM
  inspector or the state inspector. The lifecycle inspector — the one that judges a
  teardown — had never been put to the test, which is where the blind spot found in
  the demo batch had lived: an effect still subscribed after dispose renders into a
  document it no longer owns, and nothing in the document says so.

  Five mutations join it, one per rule: a root left behind, an id still resolving, a
  disposed instance that still writes, one whose effect ran and failed, and two live
  instances minting the same id. Each names the rule it breaks, because asserting
  only that _something_ was reported lets one rule cover for another — a leftover
  element raises the DOM code too, and the id rule could stop looking with the suite
  still green. Verified by turning each rule off in turn.

  The states panel declares the eight controllers it drives. It mounts every kind
  and pushes each into disabled, readonly, touched and out of play, so every kind's
  controller runs and the projection it composes reaches the DOM; the panel had
  been claiming four names for work it did across all of them.

- 009d7ad: The opener a contract names is the one a keyboard reaches

  `MDY_POPUP_OPENERS` names the part that opens each popup. `@modyra/lit` disagreed twice over, and each
  half looked defensible alone: its daterange put `aria-expanded` and `aria-haspopup` on **both** date
  inputs — two elements describing one popup, neither of them the declared opener, and a text input is a
  textbox with nothing to expand — while the toggle that _is_ the opener carried `tabindex="-1"`.

  Together they closed both doors. Measured across every kind with a popup, offering every key the
  contract names to every part a keyboard can reach: plain opens all six, lit opened four. Its daterange
  and timepicker could not be opened without a mouse at all.

  Now the declared opener carries the state and nothing else does, the toggle is reachable, and lit's
  timepicker control answers the keys `MDY_WIDGET_KEYBOARD` publishes — read through `keyBindingFor`
  rather than written again in the element.

  `aria-haspopup` names what opens: the daterange promises `grid` in both renderers, as its own
  projection declares. `@modyra/plain` promised `dialog`; `@modyra/lit` promised it on the inputs.

  The daterange projection no longer writes `role="combobox"` on its toggle. The opener table
  deliberately declares no role for the kinds whose opener is a button, no renderer consumed the literal
  one, and a button whose value lives in the two inputs beside it is not a combobox.

- a629f50: Out of play, no verdict — completed, and asked in one place

  `shownErrors` and `showsAsInvalid` reached six of the seven field kinds. The timepicker kept its own
  answer, so a disabled timepicker painted as failing while a disabled datepicker did not. It does not
  any more.

  Two additions finish the rule:

  - `errorsVisible(flags, errors)` answers _is the error text on screen_ — failing **and** touched.
    Three renderers each had their own spelling of it; one of them applied it to a single kind.
  - `shownErrorsOf(handle)` asks the question of a field handle. Two renderers had written the same
    wrapper around `shownErrors` byte for byte; both now import this one.

  `MdyFieldVerdictSource` names what a handle must offer to be asked.

  Nothing about a form's model changes: a field out of play keeps its errors and its value, and both
  come back the moment the form asks about it again.

- Updated dependencies [435a31a]
- Updated dependencies [76509d3]
- Updated dependencies [d2cdcaa]
- Updated dependencies [27224d8]
- Updated dependencies [894699d]
- Updated dependencies [f297a3c]
- Updated dependencies [09b1c21]
- Updated dependencies [c0b44a8]
- Updated dependencies [6e53749]
- Updated dependencies [25d004c]
- Updated dependencies [57c68d8]
- Updated dependencies [ac052bc]
- Updated dependencies [61e814c]
- Updated dependencies [de7e122]
- Updated dependencies [3fa4c1a]
- Updated dependencies [45eb775]
- Updated dependencies [d2cdcaa]
- Updated dependencies [039059c]
- Updated dependencies [a76fc10]
- Updated dependencies [3f0787e]
- Updated dependencies [7ac08a7]
- Updated dependencies [437bad1]
- Updated dependencies [4892a49]
- Updated dependencies [1a8138f]
- Updated dependencies [d03419c]
- Updated dependencies [d9203ee]
- Updated dependencies [2904441]
- Updated dependencies [ccde959]
- Updated dependencies [1c164b7]
- Updated dependencies [9b89cd2]
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
- Updated dependencies [3bd2d09]
- Updated dependencies [111aa5b]
- Updated dependencies [95bb48b]
- Updated dependencies [f00ead6]
- Updated dependencies [0c3a770]
- Updated dependencies [1783afc]
- Updated dependencies [f47ee5e]
- Updated dependencies [b6a1325]
- Updated dependencies [3ff02a3]
- Updated dependencies [7f847da]
- Updated dependencies [833a5f6]
- Updated dependencies [3233dd4]
- Updated dependencies [d89c221]
- Updated dependencies [1b76a2c]
- Updated dependencies [a2a2bda]
- Updated dependencies [7c8e0b4]
- Updated dependencies [aa09065]
- Updated dependencies [eab4653]
- Updated dependencies [a6dc4de]
- Updated dependencies [1b24d8f]
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
- Updated dependencies [bc1cc05]
- Updated dependencies [1c8e529]
- Updated dependencies [0a96145]
- Updated dependencies [e59d37c]
- Updated dependencies [ecca49f]
- Updated dependencies [2e005a4]
- Updated dependencies [ecee2fd]
- Updated dependencies [117ecba]
- Updated dependencies [501dbb2]
- Updated dependencies [0a6d296]
- Updated dependencies [892c01b]
- Updated dependencies [551320a]
- Updated dependencies [e6b35e4]
- Updated dependencies [e35174d]
- Updated dependencies [5e32e40]
- Updated dependencies [4d4110b]
- Updated dependencies [af002ed]
- Updated dependencies [9fab18e]
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
- Updated dependencies [9fc24f7]
- Updated dependencies [70220fc]
- Updated dependencies [c7b25ce]
- Updated dependencies [cfa1ec6]
- Updated dependencies [7cd79cc]
- Updated dependencies [9a7c524]
- Updated dependencies [c228019]
- Updated dependencies [b75b5d3]
- Updated dependencies [0879e90]
- Updated dependencies [44a23e5]
- Updated dependencies [daf38f2]
- Updated dependencies [d6a97f6]
- Updated dependencies [7cbcd34]
- Updated dependencies [ca1c6c3]
- Updated dependencies [aa3574c]
- Updated dependencies [b1a31dd]
- Updated dependencies [023d6c7]
- Updated dependencies [c464e35]
- Updated dependencies [bbf6081]
- Updated dependencies [4914abd]
- Updated dependencies [b5c81b7]
- Updated dependencies [315a533]
- Updated dependencies [5165a7b]
- Updated dependencies [30d8a97]
- Updated dependencies [136fd3a]
- Updated dependencies [c0e0348]
- Updated dependencies [49cebaa]
- Updated dependencies [7d5dc5b]
- Updated dependencies [8802f09]
- Updated dependencies [bf0c12e]
- Updated dependencies [67aa107]
- Updated dependencies [611fd20]
- Updated dependencies [e30a985]
- Updated dependencies [85ff99a]
- Updated dependencies [9190e59]
- Updated dependencies [ad86c08]
- Updated dependencies [0f9cf08]
- Updated dependencies [e4182c0]
- Updated dependencies [cd62884]
- Updated dependencies [59c70fe]
- Updated dependencies [1b24d8f]
- Updated dependencies [7e1b5a5]
- Updated dependencies [d522e25]
- Updated dependencies [211ee54]
- Updated dependencies [4678b59]
- Updated dependencies [3fa4c1a]
- Updated dependencies [1aff75a]
- Updated dependencies [000f195]
- Updated dependencies [92b7f7b]
- Updated dependencies [bd8a9ed]
- Updated dependencies [357316c]
- Updated dependencies [8514984]
- Updated dependencies [7997644]
- Updated dependencies [f207e5e]
- Updated dependencies [5589197]
- Updated dependencies [9f29b19]
- Updated dependencies [89e7d14]
- Updated dependencies [bda72f8]
- Updated dependencies [d2e0d7f]
- Updated dependencies [8d0cadf]
- Updated dependencies [556517c]
- Updated dependencies [4749edc]
- Updated dependencies [eacc848]
- Updated dependencies [83e94a5]
- Updated dependencies [50e1211]
- Updated dependencies [4af560a]
- Updated dependencies [2707f44]
- Updated dependencies [87ff0a4]
- Updated dependencies [621866a]
- Updated dependencies [483d9b7]
- Updated dependencies [3c7f88f]
- Updated dependencies [e2828ed]
- Updated dependencies [d9583ff]
- Updated dependencies [e6ca669]
- Updated dependencies [d51b2fa]
- Updated dependencies [8e5fef8]
- Updated dependencies [c8c8470]
- Updated dependencies [e712ea0]
- Updated dependencies [ee8040c]
- Updated dependencies [ea534af]
- Updated dependencies [010fa6a]
- Updated dependencies [1aff75a]
- Updated dependencies [009d7ad]
- Updated dependencies [5029184]
- Updated dependencies [ca1c6c3]
- Updated dependencies [07bea5d]
- Updated dependencies [7f738dd]
- Updated dependencies [c849c60]
- Updated dependencies [e16ed4f]
- Updated dependencies [b137ea2]
- Updated dependencies [2b04e24]
- Updated dependencies [55dd238]
- Updated dependencies [4bc6e19]
- Updated dependencies [0956768]
- Updated dependencies [74dbda3]
- Updated dependencies [3b6ecac]
- Updated dependencies [8347116]
- Updated dependencies [324d2aa]
- Updated dependencies [bd05055]
- Updated dependencies [2cbfb3f]
- Updated dependencies [a629f50]
- Updated dependencies [9133c94]
- Updated dependencies [14d74cc]
- Updated dependencies [e7b5f9c]
- Updated dependencies [a64a7a3]
- Updated dependencies [bb37b4e]
- Updated dependencies [61b5b04]
- Updated dependencies [d1733cb]
- Updated dependencies [8478a18]
- Updated dependencies [c48c9c1]
  - @modyra/core@2.2.0
  - @modyra/widgets@2.2.0

## 0.8.0

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

- bceef6d: The conformance kit answers all ten sections for the framework-free renderer.

  `npm run test:conformance-browser` reported eight of ten: _Declared rules reach the control_ and
  _A value the options do not contain is shown_ printed "not run — the config does not export
  `declaresRules`". The browser config re-exports the Node config's `mount`, and those two sections ask
  the **fixture**, not the page — so the flag simply had not travelled with the function it belongs to.
  The same renderer was described twice, and one description was missing a word.

  It now reports `CONFORMANT · 17 kind(s) · 10 of 10 section(s) run`, keyboard behaviour and the
  accessibility audit included.

  Closes finding S (`docs/contract-gaps.md`).

- Updated dependencies [34d5023]
- Updated dependencies [b31091b]
- Updated dependencies [965dd88]
  - @modyra/core@2.2.0
  - @modyra/widgets@2.1.0

## 0.7.1

### Patch Changes

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
- Updated dependencies [2e29f30]
- Updated dependencies [062881c]
- Updated dependencies [c090eac]
- Updated dependencies [992b36d]
- Updated dependencies [850a463]
- Updated dependencies [90fdf00]
- Updated dependencies [df1aaeb]
- Updated dependencies [c47d0ac]
- Updated dependencies [2a38f16]
- Updated dependencies [6921584]
- Updated dependencies [6921584]
- Updated dependencies [062881c]
  - @modyra/core@2.1.1
  - @modyra/widgets@2.0.2

## 0.7.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [0b64826]
- Updated dependencies [ba5f5f9]
- Updated dependencies [faf3275]
- Updated dependencies [206b0b3]
- Updated dependencies [3d8391b]
- Updated dependencies [495ff44]
- Updated dependencies [8b88c9f]
  - @modyra/core@2.1.0
  - @modyra/widgets@2.0.1

## 0.6.1

### Patch Changes

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

- Updated dependencies [c76dfc9]
- Updated dependencies [c1ddb7c]
- Updated dependencies [2037ba5]
- Updated dependencies [4e9a4bc]
- Updated dependencies [3e9e1fb]
- Updated dependencies [a5658fb]
- Updated dependencies [7fb3ebf]
- Updated dependencies [eb267c1]
- Updated dependencies [dce1918]
- Updated dependencies [3161bad]
  - @modyra/widgets@2.0.0
  - @modyra/core@2.0.0

## 0.6.0

### Minor Changes

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

- bdde472: `mountMdyForm` takes an `idPrefix`, so two forms can share a page.

  Every id a form generates derives from the widget id, and the widget id was the field name alone.
  Two forms built from the same field names therefore minted the same ids, and the second form's
  `label[for]`, `aria-describedby` and `aria-errormessage` all resolved to the **first** form's
  elements. Neither form examined alone looked wrong, which is why the whole suite was green: the
  defect only exists on a page holding both. The radio group's `name` collided the same way, so two
  radio groups merged into one and selecting in the second cleared the first.

  ```ts
  mountMdyForm(host, fields); // ids unchanged: `email`, `email__label`
  mountMdyForm(other, fields, { idPrefix: "quote" }); // `quote-email`, `quote-email__label`
  ```

  Additive. Unset — the default — leaves every generated id byte-identical, and the same option is
  what makes ids deterministic across a server and a client that agree on the prefix.

  Two rules are enforced where the form is built rather than discovered as a duplicate id somewhere
  in the document: the prefix may not contain `__`, which separates the segments of a generated id,
  and it may not contain `-`, which joins it to the field name. The second is what makes two distinct
  prefixes provably unable to collide — the joiner's first occurrence always ends the prefix, so
  `"a" + "b-c"` and `"a-b" + "c"` cannot both produce `a-b-c`.

  `renderField` and each `render*Field` take the widget id as a new trailing optional argument,
  defaulting to the field name. Existing calls are unaffected.

### Patch Changes

- ff37d78: Opening a date range puts the keyboard in its calendar.

  Its own datepicker sibling already did, and so did the other renderer's range picker — this one
  opened a grid and left focus on the toggle behind it, so a keyboard user had a calendar on screen
  and no way into it without tabbing. Focus now goes to the start endpoint when the range has one, and
  to the first pickable day otherwise.

  **Every renderer's divergence ledger is now empty**, across at rest, invalid, disabled and open, and
  after the open-then-Escape sequence. This was the last recorded entry.

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

- b558322: The clock's hour and minute boxes enforce the range the contract states for them.

  Typed entry went through `Number.isFinite`, which accepts `25` and `61` happily. The impossible time
  was dropped somewhere downstream with nothing on screen to say the entry was wrong, so the box sat
  there looking accepted.

  Now both segments consume `acceptTimeField` / `stepTimeField` / `timeFieldBounds`:

  - An hour over 12 (or over 23 on a 24-hour clock) and a minute over 59 mark the box `aria-invalid`
    and show the range they expected. Clearing a box is not an error — it is being cleared, not
    asserted.
  - **Arrow keys wrap**: 12 → 1, 1 → 12, 59 → 0. And a step on an already-invalid segment brings it
    back inside the range, because stepping is how a user leaves a bad value rather than the one
    operation that refuses to move while the field is wrong.
  - Each segment advertises its own `min`/`max`.

  A declared contract nothing consumes is the failure this repo has recorded three times, so the tests
  assert the wiring rather than the arithmetic: removing the invalid marking fails four of them, and
  clamping instead of wrapping fails another.

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

- 3367ced: The date and time pickers reflect that they have been touched.

  Neither renderer called the field shell's `syncState`, so the root carried no
  `mdy-renderer--touched` and the wrapper no error modifier — the treatments three themes key off. A
  user could leave a required picker empty, blur it, and see the field styled as though nothing had
  happened, while every other kind in this renderer showed its error state.

  The same defect was fixed for the select and the option groups when the invalid state was first
  compared across renderers; these two were missed because nothing asserted the state afterwards.
  Now something does.

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

- Updated dependencies [04d150e]
- Updated dependencies [5db335c]
- Updated dependencies [1c672d4]
- Updated dependencies [e3f27b3]
- Updated dependencies [0a23bfd]
- Updated dependencies [e8b586a]
- Updated dependencies [9ec6b65]
- Updated dependencies [76f4e7e]
- Updated dependencies [2d2398b]
- Updated dependencies [4de3620]
- Updated dependencies [b213813]
- Updated dependencies [c1584ad]
- Updated dependencies [b0d9252]
- Updated dependencies [27c1222]
- Updated dependencies [a3c4580]
- Updated dependencies [7bafd3d]
- Updated dependencies [3bb85a6]
- Updated dependencies [76e119e]
- Updated dependencies [c1b9b10]
- Updated dependencies [569128a]
- Updated dependencies [49c28c9]
- Updated dependencies [35d6094]
- Updated dependencies [186cbad]
- Updated dependencies [ee8198d]
- Updated dependencies [eb224f8]
- Updated dependencies [0f85077]
- Updated dependencies [d6e8855]
- Updated dependencies [ca0eebc]
- Updated dependencies [2ac6b1e]
- Updated dependencies [44d0e03]
- Updated dependencies [3068258]
- Updated dependencies [0f09b34]
- Updated dependencies [0d3fa5f]
- Updated dependencies [08cb845]
- Updated dependencies [8e67cfe]
- Updated dependencies [f4e593a]
- Updated dependencies [31cbcdb]
- Updated dependencies [75d2553]
- Updated dependencies
- Updated dependencies [5c8784c]
- Updated dependencies [6e434ab]
- Updated dependencies [5dbdf1a]
- Updated dependencies [b10a5b1]
- Updated dependencies [8d7a621]
- Updated dependencies [c7c6adf]
- Updated dependencies [f4b41af]
- Updated dependencies [afef217]
- Updated dependencies [635529b]
- Updated dependencies [bc91571]
- Updated dependencies [8bdc82b]
- Updated dependencies [81e1e39]
- Updated dependencies [e4aa213]
- Updated dependencies [7091a93]
- Updated dependencies [342f396]
- Updated dependencies [84ae084]
- Updated dependencies [50a654b]
- Updated dependencies [1a99bbb]
- Updated dependencies [bfeb371]
- Updated dependencies [816ca68]
- Updated dependencies [9a8a747]
- Updated dependencies [6d1e0cd]
- Updated dependencies [bdde472]
  - @modyra/widgets@1.0.0
  - @modyra/core@1.0.0

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

- 46e6a0e: A popup goes in the top layer, so nothing above it can move it

  `@modyra/plain` positions a popup from viewport coordinates and lets the foundation apply them to a
  `position: fixed` box. That only holds while no ancestor is a containing block for fixed
  descendants — and anything carrying `contain: layout` becomes one, which is exactly what
  `container-type` implies. The foundation needs `container-type` on the form so a row can ask how wide
  the _form_ is rather than how wide the window is, and without this change that would have quietly
  moved four popups by the form's own offset.

  `setOverlayOpen(popup, open)` is now the one place that decides how a popup is shown, the way one
  place already decides where it is placed — the six fields each assigned `hidden` themselves before.
  It sets `popover="manual"` and calls `showPopover()`/`hidePopover()`, keeping `hidden` in step so the
  two can never disagree. `manual` rather than `auto`: light-dismiss would close the popup before this
  renderer's own outside-pointer handling ran, and two things closing one popup is how a click-through
  appears.

  Four of the six popups — colors, datepicker, daterange, timepicker — live in their field's own
  subtree and are the ones this protects. `select` and `multiselect` already portal to `document.body`,
  so nothing in the form could contain them; they move to the top layer too, for one behaviour rather
  than two.

  It also fixes a standing bug in its own right: a popup could be clipped by an `overflow: hidden`
  ancestor, and in the top layer it cannot be.

  The foundation adds one declaration, `.mdy-popup[popover] { position: fixed }`. Every other UA
  popover style — the centring insets, the default border, padding, background and width — is already
  answered by the contract's own `.mdy-popup` rule, which outranks the UA sheet.

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
- 9f0732c: Portal Plain select overlays beyond clipped renderer containers and complete the Modern theme for the Plain host, listbox overlay and toggle presentation while preserving Widgets behavior and accessibility state.
- 623f3fc: Multiselect opens an overlay, and the themes stop knowing which renderer drew the DOM

  Plain's multiselect now renders a trigger with selection chips plus a portalled popup holding the
  filter field and the option chips, instead of laying every option out inline — opening it no longer
  resizes the field and pushes the rest of the form down the page. Its select renderer drops its
  private positioning code for the shared `positionOverlay`/`trackOverlay` helpers.

  `@modyra/styles` gains a foundation `.mdy-overlay` primitive: any popup portalled out of its own
  subtree carries the class, the renderer writes `--mdy-overlay-*`, and the foundation owns the
  positioning, clipping and `[hidden]` behaviour. Modern's `.mdy-plain-select__portal`,
  `.mdy-plain-form` and `.mdy-plain-{date,time}picker` rules are gone with it, so no theme file
  contains an adapter-specific selector any more.

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

- 77f2095: Name every control's parts in the contract, so a theme has a stable hook for each one and an
  adapter never has to invent a class: slider (`mdy-slider-container` / `mdy-slider` /
  `mdy-slider-value`), checkbox and toggle (`mdy-checkbox__control`, `mdy-toggle__control`), radio and
  segmented (group, option, control, label), select and multiselect (trigger, value, arrow, popup,
  search, list, option, chips, chip). The select's filter is now a contract part of its own: it is an
  input at the top of the popup, not typing over the trigger, so the committed value stays visible —
  Plain renders it that way and the DOM gate accepts a portalled popup as the contract's own portal
  capability rather than a containment violation.
- 5a66c4a: Declare outside-pointer dismissal in the contract: every widget that owns an overlay reports
  `capabilities.dismissOnOutsidePointer`, and the decision stays `overlayLifecycleTransition`, so a
  pointer landing outside closes by default and a popup that should not be dismissible has to say so.
  Plain wires it through one shared helper for the select, the pickers, the date range and the colour
  palette.

### Patch Changes

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

- 33679ba: Each widget declares how its popup attaches

  `capabilities.anchoring` names, per kind, whether the popup matches its control's width and how much
  room it needs — a select's list belongs under its control and as wide as it, a calendar is sized by
  its own content. The renderers read it instead of repeating those numbers, so two adapters can no
  longer choose different widths for the same widget, and `MDY_OVERLAY_PORTAL_CLASS` names the class
  a renderer adds when it lifts a popup out of its field.

  The suite asserts every overlay-capable kind declares its anchoring and carries the shared container
  class, so a new widget cannot be added without saying how its popup attaches.

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

- 3f2e9d0: The multiselect's popup is one anatomy, not one per renderer

  Angular's multiselect draws a header holding the filter, a grid of option chips, each chip in its own
  wrapper, and marks a taken option with a modifier. None of that was named, so another renderer could
  only produce a list that happened to hold the same words. The catalog now names `popupHeader` and
  `optionWrapper`, the listbox carries the grid class every adapter must emit, and the chips carry
  their state as modifiers — `mdy-chip--selected`, with `--counter` or `--centered` for the mode —
  which is what a theme styles.

  The framework-free renderer draws that anatomy: the filter in the header, each option chip in its
  wrapper inside the grid, and the selected modifier on a chip in either mode.

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

- 9d7b426: Give the boolean controls the anatomy Angular and Lit already render: one clickable
  `.mdy-checkbox` / `.mdy-toggle` wrapper holding the input, the drawn `.mdy-toggle__track` >
  `.mdy-toggle__thumb`, and the text after it. A switch is a checkbox input with `role="switch"`, and
  the wrapper — not the input — carries the component class. The theme's Plain-only
  `.mdy-switch-control` and input-drawn checkbox rules are gone with the markup that needed them.
- ecfb325: Show the committed value in the control that opened the overlay. Committing restores focus to the
  trigger, so the focus-guarded sync skipped exactly the update that mattered: a date picked from the
  calendar never reached the input, and a selected option left the stale search text in the select
  trigger. The sync is now guarded by whether the user is typing.
- 9f0170d: Render every one of the seventeen Widgets catalog kinds, including `daterange`, `file` and `colors`.
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

- 9e8d1c8: A disabled multiselect leaves no operable chips behind

  The multiselect renders its options twice — once in the field, once in the popup — and only the
  popup's grid applied the contract part. The reason was sound as far as it went: the part carries an
  `id` and a `hidden` flag, and only one of the two grids can own the id while only the popup filters.

  Taking nothing at all for the field grid was too blunt. Everything else the part says is true of
  both chips, so a disabled multiselect left two live buttons in the field: no `disabled`, no
  `aria-disabled`, still clickable. The field grid now applies the part with the id and the filtering
  dropped.

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

- b4b236d: Make filtering part of the contract: an option a query does not match is projected as `hidden`
  (plus a `--hidden` class) by the select and multiselect controllers, so every renderer filters
  identically by applying the part instead of reimplementing the match. The theme stops its own
  `display` from beating `[hidden]` on options and chips.
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

- Updated dependencies [6f09012]
- Updated dependencies [969c08f]
- Updated dependencies [29621a7]
- Updated dependencies [602ac27]
- Updated dependencies [2c6a57f]
- Updated dependencies [b0aa545]
- Updated dependencies [2ce4ef1]
- Updated dependencies [9e8cbad]
- Updated dependencies [879b5e9]
- Updated dependencies [cd22e96]
- Updated dependencies [33679ba]
- Updated dependencies [1d3a104]
- Updated dependencies [e5eb12d]
- Updated dependencies [c2fc744]
- Updated dependencies [808293d]
- Updated dependencies [c4ca77d]
- Updated dependencies [207901b]
- Updated dependencies [05c5665]
- Updated dependencies [242551e]
- Updated dependencies [4751929]
- Updated dependencies [18929b0]
- Updated dependencies [d568743]
- Updated dependencies [098a0af]
- Updated dependencies [8279dc3]
- Updated dependencies [f580d4b]
- Updated dependencies [8e1164f]
- Updated dependencies [db0c39a]
- Updated dependencies [daaabe1]
- Updated dependencies [3f2e9d0]
- Updated dependencies [a8606da]
- Updated dependencies [ba52f67]
- Updated dependencies [f5ee72d]
- Updated dependencies [c170cf3]
- Updated dependencies [6bdfb02]
- Updated dependencies [a0559ec]
- Updated dependencies [351c0ed]
- Updated dependencies [6f6ed4e]
- Updated dependencies [f93c8cd]
- Updated dependencies [ebfa0ca]
- Updated dependencies [4803d30]
- Updated dependencies [8e1dc80]
- Updated dependencies [d9e424a]
- Updated dependencies [d21390f]
- Updated dependencies [9864d9a]
- Updated dependencies [6aab031]
- Updated dependencies [fd87ae7]
- Updated dependencies [9d7b426]
- Updated dependencies [e4ff1ac]
- Updated dependencies [26017d8]
- Updated dependencies [e0a4cef]
- Updated dependencies [5dbf493]
- Updated dependencies [a3c662e]
- Updated dependencies [1523836]
- Updated dependencies [e7f3189]
- Updated dependencies [fc6327f]
- Updated dependencies [0bd898d]
- Updated dependencies [7a574d1]
- Updated dependencies [61271c5]
- Updated dependencies [fe0dba3]
- Updated dependencies [8b87472]
- Updated dependencies [5b34979]
- Updated dependencies [3acc9bf]
- Updated dependencies [88b57b4]
- Updated dependencies [b3aa842]
- Updated dependencies [d32694a]
- Updated dependencies [f7e0c7c]
- Updated dependencies [62575e9]
- Updated dependencies [f998046]
- Updated dependencies [f759e3d]
- Updated dependencies [df563d4]
- Updated dependencies [6d000c1]
- Updated dependencies [1644bf5]
- Updated dependencies [026cf08]
- Updated dependencies [ec3d8ca]
- Updated dependencies [a613ac8]
- Updated dependencies [cf497e7]
- Updated dependencies [e403b6d]
- Updated dependencies [1008e4e]
- Updated dependencies [f7e0c7c]
- Updated dependencies [095fff8]
- Updated dependencies [77f2095]
- Updated dependencies [92d6155]
- Updated dependencies [4b2560b]
- Updated dependencies [d981a2f]
- Updated dependencies [6bff3da]
- Updated dependencies [bbb575e]
- Updated dependencies [8061d1d]
- Updated dependencies [de65e03]
- Updated dependencies [93a65aa]
- Updated dependencies [2388e2a]
- Updated dependencies [cf9b772]
- Updated dependencies [dc7acff]
- Updated dependencies [e6e592d]
- Updated dependencies [3846236]
- Updated dependencies [c136ad1]
- Updated dependencies [0b4298b]
- Updated dependencies [847f436]
- Updated dependencies [9b2646a]
- Updated dependencies [fd6e967]
- Updated dependencies [4206be3]
- Updated dependencies [b4b236d]
- Updated dependencies [9c8a238]
- Updated dependencies [d91dca1]
- Updated dependencies [ff10fc7]
- Updated dependencies [d17ea98]
- Updated dependencies [0310e27]
- Updated dependencies [5a66c4a]
  - @modyra/widgets@0.5.0
  - @modyra/core@0.5.0

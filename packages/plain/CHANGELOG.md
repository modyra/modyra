# @modyra/plain

## 0.12.0

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

- 3852b04: A `<form>` reset returns the model to its initial values

  A Cancel button is `type="reset"`, and until now no renderer answered it correctly. The browser's
  reset returns a control to its `value` _attribute_, which these renderers never write — they write
  the property to keep the box in step with the model. So plain and lit emptied the box and left the
  model holding what the person had typed: **what they saw stopped being what the form would send.**
  Angular restored the box on the next pass, which made Cancel do nothing at all.

  All three now return to the initial values, which is what a reset means and what HTML promises.

  New in `@modyra/widgets`: `bindFormReset(binding)` and `MdyFormResetBinding`. Renderers bind it
  themselves; a consumer needs it only for a form they render and mount by hand. Its `schedule` option
  supplies the scheduler for the deferred write — the browser resets its own controls after the event
  is dispatched, so a model written during the event is overwritten a moment later.

  The form is resolved at each reset rather than at bind time, so a control mounted before its page is
  assembled and placed into a form afterwards is answered from then on.

  No migration. A control outside a `<form>` is unaffected. See ADR 0149.

- d5bc45b: A chip that holds a quantity is a spinbutton

  In counter mode a multiselect chip holds a number that arrows change, which is what
  `role="spinbutton"` describes. It now carries the role, `aria-valuenow`, `aria-valuemin` and an
  `aria-valuetext` that reads the label with the count — so the value is announced when it changes
  rather than only when the chip is entered, and `ArrowUp`/`ArrowDown` do on the chip what the role
  promises. Outside counter mode the chip holds controls and no value, so it stays `role="group"`.

  **A key can now be scoped to a part.** `MdyKeyBinding` gains `on?: string`, and `keyBindingFor` takes
  the part asking:

  ```ts
  keyBindingFor("multiselect", "ArrowDown", open); // the control: opens the popup
  keyBindingFor("multiselect", "ArrowDown", open, "chip"); // a chip: steps the quantity
  ```

  The table could previously only answer per kind and state, so one key meaning two things by position
  was decided by whichever binding was declared first. Every chip binding — the arrows, `Home`, `End`,
  `Backspace`, `Delete` and `Alt`+arrows — now says `on: "chip"`, and a renderer that asks as the chip
  and gets nothing back lets the key reach the control, which is how `ArrowDown` still opens the popup
  from the trigger.

  **A contract variant can declare roles.** `MdyWidgetVariant` gains `roles`, alongside `elements` and
  `required`, so `multiselect`'s `multi` variant states the chip's spinbutton role where the base
  contract states `group`. `satisfiesSemanticElement` takes the declared role into account, so a
  renderer emitting the variant's role is conformant rather than caught by a mirrored list in a test.

  - **`multiselect.chip` and `multiselect.options` declare roles** (`group` for both) where they
    declared none. A third-party renderer that emits neither now fails the DOM contract.
  - **`scrollChipStripByWheel` is exported** — the strip's wheel behaviour under ADR 0127, which all
    three renderers had written out identically.
  - Angular's dynamic form forwards `mode`, which it was dropping: a document declaring a counter
    multiselect got a toggle one.

- 37f5eab: A closed multiselect shows what was chosen, not everything on offer

  The field drew its whole option list inline, so three options ate 148–209px of a control and thirty
  would have eaten ten times that. The closed control now shows the **chips for what was chosen**, in one
  line that scrolls, inside the control a person presses; the options are seen in the popup, where there
  is room for them.

  **The anatomy, and what moved.**

  ```
  inputWrapper                the field's box, carrying its state classes
  └── trigger                 what a person presses; role="combobox"; the label names it
      ├── chips               what was chosen, in the value's own order
      │   └── chip            a container: label, count, remove — and the two steppers in counter mode
      ├── placeholder         when nothing is chosen
      └── arrow               the trailing affordance, decorative
  popup
  └── options                 the options, in one place
  ```

  - **`searchButton` is removed.** The magnifier is gone and the control opens the popup, so
    `MDY_POPUP_OPENERS.multiselect.opener` is `"trigger"` and `role="combobox"` moves with it — a
    button that holds no value should never have carried the role that says it does. A consumer
    selecting `.mdy-multiselect__search-btn` selects `.mdy-multiselect__trigger` now.
  - **`listbox` is removed.** It existed to name the popup's copy of a grid the field also drew. With
    one grid there is one part, and two names for it could only disagree.
  - **`options` moved into the popup**, so a renderer that keeps an inline copy fails the DOM contract
    rather than being caught by a test. Angular was drawing both, every option twice.
  - **`chip` is a container**, not a button, because it holds controls. `chipRemove` is new. A repeated
    value is a **quantity** — `increment` takes `["a"]` to `["a","a","a"]` — so one chip per distinct
    value carries the count and the steppers, and undoing one decision is one gesture rather than three.
    `.mdy-chip--counter` remains styled and emitted by nobody under the scroll decision.
  - **`readonly` joins the shell's control states.** It was supported by every field, declared by none,
    and painted nowhere: a form locked for review looked exactly like one waiting to be filled in.
    `.mdy-input-wrapper--readonly` keeps full contrast and pointer events, because a read-only field is
    in play and a disabled one is not.
  - Three i18n strings name the chip's controls: `chipRemoveLabel`, `chipDecrementLabel`,
    `chipIncrementLabel`.

  **Lit's datepicker and timepicker now open from their control**, which the contract has named as their
  opener all along. Reading the opener from the catalogue rather than from a list written out in a test
  is what exposed it — and the same list, joined into one selector, had been returning a daterange's
  start input for the datepicker's opener, so three unrelated widgets read as broken.

- 78bd88c: A multiselect's popup can be used with a keyboard

  Opening the list with a keyboard reached the filter box and stopped there: `ArrowDown` moved nothing
  and `Enter` took nothing, so a person who could not use a pointer could open the options and not
  choose from them.

  The popup's own keyboard policy has returned `move` and `select` all along — **the controller had no
  cursor to send them to**, so every renderer dropped them, and plain's source said so in a comment. The
  controller has one now: `activeKey`, a cursor and not a selection, walking the _filtered_ options
  because a cursor that walked the declared list would stop on rows the search has hidden. It clears
  when the query changes and when the popup opens or closes, since a position carried between showings
  is one the person never chose.

  The search box names it with `aria-activedescendant`: the cursor is not focus — focus stays in the box
  being typed into — so naming it is the only way to say where it is.

  **Angular kept its own index and moved it before asking what to take**, so one `ArrowDown` landed on
  the second option. That is the third piece of state that component held a second copy of, after the
  timepicker's view and its focused field.

  Two more from an accessibility review:

  - **Every chip states its position** — `aria-posinset` and `aria-setsize`. Independent of the live
    region and of anything drawn, so it survives a stripped stylesheet and a dropped announcement.
  - **Every move is announced** — "Roma, moved to position 3 of 12". Reordering with a modifier and the
    arrows has no _grabbed_ state to announce, so the movement itself is the only thing there is to
    say; unannounced, a reorder is invisible to somebody who cannot see the strip. The sentence is
    composed before the intent is dispatched, because the dispatch runs the render that reads it.

  And the counter chip's steppers follow the **mode**, not the count. A repeated value can arrive from a
  document on a field that declared no mode, and it is tempting to offer the steppers there since the
  chip does say three — but a toggle-set holds membership, so a repeat is a malformed value rather than
  a quantity, and steppers would invite making it four.

- ff19aea: A colour panel offers a way to every colour, not only to twelve

  The field took any colour typed into its hex box and offered twelve to anyone pointing. Two routes
  into one field that did not arrive at the same place, and neither could see the disagreement: a person
  who points had no way to learn that typing goes further, and a person who types had no way to see
  where their colour sat among the ones offered.

  The panel now holds a **thirteenth swatch** carrying the colour picked by hand — of exactly the same
  kind as the twelve, so it can be selected and re-selected — and, **after the grid and outside it**, a
  `Custom…` button that is always and only a door to the platform's chooser.

  Two elements rather than one: a square that were a door when empty and a colour when full would do
  different things depending on how it was set. Pressed full, either the chooser opens and the tint
  cannot be re-picked, or it selects and the door is gone. ADR 0158.

  The door is declared a child of the `popup`, which is where it is drawn. Left to the default it read
  as a child of the root, and a record describing an anatomy no renderer builds is one that will be
  believed by somebody who cannot see the page.

  **Migration.** `MdyI18nMessages` gains `colorCustomEntry` and `colorCustomValue`; a consumer with its
  own message table supplies them. `colors` gains an optional `customEntry` part.

- 9840c5e: Every form carries an id scope, so two forms on one page stop sharing their ids.

  Measured on two forms built from the same document, in all three renderers: every id shared, and the
  second form's `aria-describedby` resolving to the **first** form's help text — read out, verbatim, to
  a person who cannot see the field it belongs to. `getElementById` returns the first match, so nothing
  throws and nothing looks wrong.

  A form now has a scope whether or not the consumer asked for one, and every widget bound to it derives
  its ids inside that scope. ADR 0146 records the decision and what it costs.

  **Every id changes.** `when` becomes `f<scope>-when`, `when__label` becomes `f<scope>-when__label`.

  **Migration.** Pass the scope you want and the ids are the ones you already know, with your scope in
  front: `mountMdyForm(host, fields, { idPrefix: "signup" })`, `<mdy-text-field id-scope="signup">`,
  `[idScope]="'signup'"`. A consumer naming an id in a stylesheet, a test or their own
  `aria-describedby` should do this.

  **Without one**, the scope is a function of the document — a signature of the field paths — so a
  remount and a client hydrating a server render arrive at the ids they had. What that cannot separate
  is two forms built from the _same_ document: plain tells them apart because it can see the page it is
  mounting into, and lit and Angular cannot, because they compute an id before the element exists. For
  those two the twin case stays what ADR 0135 concluded it was — the consumer's to answer with a scope.

  `formScopeOf` and `widgetScopeOf` are exported for a renderer built outside this repository.

- 117e1c3: A form built with these controls now submits

  Put these controls in a `<form>`, press a submit button, and the browser sent **nothing** — measured,
  all three renderers, `new URLSearchParams(new FormData(form)).toString()` returning `""`. A control
  without a `name` is not serialised, and no control wrote one.

  Every kind now declares how its value is submitted, and the key is the **field's path** — `colour`,
  not the scoped widget id. Thirteen of the fourteen kinds measured now send their value identically in
  plain, Lit and Angular.

  **`radio` and `segmented` change what they send.** They were the two kinds that already carried a
  name, and it was the scoped id: `f3a9-colour=b` becomes `colour=b`. A consumer parsing the old key
  has to change. The scope keeps the job it was added for — outside a form, where nothing is submitted
  and the name only groups the set, it is still used.

  **A checkbox says what it means.** An unchecked box is absent from a payload in HTML, so `false` and
  "never sent" arrived identical; and a checked box with no `value` sends `on`. A boolean now sends its
  model value, with a hidden companion carrying `false` — so the key is always present. The companion
  goes quiet while the box is ticked, so the payload carries **one** key either way: `ok=true` or
  `ok=false`, never both, and nothing at the receiving end has to know which repeat wins.

  **If you select controls by position, check your selectors.** `select`, `multiselect`, `checkbox` and
  `toggle` now render a hidden input, so a field can hold more inputs than it used to. The hidden one is
  always placed **after** the visible control, so `querySelector("input")` and `.first()` still find the
  control a person can see — but `querySelectorAll("input")[2]` may now be a different element than it
  was. `input:not([type="hidden"])` is the selector that survives either way.

  **`select` and `multiselect` gained hidden inputs**, because they draw no form control at all. One
  per value, in order, so a multiselect keeps both.

  New in `@modyra/widgets`: `submissionFor`, `submissionNames`, `submissionDefects`, `submitFalsePart`,
  `groupSubmitName`, `syncSubmitValues`, `MdySubmissionShape`. `checkbox` and `toggle` gain an optional
  `submitFalse` part.

  Thirteen of the fourteen kinds measured now agree across plain, Lit and Angular. The one that does
  not is `datepicker`: Angular sends `01/02/2026` where the other two send `2026-01-02` — the text the
  box shows rather than the value the model holds. The name is right in all three; what the control's
  `value` carries is a divergence that predates this and is now visible. See ADR 0152.

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

- 6022157: A list you can type your way into

  Finding the twentieth option in a multiselect's popup meant twenty presses. The APG asks for
  type-ahead of any listbox a person can open, and every piece of it was already published —
  `createTypeahead`, `isTypeaheadCharacter`, `typeaheadMatch` — and used by nobody here.

  A `typeahead` intent moves the cursor to the first option whose label matches what has been typed.
  The buffer and the idle window that decides when two keystrokes are one word belong to the
  **controller**: a renderer holding them decides that for itself, which is how three adapters come to
  answer differently.

  Only where there is no filter box. A searchable popup already answers typing by narrowing the list,
  and the two would compete for the same keystrokes.

  **The cursor is now visible or named wherever focus happens to be.** Plain focuses the option itself,
  because its popup puts focus inside; Lit and Angular keep focus on the control and name the option
  through `aria-activedescendant`, which is how a control points at something it does not contain focus
  for. Without either, the cursor moved and nothing said so.

  Fixes a defect found while measuring it: **plain placed focus on every effect pass rather than on the
  opening**, so the arrows appeared to do nothing at all — the cursor moved and focus was dragged back
  to the first option behind it.

- cd7e937: A panel belongs to its field, and closing one is an answer

  Two rules ADR 0167 decided and left unbuilt.

  **A field's focus scope is the control and the panel it opened**, wherever that panel is drawn.
  `focusIsInsideField` reads the opener's `aria-controls` and answers for the panel it names; three
  renderers answered by containment before, so a panel portalled out of its field to escape a
  scrolling ancestor read as "focus has left" while an in-place one read as "still here" — one
  contract, two behaviours, decided by where a `<div>` was appended.

  **Opening a panel and closing it without choosing marks the field answered** — the panel's version
  of typing and deleting: the person saw what was on offer and took none of it. Touched and not dirty,
  because nothing about the value changed. This is what makes the previous release's rule complete: a
  bare traversal says nothing, and a gesture that engaged the value space does.

  Two renderers were told about every close except the one a person actually makes: Angular's Escape
  went straight to the overlay lifecycle, past the door a component overrides, and lit's colour palette
  flipped its own flag without telling its controller. Both now close through the contract.

  The canonical after-Escape expectation changes with it: the state is the resting one plus `touched`.

- a38781c: A panel closes when focus leaves the field, in every kind that declares it should

  `capabilities.dismissOnFocusOutside` is declared `true` by all six kinds that have a popup, and was
  honoured by one renderer in six and by no Angular renderer at all. A published rule that three
  implementations agreed to ignore, because nothing asked them for it.

  A panel left open behind a field somebody has tabbed away from covers the next question and answers
  to a keyboard that has gone elsewhere.

  Both renderers now honour it in one place rather than six: a shared helper in `@modyra/plain`, and
  `MdyOverlayControl` in `@modyra/angular` — whose own comment had always described a subclass's blur
  handler consulting the pointer precedence, with no such handler in any of them.

  It listens for focus **arriving** rather than departing. A departure does not answer the question:
  a panel that repaints — a calendar swapping its day grid for its months — destroys the element
  holding focus, which fires a departure naming nowhere, indistinguishable from somebody leaving the
  field. A pointer still outranks it, so a drag begun inside the panel does not close it on the way
  past.

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

- 9cdd4ef: Reordering has a pointer path that is not a drag

  WCAG 2.5.7 asks for a single-pointer alternative to any dragging movement, **independently** of a
  keyboard path — a keyboard alternative does not discharge it. Somebody using a pointer who cannot hold
  and drag, because of a tremor or a head pointer or a switch, has no way to reorder otherwise.

  A reorderable chip gains two move controls: one press, one place, no drag. They are the same
  `move-selected` intent the keys use, so the two doors cannot come to disagree about what an order is,
  and they announce the same sentence.

  Not focusable, like every other control on a chip. ADR 0128 settled that a chip is one operable thing
  and its controls are reached through it — adopting `role="grid"` would have put them back in the tab
  order and then supplied `Enter`/`F2` as the way to reach them again, which is scaffolding for a problem
  the roving index already removed.

  Drawn only where the field asked to be reorderable, so a set of filters gains no furniture. Their
  marks are drawn in CSS rather than written as text, for the reason the remove control's is: a
  character in a button is picked up by an accessible name composed from contents.

  Fixes a live-region defect found while measuring it: a render describing no change wrote `""` over the
  sentence just spoken, taking it back before a reader could reach it. A second pass over the same state
  is an ordinary thing for a renderer to do, so the region is now left alone when there is nothing new
  to say.

- 5ae566e: Removed five classes this renderer wrote that the widget contract does not declare

  `mdy-plain-form`, `mdy-plain-colors`, `mdy-plain-datepicker`, `mdy-plain-daterange` and
  `mdy-plain-timepicker` no longer appear in the rendered DOM. **A stylesheet selecting them stops
  matching.**

  They were hooks for a plain-only stylesheet whose rules were deleted a month ago when that styling
  was folded into the contract's own vocabulary. The hooks outlived the rules: styled by nothing,
  selected by nothing, and present on four of eleven field renderers rather than all of them. A mark on
  some of the kinds is not a convention.

  Nothing in this repository selected them — no stylesheet, no demo, no example, no end-to-end spec.
  Plain's own tests did, and they now select the classes the contract declares: the `root` part already
  carries `mdy-renderer--datepicker` and `mdy-renderer--daterange`, which is what distinguishes the two
  kinds that share `mdy-datepicker`. The distinguishing class was in the page the whole time.

  Anything reaching for a removed class has a contract class in the same position:
  `.mdy-plain-datepicker` → `.mdy-renderer--datepicker:not(.mdy-renderer--daterange)`,
  `.mdy-plain-daterange` → `.mdy-renderer--daterange`, `.mdy-plain-timepicker` →
  `.mdy-renderer--timepicker`, `.mdy-plain-colors` → `.mdy-renderer--colors`, `.mdy-plain-form` →
  `.mdy-dynamic-form`. Every one of them is written by all three renderers, so a rule moved this way
  applies where the plain-only class never could.

  Plain's conformance suites no longer claim the `adapterPrefix` exemption, so all three renderers are
  held to the same check with nothing exempted between them. The residue could not have been found
  while it was claimed: the gate that fails on an undeclared class was being told to skip these.

  See ADR 0162.

- 6b7236b: A rule about two fields reaches the page

  A document's `validations` — the cross-field rules, "start and end must differ" — were parsed, handed
  back by `parseDynamicForm`, and dropped on the floor by the renderer. `mountMdyForm` had a slot for
  `rules` and none for these, so a form built from a document that declares one behaved as though the
  slot were empty: nothing on the page said so, and the pair submitted.

  `mountMdyForm` takes `validations` now and builds them through `buildDynamicValidations`, which is the
  same function Studio's preview already used. They are the form's own validators, because a rule about
  two fields has no field to belong to — and the message reaches the field the rule targets.

- ab7fcb2: A select that does not filter is drawn by the platform

  `@modyra/plain` rendered a custom combobox for every select. ADR 0176 declares the kind as two
  shapes and says which is which: a select that filters is the combobox this library builds, and
  anything else is the platform's own chooser — which already has the typeahead a list of fifty needs,
  the platform keyboard model, and the picker a phone puts up. The other two renderers already drew
  it that way.

  **Breaking for a document that declares a select without `searchable`.** It now renders a `<select>`
  with `<option>` children instead of a button and a portalled listbox. A stylesheet or a script
  reaching for `.mdy-select__trigger` will find a `<select>` rather than a `<button>`, and there is no
  `.mdy-select__dropdown` in the document for that field — the popup is the platform's. Add
  `searchable: true` to keep the combobox; it is unchanged.

  The projection follows the shape. `projectSelectA11y` hardcoded `role="combobox"` and the opener
  relation — `aria-expanded`, `aria-controls`, `aria-activedescendant` — on every trigger. Those
  describe a list the projection does not draw when the platform owns the popup, and on an element
  whose role does not admit them they are dropped without a word. Both shapes still carry the field's
  own verdict: wrong, required, described by, out of play.

  `MdySelectControllerOptions.searchable`, `MdySelectFieldControllerOptions.searchable` and
  `MdySelectA11yOptions.variant` are new and optional. A caller that says nothing keeps the shape it
  was already drawing, so nothing loses the combobox relation while it is still drawing a combobox.

- 88c8cc7: A strip that says how many are hidden, and the same control opens them

  ADR 0127 lets a multiselect's chip row scroll only where something reaches what leaves it. The
  gradient added earlier says _there is more_ and names no number; the trigger reveals everything and
  mentions none of it. A person was told a fact by one thing and offered an action by another.

  One affordance does both now: a trailing button reading `+10`, named _"10 more not shown"_, which
  opens the list where every chosen value is. A pointer with no horizontal axis — most desktop mice —
  has a way through that is not a scroll.

  - **`overflowCount`** is a new optional part, and it joins the kind's trailing affordances, so it
    carries the same hit target as every other control in that column.
  - **`hiddenChipCount`** is exported: how many chips the strip is not showing, measured from what the
    browser laid out. How many fit depends on the labels, the theme's spacing and the width the host
    gave the field, so it is a measurement and not a count.
  - **`MdyI18nMessages` gains `chipsHiddenShort` and `chipsHidden`** — required, in all five locales.

  **A keyboard trap came with it, and `keepFocusedChipInView` is the fix.** The browser scrolls a
  focused element into view once, at the moment focus lands. An affordance that appears on the same
  beat takes its width out of the scrollport _afterwards_, and the chip the browser had just brought in
  was outside again by about the width of the control that appeared — measured at 97px of overhang,
  with `scrollLeft` unchanged. Nothing scrolls a second time on its own. Every renderer now brings the
  focused chip back after the paint that may have moved the box.

  **The chip's controls are drawn with a mask** rather than with borders and a background colour
  (ADR 0133): a mask takes the system's own colour under `forced-colors`, where a painted shape is
  dropped entirely — and the readers most likely to be zoomed into a control this small are the ones
  that mode is for.

  **lit and Angular listed only the options nobody had chosen.** The contract gives every option a
  `selected` state and, in toggle mode, `aria-pressed` — both unreachable in a list that removes what
  was taken, and it made the new affordance's promise false, because the values it says are out of
  sight are exactly the ones such a list omitted. Both list every option now, as plain always did.

  **Angular's popup held its options while it was closed** — twelve option chips in the document of a
  control that looks shut, countable by anything walking the field. The panel's contents exist only
  while it is open.

- 32e7440: Absent for configuration, disabled for state

  A control that a field's design includes is now drawn whether or not it can act at this moment.
  `multiselect.clearAll`, `multiselect.wayBackAction` and `file.clear` were declared present only while
  they had something to do, so they arrived and left under the hands of whoever was aiming at the
  control beside them — and the two multiselect neighbours are undo and discard-everything. They are
  required parts now, carrying a `disabled` state, `aria-disabled` and a `--disabled` class: in the
  page, in the tab order and in the accessibility tree at all times, announced as unavailable, refused
  when pressed.

  Breaking: `undoIsOnOffer` is gone from `MdyPartPresence`. It expressed "draw this only while an undo
  exists", which is the rule this release reverses. A consumer reading it for its own presence
  decision should read the part's `disabled` state instead, or `MDY_ARIA_DISABLED_PARTS`, which names
  the parts that answer unavailability this way.

  The conformance kit gains the issue code `PART_HIDDEN`: one of those parts found with a `hidden`
  attribute, or without `aria-disabled`, is now a violation. A consumer matching exhaustively on
  `MdyDomContractIssueCode` gains a case.

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

- cb8a6fd: One door out of the ready colours, and it is always a door

  The panel held two things for a colour picked by hand: a swatch among the ready ones, selectable like
  them, and a separate line of text that opened the platform's chooser. Lit held a third — an untranslated
  button duplicating the second.

  There is one now. It previews the last colour picked by hand and **pressing it always opens the full
  chooser**, in every state, without exception. The tint it carries is not a value: it is a preview of
  where the chooser will open. It never takes the selected mark, because a thing marked as chosen that
  opens a panel when pressed contradicts itself inside a single element.

  That costs something real and the cost is taken knowingly: somebody who picks a free colour, tries a
  ready one and changes their mind reopens the chooser rather than pressing back — a cost on a rare path,
  in preference to an element that does one thing when empty and another when full, which is a cost on
  every path and which nobody can predict by looking.

  Which colour the field currently holds is shown by the filled square on the field, whose only job that
  is. The two are necessarily separate: with preset three held and a free colour typed before it, the
  square must show preset three and the door the free colour, and one element cannot show two colours.

  **The door is legible as a door.** A shape of its own, an outline where the ready colours are fill
  alone, a mark that is drawn whatever it is showing, and a rule between it and the row. The mark sits
  beside the tint rather than over it — over the fill it would have to be legible on yellow and on navy
  at once, which no fixed colour is — so it takes the panel's foreground and obeys an imposed system
  palette while the tint keeps its colour, because in this control the colour is the content.

  **Migration.** `colors` gains one optional part, `customTint`, carrying `mdy-colors__custom-tint`;
  `contract:diff` classifies it minor. `colorCustomEntry` now reads "All colours…" rather than "Custom…",
  in all five languages: it names the dimension the two commands differ in, which is how many colours you
  can reach. `colorCustomValue` is no longer used by any renderer here and is kept for consumers that
  name their own swatch.

  Behaviour on the door itself changes: a renderer or test that pressed it expecting a selection now gets
  the chooser. ADR 0158 carries the reasoning.

- 6ee16f5: One live region for the page, and announcing became a queue

  Eight adapters each named a live region of their own — `mdy-plain-announcer`, `mdy-lit-announcer`,
  six more. Eight literals, declared by nothing, so a page carrying two renderers carried two
  `aria-live="polite"` regions.

  **Two regions speaking in the same instant are read in an order nothing specifies.** Every screen
  reader has its own policy and no specification fixes one, so one announcement cuts the other off
  partway. One region loses a message the same way — but a queue can only stand in front of one region,
  and with two there is nowhere to put it.

  `MDY_SHARED_REGION_ID` and `MDY_SHARED_REGION_ATTRIBUTE` are now exported. The attribute was already
  declared in the contract and was not published, so the one part of this that had been decided could
  not be read.

  Announcing is now queued rather than written, which fixes three things a plain write does not:

  - **the region exists before the first message.** A reader announces a _change_ to a region it
    already knows; one created and filled in the same instant is met already full, and the first
    announcement of a page is the one most likely to be lost;
  - **the same words twice running are said twice.** The region is cleared and written a turn later, so
    a repeat is a change. Written over itself it is silent;
  - **two messages in one instant are both heard** instead of one overwriting the other.

  No adapter names a region any more. `createMdyAnnouncer()` and `MdyCommandRuntimeOptions.announcerId`
  default to the contract's id; `announcerId` is still accepted, and passing one means keeping a second
  region on the page with everything above.

  The cost: announcements from two renderers now serialise, so a burst finishes slower than a burst
  that overwrote itself. And messages that should _replace_ rather than queue — "2 results", "3
  results", "4 results" as someone types — still queue, because `announce` carries no category to
  decide on. That is a real defect for anything announcing per keystroke.

  See ADR 0163.

- 5edf370: The chips strip is one tab stop, and the keys that work inside it are declared

  Every chip was a tab stop and so was every control on it: **six presses to pass the field with two
  values chosen, twenty-six with twelve.** What a control holds must not decide how long it takes to
  leave it.

  The strip is one stop with a roving index now, and the keys that move within it are in
  `MDY_WIDGET_KEYBOARD` rather than at three call sites — which is where a reader will look for them,
  and where the next renderer will find them without being told:

  ```
  ArrowLeft / ArrowRight    move focus between chips        when closed
  Home / End                to the first or the last        when closed
  Alt+ArrowLeft / -Right    move the chip itself
  Backspace / Delete        take off the chip you are on    when closed
  ```

  `when: "closed"` on all but the reorder pair, because while the popup is showing the arrows belong to
  the list a person is choosing from — the same key in two places is what the phase exists to separate.

  `MdyKeyBinding` gains `remove` as an intent and `toEnd` beside `by`. Both directions come from the
  binding rather than from the key, because a horizontal strip runs in the writing direction: in a
  right-to-left document `ArrowLeft` moves _later_, and a renderer reading the key would have to know
  that.

  A chip's own controls — the remove, and the two steppers in counter mode — leave the tab order with
  it. They are reached with the keys above.

  **Each renderer had to stop the chip's keys bubbling.** The control's own handler answers several of
  the same keys, so `End` moved focus and then had the popup's answer applied over it, and `Backspace`
  removed nothing because the second handler won. The chip's keys are the chip's.

  Verified in all three: 3 presses to reach the next field whether two values are chosen or twelve, and
  `ArrowRight · End · Home · Backspace` answering identically.

- 7df6f00: One way back, and the clear-all it exists for

  A multiselect had three destructive acts and no way back from any of them: a chip removed, an order
  rearranged, twelve choices gone. It now has **one** reversal covering the last of them whatever it
  was — [ADR 0129](docs/architecture/0129-one-way-back-not-three.md) — and the clear-all control that
  made the question urgent.

  Three undos was the alternative refused, and refusing it is the decision: an undo that covers the
  loudest act and not the quiet ones teaches a person the control has a way back and then does not have
  one the next time.

  **How it behaves.** Depth is one. A destructive act replaces the offer rather than stacking on it, and
  a constructive one — choosing again, incrementing — withdraws it, so the reversal never puts back
  something the person did not just lose. It is untimed and drawn in the page, never a toast: a message
  that takes itself away after five seconds is a time limit under WCAG 2.2.1 Level A, and an undo has no
  exception under it. It names the act, because one control covering three needs to say which:
  _"Alpha removed — Undo"_, _"Alpha moved — Undo"_, _"12 items cleared — Undo"_.

  **The contract.**

  - `MdyMultiselectFieldState.wayBack` is new and **required**: `{ act, optionKey, count } | null`. The
    value it would restore stays private — an offer a host can read is one a host can apply to a
    different moment.
  - `MdyMultiselectFieldIntent` gains `{ type: "undo" }`.
  - Three new optional parts: `clearAll` at the trailing edge, and `wayBack` with `wayBackAction` under
    the control. `clearAll` joins the kind's trailing affordances, so it carries the same hit target as
    every other control in that column.
  - `wayBackSentence` is exported: what the offer says, so three renderers cannot word it three ways.
  - **Five new required `MdyI18nMessages` members** — `clearSelection`, `wayBackLabel`,
    `wayBackRemoved`, `wayBackMoved`, `wayBackCleared` — supplied in all five built-in locales. A
    consumer passing a hand-written message table must add them.

  **Layout.** The closed control is a flex row now: the trigger takes what is left and the clear-all
  sits beside it. As a block it had nowhere to go but under the control, where it overflowed the field's
  box and the text below painted over it — drawn, and not pressable. For the same reason the way-back
  row is positioned: the input wrapper above it is `position: relative`, so it paints over the in-flow
  content that follows and takes the pointer with it.

- 709fb7f: Reading a form is not declining it

  A required field that somebody tabs through and leaves empty no longer announces itself invalid.
  Focus arriving and leaving is an act on attention, not on the value: Tab is how a person reads a
  form, the way eyes scroll it, and somebody tabbing past twenty required fields to learn what is being
  asked was collecting twenty verdicts about fields they were about to fill in. A sighted person
  scrolling the same form gets no red borders. ADR 0167 decided this; this release implements it.

  **What changed is what sets `touched`.** A bare blur no longer marks a field touched — in any
  controller, in any renderer. Every path that changes the value marks it, together with `dirty`,
  because they are one act: `touched` now means _this field has had an answer_, not _focus has been
  here_. A refused submit still marks every field, so the form still says everything at once when it is
  asked and refuses.

  Consequences for a consumer reading `handle.touched()`: it stays false through a traversal that
  changed nothing, and it is true after any edit — including an edit that put the value back. Anything
  keyed off it (a `--touched` class, a custom verdict rule) follows that meaning.

  Also fixed: a date range committed its text on the way out of the field, and an empty box committed
  "empty" over an end that was already empty — so a traversal registered as an act. Empty to empty is
  nothing happening.

- 8e5fe67: The error container is reserved under any field that can fail a rule, in all three renderers

  Three renderers, three different answers to one question, and none of them was the contract's:

  ```
  plain     reserved under every field, including ones with no rule at all
  lit       rendered only when there was a message to put in it
  angular   the same, and its templates could not tell the two apart
  ```

  `presentWhen: fieldCanBeInvalid` said what the answer should be. Nothing applied it.

  **The reservation is not for the field that is failing — it is for the field below it.** Somebody
  leaving a field is moving toward the next one, and that is what drops when a message appears under
  the field they just left. It does not stop every movement and must not be believed to: a two-line
  message moves things anyway, and a validation arriving while focus is elsewhere defeats it. It closes
  the frequent case, which is validate-on-blur. And it stays after a correction, because taking the
  space back is the same jump, upward, under the same thumb.

  Read from the field, never from its kind — an optional note with a length limit can fail a rule, a
  note with none cannot and does not buy a line of scrolling on every screen. A field out of play
  reserves nothing: the form is not asking about it, so it has no message to make room for.

  **`aria-describedby` now names the error container and the supporting text, error first.** It named
  one _or_ the other, so the moment a field failed, the instruction that would have prevented the
  failure stopped being announced. Ten places spelled that rule: the shell, five per-kind projections,
  the option projection, two literals in Lit templates, and Angular's `describedById`. They call
  `fieldDescribedBy`.

  Naming a container that is always there also removes a class of defect rather than correcting it: a
  reference that never changes has no moment at which it can point at an element not yet drawn, or one
  already gone. An element with no text contributes nothing to a description — not a pause, not
  "empty" — so a reader hears exactly what it heard before.

  Two Angular specs asserted the reference was absent before a field was touched. That was how "names
  something real" was satisfied when the container appeared with the first message; they now assert the
  property itself, which is stronger and does not depend on the answer having been no.

- 012db3b: The chip strip pays the conditions its scrolling was allowed under

  ADR 0127 let the row scroll rather than wrap — a control must be the same height as every other
  control in the form, and a wrapping row grows with what is put in it — but the departure was
  **conditional**, and two of its conditions were unpaid.

  **The count is in the field's own description.** "12 selected", stated rather than announced: somebody
  arriving at a field whose chips have scrolled out of sight had no way to learn there were more. This
  is the state, asked for; the live region carries events.

  **A wheel reaches what has scrolled out.** A cue is not a mechanism, and many desktop mice have no
  horizontal axis at all — a strip that answers only `deltaX` is a strip a large number of people cannot
  move. `chipStripWheelDelta` takes the larger of the two deltas, so a vertical wheel drives the strip
  and a trackpad's horizontal gesture still behaves as its owner expects. It answers zero when nothing
  is hidden, so a wheel over a strip with nowhere to go still scrolls the page.

  The other two conditions were already paid: `aria-setsize`/`aria-posinset` on every chip, and every
  chip reachable by keyboard with the focused one scrolled into view.

- e7be4b6: The filled square is what opens a colours panel, and the caret beside it is a drawing

  The small square filled with the current colour is the most recognisable element on a colours field:
  every platform ships one and everybody has pressed one. What it did differed by renderer — two
  opened the field's panel of ready colours, one opened the platform's own chooser — so an application
  that changed renderer changed what that square does, from a document that says nothing on the matter.

  **The square is now the opener everywhere**, and the panel it opens carries a route on to any colour
  at all. The caret at the end of the field opened that same panel, which made one act into two
  commands: two accessible names, two stops in the keyboard walk, two things to describe. It is now a
  drawing — out of the tab order _and_ out of the tree assistive technology reads, never one without
  the other — while still answering a press, because the area sits inside the field and a dead patch
  inside a live control reads as a fault.

  **Migration.** The published relationship `toggle[aria-controls] → popup` is replaced by
  `nativePicker[aria-controls] → popup`, and `MDY_POPUP_OPENERS.colors.opener` is `nativePicker`. Code
  that located the opener by the caret's part name should ask the catalogue instead — the opener has
  been declared there all along. A renderer that draws its own colours field should move the panel's
  handler and its `aria-controls` onto the square, and stop giving the caret a name, a role and a
  keyboard stop.

  The decision and the alternatives that lost are ADR 0159; ADR 0158 carries an amendment recording why
  the preview square and the door to every colour are necessarily two elements.

- e488eec: A chosen value can be dragged to a new place

  The third door onto `move-selected`, and the one the brief named. A keystroke, a tap on the move
  controls and a drag now land on the same order because they land on the same intent — none of them can
  be repaired into disagreeing with the others.

  `chipDropIndex` is the arithmetic, in `@modyra/widgets` rather than in three renderers, for the reason
  the dial's angles are: three implementations of "which one is the pointer over" is three answers, and
  the one a person meets is whichever adapter their team chose. It reads the chips' midpoints rather
  than their edges, so a chip is passed when the pointer is more than halfway across it — what the eye
  does — and it takes them in drawing order, so a right-to-left strip needs no special case.

  **A press that never travels stays a press.** Six pixels of movement before a gesture becomes a drag,
  because treating every press as the start of one takes the chip's own controls away from anybody whose
  finger moves slightly. `pointercancel` puts the chip back untouched: the browser taking a gesture is
  not a decision the person made.

  **The pointer's subject is decided rather than inherited.** A keyboard has continuity for free — focus
  travels with the chip, so a second press acts on the chip the first one moved. A pointer has none: after
  one move the chip a person was aiming at has slid out from under their finger, and a second press in
  the same place moves a different value back where the first one came from. Every pointer move now
  names the moved chip as the strip's active one, so everything downstream of the subject points at the
  right thing. **The finger still has to re-aim**, which is a property of pointing at a list that
  rearranges itself and not something a renderer can fix.

- 3246dce: A mark is not a label, and a command does not travel with the value

  A button whose whole visible content is a mark (`×`, `↶`) now hides that mark from the accessibility
  tree and carries a `title` with the same words as its accessible name. A reader announced
  "multiplication sign" before the name; somebody driving by voice had nothing to say, because a glyph
  is not a word. The name itself is unchanged: the criterion about visible text in the accessible name
  is written for text a person reads as a word, so it does not bite on a mark.

  A multiselect's way back and clear-all keep their place at the field's trailing edge, with the mark
  that opens the field outermost and a full target of empty space between the two commands. Standing
  them beside the chips they act on was tried and measured: the chip strip's width is the length of the
  value, so both slid about 90px whenever a value arrived or left — putting the control that discards
  the field where the control that restores a value had just been, under the hand reaching for it. A
  control's position may depend on the field; never on the value.

  The `file` field's clear moves for the same reason: below the list of chosen files its position was
  the number of files, so it slid every time one was added or removed — under the hand of somebody
  taking several off one at a time. It stands with the control that picks files now, and the contract's
  reading order for `file` follows: `content`, `clear`, `fileList`, `fileItem`, `rejected`.

  Fixed: a lit `file` field holding a value that is not a `File` — a restored draft, a server's answer
  — threw on its first paint instead of drawing a row without a caption.

- 769b992: The two controls a number field is declared to have

  The catalogue names `increment` and `decrement` at a number field's trailing edge, gives them classes a
  theme styles, and neither plain nor lit built them. The promise was kept by the platform's own spinner
  where a browser draws one and by nothing where it does not — the same field with a stepper on one
  engine and no way to step on another. Both renderers draw them now, out of the tab order (the box
  itself takes the arrows) and stepping through the same intent typing goes through, so a stepped value
  meets the field's rules on the way in.

  `mdy-number-spinner` is declared as presentation: the box and its steppers need one positioning
  context between them, and it is not a part — nothing is announced by it and no contract member points
  at it.

  **And a multiselect's trailing controls are drawn whether or not they have something to do.** lit and
  Angular omitted the clear-all and the overflow count until they applied; plain drew them hidden. A part
  a kind declares is a part its renderers carry, so all three draw both and hide what does not apply —
  which also keeps them disabled with the field rather than absent from it.

- f678c06: What a form submits is what was on screen

  Press Back into a form somebody had started filling in and the browser hands them their typing back.
  It writes it straight into the boxes and announces nothing — so the field showed what they had
  written while the form still held the value it was built with, and a submit sent the second. There
  was no moment at which they could have noticed: every part of the page was individually correct.

  The form now adopts what was restored. Where the browser restored nothing — which is the other two
  engines, whose restore lands before script-built controls exist — nothing happens, and there is
  nothing to disagree about either.

  The same guard runs at the submit, ahead of every handler that reads a value: whatever wrote into a
  control since the last thing the library heard — autofill, a password manager, an extension — is
  adopted before the value leaves the page.

  New in `@modyra/widgets`: `adoptSilentWrites(binding)` and `MdySilentWriteBinding`. Renderers bind it
  themselves; a consumer needs it only for a form they build and mount by hand.

  **Two visible effects.** Each control written to silently fires one `input` and one `change` when it
  is adopted, and the fields adopted are marked touched — so their validation runs and their errors show.
  Both follow from adopting through the same door a person's own typing comes through.

  If you want the typing to survive in every browser, configure a `draft`: that already does it. See
  ADR 0150.

### Patch Changes

- 7d85603: A slider stops stating a broken bound before anybody has been near it.

  `holdsUneditedValue` takes the kind so that a value which _is_ that kind's empty is not read as one
  that arrived from a draft — a thumb is always somewhere, so a slider at 0 is the control at rest. The
  shell projection passed the kind; the renderer painting the error list did not, so the two disagreed:
  the page showed a required-range message on an untouched slider while the control's
  `aria-describedby` named nothing, because the projection had decided there was nothing to name.

  `visibleErrorsOf` takes an optional kind and plain's text renderer passes it. The error waits for the
  person to have had a turn, and the control names it when it arrives.

  This was the last finding in `@modyra/plain`'s DOM conformance run, which is now clean.

- 0b012a8: A box only where there is an inside

  The shared shell handed the field box to every kind, so a slider's track and a radio group's dots
  were framed by a surface with nothing to look into — and the three renderers disagreed about which
  kinds wore it: plain dressed three, lit one, Angular none. Each decided separately what the shell was
  giving out unconditionally.

  Both renderers now ask the contract. `valueSlot` says whether a kind's value is read inside a surface,
  and the wrapper element stays either way — it is the row the shell lays out. What it stops carrying
  is the treatment.

  Visible on the segmented control, which is what the change is for: a band of field-coloured surface
  ran the full width behind three small buttons, three quarters of it empty. That empty stretch was the
  box, drawn around a control that has no inside.

- 67d0055: A clock that commits and a range a keyboard can pick

  `MDY_WIDGET_KEYBOARD` declares `Enter` on an open timepicker as `commit`, and neither renderer
  answered it: the dialog could be filled from the keyboard and only confirmed with a pointer. Enter
  now confirms from anywhere in the dialog except a focused button, which the platform already turns
  into a click.

  Plain's date range took focus into its grid when it opened and then answered no key at all — the
  arrows moved a cursor the grid never painted and focus never followed. The grid now sends the
  calendar's keys to the controller that owns the month, paints the cursor it answers with, and keeps
  focus on it. Its day cells also carry the id the contract names for them, as the single-date
  calendar's do.

- 5803809: A caption a document did not write stops standing where a caption stands

  A field given a name and no caption still needs one: everything inside the shell is named by pointing
  at the label, and a reference resolving to an empty element announces the role and nothing else. So
  the label carries the field's own key, and `mdy-label--unwritten` is what keeps that key out of sight
  — visually hidden rather than removed, so a reader can still follow a reference to it.

  The class stopped being applied. `shellStateClasses` owns it and computes it from an `unwritten` input
  this renderer was not passing, so the toggle turned off the class the shell had just switched on. A
  form showed `rows.0.code` in the position and styling of a caption somebody meant.

  That is worse than showing nothing, and the difference is the reason: nothing is legible as nothing,
  while a leaked key and a real label are indistinguishable — a person reading the form cannot tell it
  is incomplete.

  Introduced by the change that moved the state classes into the contract, which added `unwritten` to
  what that function owns without the one caller that knew the answer passing it. Guarded now, with a
  control: a caption a document _did_ write must not be marked as one nobody did, so the class cannot be
  applied always and pass by hiding every label on every form.

- 454a168: One caret, one meaning, both kinds

  The multiselect's caret pointed the same way whether its list was open or shut, while the
  single-choice list's turned. The catalogue declared `open` on one kind's `arrow` part and not on the
  other's, so nothing was inconsistent enough to fail: each contract agreed with itself.

  `multiselect.arrow` now declares `open`, and the three renderers write the modifier the same way the
  select's do — derived from the part's own class rather than spelled out, so a rename in the catalogue
  moves the rule and the renderer together.

  **The two carets were also different shapes.** The select drew `CHEVRON_DOWN` from the icon table
  while the multiselect left its box empty for the stylesheet's fallback square. Both now draw the same
  icon; the fallback stays for a host that ships no icons, which is what it is for.

- 8409975: `beginChipReorder` — one gesture instead of three, down to the six pixels

  The drag that reorders a chip strip was written out identically wherever a strip is drawn: the same
  threshold, the same dragging class, the same document-level listeners, the same swallowed click, the
  same midpoint measurement. The renderer still binds the press its own way — that part belongs to a
  framework — and everything between the press and the drop is now one function.

  Three details decide whether it works, and each was one every renderer had to get right unaided:

  - **the threshold.** A drag may start anywhere on a chip, its own buttons included: they cover most
    of it, and a chip draggable only by its bare edges is a chip nobody can drag. Travel is what
    separates a press that belongs to the button from one that belongs to the strip.
  - **the swallowed click.** A press that began on a button and ended as a gesture still produces a
    click nobody asked for. Taken once, in the capture phase, and only after an actual drag — the next
    real press on that button has to still work.
  - **no pointer capture.** Capturing follows the gesture just as far and retargets every later pointer
    event, the one that becomes a `click` included, so the chip's own buttons stop receiving clicks
    entirely: found, pressed, nothing happens.

  `MDY_CHIP_DRAG_THRESHOLD` is published because it is the number that decides whether those buttons
  still work. Too small and a steady finger reorders the strip instead of pressing what it is on; too
  large and a drag has to be exaggerated before anything moves.

  The check reads the dragging class **during** the gesture, not after. Afterwards the teardown has
  taken it off either way, so a check that only looks at the end cannot tell a press that was never a
  drag from one that was — which is exactly the mutation that survived the first version.

- 6a82839: Reordering is a grab, not a modifier

  `Alt`+arrow was Back and Forward in every major browser on Windows and Linux. It worked here only
  because `preventDefault` suppressed the platform's own gesture, and it taught a keystroke that on any
  other focused element throws away the form being filled in.

  `Enter` on a chip picks it up, the bare arrows carry it, `Enter` puts it down and `Escape` puts it
  back where it was. No modifier, so nothing to collide with on any platform. A grab is also a _state_,
  which the modifier could never be: it is announced — "A grabbed, 1 of 3. Use the arrows to move it,
  Enter to drop it, Escape to put it back" — and it can be abandoned, which matters most to the person
  who picked up the wrong chip.

  The arrows are declared once, as what moves the reading position. Held, they carry the chip: the same
  movement with the grab's subject rather than the cursor's.

  The `open` bindings now name the part they open from. They declared none, so a binding meaning "press
  the control to open it" also claimed the chips inside it, and `Enter` on a chip meant both "open the
  list" and "pick this up" — decided by whichever handler ran first rather than by the table. A
  control-level question still finds them: the part a person opens a kind with is the control, for that
  purpose.

  Migration: a consumer teaching `Alt`+arrow, or handling `intent: "reorder"` from a key, reads
  `intent: "grab"` and moves what is held with the arrows it already handles.

- 8048151: A choice is said out loud, and a multiselect is as tall as the controls beside it

  **A choice landed and nobody was told.** The chips strip is the confirmation that something was
  chosen, and it is the one a person using a screen reader does not get. The multiselect gains an
  `announcement` part — a live region carrying the whole selection, not the last change, because two
  announcements have to differ for the second to be read at all: a region written once announces the
  first choice and swallows every one after it. The words come from the contract, so all three
  renderers say the same thing.

  **A multiselect was taller than the controls beside it**, and only in one theme. Every other control
  takes the field height as a floor and holds a line of text, so the floor is also its ceiling; a
  multiselect holds chips and had a floor alone, so a row that read 38px for a text field read 54 for a
  multiselect and 62 once it held twelve. `max-height` gives it the ceiling its siblings get for free.

  The eight pixels between two chips and twelve were the horizontal scrollbar: it is laid out _inside_
  the strip and adds its thickness to the height, so the control grew by the width of a scrollbar the
  moment its chips overflowed. The bar is not drawn now — chips visibly running past the edge is the
  affordance, and it was never the only one.

  Verified against all five stylesheets rather than the default alone: `modyra`, `modern`, `material`,
  `ios` and `ionic` each give every kind one row height, and a multiselect holding twelve chips is the
  same height as one holding none.

- fa4b98a: A choice is said out loud even while the list is open

  `multiselectAnnouncement` took an `open` argument and returned nothing while the popup was showing, on
  the reasoning that the options there announce themselves and a live region firing too would speak
  twice. That holds only for somebody choosing with the **keyboard**, where focus is on the option a
  screen reader is reading. A choice made with a pointer moves no focus and announces nothing at all —
  so the suppression was silence for exactly the person with no other confirmation, since the chips
  strip is the sighted feedback and the only one.

  The parameter is removed rather than defaulted, because a caller passing `true` was asking for the
  defect. The count is not part of the native announcement either way, and the region says the change
  and the new total.

- c8326e3: Choosing the second object-valued option stops writing the first.

  A native `<select>` carries a string on each `<option>`, and lit wrote `String(option.value)` there —
  so an object-valued list gave every option `value="[object Object]"`. The browser could not tell them
  apart, and the change handler looked the picked string up in the list and answered with whichever came
  first.

  Measured before and after, both renderers, two object-valued options:

  ```
  before   option values distinct 0 of 2   ·  picking Beta left the field on Alfa
  after    option values distinct 2 of 2   ·  picking Beta shows Beta
  ```

  This one reaches the model rather than the page: a person's own selection was silently replaced by
  another. plain's radio, segmented and select derived their projection keys the same way and are
  corrected with it.

- f52e00e: A command costs what it changes, not what the project holds

  Every Studio command began `structuredClone(project)`. Measured on a thousand fields, updating one
  label cost 96% of copying all thousand — the price of an edit set by the size of the document rather
  than by the edit, with a memory multiplier behind it: a twenty-step history held twenty full copies.

  The node-scoped commands go through `withNode` now, which copies the path from the root to the touched
  node and shares every subtree off it. The touched node itself is still deep-copied, because a change
  may push to an array or write a nested member and a shallow copy would reach back into the project it
  is meant to leave alone — so the cost is bounded by the edited node's own subtree instead of by the
  document. `updateNode`, `addValidator`, `removeValidator`, `setFieldOptions` and `setServerValidator`
  take that path.

  Also: plain's multiselect leaves its overflow control disabled with the field. A button that still
  answers beside a field whose ARIA says disabled is disabled in appearance only.

- bdd05cf: An empty list that charged for a gap

  plain's file field kept its list of attachments in the flow while it held nothing. In a column with a
  gap an empty child is still a child: zero pixels tall and charged a full gap anyway — 29px against
  the other two renderers' 21, from an element containing nothing.

  The proof is inside plain rather than between renderers: the container beside it is equally empty and
  costs nothing, being `hidden`. Same box, two treatments, one of them billed.

  It is `hidden` now while empty. Under ADR 0180's amended test a container is kept only when it
  appears outside the act a person is performing, or when a reference must land on it — the list fails
  both: it changes because somebody just attached a file, and nothing names it.

- 57fcb30: The reading position in an option list is visible

  A multiselect's cursor was announced through `aria-activedescendant` and drawn by nobody. Lit and
  Angular each set `mdy-chip--active` on the option the keyboard stands on — a class the catalogue never
  declared and no stylesheet drew — and plain set nothing at all, because it applied the projected part
  and then wrote a locally built class list over it.

  `multiselect.option` now declares the `active` state, the projection emits it for the option
  `activeKey` names, plain stops overwriting what it was given, and the theme draws it. Renderers
  already using the class keep working unchanged; one that draws its own cursor should drop it in favour
  of the part's.

- 9346f32: What a chooser shows before anything is chosen comes from the message catalogue.

  Two renderers wrote their own default in English — `"Select…"` in plain's select, `` `Select ${label}…` ``
  in lit's multiselect — so a form whose every other word had been translated had an English word inside
  it, and the two renderers disagreed about what the word was.

  `MdyI18nMessages` gains `selectPlaceholder`, supplied for all five built-in locales. A caller that
  wants silence passes an empty string.

  **Migration.** The member is required, like every other in the catalogue: a consumer that builds a full
  `MdyI18nMessages` literal must add `selectPlaceholder`. Making it optional would have put the fallback
  back in the renderers, which is where the English defaults came from. `MDY_I18N_PRESETS` and the five
  exported locales already carry it, so a consumer using those needs no change.

- 3ca6787: A clock face a keyboard can turn

  `@modyra/widgets` publishes both halves of a dial's keyboard — `timepickerDialAria` for what a screen
  reader is told and `timepickerDialKeyIntent` for what the keys land on — and neither renderer used
  either. The face was a `<div>` of `<div>`s: no role, no value, no name, not focusable, and no key
  answered. Setting a time on the clock was a gesture only a pointer could make.

  Both now take the face into the tab order, announce it as the slider it is, and turn the hand with
  the arrows, `PageUp`/`PageDown`, `Home` and `End` — through the contract's own rule, so what is
  announced and where the arrows land cannot drift apart.

- 01261b8: The timepicker's clock face is hidden from assistive technology, and the boxes announce the value.

  The face carried `role="slider"`, `tabindex="0"` and the three values a slider needs. Every value it
  can set, the hour and minute boxes can set, and they are on screen beside it — so the dial was a
  second announcement of the same number, and a role a Tab walk skips is still found in browse mode,
  where it promises keys it does not answer. It is now `aria-hidden="true"` with no role and no tab
  stop. Click and drag are unchanged.

  Nothing that was announced stops being announced. The hour and minute keep their `spinbutton` role
  and bounds and gain `aria-valuetext`, so a reader hears `3 PM` rather than `3`, and `05 minutes`
  rather than `5`.

  **Migration.** `timepickerDialAria` is replaced by `timepickerSegmentAria(field, format, current,
period?)`. Same three values, `role: "spinbutton"` instead of `"slider"`, and an optional period that
  gives a twelve-hour hour its half of the day. A caller announcing its own dial should stop: the
  control that holds the value is what a reader needs to reach.

  ADR 0145 records the decision, including the one case that would reverse it — a picker whose dial is
  its only input must be exposed, and as options with position rather than as a slider.

- a116692: A colour dragged past is not the field's value

  The platform's chooser reports a drag with `input` and the choice with `change`. All three renderers
  took the value on `input`, so a field recorded colours nobody chose — and abandoning the chooser left
  whichever one the pointer had been passing over. The field then held a valid colour that had genuinely
  been on the screen a moment earlier: only the person who cancelled could tell, and only if they
  remembered what they had.

  They take it on `change` now. The requirement that cancelling restore the previous value is met by
  there being nothing to restore, and the colour being dragged past is shown by the chooser itself,
  which is where the person is looking.

  **What this gives up**: the page no longer previews the drag, so a consumer listening for a value
  while a person moves through the chooser hears nothing until they settle.

  `openPlatformChooser` opens that chooser through `showPicker` where the platform has it. A renderer
  may guard the hidden input's click to stop a press on the swatch reaching it twice, and a guarded
  click is one the `Custom…` button could not open — a door that says it opens something and does
  nothing.

- 9a2ba53: A field is not announced wrong before anybody has reached it

  A required field that is still empty is not a mistake — it is a field somebody has not got to yet.
  Three kinds announced `aria-invalid="true"` on a form nobody had touched, and painted nothing: a person
  looking saw a clean form while a person listening heard one already failing, and the refusal that does
  matter arrived later sounding exactly the same.

  The contract's own projections had it right. The renderer wrote the attribute again, from a different
  question — _is this field invalid_ rather than _is this refusal one to show now_ — and its write landed
  after, so the wrong answer won. `select`, `datepicker` and `timepicker` now ask what everything else
  asks, naming their kind so that a value which _is_ that kind's empty is not read as one that arrived
  from a draft or a server.

- f6246b7: A field that holds a paragraph is three lines tall

  plain drew a two-line textarea — the number a browser gives when nobody decides — where lit and
  Angular draw three. Two lines are not yet a different shape: the eye reads a two-line box as a
  one-line box that came out wrong, and the affordance the field exists to offer is invisible until
  the box is taller than a row can plausibly be.

  Stated as `rows`, not as a height. A length says "three lines" at a 16px body and "one and a half"
  at 32px — it stops meaning what it was written to mean exactly when a person has enlarged their
  text. See ADR 0181.

- 0050769: A multiselect's chip strip is a sibling of the control that opens the list, not its child.

  `MDY_WIDGET_CONTRACTS.multiselect.parts.chips` now hangs from `inputWrapper` rather than from
  `trigger`, and is declared before it so the reading order is the drawing order. Every renderer draws
  it beside the opener.

  **Why it had to be structural.** Each chip carries a button that takes a value off, and the opener is
  a `<button>` — invalid HTML, and worse than invalid: a press aimed at the opener could land on a
  delete, and which one depended on how long a chosen label happened to be. Aligning the field's
  affordances moved that hazard without removing it — sampled across the opener's midline it went from
  the midpoint to 17% of the whole line — which is what a rule expressed in geometry does. The
  invariant is structural instead, and checkable as one: _the opener has no operable descendants._

  Pressing the field's empty area still opens the list. It is now a behaviour of the box, which
  forwards a press on **its own** area; a press that lands on a chip never reaches the opener, because
  a chip is not inside it.

  `@modyra/styles`: the strip takes the width its chips need and the opener takes the rest. Inside the
  opener the strip had nothing to share the row with; as siblings, a strip that still grew covered the
  opener and the opener covered it back.

  **Migration for a renderer implementing this contract**: draw the strip as a sibling of the opener
  inside the field's box, before it; forward a press on the box's own area to the opener; and do not
  give either the full width of the row.

  See ADR 0142.

- 965a61c: A key declared bare stops answering a press with the accelerator held — and Escape starts answering whatever is held

  **Breaking: `MdyKeyBinding.modifier` is now `"primary" | "any"`, and four signatures accept a press
  where they took a key name.**

  Measured across all three renderers, on every kind that opens something: `Cmd`+Space, `Cmd`+ArrowDown
  and `Cmd`+Enter each opened a panel. Those are the input-source switcher, the end of a document and
  submit — a person holding the modifier is reaching for one of them, and the panel arrived under the
  gesture meant to do something else.

  `matchesKeyGesture` had always said otherwise, and had no road. Every question a renderer actually
  asks took a **key name**, so what was held with the press never reached the one function that reads
  it: a defect planted in that function moved no check in either tier, because nothing on the deciding
  path called it. It was published as the answer to a question nobody asked it.

  **The rule, once the closing case was asked about outside.** A gesture that _adds_ is refused under a
  held accelerator; a gesture that _removes_ is honoured whatever is held. Answering a dismissal
  wrongly costs a reopen; refusing one leaves somebody inside a panel with the way out not working,
  under a modifier nobody thinks to test. `Escape` in particular is the key a control does not get to
  reinterpret.

  Declared, not coded: the dismissal bindings carry `modifier: "any"` and every deciding path reads the
  binding. A condition naming `Escape` would be a second copy of the rule, and the copy is what keeps
  answering after the declaration changes — proved by mutation, which found exactly that in the first
  version of this fix.

  `keyBindingFor`, `keyMeans` and the two overlay policies accept `MdyKeyOrPress`: a string keeps
  meaning what it meant, so a caller asking what the catalogue declares about `Tab` is unaffected, and
  a caller deciding a press now says so. The calendar's `keydown` intent carries the accelerator, which
  it needed to answer at all.

  **Two things this leaves.** `colors` behaves correctly and reaches that behaviour by comparing the key
  by hand in one renderer, so it does not read the declaration. And the contract snapshot does not cover
  the keyboard catalogue at all — this changed a published binding and `contract:diff` reported `patch`.

  See ADR 0168, which also records where the type-surface classification and my own reading disagree.

- 918e404: A group is named, not the first control inside it

  Plain's field shell put the field's caption on the first control it found inside whatever a kind
  handed it. For a radio group that is an arbitrary option: the caption was announced as the name of
  "Small" and every other option had none. The shell's own comment records the same trap for a
  multiselect's chip strip — a container of several controls is the thing being named, and the group's
  role says so.

  With that fixed, a date range's first box lost the name it had been getting by accident, which is the
  half ADR 0175 had left: `MDY_PART_NAMES` now binds `daterange.startControl` beside `endControl`, so
  each end says its own role and the group says the caption. The caption still points at the first box —
  that pointer moves focus when the words are clicked, which is a different job from naming.

- 22bf399: A guard that asks about what the widget published

  `reportIdCollision` asked whether two elements carried _the widget id_ — a name a renderer need not put
  on anything. plain puts `when__label` and `when__trigger` on elements and nothing on `when`, so the
  count was one or zero and the check returned early: two forms from one document collided in silence in
  the renderer whose ids are hand-written into consumers' pages the most.

  It takes the ids the widget actually put on the page, read from the page, and reports the ones another
  element shares. Two more timing defects fell out of measuring it that way: plain asked before the
  effect that writes its ids had run, and lit latched after its first frame — which can be before the
  form it collides with exists at all. plain asks a microtask later; lit checks every update and says
  each id once.

  The shape is worth naming: **a guard that asks about something the thing it guards does not have**
  passes, and passing is what makes it invisible.

- 89e42ec: The handover moves the face and the caret together

  A tap on an hour hands the dial over to the minute after a moment. The dial redrew and the contract
  marked the minute segment, **and the browser's focus stayed in the hour box** — so an arrow or a digit
  edited the field the person was no longer looking at, and nothing on screen said which one would move.

  The cause is in the controller rather than in a renderer. `focus-field` returns a `focus` command, and
  the handover dispatches it to itself on a timer, where there is no call for the commands to be
  returned from — so they were produced and dropped. `MdyTimepickerFieldControllerOptions` gains
  `emit?`, the sink for commands this controller raises without being asked; a renderer passes the same
  executor it already uses for a dispatched command. A host that omits it draws exactly what it drew
  before.

  The decision to hand over at all is unchanged and still differs between renderers: Plain and Lit
  advance, Angular does not. That disagreement is a separate question and is not settled here.

  **Lit: an arrow on a segment emptied it.** The box bound `nothing` while it was being edited, meaning
  to leave the text alone — but `nothing` on a property binding still writes, setting `value` to
  `undefined` and clearing the box under the caret. The partial is held and bound instead, so the box
  and the draft stay two views of one thing rather than two owners of one field.

- a00cca6: A header that is not one of its own cells

  plain's calendar header read `2026` while the years were on screen — text identical to one of the
  cells under it. Anything looking for the year finds the header first and presses the way back instead
  of the year it meant: a person, a test, a tool. It reads the month and year in every view now, which
  is what the other renderers of this contract show.

  **And a fix from earlier in the night had a corner it did not account for.** lit closes its popup when
  focus leaves the element, which is what `dismissOnFocusOutside` asks for — but `relatedTarget: null` is
  not focus leaving. Re-rendering removes whatever was focused and blurs it into nowhere, and a calendar
  cell replaced when the view changes does exactly that: the popup closed on the click that was
  operating it. Focus is only _elsewhere_ when it landed somewhere, and the null case belongs to the
  keyboard repair beside it.

- 9c3f80b: A key belongs to the control that has focus

  Commands inside a multiselect — the button that removes a value, the one that clears them all, the
  way back — are `<button>` elements, which the platform activates with `Enter` and with `Space`. The
  field's own keyboard policy answered those keys as they bubbled past and called `preventDefault` on
  them, so the browser drew a focus ring on a control that said it could be operated and then did
  nothing. Worse on a chip: the chip's own bindings took `Enter` and did something else with it.

  The contract already said whose key it was — the openers' bindings are declared `on: "trigger"` — and
  the renderers were applying them wherever the key arrived. Each handler now answers only keys aimed
  at its own part; keys inside the popup, where an option _is_ a button, are untouched.

  Which of the two keys a person uses is not a preference: someone who came from links presses one,
  someone who came from forms presses the other, and assistive software sends whichever it was built
  around. There is no way to discover from outside which one a control chose.

- 12c9e50: A chip key is compared, not interpolated into a selector — and every object value stops collapsing into one

  Two defects with one root, both invisible to a suite that only ever chose values that were strings.

  **A structural key is not a legal selector.** The key that tells one chosen value from another is
  derived from the value, and for an object it is the value's own contents as a string —
  `{"id":1,"name":"Red"}`. Eight places built `[data-key="${key}"]` from one. The first quote closes the
  selector and the browser raises `SyntaxError`: landing focus after a removal, focusing a chip after a
  move and measuring midpoints during a drag did not misbehave, they threw, and took their handler with
  them. Two of five representative held values do this — an object, and any string carrying a quote.

  `elementByDataKey` reads the attribute back and compares it. Escaping would also work and needs a
  second set of rules — attribute values and class names do not escape alike — where zero will do.

  **Three derivations of one order, and one of them was wrong.** The strip lays chips out in the order
  the value holds them, and all three renderers worked that out for themselves. Two used the contract's
  key function; one used `String(value)`, which agrees on every primitive and turns every object into
  `[object Object]`. Its strip _painted_ correctly — painting reads the controller — while every gesture
  that indexes into the strip indexed into a list of one. Five chips reordered as though there were one.

  `chosenKeyOrder` is now the contract's answer, asked for by name. Three renderers read it; none
  derives it.

  The agreement between the three was never verified, only assumed: no test used an input where they
  part ways. See ADR 0166.

- 2e718c7: Two different choices held at once stop arriving as one.

  With option values that are objects — `{ id: 1, name: "Alfa" }` and `{ id: 2, name: "Beta" }`, both
  chosen — every renderer drew **one** chip, labelled as the first taken twice, with the counter
  agreeing. Beta did not appear as missing; it appeared as more Alfa. A person read a field asserting
  something they had not chosen.

  Each renderer spelled the key derivation again as `String(value)`, which renders every plain object as
  `[object Object]`, so two distinct values collapsed into one key. They read `defaultOptionKey` now —
  the same function the controller derives its own keys with, which keys an object by what it holds.

  **Nothing moves for a primitive**: `defaultOptionKey(v)` and `String(v)` agree exactly there, which is
  also why no fixture in the suite could see this — all of them hold strings.

  Two label fallbacks go with it: lit matched a held value by identity alone and fell through to
  `[object Object]` for a fresh object that _is_ an option's value, and Angular labelled a value whose
  option had gone with the same string. Both name what the value holds instead.

- 9bc3cdd: A letter typed at a closed select chooses, instead of reaching nothing.

  Type-ahead was wired to the open list only, where a letter moves the reading position and leaves the
  value alone. Closed there is no reading position to move, and every platform takes the letter as the
  choice — it is the fastest way to pick from a list somebody already knows, costing no popup, no arrow
  keys and no reading. Closed, a letter now selects the option it matches.

  Unchanged for a searchable select, which answers a letter by filtering.

- a0e0484: A read-only field says so to the eye, not only to a screen reader

  Every kind carried `aria-readonly="true"` when locked — measured, all twenty-four cases across the
  three renderers — and **seventeen of them looked exactly as they had a moment before**. Somebody
  listening was told; somebody looking tried to type, nothing happened, and nothing explained why.

  The sheet already held the decision and the reason for it: a read-only field keeps its full contrast
  and its pointer events, because it is _in play_ — focusable, submitted, validated — and says it is
  locked with a surface of its own rather than by fading, which is what `disabled` does. What was
  missing was the state reaching the kinds that draw their own frame and never sit in an input wrapper:
  a checkbox, a switch, a chooser, a slider.

  The rule is now keyed on `[aria-readonly]`, the attribute the projections already emit, rather than on
  a class each renderer has to remember — it was present in all twenty-four cases while the class was
  in one. The plain renderer also passes `readonly` to its shell for the three kinds that were not.

  **Zero of thirty-three now change nothing when locked.**

- 3bb36c1: A read-only file field refuses the file

  Locking a file field disabled the button that opens the picker, and nothing else. A file dropped on
  the field, handed to the input by a script, or delivered by an assistive technology driving the
  control was written straight into the model — a value the application had declared unchangeable,
  changed.

  Measured: with the field locked and the file delivered to the input directly, plain and Lit took it
  and Angular did not. Angular was the only one that held.

  The refusal now lives where the value is written rather than on the affordance, so every route in is
  covered by one guard. **A guard on a door is not a lock.**

- 16f1d3f: A marker only where it applies, and one answer about being wrong

  plain built the required marker into every label and hid it with `display: none`. Hidden is enough for
  a person and for an accessible name, and not for anything asking _whether this field is marked_ — a
  test, a tool, a stylesheet — so an optional field carried the marker of a required one. It is added to
  the label when the field is required and taken out when it is not.

  **And the wrapper's paint disagreed with `aria-invalid`.** plain painted `mdy-input-wrapper--error`
  from the verdict while the control said `aria-invalid="false"` from what was shown — the two faces of
  one question, answering differently, which is the thing the comment above that line says must not
  happen. Both read the shown verdict now.

  **`keepKeyboardInPlay` also gains `afterBlur`**, and it is a correction to how it was first written:
  a renderer that takes a control out of play calls _before_, with the keyboard still on it; one that
  hears about it afterwards has only the fact that focus is nowhere. Treating "nowhere" as reason enough
  in both cases moved the keyboard onto widgets nobody had been standing in. Two DOM checks were also
  `instanceof Element`, which throws in a document whose implementation does not put `Element` on the
  global — inside an effect, taking the rest of the render with it.

- f0b4f7d: A name for a field nobody named

  A document may declare no label — the published corpus does — and everything inside a field's shell is
  named by _pointing at_ that label. With no words in it, a `radiogroup`, a `grid` and a `dialog` are
  announced as their role and nothing else: "group", "grid", "dialog", with no way to tell which field a
  person has landed in.

  Two repairs, at the two levels where the question is answerable:

  - **The option projection names the group itself** where no label was written — `aria-label` from
    `fieldAccessibleName` rather than `aria-labelledby` pointing at an empty element. A reference to
    nothing is not a name, and the contract already held the order to choose by.
  - **plain's shell writes the fallback into the label** and keeps it out of sight. Every reference
    inside the field then resolves to words, whichever part made it. `clip-path` rather than
    `display: none`, which would take the label out of the accessibility tree along with everything
    pointing at it — a name is owed to a screen reader, a heading nobody asked for is not.

- a7cd1a8: The field's name stops landing on the list of chosen values.

  `insertControl` puts the field's accessible name on "the element a person operates", and asked for
  `input, select, textarea, [role], button` at once it took whichever came first in the DOM. For a
  multiselect that is the **chip strip** — a `role="list"`, structure rather than control — so the name
  was announced on the list while the combobox beside it carried the same word. A reader heard "Scelte"
  twice, for two different things, in the only renderer of three that did it.

  A real control is asked for first, and a bare `[role]` only if there is none. All three renderers now
  present the same tree: an unnamed list of chips beside a named combobox.

- a268ec7: A name the strip had to cut can be read without a pointer

  A chip whose label does not fit is cut off, and the only way to read it was the `title` attribute —
  which never appears for a keyboard or a touch user, who are exactly the people who cannot widen the
  chip. WCAG 1.4.13 asks that content revealed on hover be reachable on focus as well.

  Focusing or hovering a chip now reveals its full name in a `role="tooltip"` element the chip is
  described by. The new optional part is `chipTooltip`, and it belongs to the **control**, not to the
  chip: a child of the chip is part of the chip's own text, and the name a chip composes from its
  contents said the label twice. One element per control, moved to whichever chip is being named.

  `chipTooltipOffset` is exported — where the tooltip sits in the control's coordinates, taken against
  the strip the chip scrolls in, so a chip scrolled halfway out is named where it is drawn.

- 08cca72: A colour palette a keyboard can reach

  Three clauses of the contract could not all hold. `MDY_WIDGET_KEYBOARD` declares the arrows, `Home`
  and `End` on an open colour field; the canonical observation said focus stays outside the widget when
  the palette opens; and `Tab` is declared `cancel`, so it dismisses rather than enters. Together they
  left the swatch row unreachable from the keyboard in every conforming renderer, and the four declared
  keys undeliverable — the presets were a pointer's row.

  The canonical now says what it already says for the calendars: the palette takes focus into the row
  it just showed, because a list the keyboard cannot reach is a list only a mouse can use. All three
  renderers do it, and all three walk the row with the keys the catalogue declares, in the direction
  the binding gives rather than the one the key name suggests.

- 04a0643: A panel measured before it exists

  The calendar was positioned in the same pass that filled it, and before it: measured with no cells
  in it, the panel is 54px against a content height of 276, so the placement policy was asked whether
  a box a fifth of the real size fits under the field. It does — and the panel was then drawn at full
  height, clipped, in a window where the policy answers "above" on the same rect.

  The wrong number did not correct itself either. The measurement is held for the whole opening, so
  nothing later in the panel's life re-asked, and the panel a person saw was placed against a panel
  that never existed. The positioning now happens after the month is in, in both the date picker and
  the range picker.

  The policy was right throughout, which is why this is a browser check rather than a unit one:
  reading the policy would have agreed with itself.

- e972a01: A part named for what it is for: `select.listbox` is `select.options`

  ADR 0132: a part's name says what the element is **for**; its role says what it **is**. `listbox` stays
  everywhere it is a role and stops being a part name. A part named after a role cannot survive the
  semantics changing — multiselect already proved that, when its chips stopped being a listbox and left
  a part called `listbox` describing something it was not.

  Select's option list is `options` now, as multiselect's already is, and one name serves both kinds. Its
  role is unchanged: the element is still a `listbox`, declared through `roles` and `elements` rather
  than through the name.

  **The migration is one line, and narrower than it looks.**

  ```
  class          mdy-select__list        unchanged
  id             <widget>__listbox   →   <widget>__options
  aria-controls                          follows the id
  role                                   unchanged
  ```

  No CSS class moved, so a consumer's stylesheet is untouched. The id moved, and only plain published it
  — lit and Angular never emitted one, which is its own finding. If you named `<widget>__listbox` in
  your own `aria-*` or in a selector on that id, it is `<widget>__options`.

  `MdySelectA11yProjection.listbox` is `MdySelectA11yProjection.options`.

  **Rejected**, so it need not be re-derived: renaming multiselect's `options` to `listbox` for symmetry
  is the same mistake in the other direction; and an accessor — `optionListPartOf(kind)` — loses on
  smallest public surface, because it adds a function to learn and leaves both names for anyone who does
  not know it exists.

- 5892bb2: The colour field's native input leaves the accessibility tree instead of being named in it

  A regression, and its repair is smaller than the thing it repairs. Removing a hardcoded English
  fallback left the hidden native colour input with no accessible name, which an auditor calls critical
  — it reads the element because it is in the tree, not because it is visible.

  The first answer was to name it again. The contract says not to: **the caption points `for` at the
  hex input, the swatch points `aria-controls` at the popup, and nothing points at the native input at
  all.** It is the platform's chooser, opened by the swatch, and a person operates that. Named, it puts
  a second colour control in the tree that nothing described; hidden, it is the machinery it is, and it
  is not tabbable so hiding it strands nobody.

  Three renderers had answered that silence three ways — one hid it, two gave it different English
  names — and an auditor was green on the first and critical on the others. That is the whole argument
  compressed: a control in the tree that nothing describes is a control a reader meets and cannot place.

  **Five more parts are in the same state, and they are not machinery.** The search boxes inside the
  select and multiselect panels, the second date box of a range, and the two spinners of a timepicker
  all render controls no relation names, so what a person hears at each is every renderer's own
  decision. Recorded rather than asserted away: the list can only get shorter, each entry says whether
  it is machinery or a gap in the contract, and an entry that stops being true fails the check as loudly
  as a new one appearing.

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

- a35e153: A press on a multiselect's field completes when it is released

  Plain opened the list while the pointer was still down; Lit and Angular waited for the release.
  Beginning a press and moving away before letting go is how a person takes a tap back, and where the
  control acts on the down-event that gesture does nothing — the list is already open.

  Now the press completes on release in all three, so leaving cancels it. The down-event is used only
  to stop the box taking focus from the opener it is about to hand focus to.

  ADR 0155 records the decision and why the release, not the press, is the half that agrees with the
  button the field forwards to.

- bd78bcc: A chip's own controls keep working once it can be dragged

  Adding the drag took the tap path away, in all three renderers at once, and the cause is worth
  stating because it is not obvious from either side of it.

  `setPointerCapture` on the press does exactly what it is for — it follows the gesture anywhere — and
  it **retargets every later pointer event to the capturing element**, including the one the browser
  turns into a `click`. So the chip's own buttons stopped receiving their clicks: the control was drawn,
  it was found, the press landed, and nothing happened.

  The gesture is tracked on the document instead. It follows the pointer just as far and leaves the
  buttons alone.

  The first repair traded one door for the other: refusing to start a drag from the chip's own controls
  made the tap work and the drag stop, because those controls **cover most of the chip** — a chip
  draggable only by its bare edges is a chip nobody can drag. What separates a press from a drag is
  travel, not where it landed, so a drag may begin anywhere on the chip and the click it would otherwise
  produce is swallowed once, in the capture phase, when the gesture turned out to travel.

  All three doors agree again: a keystroke, a tap on the move controls and a drag of the same chip land
  on the same order in all three renderers.

- 5b1b52b: A quantity a keyboard can change, and a × at the end of the chip

  `ArrowUp` and `ArrowDown` on a counter chip stopped stepping its quantity. The ± controls beside the
  number are `tabindex="-1"` pointer affordances, so with those two keys gone the number was reachable
  by pointer and by nothing else — WCAG 2.1.1, and not a cost ADR 0138 traded for taking the
  `spinbutton` role off the chip: that record gave up the native announcement and kept the keys.

  The binding is back in the table and the handler in all three renderers. It collides with nothing: the
  strip's own arrows are left and right, and the `open` bindings now name the part they open from.

  The catalogue also declared `chipRemove` before `chipMove`, so the part order it published put the ×
  in the middle of the chip while all three renderers draw it at the trailing edge, where it belongs.
  The declaration follows the renderers.

- 087b2ca: A quantity says where it is, and says so once per gesture.

  Stepping a counter chip down was silent until the step that deleted the value: the sentence a
  selection change produces compares the _distinct values_ a field holds, and taking three of something
  down to two changes none of them. So the only step that spoke was the destructive one, and a person
  stepping down heard nothing until what they were counting was gone.

  Two things had to be true of the repair, and they pull against each other:

  - **A live region cannot be read on every step.** A held arrow key queues one polite sentence per
    press, played out after the person has let go — a backlog of values several steps in the past. A
    `spinbutton` does not have this problem because the platform reads a _value_ and coalesces rapid
    changes itself; a control that gives up that role (ADR 0138) takes the coalescing on.
    `settledVoice` is that coalescing: it says the value a gesture ended on, and its schedule is
    injectable so a test can settle it without waiting.
  - **The floor is announced on arrival, not on crossing.** `quantityAnnouncement` says
    `"Alfa, 1, minimum"` when a quantity _reaches_ one, so the next step down is a known act. Warning at
    the moment of deletion is too late: the value is already gone and the person is being told rather
    than asked.

  All three renderers announce identically, by keyboard and by pointer.

- 04ff8d8: A range says which day is today

  The single-date calendar reads the day cell's projection and says `aria-current="date"` on today; the
  range calendar wrote its cells by hand and said it in one renderer of three. It reads the same door
  now, and Plain and lit mark today in both channels — the class for the eye and the attribute for a
  reader — where they marked it in neither.

- cd6e557: A reference that resolves in every renderer

  Three renderers answered one contract three ways about which elements carry an id, and the halves that
  were **referenced by something** were broken in two of them.

  - **Angular never gave a label an id**, for any kind. Every `aria-labelledby="<widget>__label"` the
    widget projections emit — the calendar's month and year views, the range's grids — pointed at
    nothing. `mdy-control-label` now carries the canonical id, derived from the field it labels, and
    callers whose label points at something other than the field's own control say which widget it
    belongs to.
  - **plain's select had the same hole**: its controller's view has no label part to apply, so the
    label went out with no id while every other kind's carried one.
  - **lit and Angular gave the multiselect's option grid no id**, so the trigger's `aria-controls`
    resolved to nothing while the control claimed to control something. Both take the id the projection
    gives that part — deliberately not the one the opener names, which is the popup's and is already on
    the panel: two elements claiming one id makes every reference to it non-deterministic.

  What remains is disagreement without a broken reference: plain gives datepicker day cells and
  timepicker segment inputs ids that nothing points at, in any renderer. Whether those should be added
  to the other two or dropped from plain is a decision about what a part owes a consumer, not a repair.

- 0e6540c: A reference worth following

  A bare field with nothing to say still pointed `aria-describedby` at its supporting-text element — an
  empty one. A reader is told there is more to hear, goes, and hears silence, which costs them the move
  and teaches them not to follow the next reference.

  The reference is made only where there is something at the other end. The renderer is the one who
  knows — the text may be a host's supporting line, a slot, or a sentence the kind adds for itself — so
  the text controller takes `describes`, and lit's elements answer it with `hasDescription()`. Angular
  already asked the question this way.

  **And the DOM checker was demanding the opposite.** It required the relation whenever the target part
  was rendered, and a supporting-text element stays in the document while empty so its id keeps its
  place. It now asks whether the target is _on screen_ — `hidden` and `aria-hidden="true"` are how a
  renderer says it is not — which is the criterion the check states in its own comment: a relation is
  required exactly when both ends are on screen.

- 09522e7: A refused field says so to the eye, not only to a reader

  Every kind announced its refusal — `aria-invalid` was there throughout — and three drew nothing. A
  checkbox, a switch and a range looked exactly as they had a moment before, so a person who could see
  the control was told nothing while a person listening was told everything.

  Three separate causes under one symptom:

  - **the sheet painted the box and not the words.** The box treatment names `mdy-input-wrapper`, and a
    checkbox and a switch carry their own wrapper class, so the rule addressed a block they do not have.
    The refusal is now stated on the label, which is the one part every kind has;
  - **a checkbox said it was wrong before anybody had been near it.** It asked _is this field invalid_
    where every other kind asks _is this refusal one to show yet_ — two answers to one question, and the
    first is true from the moment a required box is drawn unchecked;
  - **a range said it too, for a different reason.** Its empty value is an object, and the predicate was
    not told the kind, so a value that _is_ this field's nothing read as one that arrived from a draft
    or a server — which is said at once rather than waiting for a turn. `file` had the same shape and is
    fixed with it.

  The first two made refused and untouched look **identical**, which is why nothing caught them: the
  state that mattered was the one that never changed.

- 58654b1: The button that takes a chip off says which chip it takes.

  Every remove button in a multiselect's strip was named with the verb alone — `Remove`, `Rimuovi` — so
  a field holding eight values offered eight controls with one name between them. Someone reading the
  page one control at a time hears "Remove" and has to leave it, find the chip beside it, and come back
  to know what they would be removing; someone listing the controls hears the same word eight times.

  `chipRemoveName(verb, label)` is published from `@modyra/widgets`: the words stay with the renderer,
  where the language lives, and the rule that the object belongs in the name lives in one place. All
  three renderers now announce `Remove Alfa`.

  **Migration**: a test or tool matching the old name exactly — `[aria-label="Remove"]` — matches
  nothing now. Match the prefix, or the part class.

- cde2ab8: A role the catalogue names

  Four roles were written by renderers and declared nowhere, so nothing could check them and the next
  renderer had to guess.

  `calendar` is a `dialog` on the datepicker and the daterange — the calendar and not the popup around
  it, because the calendar is what a person enters, works in and leaves while the popup is the box that
  positions it. Two renderers already wrote it there; Plain wrote it nowhere and now reads it from the
  catalogue, along with the accessible name a dialog owes.

  The timepicker's `hourControl` and `minuteControl` are `spinbutton`s. The projection has emitted the
  role since the segments existed and the parts table did not carry it.

  The conformance kit learns that `<input type="number">` is a spinbutton to the platform, so a
  renderer using one carries the role without spelling it — reporting "with none" over an element that
  has the role was the inspector describing its own table rather than the page.

- 1f53a38: The colour presets answer the keys the catalogue declares for them

  `MDY_WIDGET_KEYBOARD` declares the arrows, `Home` and `End` on an open colour field, and neither
  renderer answered any of them: the swatches are a listbox and nothing walked it. They do now, in the
  direction the binding gives rather than the one the key name suggests, so a row reads correctly in a
  right-to-left document.

  Focus is unchanged: the contract's canonical observation says a colour overlay leaves focus where it
  was, so nothing moves into the row on open.

- 0ae26cf: The option grid says what it is, and a multiselect opens on an arrow again

  **The chip grid declared no role at all.** It once claimed `listbox` semantics its chips did not have,
  and the redesign removed the role rather than correcting it — so the container became an unlabelled
  `div` and a screen reader was told nothing about the set. `null` is neither of the two published
  answers; it is the one that says nothing.

  `group`, declared by the contract rather than written into three renderers — which is what plain and
  lit were already doing separately and Angular was not doing at all. Not `listbox`: a listbox's
  children are options a person walks with the arrows, and these are chips that toggle, so the stronger
  role would promise a keyboard model the grid does not have.

  **And `ArrowDown` opens a closed multiselect again.** It is the APG's own behaviour for a combobox and
  `select` still had it. The binding was conditional on a kind declaring a `listbox` part — and the
  multiselect lost its arrows the day that part was retired, because its popup still held the same
  options under a different part name. The condition asks about `option` now, which is the question it
  was always trying to ask: a calendar, a clock face and a colour palette declare none, so they are
  untouched.

  One conflict closed with it: a focused chip was swallowing every key the contract declared, including
  the ones it does not answer, so `ArrowDown` on a chip did nothing at all. A chip now stops only the
  keys it handles.

- 763348b: The multiselect's way back reserves its line, so removing a value moves nothing else.

  The row that offers the undo was rendered only while the offer stood, so every control below the
  field stepped down 21px when a value was removed and stepped again on the next removal. The row is
  now always in the page and always one line tall; its sentence and its button are what come and go.
  At rest there is nothing to read, nothing to announce and nothing to press.

  The offer is deliberately not moved into the control's box: it would trade the vertical shift for a
  horizontal one, with the clear-all and the caret sliding as it arrived. ADR 0144 records both.

  Angular's row also moves ahead of its overlay panel, which the contract's part order requires and
  which nothing could observe while the row was conditional.

- 03022aa: A state attribute says what the contract says, in both directions

  Three renderers narrowed or widened what the projections declare, so the same field said different
  things depending on who drew it.

  Plain wrote `aria-readonly="false"` on a colour field and on both ends of a range. The projection
  emits that attribute only while it is true — "false" is a claim about a state the control is not in —
  so Plain now writes it or nothing.

  Lit dropped `aria-disabled` from a select's trigger when it was false, where the contract declares it
  in both states: a trigger that is not a native control says "no" rather than saying nothing.

- 49339e9: The chip strip is a `grid` and every chip a `gridcell`.

  A screen reader switches between its two modes on the role of the focused element, and `listitem` —
  which the chip was — is not one it switches on. Somebody who arrived at the field **by browsing** — by
  heading, by landmark, by jumping to the next form field, which is the ordinary way to arrive — pressed
  an arrow, the virtual cursor moved, focus stayed on the chip, and the strip's entire keyboard model
  never reached them. Silently, and only on one of the two ways in.

  `gridcell` is a role the mode switches on, and it may contain buttons, which is what a chip is: a thing
  with up to five buttons in it. `option` switches too and is refused for its own reason — this widget's
  listbox is the popup a person chooses from, and a strip of what was already chosen is not a second one.

  **Always, not only where a chip holds a quantity.** ADR 0148 supersedes ADR 0138, whose objection was
  against a grid that arrived _with_ the quantity: a strip that changed role with its contents would
  change its keyboard model underneath the person who filled it.

  **Migration.** A consumer styling or querying `[role="list"]` / `[role="listitem"]` on the chip strip
  should read `grid` / `gridcell`. The classes are unchanged.

  **The position moves with it.** A `gridcell` does not take `aria-posinset`/`aria-setsize`; a grid says
  the same thing with `aria-colcount` on the strip and `aria-colindex` on each chip, which exist for a
  set that is not all rendered — the same shape as a row that scrolls. A reader announces "Roma, column 3
  of 12". One cell per chip, never one per button: the index counts cells, so five buttons each a cell
  would say "column 14 of 72".

  **The strip appears with the first value and goes with the last.** An empty grid announces contents it
  does not have, so a field nobody has chosen anything in draws no grid at all — what says it is empty is
  the placeholder. `chips` is therefore optional in the contract rather than required.

  **Removing the last value says so**: `selectionRemovedLast`, new in the message catalogue in five
  locales, because once the strip is gone nothing else in the page tells a person what happened.

- d2092bb: A chip strip that can say where a chip is

  `aria-posinset` and `aria-setsize` are legal on `option`, `listitem`, `row`, `tab`, `treeitem`,
  `radio`, `menuitem*`, `article` and `comment`. The strip was a `group` and a chip was a `group` — or a
  `spinbutton` when it held a quantity — so the position and the count every chip states were written to
  the DOM and permitted on neither role. ADR 0127 departed from 1.4.10 and paid for it with exactly
  those two attributes; the payment could not be made in the roles the strip had.

  The strip is now a `list` and a chip a `listitem`, in the catalogue, so all three renderers say it
  once. `option` would also take them but only inside a `listbox`, and the listbox here is the popup a
  person chooses from — a strip of what was already chosen is not a second one. A counter chip stops
  claiming `spinbutton`: a control cannot be both the item at position 3 of 12 and the number 3 of a
  range, and the role that carries the position is the one the strip owes. Its quantity is in the chip's
  own name and in the announcement its change makes, so `aria-valuenow`, `aria-valuemin` and
  `aria-valuetext` are gone from it.

  The row also wraps at 320 CSS pixels — 400% zoom on a desktop viewport — where a single scrolling row
  stops being a layout and starts being content a person has to operate blind.

  Migration: a consumer styling `[role="group"]` inside the strip, or reading a chip as a spinbutton,
  reads a `listitem` in a `list` instead. The classes are unchanged.

- 76c0865: The chips strip scrolls, and `searchable` decides whether there is a search

  **`searchable` was ignored by every multiselect renderer.** The document has declared it all along and
  all three built the filter box regardless, so a field that asked for no search got one — and a field
  that asked for nothing got one too, which is what made the flag look like it worked. The slot was
  never the problem; three renderers each dropped it.

  **The strip scrolls now, and the reason it did not is worth recording.** Nothing overflowed because
  the truncation was absorbing it: chips shrank until they fit, so `overflow-x` had nothing to do and
  "scroll to see the rest" never happened — they just got narrower until nothing was legible. The chip
  gains a floor width, which makes the overflow real, and the ellipsis then means _this one is clipped_
  rather than _everything is_.

  One layer up, the field's box was growing to fit its chips: a flex item's automatic minimum size is
  its content, so the control was as wide as the value was long — the same expansion the inline option
  list used to cause, one axis over. `.mdy-multiselect` takes `min-width: 0`.

  Deliberately **not** `scroll-behavior: smooth`. A chip scrolled out of the strip is still
  Tab-reachable and focusing it brings it back, but smooth makes that arrival take about half a second,
  during which the focused chip is still off screen and anything reading the scroll position sees the
  old one. A focus ring nobody can see yet is the same defect as a focus ring nowhere.

  **The chip's controls draw their marks in CSS rather than writing them as text.** An accessible name
  composed from an element's contents picks up a `×`, so the chip announced itself as "Opzione A 2 ×"
  unless somebody remembered to exclude it. A mark that is never text cannot be read out by accident.
  The caret at the trailing edge is drawn the same way, from the same glyph token as the select's.

  A chip narrowed to an ellipsis carries its full name in `title`. That is the pointer's half; the
  tooltip a theme draws on focus and long press is the half that reaches a keyboard and a touch.

- c5276cc: A press on the edge of a field reaches the control

  The plain renderer draws a box between the field and its control, inset by 12 pixels on each side.
  That leaves a strip along every edge that looks like the field and is not the control: a press there
  put focus **nowhere at all** — measured, the document's body kept it — while the same press in the
  Lit and Angular renderers lands on the control, because neither of them draws that element.

  Every kind with a field shell was affected: text, number, select and the rest.

  The box now forwards a press to its control. Only a press on the box itself — one on a prefix, a
  suffix or a button inside it still belongs to that element.

- 8bd2920: A multiselect the keyboard does not lose

  Plain re-appended every option to the popup grid on each pass to keep the order the controller's.
  Moving a node takes focus off it, so choosing an option with the pointer sent the keyboard to the
  document: the popup stayed open with nothing focused inside it, and `Escape` reached no listener.
  Options are now moved only when they are not already where they belong.

  Lit kept its own list of the keys that open a multiselect and answered three of the four the
  catalogue declares — `ArrowUp` on a closed control did nothing. The keys come from
  `MDY_WIDGET_KEYBOARD` now.

  Lit also placed focus on the remove button inside the next chip after a removal, while the strip's
  tab stop is the chip itself. Focus lands on the chip, as it does in plain.

- b7fbfd4: A tap on the hour no longer takes the dial away

  Tapping an hour handed the face over to the minutes a moment later, so a person who touched roughly
  the right number and then went to drag to the one they meant found the dial already showing minutes.
  The handover stole the gesture it was meant to follow.

  `set-from-angle` gains `phase?: "move" | "end"`. **The hour hands over when a gesture ends after
  moving, and never on a tap** — a tap is where a person starts, a release after travelling is where
  they stop. A caller that reports no phase is a caller reporting a result rather than a gesture, and
  gets the tap's answer: no handover.

  This is a behaviour change in Plain and Lit, which advanced on a tap, and it makes all three renderers
  agree. Angular did not advance at all, for a reason that was itself a defect: its clock component held
  `focusedField` as a signal of its own, so the controller's handover reached the contract and never the
  face. The field is now given to the clock and asked back, as `viewMode` already was — the third state
  that component kept a second copy of.

  **Why the reasoning is here rather than in a decision record.** `docs/` is being worked on elsewhere
  and is not ours to touch this session, so this changeset carries the decision until a record can be
  written for it. What is decided: a tap explores, a drag chooses, and only a choice moves the field on.

  Two supporting fixes travel with it. `MdyTimepickerFieldControllerOptions` gains `emit?`, the sink for
  commands the controller raises without being asked — the handover produces a `focus` command on a
  timer, where there is no call for it to be returned from, so the dial drew the minutes while the caret
  stayed in the hour box and an arrow moved the field nobody was looking at. And Lit's segment bound
  `nothing` while it was being edited, meaning to leave the text alone; a property binding still writes,
  so `value` became `undefined` and the box emptied under the caret.

- 4b95b46: A tap target stays inside the field it acts on, and a chip's steppers draw their marks.

  **The target.** The datepicker, timepicker and colours toggles carry a 44px hit area as an `::after`,
  centred on a control that is smaller than it — so the target hung over both sides, and these controls
  sit at the field's trailing edge. Half of it lay **outside the field**, in the space belonging to
  whatever the form draws next: a press three pixels past the border opened the colour palette. Anchored
  to the control's inner edge and grown inwards now, so the whole target is over the field it acts on.
  The target keeps its size; only the direction it grows in changes.

  **The marks.** A counter chip's two steppers were 32×24 of nothing in `@modyra/plain` and
  `@modyra/lit` — they took their space, answered a press, and showed a person nothing, so the only way
  to find one was to press the blank and watch the number change. Both renderers draw the minus and plus
  from the icon set, which is what their own option chips already did and what `@modyra/angular` does.

- 4900c8b: Tab leaves a closed widget again, and stops being cancelled inside an open one

  A regression from the previous release, found on the browser tier: forty tab stops inside a **closed**
  colour field and the next field never reached. A trap in an open panel is at least explicable — there
  is something on screen. In a closed control nothing says why the key stopped working.

  Moving the dismissals onto the catalogue asked the wrong question of it. `Escape` and `Tab` are both
  declared `cancel`, and they are not the same act: `Escape` takes the reading position back to the
  opener, `Tab` is already carrying it to the next field and must be left alone. Asked only "does this
  key mean cancel", six handlers answered `Tab` with `Escape`'s rule. One of them focused the opener —
  that is the trap that was found. The other five called `preventDefault` on `Tab`, which strands
  somebody in a panel being torn down and which **no check outside a browser can see**, because there
  is no native Tab to prevent.

  The contract already told them apart: `restoresFocus`. Every one reads the binding now, and the phase
  is asked rather than assumed — a shut control asked about the open phase answers with the bindings of
  a panel that is not there.

  Two checks, because the two halves are not visible to the same instrument. One walks a closed
  widget's tab stops and asserts nothing moves the reading position. The other presses `Tab` at every
  stop, open and closed, and reads `defaultPrevented` off the event — which works exactly where
  watching focus cannot. `Escape` is its control: a renderer that cancelled nothing at all would pass
  the first and fail the second.

  The one kind that keeps `Tab` inside its open panel is read from the catalogue, not exempted by name:
  its overlay holds an actions bar, so a confirm button inside has to stay reachable, and it declares no
  `Tab` dismissal — which is the contract saying exactly that.

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

- ef24648: The way back joins the field's trailing edge, and the caret is drawn last

  A multiselect's undo moves from a row beneath the field into the row of commands at the field's
  trailing edge, where the clear-all it reverses already sits. The row goes, and the band it reserved
  returns to the validation message.

  **Migration.** The `wayBack` part no longer exists and `wayBackAction` is now a child of `box` rather
  than of that row; `arrow` is a child of `box` rather than of `trigger`. Anything selecting
  `.mdy-multiselect__way-back` or reaching a part through those parents follows the new structure. The
  `mdy-multiselect__way-back-action` class stays and is now a mark rather than a word — it names what
  it puts back through its accessible name, composed by the new `wayBackActionName`.

  The count of what is chosen no longer appears under the field. The chips are the selection, and the
  ones the strip scrolled past are counted at the strip's own edge, where the count is also the way to
  reach them.

  **A defect closed with it**: that edge count answered `1` for every arrangement — it measured the row
  holding the chips instead of the chips, so a strip hiding twenty-five said "1 more not shown". It now
  counts chips at any depth. Renderers no longer write a count of zero into a control they are not
  showing.

- f24ca8b: The keyboard shortcut a record promised now exists

  ADR 0147 states that `Ctrl`/`Cmd`+Z reaches a multiselect's undo. It reached nothing, from any
  position focus could hold, in any renderer — and a shortcut that does nothing cannot be told apart
  from one nobody pressed, so a record read by people who tell their own users was worse than a record
  that had never promised it.

  The gesture is now **declared in the keyboard contract** rather than written into three renderers:
  `MdyKeyBinding` gains `modifier: "primary"` for the platform's own accelerator, and
  `matchesKeyGesture` resolves a binding against an event so the platform test is made once.

  **Migration.** `MdyKeyBinding["intent"]` gains `"undo"` and `MdyWidgetKeyIntent` gains `{ type:
"undo" }`. A consumer that switches exhaustively over either has one more case to answer; anything
  reading them non-exhaustively is unaffected.

  Using the way back also left focus on nothing, because the offer is withdrawn by using it and took
  the person's place with it — so undoing a removal cost finding the field again, which is the cost the
  undo exists to save. The reading position now lands on the value that came back, or on the field when
  there is none.

- 529acef: Every renderer's dismissal reads the declaration instead of naming the key

  `Escape` closed a panel whatever was held with it, in all three renderers, and kept closing with the
  declaration deleted from the contract. Fourteen conditions compared the key by hand: correct
  behaviour, reached for each renderer's own reasons, so the catalogue could have lost the line that
  says a dismissal answers a held modifier and nothing anywhere would have moved.

  That is what a rule stated twice does. The copy keeps answering after the declaration changes, and
  the next renderer has no reason to agree with either.

  All fourteen ask `keyMeans(kind, event, "cancel", …)` now — including the two shared calendar helpers,
  which take the kind whose grid they are drawing rather than assuming one. Removing `modifier: "any"`
  reddens four kinds in the framework-free renderer, all six in the web-component one, and a contract
  check in every one of the three. The two that stay green in the first are the kinds whose opener is a
  button, where a key does not open the panel outside a browser and the dismissal is never reached.

  ADR 0168 corrected with the measurement: it said one kind was not reading the declaration. It was
  almost all of them, and the wrong number came from counting the lines a test runner repeats in its
  summary rather than the checks that failed.

- 661568e: An act that moves three values is announced as three

  Clearing a multiselect said "Alfa removed, nothing selected" while three values went, and undoing that
  clear said "Alfa added, 3 selected" while three came back. The count beside it was right the whole
  time, which is what made the sentence sound like an account rather than a fragment: it invites a
  listener to reconcile the halves themselves, and the reading that comes back is the one where they had
  only ever chosen Alfa.

  **Migration.** `MdyI18nMessages` gains three required members — `selectionAddedMany`,
  `selectionRemovedMany`, `selectionRemovedManyLast` — carrying `{moved}` for how many changed and
  `{count}` for how many are held. A consumer with its own message table supplies them. They are
  required rather than optional on purpose: a table that cannot say the plural act is a table that will
  say a smaller one, which is the defect this closes.

  Counted rather than listed. The singular templates put the value before a verb that agrees with it, so
  a list of names dropped into one is ungrammatical in every language that inflects — and twelve names
  read out for a single act a person took knowingly is a list rather than a fact.

- 5bde1b0: A field with no rules of its own still shows an error it is given

  Reserving the error container asked one question — can this field fail a rule? — and then used the
  answer for a second one it does not fit: whether the container exists at all. A field with no local
  constraint got no container, so a refusal arriving from a server was held by the form and never
  written to the page. The form knew; the person did not.

  The two questions are separate, and only the first is about the field's rules. **Holding a place**
  under a field that can fail is what stops a message pushing down the field somebody is already
  reaching for. **Having something to say** is what decides the container exists. A server judges a
  value nothing local can, and that refusal has to land somewhere.

- 8081294: A nested field's id can be reached by a selector

  A document that holds a collection names a nested field `rows.0.name`, and every renderer built that
  field's id from its path. The separator is a class selector to a browser, so
  `querySelector("#form-rows.0.name")` does not miss — it **throws**, because a class may not begin with
  a digit. A consumer selecting a nested field by the id this contract published got a stack trace, and
  the only input required was putting a form inside a form.

  ADR 0141 already decided this for caller data. The library was the other producer of an unreachable
  id, and the same rule now covers the path: `rows.0.name` becomes `rows_2E0_2Ename`, by the same total
  escape, through the same function — exported as `idSafeKey` so the three renderers spell it one way
  rather than three.

  **Migration.** Every nested field's id changes, so a stylesheet, test or `aria-describedby` naming
  `form-rows.0.name` names nothing after this. Those are exactly the ids that could not be selected
  before. A flat document is untouched — `name` escapes to `name` — so the common id stays readable.

- 233c2bd: An option a document closed says so before it is pressed.

  The press was already refused — the form kept `null` — but three of six renderer-and-kind pairs drew
  the unavailable option exactly like an available one: no `aria-disabled`, no distinguishing class,
  nothing a person could see or hear before pressing it. Someone who cannot see the list read that as a
  broken control; someone who could read it as their own misclick.

  - `select.option` and `multiselect.option` declare the `disabled` state (`contract:diff`: **minor**).
  - The select projection emits `aria-disabled` and the state class per option, which `@modyra/plain`
    applies with the rest of the part.
  - `@modyra/lit` and `@modyra/angular` apply the multiselect's projected option part whole, instead of
    reading its id and rebuilding the classes beside it — which is what left the disabled half off.
  - `@modyra/styles` paints both: `.mdy-select__option--disabled`, and `.mdy-chip--disabled` beside the
    existing `:disabled` rule, because an option chip in counter mode is a `div` and cannot carry the
    native attribute.

  **Migration for a renderer implementing this contract**: apply the projected option part rather than
  composing option classes locally, or the state will be declared and never drawn.

- f133092: An option the platform can stand on, and a caption a control is named by

  **A select nobody could operate from the keyboard.** The entry for "nothing chosen" is disabled, and
  with no option _declaring_ itself selected the browser rests on index 0 — that entry — so arrowing
  off an option that cannot be chosen is not a move it makes and the control answered no key at all.
  Both renderers set the property, which a document already reports for index 0 whether anybody said
  so; the attribute is the declaration, and it is what the working renderer had.

  **A caption a control is named by.** Angular's datepicker wrote `aria-label` where the field has a
  visible caption, replacing the words a person is reading with words only a reader hears. It reads
  `fieldNameAttributes` now, like every other control.

  **A datepicker named by nothing in lit.** Its input applied the shell part and hand-wrote the role,
  the popup relation and the caption — four literals answering what the projection already says, and
  the caption was not among them. It applies the projected trigger part now. `aria-controls` stays the
  renderer's: the projection names the day grid, and choosing a month or a year replaces it, so a
  fixed reference would name an element that has been taken away.

- 96bd5da: Each renderer declares the select shapes it draws

  ADR 0176 gave the select two anatomies; this is what makes them measured. Every conformance config
  now says which shapes its renderer draws, and mounts one run per shape: lit and Angular hand a
  non-filtering select to the platform and draw the combobox when it filters, so they declare both;
  Plain draws the combobox whichever way the field is configured, so it declares one.

  That is the answer to six findings that read as cross-renderer divergences. They were one renderer
  supporting one shape and two supporting two, which nothing in the suite could say before — and
  "repairing" any of them would have meant giving a native `<select>` combobox attributes it must not
  have.

- a7cd1a8: Every button inside a chip names the value it would act on, not only the one that removes it.

  Read from the accessibility tree — the first time anything here has been — a two-chip strip offered:

  ```
  listitem "Alfa, 2"   button "One fewer"   button "One more"   button "Remove Alfa"
  listitem "Beta"      button "One fewer"   button "One more"   button "Remove Beta"
  ```

  Four controls that sound like two, in the same chip that already knew how to say it. And **the unnamed
  pair is the one that destroys**: stepping down from one takes the value off, so the control that can
  delete was the control that did not say what it would delete. The movers had it too.

  **Migration.** `chipRemoveName` is `chipActionName`, same signature and same rule — the verb and the
  object — because it was never only about removal. A caller composing a chip button's name should use it
  for all of them.

  Now, in all three renderers: `Move earlier Alfa`, `One fewer Alfa`, `One more Alfa`, `Move later Alfa`,
  `Remove Alfa`.

  Angular's `removeName` goes with it: one method names every button in the chip, which is the same
  consolidation one function up.

- 450aa2c: Focus is placed when a chip is taken off, rather than left where it falls

  Removing a chip left focus on the document in two renderers and on the next remove button in the
  third — which looked deliberate until the _last_ chip was removed, and then that one dropped it too.
  That is the tell: focus was landing on whatever now occupied that position rather than being placed,
  so it worked while a next chip existed and failed at the end of the strip. Somebody clearing a strip
  from the right lost their place on the first press.

  `chipFocusAfterRemoval` states the rule once: the next chip, or the previous one when the last was
  removed, or the control itself when nothing is left. All three renderers ask it and answer the same.

  Lit needed a second `updateComplete`. The first can settle for a render that was already scheduled
  when the value changed, so the strip is still the old one and focus lands on whatever sat at that
  index before — the chip after the one you removed rather than the one that took its place.

- 3fd899b: A date range's two ends carry a class each, so a sheet stops counting `<input>` elements.

  `startControl` and `endControl` are two declared parts and they carried the same two classes, so the
  only way to round the left end of the pair was `:first-of-type` — a rule that counts elements of a tag
  while reasoning about a class. Put a hidden native input or a sizer of the same tag in the group and
  the rounding moves to the wrong end.

  Each part gains a class of its own — `mdy-daterange__input--start`, `mdy-daterange__input--end` — and
  the three renderers take their classes from the contract rather than repeating a string. The two
  positional rules, in the base sheet and in the iOS theme, name the end they mean.

  Additive: both parts keep the classes they had.

- 244dd08: `inputWrapper` means the shell's box for every kind, including the multiselect

  The multiselect gave the name `inputWrapper` to its own layout box, `.mdy-multiselect`, while every
  other kind means the shell's `.mdy-input-wrapper` by it. Both boxes exist and one is nested in the
  other, so a check that resolved the part per kind compared the shell for three kinds against the inner
  box for the fourth — and reported the 1px border a theme draws on the shell as a two-pixel height
  defect. One name for two different elements is not a naming inconvenience; it is a measurement that
  cannot be right.

  `multiselect.parts.inputWrapper` is now `["mdy-input-wrapper"]`, as everywhere else, and the widget's
  own box is its own part: `box`, classed `mdy-multiselect`, carrying no shell state — which is what the
  old arrangement was working around, since handing `mdy-multiselect` the shell's states would have
  minted `mdy-multiselect--disabled`, styled by no theme and emitted by no renderer.

  Migration: a consumer resolving `MDY_WIDGET_CONTRACTS.multiselect.parts.inputWrapper` to select the
  chips area wants `parts.box`. Nothing in the rendered DOM moves — both elements were already there.

- 96edbb0: One default colour palette, in the contract

  Each renderer carried its own list of suggested colours — eight in plain, fourteen in lit, ten in
  Angular — so the same document drew a different palette depending on which adapter rendered it, and
  none of the three was the one the library suggests. `MDY_COLOR_PRESETS` is now published from
  `@modyra/widgets`: eight hues around the wheel and two neutrals, which all three consume.

  Migration: a field that passes its own `presets` is unaffected. A field that relies on the default
  gets the declared palette, which differs from what plain and lit drew before.

- e63ccbd: One row, one arithmetic

  The colour presets' roving index was written three times, once per renderer — three chances for one of
  them to clamp where the others wrap. `rowRovingIndex` is published from `@modyra/widgets` and all
  three call it: either axis walks the row, `Home` and `End` reach its ends, it clamps rather than
  wraps, and the direction comes from the binding so a right-to-left document reads correctly.

  Angular also lands on a swatch now. Its panel is a popover, and the frame the focus was attempted in
  was the one before the popover was shown — a `focus()` there is a no-op that reports nothing, so the
  keyboard stayed on the toggle and the arrows had nothing to move. The attempt is checked and retried
  rather than assumed.

- 3a148c0: One scope for two forms is not silent

  Ids come from the field's path (ADR 0135), so two forms built from the same document claim the same
  ones unless the host scopes them. The record rejects renaming the second form's ids — a
  mount-order-dependent id is the counter's defect returned in a corner — which leaves the collision as
  the design, and silent it was the worst of both: `aria-describedby` resolves into the other form and
  the page looks exactly like one whose references are right.

  `reportIdCollision` warns, in development, when a widget publishes an id another element on the page
  already carries. It never renames. It is stateless — it asks the document rather than keeping a
  registry of live ids — so nothing has to be released on teardown and a remount cannot report a
  collision with its own former self.

  The fact belongs to `@modyra/widgets` and the spelling belongs to whoever is being read: each renderer
  passes the advice naming its own door — `idPrefix` when mounting Plain, `id-scope` on lit's controls,
  `[idScope]` on Angular's.

- e1364bd: Present when means on the page

  Five parts in Plain were built once and hidden: the required marker on a checkbox and a toggle, the
  select's value and placeholder, and the multiselect's placeholder. The contract says a part is
  present _when_ its condition holds, and the other two renderers build these only when they are owed
  — so a checker reading the anatomy found a part drawn while its condition was false, and anything
  deriving words from a control read a placeholder that was not on screen.

  They are added and removed now, in the contract's own reading order.

- e34fed0: Reading a select is not declining it

  The chooser the platform draws marked its field touched on blur, so focus arriving and leaving with
  the value untouched — which is what a person does while reading a form — painted a refusal onto a
  field they were about to fill in. Tabbing through a form left every required select calling itself
  wrong behind them. What makes a field answerable is a change to its value, which the commit path
  already records. See ADR 0167.

  The rule was already asserted for every kind, and it asked `select` only as the combobox: a kind
  drawn two ways is read twice now, so the shape a document gets by default is asked the same question
  as the one it has to be configured into.

- 5c49e32: Somewhere to stand when a field leaves play

  Disabling a focused element blurs it — that is the platform. What followed was this library's: the
  person who was typing landed on `body`, their next Tab starting at the top of the document, with
  nothing said about where they went. It is reachable without anybody clicking: a document's rule takes
  a field out of play when another field changes, so a value arriving from a fetch can empty the
  keyboard's position mid-word.

  Read-only is the proof that it need not cost them their place — a read-only field keeps the keyboard —
  so `keepKeyboardInPlay` puts a disabled one somewhere too: the next thing that can take focus after
  it, the previous one otherwise, and the widget's own root as the last resort, so the next Tab starts
  from where they were rather than from the top of the page.

  The two renderers ask at the moment each can: plain before it takes the control out of play, lit when
  the focus leaves with `relatedTarget` null — which is the platform taking it rather than a person
  moving it, and the one case worth acting on.

- 58af44d: Tab leaves an open list and lands on the next field

  The policy has always answered Tab with _close, and do not restore focus_ — let it go where it was
  headed. Measured on a page, no renderer did that. Plain put focus back on the trigger, so leaving took
  two presses and the first one went **backwards** onto the control being left. Lit and Angular put it
  on the document body, from which the next press starts again at the top of the document: the person
  has lost their place in the form and nothing said why.

  The body case is nobody's decision. The panel closes while the focused element is inside it, the
  browser is left with an active element that no longer exists, and it falls back to the body.

  **So the rule is an order, not a destination.** `stepOutOfOverlay` moves the focus to the opener and
  closes after. The opener is crossed, not stopped at: the key's default is left alone, so the browser's
  own Tab carries on from a control that still exists — and from a control it knows what the next one
  is, where from inside a panel drawn outside the field it does not.

  Tab does not choose. A highlighted option stays unchosen: a shortcut that commits on the way out
  removes the ability to leave without choosing.

  Plain and Lit are measured landing on the next field, in one press. **Angular is not fixed here.** Its
  panel resisted three containment tests and `stepOutOfOverlayByTab` never fired — a measurement, not a
  guess — so the attempt was withdrawn rather than shipped on a fourth guess about where its panel
  lives.

  The check is on the sequence rather than the destination. One that read only where focus ended would
  pass an implementation that closes first and focuses after, which works in a fixture and not on a
  page, because on a page the browser has already decided by then.

- 1897b23: A selection announces the change, not the whole list

  The live region said `"2 selected: Roma, Milano"` — the entire selection, every time. That is wrong at
  any size, not only at twelve: a polite region **queues rather than replaces**, so rapid clicking builds
  a backlog of stale lists and the person hears a selection several actions out of date. The list is an
  on-demand fact and belongs in the field's description, where a reader can ask for it; an event should
  carry the event.

  `multiselectAnnouncement` composes the delta and the new total — `"Roma removed, 1 selected"` — from
  what changed rather than from what is. Three i18n strings carry the words.

  **Silent while the popup is open.** The options there carry `aria-selected` and announce themselves,
  so a region firing at the same moment makes every toggle speak twice. The chip row's own removals are
  the case nothing else speaks for.

  **And silent on arrival.** The baseline is seeded from what the field already holds: a value that came
  with the form is not something the person just did, and announcing it on the first paint describes a
  choice they never made.

  **`Backspace` lands on the previous chip and `Delete` on the next.** Both used to land forward, which
  is not what any text field on any platform does — and a strip of chips is close enough to a line of
  text that people bring the expectation with them.

  Fixes a defect in the same code: **plain gated every chip key on `reorderable`**, so moving between
  chips and removing one did nothing in the default configuration — which is every field that never
  asked to be rearranged. Only reordering is opt-in.

- 3036f28: The contract says which element is the field's control

  Plain's shell named the first control it found inside whatever a kind handed over. That is the hidden
  picker in a file field — right — and an arbitrary option in a radio group — wrong, and it left every
  other option unnamed while the caption was announced as that one's name.

  Counting the controls does not tell the two apart. The catalogue does: a kind that declares a
  `control` part says which element it is, and a kind that declares none is named as a whole.

- 1a235c4: The select reads its field instead of being told about it — and empty stops meaning wrong

  **Breaking: `createSelectFieldController` no longer reports `invalid` for a required field nobody has
  touched**, and its interface gains `setDescribedBy`, `setOpen` and `setPopupRendered`.

  `createSelectFieldController` was written to close a split — the select was the one kind driven by
  imperative setters where every other kind takes a field handle and reads it — and then nobody adopted
  it. Two reasons, and neither was effort:

  **It forwarded none of the three facts only a renderer has.** Which of the two texts under the field
  is on screen; whether the panel is up; whether the panel's contents are in the document at all, since
  a renderer that builds them on open has nothing for `aria-controls` to name while closed. A renderer
  that adopted it lost all three.

  **It carried the older verdict rule.** It reported `invalid` from `showsAsInvalid` — true the moment a
  required field is drawn empty — and a renderer that had adopted that rule by hand _overwrote it_, with
  a comment saying why. The override winning was the only thing keeping that renderer's answer right.

  Asked outside the repository: `aria-invalid` is a verdict on an act, not a state. A field that is
  empty and never touched contains nothing; `required` is the word for what is missing, and a screen
  reader already says it. On a long form, twenty required fields announcing themselves invalid to
  somebody tabbing through to learn what the form asks spends the word before the first real error. But
  a value that arrived already wrong — from a draft, from a server — speaks at once, touched or not,
  because a draft nobody is told about is a draft that gets resent.

  Both are `visibleErrorsOf`, so it is one call rather than two rules. `showsAsInvalid` remains what it
  is — whether the form would refuse this field — and is still exported. See ADR 0165.

  Two checks asserted the old answer and were changed with their reasons recorded. One is a mutation
  spec whose `correct` value **is** the declared right answer, so changing it is the decision taking
  effect rather than a test being made to pass.

  Adoption goes from 46 of 51 renderer/kind pairs to 48. The three that remain are Angular's, whose
  value pipeline is its own question.

- 9f191da: Two boxes and no way out of them

  plain's date range trapped the keyboard. Tab anywhere in the field dismissed the popup, a dismissal
  restores focus to the start input, and the popup did not have to be open for any of that — so every
  Tab pulled the keyboard back where it began. Forty presses never reached the field below.

  Two things were wrong and both are fixed where they belong:

  - **A closed popup is not dismissed.** The handler now asks whether anything is open before acting,
    so Tab in a closed range is Tab.
  - **`cancel` gains `restoreFocus`**, which is what tells Escape from Tab. Escape means _put me back
    where I was_, so focus returns to the opener. Tab is already carrying the keyboard onward, and
    taking it back is the trap the dismissal exists to avoid — which is what the keyboard table has
    said all along with `restoresFocus: false` on `Tab@open`.

- 54b9fae: The last two kinds stop announcing themselves wrong before anybody has reached them

  A range and a file field marked their controls `aria-invalid="true"` on a form nobody had touched,
  while the error list beside them rendered nothing — the same split between what is seen and what is
  heard that the other kinds had.

  The cause is one line shorter than the previous one. Both renderers project the field shell
  themselves, and the shell decides what to announce from an optional answer it is given: _is this
  refusal one to show now_. Neither passed it, so the shell fell back to the only thing it could ask
  on its own — _is there an error at all_ — which is true for a required field from the first paint.
  Three lines further down each renderer asked the right question to fill its error list, so the two
  halves of one verdict were computed in the same function and only one of them reached the control.

  Both now pass what they already knew, naming their kind so that a value which _is_ that kind's empty
  is not read as one that arrived from a draft or a server.

- 049f824: The file field's rules come from the contract, not from each renderer

  `createFileFieldController` became importable in the previous release and nobody was calling it —
  each renderer had written its own copy of what it does: the accept-and-reject transition, the
  separate list of what a pick turned away, and the guard that belongs on the model rather than on the
  button. That last one carried the same comment in both, word for word: _a file still arrives by being
  dropped, by a script, or through an assistive technology driving the input, and a guard on a door is
  not a lock._

  Two of the three now call it. Adoption goes from 42 of 51 renderer/kind pairs to 44.

  **Angular does not, and not because it was harder to type.** Its file field routes every value change
  through its own intent pipeline rather than setting the handle, so a controller that sets the handle
  would make two things own the value. That is a question about how that renderer moves values, not a
  swap, and answering it by doing the swap would have left the field with two sources of truth.

  The element's own `value` is still cleared by hand where the field is cleared: a file input keeps the
  last pick's name until it is told otherwise, and no model owns that.

- 6992eaa: One field, one verdict

  The message under a field and the `aria-invalid` beside it answer the same question — is this person
  being told — and were computed from two different rules. The attribute had been taught that a
  traversal is not an answer; the text was still painted from _which refusals exist_. So a field said
  `aria-invalid="false"` and printed "required" at the same time, on sixteen of seventeen kinds in
  Angular and on the checkbox and toggle in Plain.

  Both now read the same rule. The error container is still reserved whether or not it holds anything,
  so a message arriving does not push the page down.

- 2175826: A datepicker sends the date it holds, not the date it shows

  What a form sent for a date field contradicted what the field itself answered: `01/02/2026` on the
  wire against `2026-01-02` in the model, in the same instant, from the same control. A receiver handed
  `01/02/2026` cannot tell the second of January from the first of February — and neither can the sending
  side, because it is looking at a field that holds the right answer.

  Not a defect of whichever renderer formats today. A control's text is a **presentation** of the value
  and the value is not, so a name on that control sends the presentation the moment anybody formats
  anything. The field now carries its value in an input of its own, as `select` and `multiselect`
  already do, and the control carries no name at all.

- b69252a: `shellStateClasses` answers which shell classes a field's state puts on — and takes off

  `MDY_FIELD_STATE_CLASSES` has always declared which base each shell part carries and which states it
  admits. It never said the answer: _given these flags, which classes are on_. So every renderer wrote
  that out, with the class names as string literals beside lines that read the vocabulary properly.

  Two things a renderer had to get right unaided, and both now come from one place:

  - **one state, two spellings.** A failing field takes `--error` on its wrapper and `--has-error` on
    its label. Both were declared; nothing composed them, so each renderer paired them by hand.
  - **off is an answer.** Every class is named with its on-or-off, not just the ones that are on. A
    list of what to add says nothing about what to remove, and a field that stops failing keeps the
    class that says it is — a control left looking wrong after it was corrected.

  The states it answers for are derived from the vocabulary rather than listed, so a state added there
  and not here fails the check rather than going quietly missing from every renderer at once.

  Angular is unchanged: its sixteen host blocks bind the same state declaratively and read the same
  signal, which is repetition without a divergence to close. Doing it there needs the host binding to
  move to the shared base, and that is a change to how every renderer declares its classes rather than
  to what they mean.

- 2742dd9: The three readings an anchoring decision is made from, taken once

  `anchorOverlay` has always declared what it needs — a viewport, a direction, a content size — and
  never how to obtain them, so each renderer gathered them itself. The three gatherings were
  **character-for-character identical**: one answer written in the three places somebody had to write
  it.

  `viewportSize`, `inlineDirectionOf` and `measureOverlayContent` are exported. They stay outside
  `anchorOverlay` because that function is pure and is exercised against rectangles no document ever
  held — what is shared is the _reading_, not the decision.

  Each carries a trap, which is why none of them was a one-liner:

  - **the border box.** `scrollHeight` stops at the padding edge, so a popup with a border asks for a
    size its own outline does not fit in, and every decision made from it clamps a few pixels short;
  - **nothing laid out.** Zero is not a measurement, and a decision made from zero is indistinguishable
    from one made on a real one, so it answers `null`;
  - **the live direction.** A widget declares which _inline_ edge its popup hangs from; only the
    document says which physical edge that is today.

  The shared measurement is the **union** of what the three guarded, not the smallest of them: one
  checked `hidden`, one checked null, one checked neither. Narrowing to any single renderer's guard
  would have taken something away from the other two.

- 425f3a7: One field, one answer to what a typed colour is

  The colour field had two rules. One renderer carried its own regular expression — `/^#[0-9a-fA-F]{3,8}$/` —
  and it disagreed with the contract on five strings, **in both directions**:

  ```
  #ffff  #fffff  #ffffffff  #12345     kept as the value there, refused by the contract
  fff    "  #fff  "                    refused there, accepted and normalised by the contract
  ```

  `#fffff` is a length no colour has. Stored, it becomes a value that paints as nothing: the field
  visibly holds something and nothing shows it. And `fff` is what people type — refused in one renderer
  while another accepts it is the same control answering two ways.

  Both now call `createColorsFieldController`, which is where that rule already lived along with the
  one nobody duplicated: **typing never closes the panel and choosing a preset does**, because `#0` is
  on its way to being a colour and a field that committed or rejected on every keystroke would take a
  half-typed value away from the person typing it.

  Adoption goes from 44 of 51 renderer/kind pairs to 46. Angular's colour field still holds its own
  open state through its overlay directive; its value already goes through the contract.

- b22529e: The contract says which message names a part no relation points at

  Most parts are named by being pointed at — a caption's `for`, an opener's `aria-controls` — and the
  relations declare it. Five are not, and they are not machinery: a person types in a panel's search
  box, in the second date of a range, in each half of a time. Nothing said what those are called, so
  each renderer chose.

  They chose differently. One built `"<caption> — end"` out of an English word and the caption; another
  read `daterangeEndLabel` from the message table. **The words already existed in the table in five
  languages.** What was missing was the line saying which word belongs to which part — so a page in
  Italian announced a box as "end".

  `MDY_PART_NAMES` is that line. It is a binding rather than a vocabulary: the translation of a
  control's name stops being a decision a renderer takes alone.

  Held to both tables at once — a binding to a message that does not exist and a binding to a part the
  contract does not declare fail differently here and identically on a page — and to the relations: a
  part named by a relation **and** by a message is refused. That refusal found one immediately: a
  range's caption already points `for` at the first of its two boxes, so only the second was unclaimed,
  and binding both would have been two answers to one question.

  The framework-free renderer reads the binding now. Its first box keeps the caption; the phrase built
  around it is gone.

  Also asserted: every bound message exists in every locale the package ships, because a name that falls
  back to English on a translated page is the defect this exists to stop being possible one renderer at
  a time.

- aa44a14: Where the keyboard stands when a list opens

  A multiselect panel opened with nothing singled out, so the first arrow press was spent picking a
  starting point — showing nothing, and indistinguishable by ear from an arrow that did not work — and
  the key meaning "choose this one" had no target, which two renderers answered from the trigger
  instead.

  The cursor is now primed when the panel is raised from the keyboard: on the first value already
  chosen, and on the first option on screen when nothing is chosen. Raised by a pointer it stays empty,
  because the next thing is a click and a cursor would draw a ring on an option nobody touched.

  `open` and `toggleOpen` carry the modality as an optional `by`, and `MdyOpenModality` is exported.
  A caller that says nothing keeps today's behaviour exactly — a panel that opens with nothing singled
  out — so the change is additive, but silence is the pointer answer rather than a neutral one: a host
  that opens from a key should say so. See ADR 0179.

- Updated dependencies [7d85603]
- Updated dependencies [4098145]
- Updated dependencies [9ad3e51]
- Updated dependencies [3852b04]
- Updated dependencies [454a168]
- Updated dependencies [8409975]
- Updated dependencies [d5bc45b]
- Updated dependencies [6a82839]
- Updated dependencies [8048151]
- Updated dependencies [fa4b98a]
- Updated dependencies [0f16026]
- Updated dependencies [37f5eab]
- Updated dependencies [a14b7c6]
- Updated dependencies [4a1928c]
- Updated dependencies [ff00fb6]
- Updated dependencies [57fcb30]
- Updated dependencies [78bd88c]
- Updated dependencies [4b30db9]
- Updated dependencies [9346f32]
- Updated dependencies [01261b8]
- Updated dependencies [ff19aea]
- Updated dependencies [a116692]
- Updated dependencies [9a2ba53]
- Updated dependencies [0050769]
- Updated dependencies [7f407b9]
- Updated dependencies [9840c5e]
- Updated dependencies [117e1c3]
- Updated dependencies [965a61c]
- Updated dependencies [918e404]
- Updated dependencies [22bf399]
- Updated dependencies [3a15797]
- Updated dependencies [89e42ec]
- Updated dependencies [12c9e50]
- Updated dependencies [86d196e]
- Updated dependencies [1fffe2d]
- Updated dependencies [ba9a0c1]
- Updated dependencies [b6b31c4]
- Updated dependencies [4c8cf60]
- Updated dependencies [d0a6f15]
- Updated dependencies [4e7ba99]
- Updated dependencies [6022157]
- Updated dependencies [16f1d3f]
- Updated dependencies [93fcb70]
- Updated dependencies [f0b4f7d]
- Updated dependencies [a268ec7]
- Updated dependencies [2fde8a7]
- Updated dependencies [08cca72]
- Updated dependencies [cd7e937]
- Updated dependencies [e0ab01c]
- Updated dependencies [5bde1b0]
- Updated dependencies [e972a01]
- Updated dependencies [be44d0a]
- Updated dependencies [d8b3b54]
- Updated dependencies [07b3ec8]
- Updated dependencies [9cdd4ef]
- Updated dependencies [f962df5]
- Updated dependencies [5b1b52b]
- Updated dependencies [087b2ca]
- Updated dependencies [234736d]
- Updated dependencies [e455962]
- Updated dependencies [04ff8d8]
- Updated dependencies [4255d5a]
- Updated dependencies [0e6540c]
- Updated dependencies [58654b1]
- Updated dependencies [cde2ab8]
- Updated dependencies [0a54a17]
- Updated dependencies [ab7fcb2]
- Updated dependencies [3bc4a23]
- Updated dependencies [f7bd4cb]
- Updated dependencies [0ae26cf]
- Updated dependencies [49339e9]
- Updated dependencies [d2092bb]
- Updated dependencies [88c8cc7]
- Updated dependencies [50ffc70]
- Updated dependencies [b7fbfd4]
- Updated dependencies [ca7a0fa]
- Updated dependencies [e6531f2]
- Updated dependencies [59e7af2]
- Updated dependencies [ef24648]
- Updated dependencies [f24ca8b]
- Updated dependencies [2e2a1ef]
- Updated dependencies [423b8b1]
- Updated dependencies [32e7440]
- Updated dependencies [661568e]
- Updated dependencies [0883045]
- Updated dependencies [2228872]
- Updated dependencies [8081294]
- Updated dependencies [e47e039]
- Updated dependencies [0cba121]
- Updated dependencies [233c2bd]
- Updated dependencies [f133092]
- Updated dependencies [e65f631]
- Updated dependencies [f65d19d]
- Updated dependencies [6efa698]
- Updated dependencies [a7cd1a8]
- Updated dependencies [a7eddca]
- Updated dependencies [fb289a9]
- Updated dependencies [024de71]
- Updated dependencies [450aa2c]
- Updated dependencies [9eb86d9]
- Updated dependencies [cfff558]
- Updated dependencies [96ab84b]
- Updated dependencies [b6cd7d6]
- Updated dependencies [82e7216]
- Updated dependencies [49e17ce]
- Updated dependencies [3fd899b]
- Updated dependencies [d5656be]
- Updated dependencies [cb8a6fd]
- Updated dependencies [e505164]
- Updated dependencies [6ee16f5]
- Updated dependencies [244dd08]
- Updated dependencies [953381d]
- Updated dependencies [8f72ad1]
- Updated dependencies [96edbb0]
- Updated dependencies [09c79c3]
- Updated dependencies [e63ccbd]
- Updated dependencies [3a148c0]
- Updated dependencies [5edf370]
- Updated dependencies [7df6f00]
- Updated dependencies [709fb7f]
- Updated dependencies [8e5fe67]
- Updated dependencies [1f646ae]
- Updated dependencies [5c49e32]
- Updated dependencies [58af44d]
- Updated dependencies [fc493c5]
- Updated dependencies [1897b23]
- Updated dependencies [012db3b]
- Updated dependencies [14755ac]
- Updated dependencies [11b6823]
- Updated dependencies [49e17ce]
- Updated dependencies [48c0597]
- Updated dependencies [7aaa84a]
- Updated dependencies [1a235c4]
- Updated dependencies [3eb1f84]
- Updated dependencies [e7be4b6]
- Updated dependencies [e488eec]
- Updated dependencies [3246dce]
- Updated dependencies [769b992]
- Updated dependencies [cef9693]
- Updated dependencies [23accd5]
- Updated dependencies [d3cd87c]
- Updated dependencies [7878e24]
- Updated dependencies [b4bee4f]
- Updated dependencies [9f191da]
- Updated dependencies [052db3e]
- Updated dependencies [17c3bff]
- Updated dependencies [a36aca3]
- Updated dependencies [ad85b8b]
- Updated dependencies [2175826]
- Updated dependencies [b69252a]
- Updated dependencies [2742dd9]
- Updated dependencies [425f3a7]
- Updated dependencies [7c85752]
- Updated dependencies [b22529e]
- Updated dependencies [f678c06]
- Updated dependencies [cd584fc]
- Updated dependencies [aa44a14]
- Updated dependencies [69d8cb8]
- Updated dependencies [ce0b6d5]
  - @modyra/widgets@2.5.0
  - @modyra/core@2.5.0

## 0.11.0

### Minor Changes

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

- 8a12c47: A period the contract names, and the same one in every renderer

  AM and PM were `presentation` — the catalogue's own word for a class a renderer may use that carries
  no semantics. So there was no part, no `selected` state, no conformance check, and nothing holding
  the three renderers to one anatomy. They diverged exactly where you would expect: Angular and Lit
  drew a two-button segmented control with one marked, and **plain drew a single button whose text was
  the current period and which toggled on click**.

  That is the weaker form in three ways. The value was only readable as the label of the control that
  changes it; nothing was ever marked selected, so a screen reader had no state to announce; and the
  target was half the size. It is also a control that says "AM" and means "switch to PM" — a label
  describing what it is not.

  `periodOption` is now a declared part with `states: ["selected"]`, and both classes have left
  `presentation`. Plain draws two buttons, each asking for its own half. Angular and Lit take the class
  from the catalogue rather than writing the literal, so the anatomy is decided in one place.

- 91f9715: A checkbox or toggle row is no longer a pointer target

  **Read this before upgrading: it is a breaking change released under a minor.** The anatomy below
  changes, and a stylesheet that reaches the box through the input's _sibling_ stops matching. The
  shipped themes move with it; a stylesheet outside this repository does not. Selecting by state
  rather than by position survives the change:

  ```scss
  // before — the track was the input's next sibling
  .mdy-toggle input:checked + .mdy-toggle__track .mdy-toggle__thumb {
  }
  // after — the track is inside the label; ask for the state, not the position
  .mdy-toggle:has(input:checked) .mdy-toggle__thumb {
  }
  ```

  All three renderers built the wrapper as a `<label>`, and a native label forwards a click from
  anywhere inside it — so the empty space to the right of the words toggled the field. The wrapper is
  now a container, and the words are the `<label for>`.

  **The drawn box moved inside the words**, and that is the part worth reading. The native input is
  visually hidden in every renderer, so once the wrapper stops being a label the `<label>` is the only
  element left that forwards a click: a box outside it is decoration nobody can press. Measured before
  and after — the box went inert, then came back:

      before   row toggles · box toggles · words toggle
      interim  row inert   · box INERT   · words toggle
      after    row inert   · box toggles · words toggle

  `MDY_WIDGET_CONTRACT_VERSION` moves **3 → 4**: `inputWrapper` is a `container` on these two kinds,
  `label` is a `label`, and `indicator`/`track` are parented to it.

  **Migration.** A stylesheet or test selecting `label.mdy-checkbox`, `label.mdy-toggle` or
  `.mdy-toggle > .mdy-toggle__track` selects nothing now — the wrapper is a `div` and the box is inside
  the label. Anyone relying on the whole row being clickable loses it deliberately. The shipped
  stylesheet moves with the anatomy: `cursor: pointer` leaves the row for the label.

  WCAG 2.5.5 is met as DESIGN.md § _the target is not the box_ already meets it elsewhere — the target
  is a centred overlay, so the visible box keeps its size. See ADR 0117.

- 2aa3ce8: An overlay's boundary is the contract's, not the renderer's

  `createLightDismiss` decided _when_ an interaction dismisses and asked the renderer _where from_,
  through an `isInside` predicate. Four renderers answered four ways, three of them carrying their own
  duck-typed node guard, and the reason given was that only a renderer knows where its portal went.

  It is not true. A widget that portals a popup declares the relationship — its opener names the popup
  through `aria-controls` — and `portalRootFor` follows that declaration out of the widget root. So the
  branch is derivable, and the three renderers that answered by containment alone would have dismissed
  their own portalled popup under the user's own press.

  **Migration.** `MdyLightDismissOptions.isInside` is removed; `branch` replaces it:

  ```ts
  // before
  createLightDismiss({
    isOpen,
    dismiss,
    isInside: (t) => t instanceof Node && wrapper.contains(t),
  });

  // after
  createLightDismiss({ isOpen, dismiss, branch: { root: wrapper } });
  ```

  `branch` takes `{ root, also? }`, or a function returning one when the roots are view children that
  do not exist yet. `root`'s descendants are inside, and so is whatever it portalled — found from the
  root, not supplied, so forgetting is no longer possible. `also` is for what containment cannot reach
  and `aria-controls` does not name, such as a multiselect's chips outside the wrapper. A target that
  is not a node is outside.

  `overlayBranchContains`, `MdyOverlayBranch` and `MdyOverlayRoot` are exported for a renderer that
  needs to ask the question directly. Angular's `overlayContains` override becomes `overlayBranch`.

  ADR 0119 records the decision and what it forecloses: a branch is roots and containment, so an
  arbitrary boundary can no longer be expressed — which is the constraint that stops four renderers
  diverging again.

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

- ef53275: A ghost that ends under the pointer, and the slices that carry nothing

  The ghost had two lengths, chosen by which ring the pointer was over, so it snapped between them. Its
  end is the whole of what it says — _this is where your finger is_ — and a hand that stops somewhere
  else is reporting a position nobody is at. It now reaches exactly as far as the pointer does, capped
  at the hand's length because past that the face runs out and a longer hand would spill over its own
  numbers.

  **No floor.** A finger 15px from the centre gets a 15px stub, which looks like nothing much and is
  exactly right.

  `MdyTimepickerDialGhost` gains `reach`; the renderers write it as `--tp-ghost-reach` and the `--inner`
  modifier stops applying to the ghost, since `reach` supersedes it for length. `timepickerDialGhost`
  takes two more options — **breaking** for a caller passing the options object positionally, additive
  for everyone else.

  `timepickerDialUnavailableArcs` answers which stretches of a ring carry no time anybody can land on.
  A face declared with `minuteStep: 15` draws four numbers, and the other 356° look exactly like them:
  continuous, uniform, and offering nothing. The arcs are the positions the granularity **took away** —
  the ones an undeclared face would draw and this one does not — each covered by the knob's own angular
  half-width, with neighbours run together so a dead stretch reads as one.

  Not the space between the numbers that remain. An hour face has visible gaps between its knobs and
  every hour in it is selectable; the first version of this dimmed those and would have said a picker
  was constrained when it was not.

  Two widths, deliberately: snapping is still nearest-value, so every angle resolves to a number
  including inside these arcs. What is dimmed is where you can land on **the number you are pointing
  at**, which is the narrower question and a display one.

- a53b93f: The hand says which ring it is pointing into

  A 24-hour face carries two numbers at every position: 3 outside and 15 inside share a direction. The
  contract has always told them apart by how far from the centre the pointer was, and a granularity
  makes the ambiguity ordinary rather than rare — with a three-hour step, 3 and 15 are the two hours
  that position offers. **Drawn with a hand of one length, the two selections are identical**, and a
  person cannot tell which they chose until they read the header.

  The hand now stops at the ring it points into. `timepickerSelectedRing` says which that is, from the
  same predicate that decides where a number is drawn, so the face and the hand cannot disagree; all
  three renderers read it and none derives it.

  Its length is `--tp-hand-length × var(--tp-inner-ring)`, and `--tp-inner-ring` is where the
  stylesheet's own figure for the ring now lives — one number for the numbers and the hand that points
  at them. It was two: a literal beside the inner numbers, and `MDY_TIMEPICKER_INNER_RING` in the
  contract. A shortened hand written as a third would have made the hand point at one ring while the
  hit test picked the other, with every number still exactly where it should be.

  `css-properties.spec.mjs` now fails if the hand takes a figure of its own, if the sheet stops
  declaring `--tp-inner-ring`, or if it stops matching the contract.

- 8d2dd0a: A minute you can type back into the box

  _"Io ho 00, uso tasto back del mac per cancellare e ho solo 0, a quel punto scrivo 1 e ottengo 01."_
  It gave `001` instead.

  This renderer read its own box, handed the controller a number, and the sync wrote the canonical form
  straight back — so a `0` became `00` with the caret after it and the next key landed third: three
  digits in a two-digit field, and `01` unreachable by the route a person takes.

  The box reports what was typed and the contract decides what it means. The sync leaves a segment alone
  while somebody is inside it, and on blur it settles to the canonical form of what the draft holds —
  which is `timepickerEntryText`'s answer rather than this renderer's padding.

  Measured through the gesture as it was described:

  ```
  00 → Backspace → 0 → type 1 → 01 → Tab → 01      committed 09:01, hand at one minute
  ```

  And the half that makes the rule a hybrid, in the hour box on a 24-hour face: typing `2` moves the
  hand to two, and typing `9` after it leaves the hand there — `29` is not an hour, so the box goes on
  showing it while the draft does not take it. Committed `02:01`.

- 1a6797d: A picker a keyboard can finish

  All three renderers now do the same thing from open to commit, without a pointer:

  ```
  open → focus on the hour box → type → Tab → type → Tab → Tab → Enter → 14:30
  ```

  **Angular had never executed a widget command.** `dispatch(...)` was called and its return discarded
  at every call site, so `focus`, `open-overlay` and `restore-focus` had no route to the DOM at all —
  not wired wrongly, not wired. It goes through the `MdyWidgetRuntime` the select adapter already used,
  with the same `afterNextRender` beat. Its local `scheduleMinuteSwitch` and the two different delays
  are gone; the controller owns the handover.

  **Angular focused the dial face on open.** The face is a slider a keyboard can operate and it is not
  where a person types, so the two controls that accept typing were never reached — which is why Tab
  walked out of the popup without entering it. It focuses the box the contract names.

  **`action` named two buttons.** Cancel and confirm carry one part between them, so a tab order that
  named the part reached whichever was drawn first — cancel. Tab to the end of the dialog, press Enter,
  and the draft was discarded instead of committed. The order names both, told apart by the `confirm`
  state the catalogue already declares.

  **Lit rewrote the box on every keystroke.** With `.value` bound to the draft, each input triggered a
  render that wrote the canonical form back over what had just been typed: backspacing an hour from `09`
  produced `12`, and `14` could not be typed at all. It reports what was typed and leaves the box alone
  until the person leaves it — the same rule plain took, from the same contract.

- 66b5ba1: The radius every hit test was computed against was wrong

  `--tp-hand-length` is a custom property, and a custom property resolves at _use_. Reading it back
  gives the token stream — `calc(256px/2 - 40px/2 - 8px)` — which no `parseFloat` reads. So that branch
  never succeeded in any renderer, and what ran every time was the fallback beside it: **half the face,
  128 where the hand is drawn at 100.**

  Every angle-at-a-radius in the dial was computed against a circle 28% too large: which ring a press
  claims, how far off a number counts as being on it, and where the dimmed stretches fall. The inner
  ring's edge landed near 95 instead of 74, which is a press just inside the outer digits reading as the
  inner ring — the complaint that started this, answered until now by tuning a constant that was
  compensating for a measurement.

  All three renderers now measure the **hand's own drawn height**, which is the length itself rather
  than an expression describing it.

  Two more, both Lit and both in the dimming shipped an hour ago:

  - **it never drew.** The arcs are angles at a radius, and the render that _creates_ the dial cannot
    measure it — the face does not exist yet, the length read as zero, and the contract correctly
    answered `[]`, which is also the right answer for a face with nothing to dim. Nothing scheduled a
    second pass, so it was permanently absent and every unit test agreed. Lit measures in `updated()`
    now and re-renders when the answer moves.
  - **the layer painted over the hand.** All three renderers carried a comment saying the dimming goes
    behind; one put it there. Lit emitted it after the hand, and Angular emitted the arcs with no layer
    element at all — which also meant Angular never drew a `dialUnavailable`, a part the contract
    declares.

  `open-coverage.spec.ts` is why that last one could ship. It asserted `rendered >= 40` against a total
  the contract supplies, so when the contract grew the denominator moved and the floor did not: three
  parts were declared, this adapter drew one, and 42 of 48 still cleared 40. It called itself a ratchet
  and nothing ever raised it. Each exemption is now named with its reason, so a part that enters the
  contract and appears nowhere in the adapter fails on the day it is declared — verified by declaring
  one that nothing draws and watching it fail.

- c505ccf: The daterange previews the range under the pointer

  The contract has carried this since the kind existed: `{ type: "preview", iso }` is an intent, the
  controller publishes `previewed`, and the `gridcell` part declares `inRange`, `rangeStart` and
  `rangeEnd`. This renderer already painted all three from `state.previewed` — and never told the
  controller where the pointer was, so the highlight could only ever show a range already committed.

  It dispatches `preview` on cell hover and on keyboard focus, and `iso: null` when the pointer leaves
  the grid. Measured: after picking a start and hovering six days later, five cells light up as
  in-range where none did before.

  Nothing was added to the contract. The intent, the published state and the cell flags were all
  already there; only the dispatch was missing.

- c6fd3b4: A ring that does not change its mind while the finger holds still

  Resting a finger on the outer part of an inner number put it exactly on the edge between the two
  rings — and a hand is never still. Measured, a 6px wander changed the ring **four times**: each one
  the hand jumping its own length and the face swapping which twelve numbers it picks from, several
  times a second.

  The edge is not wrong and moving it does not help: any edge has this, because a finger can rest on
  any edge. _Where the rings divide_ and _whether to change_ are two questions, and one comparison was
  answering both. What was missing is memory.

  `timepickerDialRing` takes the ring it last answered — state every renderer already held and handed
  to the two neighbouring functions on the next line — and leaving a ring now takes reaching **halfway
  from the edge to the other ring's own numbers**, derived from where they are drawn rather than
  picked. Without a previous ring, the first answer of a gesture, it falls through to the edge
  unchanged, so ADR 0120's derivation still decides where the rings divide.

  Asserted as four properties, and the fourth is the one a fix that simply refused to change ring would
  fail: the rings still divide once across the radius, a wander at the edge changes nothing, no wander
  of half a box changes the answer twice anywhere on the face, and a deliberate move from one ring to
  the other still arrives — in exactly one change.

  `timepickerDialUnavailableArcs` also answers for **every ring a face has** when asked without one,
  and each arc carries its own `span` and `ring`. Three renderers were each deciding "does this face
  have an inner ring", which is a question about the face.

- af2d59b: A ring you have to reach for, and a rule every renderer follows

  Three defects the user found by using it, all in the same place.

  **The inner ring claimed most of the face.** It was everything closer to the centre than the midpoint
  between the two rings — so the empty middle, which is most of a dial's area, answered with an hour
  whose number was nowhere near the pointer, and the hand jumped short for a press aimed at the outer
  ring. It is now a band as wide as the gap between the two painted radii, centred on the inner one:
  near the digits to claim them, and anything else belongs to the ring drawn out there.

  **A minute face has one ring, and was being asked about two.** `timepickerDialRing` did not know
  which field was being picked, so a press near the middle of a minute dial read as `inner` and
  shortened the hand for a ring that does not exist. It takes the field now.

  **The hand's length changed only at the ends of a gesture.** In Angular the ring was a plain field,
  so the view was never told it had changed: the hand kept the length it began with and snapped on
  release. It is a signal, and the length follows the pointer.

  And the part that mattered most: **the granularity was enforced in one renderer of three.** Angular
  passed the steps down; plain and lit called the same contract functions without them, so a document
  declaring quarter-hour minutes still took `07` by typing, still stepped by one on the arrows, and
  still drew twelve numbers on its minute face. All three now resolve the steps per interaction — a
  windowed granularity depends on the hour the draft is on — and all three set the native `step` on
  their segments, so the platform's own spinner offers what the field offers.

- 2eb1112: A ruler that was one of the things it measured

  Reading the hand's own height fixed one defect and created a worse one. The hand is drawn **shorter
  when it points into the inner ring**, and which ring it points into is the answer that measurement
  produces:

  ```
  hand on 14 (inner)  → measures 60  → thresholds from 60 → the same position reads outer → 2
  hand on 2  (outer)  → measures 100 → thresholds 70/90   → the same position reads inner → 14
  ```

  Each state is the other's cause. Resting on the centre of a 14 and moving two pixels alternated
  `02 14 02 14 02 14 02 14` — **seven changes in eight events**, on every renderer. Not a tremor: a
  feedback loop, which no amount of hysteresis damps because what moves is the thresholds themselves.

  `dialHandLength` is one helper in `@modyra/widgets` and divides the shortened state back out, using
  `MDY_TIMEPICKER_INNER_RING` — the constant already held against the stylesheet. The same line had been
  copied into three renderers twice now, and both times it was wrong in all three; the contract owns the
  question so a fourth adapter cannot copy a fourth version of it.

  Found while verifying: **plain printed a 24-hour picker's hour in the canonical 12-hour form**, so a
  field holding 14:00 showed `2` in its header while the face and the value said 14. The one number on
  screen that says what is selected, saying something else. It reads the picker's own notation now, as
  the other two do.

- 8020123: What a box holds while you are typing, and which view opens

  **A half-typed number is a state every time field has, and the contract had never named it.** So each
  renderer answered on its own and all three were wrong in different directions: one padded to two
  digits after every keystroke — clearing `00` and typing `0` then `1` gave `001` in a two-digit field,
  and `01` was unreachable by the route a person takes — and the other two reformatted the character
  away, so no partial existed and the box could not be cleared at all.

  `timepickerEntry` states the rule, and it is a hybrid rather than "the text is free until blur":

  - a focused segment **may hold a partial** — empty, or fewer digits than the canonical width;
  - on every keystroke, **if the text names a value the field accepts, the draft takes it and the hand
    moves there**;
  - if it does not — empty, out of range, off the granularity's step — the draft keeps its last
    accepted value and the hand stays;
  - on blur or commit the text normalises, which `timepickerEntryText` answers.

  So typing `2` in an hour box on a 24-hour face moves the hand to 2, and typing `9` after it leaves the
  hand where it was: `29` is not an hour, and the box keeps showing it while the draft does not take it.

  The text and the hand are two views of one draft — the same principle the focus contract rests on.

  **`MDY_TIMEPICKER_INITIAL_VIEW` is the face.** It was two answers across three renderers, so a person
  met a different control depending on which adapter their team had chosen. The face is the faster route
  to an approximate time and the only gesture where there is no keyboard; the boxes are one press away
  and stay typeable while it is showing.

  Also: plain drew its dimmed-stretch layer whether or not there was anything in it — a part of the
  anatomy present without being anything, which a conformance reading correctly called an extra part.

- Updated dependencies [45720b9]
- Updated dependencies [5262ad2]
- Updated dependencies [2dfa37b]
- Updated dependencies [ef53275]
- Updated dependencies [841f0f9]
- Updated dependencies [a53b93f]
- Updated dependencies [53ecc1a]
- Updated dependencies [f0044c2]
- Updated dependencies [771ea00]
- Updated dependencies [a0ab5de]
- Updated dependencies [8a12c47]
- Updated dependencies [37ccb9b]
- Updated dependencies [1a6797d]
- Updated dependencies [56b9361]
- Updated dependencies [1b9ad89]
- Updated dependencies [5e31f89]
- Updated dependencies [66b5ba1]
- Updated dependencies [b331412]
- Updated dependencies [c6fd3b4]
- Updated dependencies [af2d59b]
- Updated dependencies [91f9715]
- Updated dependencies [2eb1112]
- Updated dependencies [df918e6]
- Updated dependencies [9862d2f]
- Updated dependencies [22f79b3]
- Updated dependencies [2aa3ce8]
- Updated dependencies [638acb6]
- Updated dependencies [6d90b06]
- Updated dependencies [8020123]
  - @modyra/widgets@2.4.0
  - @modyra/core@2.4.0

## 0.10.0

### Minor Changes

- b30cd0d: Every renderer defaults to the 24-hour clock

  The three renderers each wrote the default down for themselves — `"12h"` in all three, in three
  places — which is what lets one document render a different clock in each adapter. And in Plain that
  parameter default is the _only_ clock a document-driven form can get: `fields/index.ts` passes
  `undefined` for the format, and a document cannot name one, because no member of the field contract
  carries a clock format.

  All three now default to `"24h"`. A host that wants the other passes `format: "12h"` — `[format]` in
  Angular, the `format` attribute in Lit — which every renderer already accepted.

  **This changes what an existing form shows**: `02:30 PM` becomes `14:30` unless the host asks
  otherwise. Four tests in Plain and four in Lit moved with it, rewritten in 24-hour terms rather than
  patched: an hour past 23 is marked invalid, the arrows wrap at 23 → 00, the segments advertise 0–23.

  A document still cannot ask for either format; with 24-hour as the default the common case works, and
  that gap is recorded separately. See ADR 0116.

### Patch Changes

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

- daab507: The dial's inner ring is hit where it is painted

  `timepickerDialRing` compared a fraction of the **hand's length** against a fraction of the **dial's
  radius** — two different lengths. With the shipped geometry (a 256px dial, 40px numbers, so a 100px
  hand) the boundary landed at 102.4px, _2.4px beyond the outer digits_: every point on the face read
  as `inner`, including the outer numbers themselves, so a person had to aim past a number to be read
  as pointing at it.

  The boundary is now the midpoint between where the two rings are actually drawn — 80px for that
  geometry — and `handLength` is passed in rather than recomputed, because `dialSize / 2 − numSize / 2
− 8px` are the drawing's numbers and a copy of them in TypeScript is a copy that drifts. Plain and
  Angular read `--tp-hand-length` from the face.

  `MDY_TIMEPICKER_INNER_RING` is published as the one value the drawing and the hit test share, and a
  contract test holds it against the stylesheet's own `-0.6` — the drift that produced this defect
  cannot happen silently again.

  `timepickerDialRing` gains a required parameter, which the surface audit calls major. It was added
  after the version commit and is in no released package, so there is nothing to migrate.

- Updated dependencies [20c69d0]
- Updated dependencies [daab507]
  - @modyra/core@2.3.0
  - @modyra/widgets@2.3.0

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

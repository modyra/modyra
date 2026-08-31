# @modyra/widgets

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

- 7d85603: A slider stops stating a broken bound before anybody has been near it.

  `holdsUneditedValue` takes the kind so that a value which _is_ that kind's empty is not read as one
  that arrived from a draft — a thumb is always somewhere, so a slider at 0 is the control at rest. The
  shell projection passed the kind; the renderer painting the error list did not, so the two disagreed:
  the page showed a required-range message on an untouched slider while the control's
  `aria-describedby` named nothing, because the projection had decided there was nothing to name.

  `visibleErrorsOf` takes an optional kind and plain's text renderer passes it. The error waits for the
  person to have had a turn, and the control names it when it arrives.

  This was the last finding in `@modyra/plain`'s DOM conformance run, which is now clean.

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

- a14b7c6: A combobox says whether an answer is being asked for

  A select's trigger is not a native control and carries none of the field's rules on its own. Two
  renderers wrote `aria-required` from what they could reach and one wrote nothing, because the
  contract declared nothing — each of the three deciding for itself what had not been said.

  The select projection declares it, the standalone controller carries it with a `setRequired` beside
  `setInvalid`, and the field controller binds it from the handle. A consumer driving the standalone
  controller gains a method it must supply.

  Angular's multiselect trigger, which had the same gap for the same reason, now says it too.

- 4a1928c: A field showing its errors inline still says it is failing.

  `projectFieldShellA11y` wrote `aria-invalid` from `errorsVisible` — the flag that says _which element
  holds the words_, so that `aria-describedby` never names an element that is not in the document. With
  errors drawn **inline** there is no error list, so that flag is false, and the control announced
  itself valid while the field beside it was painted as refused and an icon stated the reason.

  The two questions are separated: `aria-describedby` still follows what was rendered, and `aria-invalid`
  follows the verdict. The new `invalid` option defaults to `errorsVisible`, so a renderer that draws its
  errors one way only is unaffected.

  `@modyra/angular` passes its own answer, which is the same one the wrapper's error class takes — so
  what a theme paints and what a screen reader is told cannot disagree.

  Found by the themed end-to-end suite, on a page configured the way a product configures one.

- 57fcb30: The reading position in an option list is visible

  A multiselect's cursor was announced through `aria-activedescendant` and drawn by nobody. Lit and
  Angular each set `mdy-chip--active` on the option the keyboard stands on — a class the catalogue never
  declared and no stylesheet drew — and plain set nothing at all, because it applied the projected part
  and then wrote a locally built class list over it.

  `multiselect.option` now declares the `active` state, the projection emits it for the option
  `activeKey` names, plain stops overwriting what it was given, and the theme draws it. Renderers
  already using the class keep working unchanged; one that draws its own cursor should drop it in favour
  of the part's.

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

- 4b30db9: The day a calendar is always asked about

  `today` has been a declared state on the day cell for as long as the part has existed, and the cell
  had no projection: three renderers wrote its semantics by hand and one of the three marked today. A
  person hearing the grid got thirty-one numbers and no anchor.

  `projectCalendarDayCellA11y` is the door — classes, role, `aria-selected`, `aria-disabled`, the
  roving tabindex and `aria-current="date"` on today. The datepicker controller and lit's calendar bind
  it; Angular already said it and now has a declaration to say it from.

  `date` rather than `true`, and absent on every other day: the token names what kind of current this
  is, and thirty cells saying "not today" is noise.

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

- 86d196e: A key means what the part under it means

  The space bar is declared where it lands rather than per kind: a character in a text box, "this one"
  on a highlighted day or option, a press on a button. Two renderers claimed it in an open panel and
  the catalogue declared it for neither, so the same key meant one thing in a calendar and another in a
  list with nothing saying why.

  `Space` on a `gridcell` commits; on an `option` it toggles where the field can hold several and
  commits where it holds one, read from the value contract's own shape. Nothing claims it over a text
  box, which is how the table says the platform keeps it — a person typing a filter or a date types a
  space.

  ADR 0174 records the rule, including what it does not settle: what "commit" means at the first end of
  a range.

- ba9a0c1: A key that depends on a capability says so

  `MdyKeyBinding` gains `requires?: string`, the field-level capability a binding depends on where the
  kind alone does not decide it. `on` says which part answers a key; this says whether the key exists
  at all for this field.

  Reordering forced it. Every multiselect has chips, and only one declared `reorderable` has an order a
  person may change — so `Alt`+`ArrowLeft` and `Alt`+`ArrowRight` now carry `requires: "reorderable"`.
  Until now the table said the kind answers four keys that a default field answers none of, and anything
  reading it across kinds — a sweep, a help panel, a consumer's own key handler — had to carry its own
  list of which ones were conditional. A capability named in the table is one a reader can ask the field
  about.

- b6b31c4: A binding can name the state it waits for

  `Ctrl`/`Cmd`+Z puts back a multiselect's last removal, and on a field where nothing has been removed
  it correctly does nothing — which from outside is indistinguishable from a key nobody implemented. A
  sweep over every declared key found it and reported it unanswered.

  `MdyKeyBinding` gains `awaits`, naming a transient state the field must already be in. It sits beside
  `requires` and answers a different question: a capability is true for as long as a document says so,
  a state has happened and can stop being true again. The test is whether the answer can change while
  nobody touches the document.

  A check may now arrange the state before pressing or count the key as unreached; a legend says _when_
  a key applies rather than promising it always. ADR 0157.

- 4c8cf60: A label can say it was never written

  Everything inside a field is named by pointing at its label, so a field a document gave no name to
  had to be given words anyway — `fieldAccessibleName` chooses them. Plain marked such a label with a
  class of its own invention so a theme could keep it out of sight, since a name is owed to a screen
  reader and a heading is not.

  `unwritten` is now a state of the shell's label, and `projectFieldShellA11y` emits it when a caller
  passes `nameSources` and neither a label nor an `aria-label` was written. Callers that pass nothing
  are unaffected: the label carries no such claim and nothing changes.

  The theme also gains the two chip states it declared and never painted — a chip in flight during a
  drag, and the tooltip that gives the full name of a chip the strip had to cut short, which until now
  was unstyled text that widened the row it was explaining.

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

- 93fcb70: A month you can walk sideways

  The calendar keyboard declared `ArrowUp` and `ArrowDown` and not the horizontal pair, so a person
  walking a month with the keyboard could move up and down a column and never along a row. All three
  renderers answered `ArrowLeft` and `ArrowRight` anyway — a grid that cannot be walked sideways is not
  a grid — which is three implementations agreeing against a declaration, and that is evidence about
  the declaration.

  `ArrowLeft` and `ArrowRight` move by a day where the vertical pair moves by a week, which is what the
  two axes of a month are.

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

- 2fde8a7: A native radio carries its own state

  Every renderer draws an option as a native `<input type="radio">` — a segmented button is one wearing
  a styled label — and a native radio maps its own `checked` into the accessibility tree. `aria-checked`
  beside it was a second source for one fact, applied by two renderers and dropped by the third, and
  when two sources disagree the ARIA one wins and is the one that went stale.

  The option projection says `null` for it; lit and Angular stop writing it. What is chosen is read
  from the state, which is where the checks now read it too.

  This is the same rule as `aria-checked` on a native checkbox, and the reason the two looked like
  opposite cases was that nobody had checked which element a segmented button actually is.

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

- e0ab01c: A part can say what the page had to ask for before it is owed at all

  `presentWhen` says when a part is on the page. It cannot say whether the question applies: a
  multiselect's reorder grip is present when there is a value **and** only where a document asked for
  reordering, which is not a state the widget is in — it is something the page decided before the
  widget existed.

  Read without that, the contract owed a drag handle to every multiselect holding a value. All three
  renderers drew it only where reordering was asked for, which is right and was a rule none of them
  could point at.

  Three adapters agreeing against a declaration is the evidence that the declaration is what is wrong.
  One adapter disagreeing would be a renderer defect; three is the contract saying something nobody
  follows, and a rule nobody follows is a rule that has already stopped being one.

  `MDY_PART_REQUIRES` carries the precondition per part, beside the presence table and derived the same
  way. It uses `requires` — the word a key binding already uses to gate a gesture on the same fact —
  because one vocabulary for one idea is what keeps a reader from checking whether two spellings differ.

  Checked in three directions: the precondition reaches every kind that draws the part, it names a
  capability that kind's own keyboard already gates on, and — the perimeter — the contract does not
  become mostly conditional on what a page asked for, which would say very little about what a renderer
  owes.

- 5bde1b0: Fifty more optional parts say when they are on the page, derived rather than declared

  The presence conditions went from 112 of 193 to 162 of 185, and not one of the fifty was written by
  hand. A part inside a popup is present when the popup is, and the anatomy already answers which parts
  those are — `dynamicPartsOf` walks the containment chain from any node whose element is a popup, and
  the server split has read that answer since it existed.

  Declaring them in the table would have been a second answer to a settled question, going stale the
  first time a kind grew a part inside its overlay. The table still wins where it names one, so a part
  with a sharper condition than "the overlay is open" keeps it.

  `dynamicPartsOf` moved to `structure.ts`, beside the type it reads, and `ssr.ts` re-exports it from
  the door it was published from. It could not stay where it was: `ssr.ts` reads the catalogue, and the
  catalogue now needs the derivation while it is being built.

  The anatomy is assembled in two passes, because containment is only readable once every node has its
  parent. The shape is laid out first; the conditions are attached to it after.

  Twenty-two parts are still silent — chips, file entries, spinner buttons, a select's displayed value.
  Each was measured against a rendered page rather than reasoned about, and the page contradicted the
  obvious guess: `clearAll` and `fileList` are on screen with no value at all, so "present when the
  field holds a value" is wrong for them. They stay in the baseline. A missing condition is a gap; a
  wrong one tells a renderer to build something at a moment nobody wanted.

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

- be44d0a: Parts that follow the value say so, and the placeholder's condition was wrong

  **`MdyPartPresence` gains `valueIsAbsent`.** A consumer switching exhaustively over the vocabulary
  must handle it.

  **`placeholder` was declared `documentDeclaresIt` and that was wrong.** The document supplying the
  words is necessary and not sufficient: a placeholder is shown because the words exist _and_ there is
  nothing yet to show instead. A renderer following the old declaration would draw a placeholder beside
  the value it stands in for. Correcting a wrong declaration is still a breaking change for anyone who
  implemented it.

  Seven more parts now say when they are there, and each was read out of a renderer's source and then
  confirmed against a rendered page: `chip`, `chipRemove`, `chipMove` and `fileItem` exist per chosen
  value; `value` is what a chosen value is shown as; `clearAll` and `clear` offer to take a value away
  once there is one. 169 of 185 optional nodes carry a condition.

  `chips`, `chipRow` and `fileList` are **not** among them, though the obvious reading says they should
  be: they are containers built once and kept, and only their contents follow the value. Thirteen parts
  stay silent — a spinner's buttons, a loading mark, an overflow count, an undo offer — because each
  one's condition needs a reading their sources have not been given.

  A new check holds the page to the declaration: for every part declared to follow the value, mount
  with nothing and with something, and the part must appear on one side and not the other. It reads
  presence as _shown_ rather than as present in the DOM — this renderer builds a part once and hides
  it, so counting nodes reports every one of these as always there, which is what two earlier probes
  concluded before this existed.

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

- 0a54a17: A select is two shapes, and the contract says which

  A select renders the platform's own `<select>` unless it filters, and the combobox when it does. The
  catalogue said so in a comment and said nothing an instrument could read, so read as one anatomy it
  owed every select the combobox's parts and its opener relation — and six cross-renderer findings sat
  unfixable, because repairing any of them meant giving a native `<select>` attributes it must not
  have.

  `select` declares two variants. `custom` requires the mark that says it opens; `native` describes what
  the platform makes of the parts it has — the trigger is the `<select>`, the placeholder an `<option>`.
  `value` and `placeholder` keep their own presence conditions and simply do not exist in the native
  shape.

  `MdyWidgetVariant` gains `"native" | "custom"` beside the multiselect's modes. Two axes share one
  vocabulary because a variant name is only meaningful for the kind that declares it: asking a select
  about `multi` selects no anatomy rather than the wrong one.

  The conformance kit learns that a `<select>` is a combobox and a `<select multiple>` a listbox, so the
  native shape carries the role its trigger promises without spelling it.

  ADR 0176, including what it does not settle: the opener relation belongs to the custom shape and the
  relation table is not variant-aware, so nothing enforces that yet.

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

- 3bc4a23: `partSelector` moves from the testing door to the package's own

  **Breaking: `partSelector` is no longer exported from `@modyra/widgets/testing`.** Import it from
  `@modyra/widgets`. It also takes an optional third argument for part states, and infers its kind, so
  every existing call still compiles.

  Finding a part by the classes the contract declares is not a testing question — every renderer asks
  it, and the ones that could not import it wrote the class name out as a literal instead. Eight of
  those literals were in one renderer. A selector written by hand is a copy of the vocabulary that no
  rename reaches: the class moves, the selector matches nothing, and the only symptom is a part that
  quietly stops being found.

  The move kept the two things the original got right and a first draft of this change lost:

  - **it escapes the name**, by hand rather than with `CSS.escape` — that is a browser global this
    package must not require, since it loads and computes in a process with no DOM;
  - **it answers `null`**, both for a part with no classes of its own (five controls have none) and for
    a part the kind does not have. Delegating to `partClasses`, which raises for an unknown part, broke
    a caller that sweeps every part name there is — for that question, "this kind has no such part" is
    an answer rather than a mistake.

  **Angular's four shadowed `minSpace` numbers are gone.** Three renderers carried `450` and one `250`,
  beside a spread of `overlayAnchoringFor` that lands after them and wins — so the literals decided
  nothing while reading as though they did, and they disagreed with the catalogue that was actually
  being used. The base's fallback stays, for a control the catalogue does not know.

- f7bd4cb: A control can say how it is operated, in words derived from its keys

  Nothing on a page tells anyone the key map exists. It is discoverable by guessing, and a person who
  does not guess has a control they can see and cannot operate.

  `widgetKeyGuide(kind, messages, options)` reads `MDY_WIDGET_KEYBOARD` and returns one sentence: what
  opens the control, what moves in it, what changes its value, what confirms, what closes it. Derived
  rather than written beside the table, because a phrase naming keys _is_ a copy of the key map — it
  goes stale the moment a binding moves, which is a shape this contract has now found five times. The
  frames are `MdyI18nMessages`, so a locale that translates them translates the legend.

  It stays quiet about what a person cannot do: a key needing a capability the field never asked for is
  left out — a legend listing `reorderable`'s keys on a field without it is worse than none — and so is
  a key answered on a part the control did not draw. It describes one state at a time, because a closed
  control's keys and an open one's are different sets.

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

- e6531f2: A value the field was given, against a value the person entered

  The origins closed half of this: a shape refusal, a server's answer and an unreadable entry are news
  the moment they arrive. A **bound broken by a value that arrived** is the other half and no origin can
  express it — `initialValue: 150` against `max: 50` is an ordinary rule, `origin: "validation"`, and it
  is still about a value already in the field. Untouched, it was held, shown, and explained by nothing:
  `aria-invalid="false"` and no text, over a number nobody at that page typed.

  `errorsVisible` takes `holdsUnedited` — the field holds something and no edit has been made since — and
  `holdsUneditedValue` computes it. Not dirty and not empty, because emptiness is `required`'s question:
  a field with nothing in it has nothing to explain.

  **The kind's own empty is not something that arrived.** A slider always holds a number — a thumb is
  always somewhere — so its default is the control at rest rather than a value a draft put there, and a
  bound it breaks stays quiet until somebody has been at the field. A kind this contract does not know
  gets the touched rule and no opinion about what empty means for it.

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

- 423b8b1: A widget's own box is a part, and the parts it lays out are declared as its children.

  `MDY_WIDGET_CONTRACTS` named `inputWrapper` — the shell every kind sits in — as the parent of parts
  that every renderer draws one level deeper, inside the widget's own layout box. Nine parents move to
  where all three renderers already build them:

  - multiselect: `chips`, `trigger`, `overflowCount`, `clearAll`, `announcement` → `box`
  - file: `fileList`, `clear`, `rejected` → `content`
  - slider: `value` → `track`

  The rule underneath, and why the two boxes must not be merged: **one part name means one element.** A
  name shared by two elements makes every measurement taken through it ambiguous — which is how a height
  comparison came to be off by the border a theme draws on one of them.

  `trailingAffordances` now looks for a kind's affordances in the widget's own box as well as in the
  shell, or the multiselect's clear-all and overflow stop being affordances the moment they are declared
  where they are drawn.

  `@modyra/angular`: the select's arrow moves inside its opener, matching the other two renderers, and
  the multiselect's chip tooltip is drawn after the announcement rather than before it — the position
  the other two use and the one the contract now states.

  See ADR 0143.

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

- 2228872: A control is described by its error **and** its help, error first

  The rule was `errorsVisible ? errorId : descriptionId` — one or the other. So the moment a field
  failed, the instruction that would have prevented the failure stopped being announced, at the one
  moment it was most useful. A description is a list; both fit in it. The error is named first because
  it is the new thing, and somebody who stops after the first sentence has heard the one that mattered.

  `MdyFieldShellA11yOptions` gains `errorsReserved`: whether the error container is **on the page**,
  which is not the same question as whether it holds a message. A renderer that keeps the container
  under every field that can fail a rule passes this and keeps one reference that never changes — and a
  reference that never changes has no moment at which it can point at an element not yet drawn, or one
  already gone. That is a class of dangling reference removed rather than corrected.

  An element with no text contributes nothing to a description. It is not read as a pause or as
  "empty"; it is as though the reference were absent, until text appears inside it. Which is what makes
  a permanently-present reference cheaper than a carefully-maintained one.

  `errorsReserved` defaults to `errorsVisible`, so a renderer that draws the container only when it has
  something to say is unaffected. `fieldDescribedBy` is exported as the one place the composition
  lives.

  **No renderer reserves the container yet.** Reserving it in lit turned two things red that this
  change does not settle: the contract orders `errors` after `supportingText`, and two kinds render
  them the other way round; and a reference claimed before the renderer draws the container dangles.
  Both are renderer work, and both are the reason the projection lands first.

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

- e47e039: An id the projection emits is an id the renderer applies

  ADR 0134: where a projection emits an id, the renderer applies it; where it does not, no renderer
  invents one. Not _every part gets an id_ — that would be DOM weight for no reader. The rule takes away
  the freedom each renderer had to drop one the contract was already computing.

  - **Calendar day cells** carry the id the field controllers compute for them. plain applied it; lit and
    Angular did not, so `<widget>__day__<iso>` existed in one renderer of three.
  - **A timepicker's hour and minute controls** carry `<widget>__hour` and `<widget>__minute`, which the
    timepicker projection has always named.
  - **`calendarDayId` is exported.** lit had been rebuilding `` `${fieldId}__day__${iso}` `` by hand — two
    places computing one id, which drifts the day the format changes. The controllers and any renderer
    that cannot reach the part table now ask the same function.

  Angular's calendar and timepicker components gain optional `widgetId` inputs, and its cell and segment
  components gain optional id inputs: a component two levels below the field cannot reach the field's
  projection, so the id is passed down rather than reinvented at the leaf.

- 0cba121: The catalogues that make up the contract, in one place, each saying what shape it is

  There was no such list. Fourteen vocabularies, fourteen separate exports, and nothing saying _these
  are the ones_ — so a tool built against "the contract" read whichever it reached first and looked
  complete. Not hypothetical: an enumerator that knew one of them reported "41 properties declared,
  none silent", then "eight undeclared conventions", and both were wrong, because the conventions were
  declared in catalogues it was not reading.

  `MDY_CONTRACT_VOCABULARIES` names each one, **the shape it has**, and the subpath it is published
  from. The shape is declared rather than inferred because inference fails on a real case: a flat
  dictionary is the degenerate form of a table with one column, so a rule asking "are all the values
  objects?" gets `{ formErrors: "mdy-form__errors" }` wrong and stops covering it silently.

  The door is recorded because it has already cost two mistakes: a vocabulary reachable only from
  `./vocabulary` reads as unpublished to anybody grepping the barrel. Three of the fourteen entries
  were found that way — by the check that says the index must be complete, after two people had counted
  by hand and agreed on the wrong number.

  Adding a vocabulary is a line in that file, and the check fails until it is there.

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

- f65d19d: `aria-checked` is the switch's, not the box's

  `role="switch"` has no host-language state to read, so the attribute is the only thing that says
  whether it is on. A native `<input type="checkbox">` maps its own `checked` into the accessibility
  tree, and writing `aria-checked` beside it is a second source for one fact — when the two disagree
  the ARIA one wins and is the one that went stale.

  The boolean projection emitted it for both, and the three renderers disagreed about applying it,
  which is what a redundant attribute invites. It is emitted for the switch alone now; the box still
  says it is ticked, in the way HTML says it.

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

- fb289a9: Every optional part says when it is on the page — all 195, with nothing exempted

  **`MdyPartPresence` gains five members.** A consumer switching exhaustively over the vocabulary must
  handle `valuesOverflow`, `undoIsOnOffer`, `inputWasRefused`, `pointerIsOnAValue` and `workIsInFlight`.

  `optional` said a renderer _may_ leave a part out and stopped there, so three renderers each decided
  when to build it and conformance had nothing to ask. Every optional node in the contract now answers:
  195 of 195, from each kind and from both shells.

  The last eight were the ones with no word for their rule, which is why they were left. Each is
  present under a fact of its own, and each of those facts is real enough to name:

  - `overflowCount` under **`valuesOverflow`** — a count reading "and four more" says nothing while they
    all fit, and that is not about how many are chosen but about how many are on screen;
  - `wayBackAction` under **`undoIsOnOffer`**;
  - `rejected` under **`inputWasRefused`** — not an error about the value, because there is no value: a
    file of the wrong type never became one, and saying so is a different message in a different place
    from a rule the value broke;
  - `chipTooltip` under **`pointerIsOnAValue`**;
  - `loading` under **`workIsInFlight`**;
  - `submitFalse` and `formErrors` under **`kindOffersIt`**, and `formErrorItem` under
    `errorsAreVisible`. A form can always be refused — a failed call, a service that is down — so its
    error container belongs to the shape, and only its contents follow the refusals.

  Every one was read out of the renderer that draws it and then confirmed against a rendered page.
  `loading` is the clearest: absent at rest, on screen once the field says it is loading. `submitFalse`
  carries no class of its own, which is why a sweep by class had reported it absent while it was there
  all along.

  `MDY_FORM_SHELL_STRUCTURE` reads the same table as every other anatomy. It is small enough to have
  been written out by hand twice over, which is exactly how two declarations of one rule begin.

  **The check is a floor now, not a baseline that may only shrink.** A shrinking list is the right shape
  for a gap being closed in batches and the wrong one for a closed gap: it leaves somewhere to put the
  next exception. `packages/widgets/contract-baseline/parts-without-a-when.json` is gone.

- 024de71: The five per-kind projections compose their description the same way as the shell

  Each of `boolean`, `datepicker`, `daterange`, `multiselect` and `timepicker` carried its own copy of
  `hasErrors ? errorId : descriptionId` — the rule that makes an error message replace the help, written
  out five more times beside the one in the shell. All six now call `fieldDescribedBy`: both, error
  first.

  Each gains `errorsReserved`, defaulting to whether there are errors to show, so a renderer that draws
  the error container only when it has something to say is unaffected — and one that keeps the
  container under every field that can fail a rule gets a reference that never changes.

  Six copies of one rule is six places for one of them to be corrected and the others not.

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

- 9eb86d9: Focus that waits for the panel it is aimed at

  A popup rendered into the top layer exists in the document a frame before it is shown, and `focus()`
  on an element that is not being rendered is a no-op that reports nothing. A renderer focusing on the
  render it triggered therefore left the keyboard where it was — which is how Angular's colour palette
  took focus in its unit tests and not on a page.

  `focusWhenShown` verifies the attempt and retries on the next frame while the caller says the reason
  still holds, bounded rather than looping: a panel that never draws is a different defect and an
  endless retry would hide it.

- cfff558: A group of exclusive choices declares all four arrows

  `radio` and `segmented` declared `ArrowUp` and `ArrowDown` and nothing else, while the paragraph
  beside the table already said the ARIA authoring practices give a radio group _the four arrows_. One
  renderer honoured all four and the others did not, so a gesture somebody learned in one was gone in
  another.

  **The layout is a visual choice, and somebody who cannot see it does not know it.** A screen reader
  announces "group, 1 of 4" and says nothing about a row or a column, so a person presses whichever
  arrow comes to hand and it has to work. A group answering only its own axis makes them guess an axis
  that was never announced.

  `ArrowLeft` and `ArrowRight` are declared for radio groups only — the kinds whose parts carry
  `role="radiogroup"`, asked of the catalogue rather than of a second list.

  `Home` and `End` stay undeclared, and the reasoning already in the file is right: they serve a set
  longer than can be seen or held in mind, and three or four always-visible choices are crossed in three
  presses. A renderer offering them is not in breach — nobody expects them, so nobody loses them moving
  between renderers — but declaring them would widen the contract without closing any gap.

- 49e17ce: The index of catalogues covers everything the package publishes, and every catalogue is frozen through

  Two holes, one shape: a list that says "these are the contract" is worth exactly what it leaves out.

  **The index was a quarter complete.** Its own check recognised a vocabulary by six name endings —
  `CLASSES`, `CONTRACTS`, `KEYBOARD`, `OPENERS`, `STRUCTURE`, `RELATIONS` — so it could only ever find
  what already looked like what somebody had thought of. Twenty-six collections sat outside it,
  published and unindexed, and the check was green the whole time: a recogniser narrower than the thing
  it guards reports the absence of what it cannot see. It now derives the list from the package's own
  exports — every `MDY_` name holding members — and there are 41, the index among them. An index that
  omitted itself published one collection it did not cover.

  A fifth shape, `data`, separates the collections that are contract from the collections that are
  payload: translations, colour presets, icon paths. Both are published and readable; only one is a
  vocabulary a fourth adapter must implement against, and no rule reading the data can tell them apart.

  **Every catalogue is now frozen all the way down.** `Object.freeze` reaches one level, and two
  catalogues were shallow: `CATALOGUE.text.parts.label.classes.push(…)` succeeded, and from then on
  every renderer reading the contract read what the page had written. Invisible while each catalogue
  was reachable only through its own export — publishing an index made all of them reachable from one
  value, which is what turned a latent hole into a found one. The freeze is applied at the source, so a
  catalogue imported directly is as safe as the same catalogue reached through the index; protection
  that depended on how you asked would not be protection.

- 3fd899b: A date range's two ends carry a class each, so a sheet stops counting `<input>` elements.

  `startControl` and `endControl` are two declared parts and they carried the same two classes, so the
  only way to round the left end of the pair was `:first-of-type` — a rule that counts elements of a tag
  while reasoning about a class. Put a hidden native input or a sizer of the same tag in the group and
  the rounding moves to the wrong end.

  Each part gains a class of its own — `mdy-daterange__input--start`, `mdy-daterange__input--end` — and
  the three renderers take their classes from the contract rather than repeating a string. The two
  positional rules, in the base sheet and in the iOS theme, name the end they mean.

  Additive: both parts keep the classes they had.

- d5656be: One door for whether a part is owed

  Two facts decide whether a part belongs on the page and they read as one: a **capability** the
  document asked for before the widget existed, and a **condition** the widget is in. A checker taking
  only the second owes a reorder grip to every multiselect holding a value — a rule all three renderers
  correctly disobey, which is the shape where the adapters agree against the declaration and the
  declaration is the thing being read wrongly.

  `partIsOwed(node, { holds, offers })` answers both, so neither half can be taken without the other.

  `MDY_PART_REQUIRES` is keyed by `kind.part` where a gate belongs to one kind and by the bare part
  name where it belongs to the part wherever it appears. A slider's `value` is not a select's, and the
  bare key gave a slider's readout a capability sliders do not have — a table telling the truth about
  one kind and a lie about another.

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

- e505164: One gesture, one answer

  The same three keystrokes on the same document reached different values depending on which adapter
  drew the page — the failure a cross-framework UI contract exists to prevent. Three controls, three
  causes, all of them a renderer or a controller disagreeing with a rule the contract had already
  written down.

  **A select's list opened with the first option already under the reading position** in the two
  renderers built on the select controller, so the first `ArrowDown` stepped past it while Angular's
  arrived at it. The keyboard policy beside that controller says the opposite in words — _the list opens
  with nothing active, and the next arrow lands where the direction says_ — and with the first option
  pre-activated, `listboxNextIndex`'s answers from nothing-active could never run. Opening now puts the
  position on the chosen option, and nowhere when nothing is chosen.

  **Angular's datepicker opened on no key at all** and its timepicker on `ArrowDown` alone, while both
  open on `Enter` everywhere else — two sibling controls in one adapter disagreeing with each other. The
  overlay base now reads which keys open a kind from `MDY_WIDGET_KEYBOARD`, so a binding gained upstream
  reaches every control that inherits it.

  **Angular's clock did not commit on `Enter`**, which the table declares for an open timepicker, so a
  time set from the keyboard could only be confirmed with a pointer.

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

- 8f72ad1: One name on a control, decided once

  Which attribute carries a control's name was a rule each renderer answered for itself, spelled out
  at every element that needed it. Two names on one element is not two names: the computation takes
  `aria-labelledby` and stops, so an `aria-label` beside it is text nobody will ever hear — and where
  the two disagree, the one a developer reads in the source is the one that does not speak.

  `fieldNameAttributes` answers it once and returns the attributes to apply, so the pair cannot be
  written by accident: the caption where the field has one, the words it can offer otherwise, and
  never both. The option projection, lit's group elements and Angular's radio and segmented renderers
  all read it now instead of restating it. See ADR 0175.

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

- 1f646ae: Seven more parts say when they are there, and one earlier reading was wrong

  177 of 185 optional nodes now carry a condition, up from 169.

  **`chips` and `chipRow` follow the value.** The changeset before this one said the opposite — that
  they are containers built once and kept, and only their contents follow — and the page contradicts
  it: with nothing chosen there is no strip at all, not an empty one. That reading came from seeing
  them constructed in the renderer's setup; what it missed is that the strip is built and then not
  attached until there is something to put in it.

  **`arrow`, `box`, `increment`, `decrement` and `fileList` are `kindOffersIt`**: drawn because the
  kind has them, not because of anything the field is doing. The condition is not vacuous — it says a
  renderer that draws this kind another way is still conformant, which is what `optional` alone left
  each of them to decide privately.

  Eight stay silent, and each now records **what it is actually present under**, in the words of the
  renderer that draws it: the pointer is over a chip, more chips are chosen than the strip can show, an
  undo is on offer, a file was refused, the field says it is loading. The rule is known; the word for
  it in `MDY_PART_PRESENCES` is not, and eight words each used once would be a list rather than a
  vocabulary. Written down so whoever adds the word does not rediscover the rule first.

  The check gained the direction that cannot be escaped by weakening a declaration. Reading the
  contract and holding the page to it is half a guard: a part re-declared as something else leaves the
  set the check looks at and passes. So it now also reads the page first — a part that appears only
  once the field holds a value — and asks the contract what it says about that part. Moving `chips` out
  of `valueIsPresent` used to pass; it fails now.

  That direction needed two corrections of its own before it could assert anything. It could not tell
  `option` from `chip`, which share `mdy-chip`, so it now measures the overlap on the page rather than
  comparing declared class lists. And it flagged `optionLabel`, which is a _required_ part inside an
  optional popup — always there while its option is, so asking what state brings it about has no
  answer. Required parts are out of its scope.

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

- 14755ac: The contract declares how each kind's value is read, so no renderer decides it

  Two checks disagreed across three renderers because the question was filed as a property of a
  _control_ — which sounds like something each renderer settles. It is not. An accessibility and
  interaction specialist, consulted knowing nothing of this repository, put it in one line:

  > Equal height is not a rule. It is a **consequence**. The rules are alignment for everyone, and a box
  > for containers.

  Every field has one place where its value shows — its slot. Look _inside_ a surface to read it and the
  field is a container: it carries the box and sits in the column. Is the slot _itself_ the value — a
  position, an on or an off — and there is nothing to look inside and no box. Everything else is frame,
  and frame has no category.

  **Decided by how a value is read, never by how it is entered.** Every hesitation about the table
  turned out to be somebody looking at entry: a colour swatch is _pressed_, files arrive from another
  window, chips are _removed_ one at a time, a segmented row has _words_ in it. None of it counts. A
  quantity stepped with plus and minus is a container, by the rule rather than as an exception to it.

  `MDY_WIDGET_CONTRACTS[kind].valueSlot` is `"container"` or `"shape"`, recorded in the contract
  snapshot: changing one is **major**, because every renderer draws that kind differently afterwards and
  a theme keyed on the box is drawing it for a control that no longer has one.

  Nothing renders differently today — the table records what the renderers already do. What changes is
  that it is now declared once and checked, rather than agreed on by three implementations that nothing
  was asking.

- 11b6823: Type-ahead is declared, with a key that admits it has no key

  All three renderers let you type a letter at an open list to jump to the option beginning with it,
  and none of them was asked to: the contract had no binding for a printable character. A check
  counting what a renderer claims against what the contract declares read this as a renderer doing more
  than it was told. It was the contract doing less.

  Declaring it needed a key, and there is none — the gesture is _any_ character. Picking a letter to
  stand for the alphabet would be a table saying one thing and intending another, which a tool reads
  literally and a person reads charitably. `MDY_ANY_PRINTABLE_KEY` is the key field admitting it has no
  key, and `keyBindingFor` resolves any single character to it.

  Narrower than "navigates options": only kinds that hold a list of named choices. A calendar walks its
  cells with the arrows and has nothing to type at — a date is not a word, and a character typed there
  reaches the platform rather than being swallowed. Keyed on the part that _is_ the list rather than on
  a role, because the two kinds that have one give it different roles — a listbox where choices are
  exclusive, a group where they are not — so a role test covers one and misses the other while looking
  like it covers both.

  Space is never a character to search with, a closed list has nothing to jump within, and a named key
  still wins where both could answer.

- 49e17ce: `isWidgetKind`, `keyMeans`, `bindingForIntent` and `capabilityOf` — the questions the adapters were already asking

  Every renderer reached the catalogues the same way and wrote the same expressions to do it:
  `keyBindingFor(kind, key, open)?.intent === "open"`, `CONTRACTS[kind].capabilities.x === true`, a cast
  asserting a string is a kind. Twenty-five sites across three adapters, and each one a chance to spell
  the question differently — which is how a single declaration came to mean three things. Some sites
  compared the intent, some checked only that a binding existed, and the two answers differ on a key
  declared with another meaning.

  The kind is always an argument. A helper closing over a kind reads well in the renderer that wrote it
  and cannot be reused by the next, and the shape of these questions is what a fourth adapter needs on
  its first day.

  `capabilityOf` raises rather than answering when a capability is not a yes or a no.
  `dismissOnOutsidePointer` is a named strategy and `anchoring` is a record of measurements; asked as
  booleans they would come back `false`, which reads as "this kind does not do that" for six kinds that
  do. A boolean question about a non-boolean value has no true answer, so it does not invent one.

  No behaviour changes: this is the body that was already there, put where it can be asked instead of
  copied.

- 48c0597: The scale's step names are recorded as public surface.

  A consumer builds a theme by setting `--mdy-control-1` or `--mdy-space-4`. Renaming one breaks them
  exactly as renaming a widget part does, and until now nothing could see it: the tokens were in no
  snapshot at all.

  `contract:diff` reads the step names from the sheet — not from a list somebody has to remember to
  update — and reports a step that stops answering as **major**, a new one as **minor**.

  **Names, not values.** Changing what a step _is_ is what a theme is for, so recording values would
  report every theme as a contract change.

- 7aaa84a: The second door, and what the contract declines to say

  `MdyPopupOpener.alsoOpensFrom` names the part a pointer opens an overlay from beside the opener that
  carries the relation: the calendar button next to a typeable date, the clock next to a typed time,
  the box a multiselect's chips sit in, the swatch next to a colour. All three renderers answered a
  press on these and none was asked to — the door worked everywhere, nothing declared it, and any of
  them could have lost it with every suite green.

  It carries no relation: `aria-expanded` and `aria-controls` stay on the part that holds the value,
  because a second element claiming them announces two comboboxes for one list.

  ADR 0177 also records two things the contract deliberately does not decide — whether a renderer draws
  an optional part that declares no condition, and whether a control is named by a reference to its
  caption or by the caption's words — so a check can read the reasoning instead of reporting the silence
  as a defect.

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

- 3eb1f84: The seven presence conditions that were owed an answer have one

  `valueIsPresent`, `valueIsAbsent`, `fieldIsRequired`, `undoIsOnOffer`, `viewIsActive`,
  `inputWasRefused` and `workIsInFlight`. Each takes the narrowest input that decides it rather than a
  widget state, because a resolver that takes everything is one a caller cannot use without holding
  everything.

  **`valueIsPresent` is derived, not tabulated.** The emptiness of a value is the kind's, and the kind
  declares it: `nullable` separates a number field whose empty is `null` from a slider whose empty is
  where it starts, and the shape separates a list from the single value it holds. `Boolean(value)` gets
  both wrong, and three renderers asking it separately got them wrong in three ways — which is how this
  condition came to mean one thing where chips are drawn and another where they are not.

  It refuses one case rather than guessing: a non-nullable numeric value has no absent state and this
  function is not handed the floor. A check asserts no kind of that shape declares a part under the
  condition, so the branch is unreachable rather than wrong — and if one ever does, that check fails
  instead of the rule quietly answering for a slider at its minimum.

  **`fieldIsRequired` is not `handle.required()`.** A marker on a field nobody can fill in asks for
  something that cannot be given, and the asterisk that means "you must" on a live field still reads as
  a demand on a disabled one.

  **`workIsInFlight` is two facts and one question** — a validator that has not answered and a list of
  options still arriving. A renderer asking them separately shows the waiting part for one of the two
  reasons it exists.

  The rule is checked against `MDY_CANONICAL_EMPTY`, the table every adapter's conformance fixture
  mounts from: what the fixtures call empty, the rule calls absent, and what they call filled it calls
  present. Two statements of one rule is the shape this work has been removing; where one cannot yet be
  deleted, the next best thing is that they cannot drift apart in silence.

  `MDY_PRESENCE_RESOLUTION` now names an answer for eleven of the fourteen conditions and an argument
  for the three that will never owe one. `owed` stays in the shape with nothing in it, because a
  condition added to the contract arrives owed and the table has to be able to say so.

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

- cef9693: A press on a panel's dimming veil dismisses it

  The veil is drawn as the panel's **sibling inside the same portal**, and the rule that decides
  whether a press happened inside the overlay counts everything in that portal as inside. So a press on
  the darkened area — the one gesture a person reaches for to close a modal — was read as a press
  inside the panel, and the panel stayed open. With no pointer way out, only `Escape` remained, which
  not everybody knows.

  `MDY_BACKDROP_ATTRIBUTE` is exported, and `overlayBranchContains` answers _outside_ for the veil and
  for anything drawn on it. It is the canonical outside; treating it as inside is the one answer it
  can never have.

  Found by a browser sweep that reported it against `daterange` on Angular, and confirmed as belonging
  to none of them: the veil is drawn by the shared overlay layer, so every renderer that dims the page
  had it. It only showed on one kind because that was the kind whose panel happened to be open when a
  press landed on a veil another kind had drawn.

  The check that came with it was green for the wrong reason first. Rooted at the panel, the veil is a
  plain sibling and reads as outside with no rule at all — the fixture has to be rooted at the _field_,
  with a trigger naming a panel that lives in a portal, because that is the shape the rule is written
  about. Removing the guard did not fail the first version.

- 23accd5: Three field controllers are importable, and a check says so when the next one is not

  `createSelectFieldController`, `createColorsFieldController` and `createFileFieldController` were
  written, tested, and behind no door. Their **types** were published and the functions that build them
  were not — so a consumer could name a `MdySelectFieldController` and had no way to make one. No
  renderer adopted them because no renderer could.

  The one for `select` says in its own first line why it exists: the select was the single kind built
  the other way round, driven by eight imperative setters where every other kind takes a field handle
  and reads it, and this is _"the adapter that closes it"_. It has been closing nothing.

  **Nothing said so, and four gates each had a reason not to.** Their suites import by deep path into
  `dist`, which passes — and that is the house habit for controller specs, so it is not a signal.
  `coverage-and-demo` counted them asserted, because a test does mention them. `audit-public-doors`
  guards the opposite mistake: a name reachable from _two_ subpaths, not from none. And
  `audit-contract-adoption` reported `"none offered"` — correctly, and therefore silently.

  A new check reads the barrel: every `src/field/*-field-controller.ts` must export a builder the
  package publishes. It finds the module list itself rather than being given one, and it asserts the
  counts agree, so a check looking in the wrong place fails instead of passing quietly.

  **The adoption audit now measures the field controller for `select`, not the standalone one**, and
  knows a controller is offered for `colors` and `file`. The score moves from `45/45` to `42/51` — not
  because adoption fell, but because the question sharpened. Nine renderer/kind pairs are offered a
  controller and do not call it, and that list is now printed.

- d3cd87c: Three gates that were reporting on things they could not see

  **Moving a part inside a kind's list changed nothing the contract differ could tell you.** The order a
  part sits in is the reading order — `contracts.ts` says so — and the snapshot recorded eight fields
  per part, none of them where it was. Swapping two names in a shipped kind moves what a screen reader
  says next and the differ answered "contract unchanged". It records `order` now, and a move is major
  in both directions: a person hears the parts in the order they are in.

  **A field controller published by no door was nobody's finding.** Three of them were written, tested,
  and unreachable: the types were exported, so a consumer could name the interface and had no way to
  build one, while the adoption bench reported the kinds as offering nothing — correctly, because from
  the public door nothing was. The duplicate-door check guards the opposite problem, the type surface
  only compares what is exported, and their own specs reach them by deep path into `dist/`, which is
  the house habit and therefore not a signal. `test:public-doors` now asks the third question, and its
  three findings print three different sentences: one had been telling readers to look for a second
  door when the finding was that there was none.

  **One index claimed to cover a package it covered two thirds of.** The `./testing` door publishes
  twelve collections — what a kind holds when it is empty, what it looks like at rest, which beats a
  paint takes — and every one was in no index. They are what the adapters' fixtures compare against, so
  a fourth adapter's author needs them as much as the contract's own catalogues.

  They are not folded into the contract's index, because reaching them from the main barrel would put
  fixtures in the bundle of somebody who only wanted to draw a field. `MDY_TESTING_VOCABULARIES` is
  that door's own index. Two indexes and no third list: the alternative — one index plus a ledger of
  what it deliberately omits — is the shape that goes stale in silence, and two such ledgers once hid
  five undeclared classes between them. The check now asks of every door together that nothing
  published anywhere is named by neither.

- 7878e24: The timepicker's popup declares `role="dialog"` in the widget catalogue.

  `MDY_WIDGET_CONTRACTS.timepicker.parts.popup` now carries `role: "dialog"`, which every renderer of
  the kind must announce. `@modyra/plain` and `@modyra/lit` already emitted it and are unchanged.

  **Migration for a renderer implementing this contract**: emit the declared role on the popup element
  wherever the panel is drawn, rather than deriving it from placement. Modality is separate — the
  timepicker's popup is modal (`aria-modal="true"`, focus trapped) while the multiselect's declared
  dialog is not — so do not derive `aria-modal` from the role alone.

  `@modyra/angular`'s timepicker previously announced no role at all unless the panel was drawn over
  the page with a backdrop; it now matches the other two renderers, named by the field's label through
  `aria-labelledby`. See ADR 0140.

- b4bee4f: A calendar declares the keys that turn its month

  `PageDown` moves to the next month and `PageUp` to the one before, in all three renderers, and none
  of them was asked to. An adapter written from the contract alone shipped a calendar that could not
  leave the month it opened on: the arrows walk within a month and cross its edge one day at a time,
  which is a long way to reach next March.

  Declared for the kinds that have a `grid`, which is what a month is — a calendar has one and a list
  does not, so a page key means something here and nothing there. `MdyKeyBinding` gains `page`,
  separate from `by` rather than a third value in it, because the two compose: a page key carries a
  direction like any other movement, and a reader asking "which way" gets the same answer from both.

  Nothing renders differently. The table records a gesture the three already agreed on, and stops an
  adapter from having to discover it.

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

- 17c3bff: Type-ahead answers at a closed single-choice control, and the differ learns what widening is

  Declaring type-ahead yesterday restricted it to the open phase, on the reasoning that a character
  typed at a closed control opens nothing and is the platform's business. That was wrong about the
  platform: every native chooser moves to the option beginning with that letter _without opening_, and
  the framework-free renderer does the same. The binding said a gesture was not owed at a control that
  has always offered it.

  It now answers in both phases where **one** choice is held. Where several are, there is no "the"
  choice for a letter to move and the strip has its own use for keys, so it stays open-only until
  something measures otherwise.

  **And `contract:diff` gained the distinction the change exposed.** Dropping a phase from a binding
  _widens_ it — a key that answered only while open now answers always, and nobody relying on the open
  behaviour loses anything. Compared as strings that read as one binding removed and another added: a
  major for a change that takes nothing away. The tool was right that the old spelling is gone and
  wrong about what a consumer can survive, and that disagreement is worth more than either verdict.
  Narrowing a binding to one phase is still major.

- a36aca3: The class-rule exemption reports itself, and a field can say whether it can fail

  **`MdyDomContractIssueCode` gains `EXEMPTION_ACTIVE`.** A consumer switching exhaustively over issue
  codes must handle it.

  Passing `adapterPrefix` to the DOM conformance kit suspends the rule that fails on classes the
  contract does not declare. It did so silently, and a result that does not say a rule was suspended
  reads exactly like one where the rule held — while the person who passes the option and the person
  who later reads the green are not the same person. Five undeclared classes lived for months behind
  this, in a repository whose conformance check fails on undeclared classes.

  The option stays, because a renderer outside this repository may rely on it. What it no longer does
  is stay quiet: either the class is reported as invented, or the exemption is reported as active.
  There is no combination that reports nothing. An exemption that skips nothing still reports nothing —
  otherwise every caller carries a permanent finding for a rule that never fired.

  **`fieldCanBeInvalid` is exported**: whether a field can fail a rule, and so whether its error
  container is reserved at rest. One predicate rather than three renderers each deciding.

  The reservation is not for the field that is failing — it is for the field _below_ it. Someone
  leaving a field is moving toward the next one, and that is what drops when a message appears under
  the field they just left. It does not stop every movement and must not be believed to: a two-line
  message moves things anyway, and a validation arriving while focus is elsewhere defeats it. It closes
  the frequent case, which is validate-on-blur.

  Read from the field, never from its kind — an optional note with a length limit can fail a rule. And
  it depends on the field's rules, never on its errors: the container stays reserved once a message
  clears, because taking the space back is the same jump, upward, under the same thumb.

  **No renderer reserves the container yet.** Doing so collides with a rule the renderers hold — the
  control's description names the error list only when the list is rendered — and that collision needs
  its own decision. The predicate lands first so the decision has one place to be applied.

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

- cd584fc: Every optional part can now say when it is on the page

  193 structure nodes were `optional: true` and not one said **when**. `optional` says a renderer _may_
  leave a part out and stops there, so each renderer decided for itself when to build it, three
  renderers decided three times, and conformance could ask nothing — there is no checking a rule nobody
  wrote.

  `MdyWidgetStructureNode` gains `presentWhen`, drawn from `MDY_PART_PRESENCES`: a closed vocabulary of
  eight conditions a renderer can already answer — the document supplied the content, the field is
  required, the field can fail a constraint, errors are visible, the overlay is open, a value is
  present, the kind offers it, the view is showing.

  Named `presentWhen` rather than `when` because `when` already means the overlay phase on a key
  binding, and one word with two meanings is how a declaration comes to be read two ways.

  The conditions live in one table, `MDY_PART_PRESENCE`, keyed by part name. This anatomy is declared
  twice — written out for the shell every field shares, derived again for each kind — and a condition
  copied into both drifts the first time one is edited. Both read the table.

  **The error container is present under `fieldCanBeInvalid`** — the field has constraints, so it can
  fail one — and its contents under `errorsAreVisible`. Reserved at rest, and still reserved after a
  correction: taking the space back when a message clears is the same jump as giving it, upward. Read
  from the field, not from its kind: an optional note with a length limit has a constraint.

  112 of the 193 nodes carry a condition. The other 81 are recorded in a baseline that may only shrink:
  a _wrong_ condition is worse than a missing one, because it tells a renderer to build something at a
  moment when it is not wanted and nothing notices until it is on the page.

  Two audits were repaired to see this, both reading a field rather than a relation. `contract:diff`
  snapshotted `optional` and `repeated` and not `presentWhen`, so it called the contract unchanged while
  every optional node in it gained a condition. `audit-type-surface` read a union's members from syntax,
  so a union derived as `(typeof ARRAY)[number]` looked empty — which also left `MdyWidgetKind`,
  `MdyWidgetState` and four more recorded as opaque.

  The contract now says when a part is there. **Nothing yet checks that a renderer builds it then** —
  that is the next batch, and until then these are declarations rather than enforced behaviour.

  See ADR 0164.

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

- 69d8cb8: Which shape a document asks for

  ADR 0176 gave the select two anatomies and published no way to ask which one a given field selects,
  so a renderer drawing one shape and ignoring the property was violating nothing stated, and a checker
  had to hard-code the rule or guess.

  `variantOf(kind, spec)` answers from the document's own words: a multiselect's `mode`, a select's
  `searchable`. And `MDY_POPUP_OPENERS.select` now says the opener relation belongs to the custom
  shape — a `<select>` carrying `aria-expanded` claims to be a combobox, which is a lie about what it
  is.

  Between them a real divergence becomes visible instead of arguable: one renderer draws the combobox
  for every select where two hand a non-filtering one to the platform.

- ce0b6d5: Every presence condition says who decides it

  `MDY_PART_PRESENCE` says, for each part, the condition under which it is on the page. Fourteen
  conditions carry 185 declarations across the kinds, and three of them carry 85 — the three the package
  publishes a way to _decide_. That is the direction of the causation rather than a coincidence: a
  condition a consumer can ask about is the one consumers read, and the eleven with nothing are
  declarations each renderer interprets for itself. It is how `valueIsPresent` came to mean one thing
  where chips are drawn and another where they are not.

  `MDY_PRESENCE_RESOLUTION` names, for each condition, what answers it or why nothing does. Two things
  it makes visible that a blank could not:

  `valuesOverflow` **was** answered — `hiddenChipCount` decides it and was not named as deciding it,
  which is worse than a gap, because a consumer looking for the resolver finds none and writes a second
  one beside the function that already answers.

  And three conditions will never have one, so they say why. `documentDeclaresIt` asks whether the page
  passed a label; the renderer holds that input and a resolver would put a call between a consumer and
  a fact in their hand. `kindOffersIt` is answered by the catalogue a renderer already reads.
  `pointerIsOnAValue` is knowable only by the renderer. Left blank they read as three gaps, and the next
  person counting resolvers reports three decisions as findings.

  Seven remain owed and are named as debts rather than absences. See ADR 0169, which states the rule
  that decides which is which: a condition owes a resolver when two renderers could reasonably disagree
  about the answer from the same state.

  The check derives from the conditions, so a condition added to the contract has to be accounted for
  before it can be declared on a part — and it holds one property as a property rather than a sentence:
  if the declarations ever come to hang mostly off conditions nothing decides, the contract has grown in
  the direction that made two renderers disagree, and somebody should know before it is measured by
  accident again.

### Patch Changes

- 4098145: The renderer budget records what moved instead of failing on it.

  `overrun` was a ratchet — may shrink, may not grow — and the property was right in principle and wrong
  in practice: **every legitimate edit moves the number**, so it fired on correct work and the only way
  past it was to re-record. It fired twice in one afternoon over a single line and its removal.

  That is the diagnosis `check-bundle.mjs` already wrote down about the bundle size, in this repository,
  after reaching it the same way: _a threshold that is raised whenever it is crossed is a record of past
  sizes rather than a limit._ This applies that reasoning where it was found a second time.

  **What replaces the gate is a history.** Each re-record appends what moved, from what to what, at which
  commit — so four lines and four hundred stop looking alike, which is what the ratchet was protecting
  and the one thing it could not show:

  ```
  multiselect/multiselect-renderer.component.ts: 113 → 116 (+3)
    moved 2 time(s) since 2026-08-25, 0 in total
  ```

  Only movement is appended: a re-record that changes nothing writes nothing, or the series fills with
  entries saying "still 113" and stops being readable. A dirty tree is recorded as such rather than
  naming a commit whose content is not what was measured.

- 9ad3e51: A calendar's views say which one is showing, and no word in the vocabulary is idle

  The day grid, the month picker and the year picker were all declared `overlayIsOpen` — true of all
  six parts at once, and contradicted by the page: with the day view up, the month and year pickers are
  hidden and their cells are never built. They are present under `viewIsActive`, which is the sharper
  condition and implies the weaker one, since a view cannot be the one showing inside a panel that is
  not there.

  Found from the other end. `viewIsActive` was published and **no part used it**, which is a word
  nobody had to get right. A check now says so: a condition the vocabulary offers and nothing is
  present under is either a missing declaration or a word the contract does not need, and both are
  worth failing over.

- 0f16026: `contract:diff` sees the class names that belong to no kind

  The snapshot reaches class names through a kind's anatomy, so a name outside every kind was invisible
  to it: the shared button, the overlay machinery, a layout's own boxes, the form shell. Fifteen names
  across three published vocabularies.

  Seven of them are selected on by the themes shipped here, so the dependency was real while a rename
  would have been classified as an internal change — and every stylesheet using one would have broken
  on a release the gate called a patch. `contract:diff` was not silent about them; it was silent
  _because_ of them, which is the harder kind to notice.

  They are recorded beside the scale, for the same reason and in the same shape: names, not values,
  because what a class _is_ belongs to a theme and what a consumer cannot survive is a name that stops
  answering.

  Named one vocabulary at a time rather than discovered by shape. A vocabulary is sometimes an array
  and sometimes a dictionary, and a flat dictionary is the degenerate case of a table with one column —
  a rule reading the shape cannot tell them apart and would quietly stop covering whichever it did not
  anticipate.

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

- 7f407b9: The browsers this library works in are now declared, and enforced

  There was no `browserslist`, no CSS lint and no sentence anywhere saying which browsers this library
  supports. It arrived at its present shape one rule at a time — 85 uses of `:has()`, 144 of
  `color-mix()` — and the first rule newer than somebody's browser would have broken their page with
  nothing here to say so.

  The floor is **Baseline widely available**. Everything used below it is declared in
  `packages/widgets/contract-baseline/platform-floor.json` with what is lost without it, and with the
  guard or the check that holds its fallback. Three features are below the line today — the Popover
  API, `backdrop-filter` and relative colour syntax — all enhancements, all degrading rather than
  breaking, and that file says exactly how.

  `npm run test:platform-floor` fails on a breach and runs in the contract gates. Nothing about the
  published API changes. See ADR 0151.

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

- 1fffe2d: Backspace stops being swallowed at a multiselect trigger

  The overlay policy answered `Backspace` with "clear the search" when the search was **already empty** —
  an action that changes nothing, handed to a caller that prevents the default because it was given an
  action. All three renderers therefore swallowed the key at the trigger and did nothing with it,
  including with the panel closed, where there is no search box to clear.

  The key is declared on the chip, where it takes a chosen value off. Claimed at the control it was
  taken from the person and given to nobody: **a key that is prevented and unanswered is worse than one
  nothing claims**, because the platform's own meaning goes with it.

  And `audit-type-surface` stops reading documentation as surface. A doc comment sits inside an inline
  object type in the emitted declaration, so rewording one changed the compared string and was reported
  major on a type whose members had not moved. A comment cannot break a consumer; a member can, and
  members still are.

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

- 234736d: A quantity that stays where it is

  Stepping a counter chip reordered the value behind it. `increment` appended the new occurrence to the
  end of the array, so `["a","b"]` stepped on `a` became `["a","b","a"]` — while the strip, which draws
  each distinct value once at its first position, did not move. The two disagreed and neither looked
  wrong on its own: the control showed one order and the form submitted another, silently, on a press
  that was supposed to change a number.

  One more of a value now goes in beside the ones already held, and one fewer takes the last of the
  group so what remains keeps the positions it had. A value not yet held still starts its own group at
  the end, which is where a first choice goes.

- e455962: A question the element answers itself

  The select projection wrote `aria-disabled` on its trigger in both shapes. On the platform's own
  chooser that is a second answer to a question the element already answers: a `<select>` carries
  `disabled` as a property, assistive technology reads it, and two sources for one fact is how they
  come to disagree.

  It is written only for the custom combobox now, which is a button standing in for a chooser and has
  nothing else to say it is out of play. The native attribute stays in both — it is what actually
  refuses the press, rather than what describes the refusal.

- 04ff8d8: A range says which day is today

  The single-date calendar reads the day cell's projection and says `aria-current="date"` on today; the
  range calendar wrote its cells by hand and said it in one renderer of three. It reads the same door
  now, and Plain and lit mark today in both channels — the class for the eye and the attribute for a
  reader — where they marked it in neither.

- 4255d5a: The contract record carries every field a key binding declares, not three of them

  `contract:diff` recorded a binding as `key@phase:intent`. Everything else a binding says — which part
  answers it, what may be held with it, which way a move goes, where focus lands afterwards, what gates
  it — was outside the record, so changing any of it was a change the differ could not report.

  Found by changing one: `Escape` gained `modifier: "any"`, which decides whether somebody can leave a
  panel with a modifier held, and the differ answered `patch`.

  A binding is identified by its gesture and the rest are compared as that gesture's attributes.
  Compared as one string instead, enriching the record reads as every binding removed and a different
  one declared — eighty findings with a real removal invisible among them, which is the failure the
  entry exists to prevent. A baseline written before the attributes existed has none for any binding,
  and an absence there means "not written down" rather than "declared nothing", so the attribute
  comparison is skipped against one — a guard that removes itself with the next snapshot.

  Two mutations that used to pass now classify major: removing a modifier declaration, and removing a
  binding outright.

- 50ffc70: A strip that says there is more

  ADR 0127 lets a multiselect's chip row scroll only where something reaches what leaves the viewport.
  The wheel and the roving focus are that mechanism; nothing told a person there was anything to reach.
  Twelve chips in a control that shows four looked like a control holding four.

  Two answers, one for each way of reading a control:

  - The strip carries `aria-describedby` pointing at the field's own description, which already says how
    many are chosen. A reader standing on the strip is exactly the person who cannot see that it runs
    on, and the count is the fact that makes the hidden chips worth looking for.
  - A scroll shadow at each end, in CSS and self-adjusting: two gradients scroll with the content and
    paint the field's surface over the shadow at whichever end is exhausted, so the cue is drawn only
    while chips really are hidden that way. No measurement, and no class a renderer has to keep in step
    with the scroll position.

- 2e2a1ef: The way back restores only what the field still offers

  An option set is not fixed: a document changes it, a host reloads it, a dependent field narrows it.
  An undo made before such a change held values from a world that no longer exists, and taking it put
  one of them back into the form — a value nobody can choose, on a chip with no option to take a label
  from, so a person read a raw `b` beside words.

  Undo now restores the part of its offer the set still holds. Refusing it wholesale would satisfy the
  same property; keeping what survives is the half the person asked for, and a way back that silently
  does nothing is worse than one that does what it can.

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

- a7eddca: The UI contract gates report every failure, not the first one.

  `test:contracts` was twenty-six checks joined by `&&`. A chain reports the thing that broke and says
  nothing about the rest, so a pipeline red in five places looked exactly like one red in one, and each
  repair revealed the next wall instead of the remaining distance.

  `scripts/run-contract-gates.mjs` runs the same commands in the same order, with the same exit code, and
  does not stop. The first run of it found five failures where the chain had been reporting one.

- 96ab84b: Angular's select publishes the ids the contract spells

  A published id is `<widget>__<part>__<key>`, and this renderer minted `pick-opt-0` from the option's
  _position_ while the other two spelled the contract's form — so a consumer reading the published
  format and writing a selector reached two renderers and missed the third, and an id moved when the
  list was filtered rather than naming the same option throughout. The trigger published the bare field
  id where the others publish `__trigger`.

  Both now come from the id factory, and from _this_ control's current widget id rather than the
  adapter's: the adapter is constructed once and holds the id the control had at that moment, which is
  the mount id — so its view spelled `mdy-control-0__option__…` while every id computed later in the
  same component spelled `pick__…`. An id is a function of the document (ADR 0135).

  The keyboard policy's comment is corrected too: it said a list opens with nothing active, which is
  neither what the controller does nor what the authoring practices describe, and it nearly bought a
  repair that made `Enter` straight after opening choose nothing.

- b6cd7d6: A part recorded as machinery has to be reachable by nobody

  The ratchet that records controls no relation names carries a classification per entry: machinery, or
  a gap in the contract. Without a check on the classification itself, the list can shorten by
  _reclassification_ rather than by repair — a gap moved into the machinery column stops being counted,
  and the sentence that excuses it is one nothing reads.

  So the claim is held to the page. Machinery is a part no relation names **and** a part no renderer
  offers as a stop for the keyboard, measured by mounting it rather than by reading a renderer's source,
  because "is this reachable" is a question about a document. Giving the one recorded entry a positive
  tab index turns it red.

  The distinction it guards is the one the colour field made expensive: a control in the tree that
  nothing describes is a control a reader meets and cannot place, and the five remaining entries are
  that — a person types in every one of them.

- 82e7216: "No attribute" is said with `null`

  Taking `aria-checked` off the native checkbox left the key out of the object rather than setting it to
  `null`. This contract says "no attribute" with `null` everywhere — `aria-readonly` beside it does —
  and a key simply absent reads as `undefined` to anything asking the projection what the field says,
  which is a value no reader maps and outside the three the standard allows. Worse than the redundancy
  it replaced: an ARIA attribute holding an uninterpretable value beside a box that maps its own state.

  Also in Angular's colour field: `aria-label` was bound twice on the hex box, so one of the two names
  was silently discarded, and `aria-disabled` was written only while true where the other two renderers
  and the contract say it in both states.

- 953381d: One name on a control, never two

  A multiselect's trigger was named by the caption in two renderers and by its own words in the third,
  so the same field said the same thing through two mechanisms — and any renderer carrying both would
  have said only the first, because `aria-labelledby` wins the name computation and silences whatever
  sits beside it.

  All three point at the caption now, and say the words only where a document wrote no caption. The
  contract's comment says which of the two applies and why, so a fourth renderer does not have to pick.

  Angular's `labelId` is computed rather than captured at construction: a field initializer spells the
  id the component had before the host gave it one, which resolves to no element.

- 09c79c3: `partClasses` and the contract record now agree about every part

  Both are published, and they disagreed about five of them: `partClasses(kind, "control")` returned
  `["mdy-input-wrapper__inliner"]` for text, email, password, textarea and number, while the record
  said the part carries no class at all.

  The record was right. That class belongs to the **box that holds** the control, not to the control —
  measured in the page, the `<input>` does not carry it and its container does. The accessor fell back
  to the shell's vocabulary by name, and the shell uses the word `control` for the box.

  **If you selected a control with that class, you were selecting its container.** The selector found
  an element, which is why nothing failed. `partClasses(kind, "control")` now returns `[]` for those
  five kinds, and every part reads the same whichever surface you ask. See ADR 0154.

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

- 2175826: A datepicker sends the date it holds, not the date it shows

  What a form sent for a date field contradicted what the field itself answered: `01/02/2026` on the
  wire against `2026-01-02` in the model, in the same instant, from the same control. A receiver handed
  `01/02/2026` cannot tell the second of January from the first of February — and neither can the sending
  side, because it is looking at a field that holds the right answer.

  Not a defect of whichever renderer formats today. A control's text is a **presentation** of the value
  and the value is not, so a name on that control sends the presentation the moment anybody formats
  anything. The field now carries its value in an input of its own, as `select` and `multiselect`
  already do, and the control carries no name at all.

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

- 7c85752: A combobox says what it asks, then what it holds

  A `<label for>` names a button, and that was the defect rather than the fix: the accessible name
  computation takes the caption and stops, so the button's own content — which for a select trigger
  _is_ the chosen value — was never appended. A person reaching the field heard what it asks and not
  what it holds.

  The projection names the trigger by two references, the second being the trigger itself: a
  self-reference contributes the element's own content, so the name reads "Country, France" without
  the value needing an id of its own. The `<label for>` stays — it no longer supplies the name, and it
  is still what makes clicking the caption reach the control.

  The platform's own chooser is left alone. A `<select>` has a value the reader announces separately,
  so `for` gives "Country, combo box, France" already, and overriding it would take apart what the
  platform does right. See ADR 0175.

- Updated dependencies [ff00fb6]
- Updated dependencies [3a15797]
- Updated dependencies [d0a6f15]
- Updated dependencies [4e7ba99]
- Updated dependencies [d8b3b54]
- Updated dependencies [07b3ec8]
- Updated dependencies [f962df5]
- Updated dependencies [ca7a0fa]
- Updated dependencies [59e7af2]
- Updated dependencies [0883045]
- Updated dependencies [e65f631]
- Updated dependencies [6efa698]
- Updated dependencies [fc493c5]
- Updated dependencies [052db3e]
- Updated dependencies [ad85b8b]
  - @modyra/core@2.5.0

## 2.4.0

### Minor Changes

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

- 771ea00: A number that does not change under a tremor

  The ring was given memory and the angle was not, so half the flicker survived — the half a person
  notices most. Twelve hours sit 30° apart, which puts the boundary halfway between two of them, and at
  a hand of 100 **one degree is 1.75px of arc**. A finger resting near that boundary crossed it
  repeatedly and the hour changed several times while the hand was, to its owner, still.

  Nearest-value is the right answer to _which number is this_ and the wrong answer to _should the number
  change_. `timepickerDialPick` takes the value in hand and keeps it until the pointer passes the
  boundary by **a quarter of the spacing** — a fraction of the spacing rather than a count of degrees,
  because minutes sit 6° apart where hours sit 30°, and a margin that suits one is either nothing or
  everything on the other. A granulated face uses its own spacing: four minutes 90° apart get a
  quarter of _that_.

  The controller passes the number it is holding, which it already had; no renderer grows any state.

  Four properties, and the last is the one a fix that eliminated flicker by refusing to change at all
  would fail: a tremor at the boundary changes nothing, no one-degree wander changes the value twice
  anywhere on either face, a deliberate move to the next number lands in exactly one change, and a
  granulated face keeps the rule at its own spacing.

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

- 37ccb9b: Tab moves inside a popup that has controls of its own

  **Read this before upgrading: it changes a declared key, and it ships under a minor.** `Tab` on an
  open timepicker no longer closes it. Anything relying on Tab to dismiss the picker — a test walking
  focus past it, a page counting on the popup being gone — sees it stay open and must use `Escape`,
  which is unchanged and now the way out.

  `Tab` was declared as `cancel` for every kind with an overlay. A timepicker's popup holds six
  controls, so:

  > Open the picker, type an hour, press `Tab` to reach the minutes — the picker closes and the draft
  > is discarded.

  And nothing else reached the confirm button, so **the widget's only way to commit a time was a
  pointer**. WCAG 2.1.1, not a preference.

  **Migration.** `Tab@open:cancel` is withdrawn for `timepicker` and `Tab@open:move` declared in its
  place. Every other overlay kind is unchanged — a popup holding a list is one composite control and Tab
  leaving it is the combobox pattern. The question is asked of the catalogue: a kind that declares an
  `actions` bar keeps Tab, because an action bar means a confirm button inside the overlay.

  A renderer built against the old table and not updated leaves a timepicker popup open when the user
  tabs. `Escape` is unchanged, still cancels, still returns focus to the opener — and is now the only
  way out of the dialog, which is why it stays.

  Three things are published with it, so the renderers stop each answering them: `timepickerTabOrder`
  (hour, minute, period on a twelve-hour picker, mode toggle, actions — wrapping at both ends),
  `timepickerFocusPart` (which part carries focus for a field), and `MDY_TIMEPICKER_ADVANCE_MS` (one
  delay for the dial's hour→minute handover, where there were three: 0, 200 and 300).

  ADR 0122 records the decision and amends ADR 0021, which had declared Escape and Tab equivalent.

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

- 56b9361: A timepicker can offer only some of the times

  A booking form takes appointments every fifteen minutes; a shift planner takes them every five
  before noon and every thirty after. `MdyTimeGranularity` says so, as data rather than as a callback,
  so a dynamic document can carry it and a server can send it:

  ```ts
  granularity?: {
    minuteStep?: number;   // must divide 60
    hourStep?: number;     // must divide 24
    windows?: readonly { from: string; to: string; minuteStep: number }[];
  }
  ```

  A window's step **overrides** the field's rather than composing with it — composition has no answer
  when 5 and 15 disagree — and a window runs from `from` inclusive to `to` exclusive, so adjacent
  windows tile with neither a gap nor an overlap to refuse.

  `validateTimeGranularity` refuses a bad declaration **by name**: a step that does not divide its unit
  (`minuteStep: 7` offers 0, 7 … 56 and then jumps four minutes, which is not the rule its author
  wrote), a window that covers no time, a window naming something that is not an `HH:MM`, and two
  windows claiming the same minutes. `explainGranularityProblem` turns each into the sentence a person
  reads.

  **Nothing is ever rounded.** A value already off the step — chosen before the rule changed, or sent
  by a server that does not share it — is kept and shown as it is, and reports invalid so `canSubmit`
  is false (ADR 0063). Stepping off it lands on an offered value _in the direction of travel_, because
  stepping is how a user leaves a value the field will not take.

  Every route into the value obeys the same rule, from one source: the face draws only offered numbers,
  the arrows move by the step, typing an off-step value is refused, and `timepickerDialPick` lands a
  dragged pointer on a number the face actually drew rather than on arithmetic of its own — so the face
  and the drag cannot disagree.

  `timepickerDialPick` answers with the value, **the number's own angle** — so a renderer rests the
  hand on what was chosen rather than under the finger — and **which ring it is on**, which is what
  lets a 24-hour face draw the difference between the outer 3 and the inner 15 when a step puts them
  at one position.

  **Breaking, both additive:** `MdyTimeFieldBounds` gains a required `step`, and `MdyTimeRejection`
  gains `"off-step"` beside `"not-a-number"` and `"out-of-range"`. A caller that constructs bounds or
  switches exhaustively on the rejection needs the new member; a caller that reads them does not.

  Absent `granularity`, every function behaves exactly as before — step 1 is every value. No renderer
  passes one yet.

- 5e31f89: A press is already a choice, and the dial's arrows obey the step

  **A tap on the dial set nothing, in Angular and in Lit.** Both emitted only on move and on release,
  so a pointer that lands and lifts without travelling produced no intent at all. On a mouse the jitter
  between press and release hides it; on a touch screen there is no movement, and that is the entire
  interaction on a phone. Plain was already correct and is what both now do: a press emits where the
  pointer is, through the same call the move uses, so the two cannot differ.

  **The dial's own keyboard restated the bounds and ignored the granularity.** `timepickerDialKeyIntent`
  carried its own `min`, `max` and wrap, so on a field offering only some times the arrows walked
  through values the face does not draw and the field would refuse — the keyboard being the one route
  that reached them. It goes through `timeFieldBounds` and `stepTimeField` now, like a segment's arrows
  and everything else. `End` answers the last value **on offer**, which is not the range's end when the
  step does not divide it: a 12-hour clock stepping by five ends at 11, not 12.

  That matters beyond tidiness. A dial is a pointer affordance, and the header's inputs are what make
  the popup usable without one — WCAG 2.1.1. If its arrows disagreed with its face, the two ways in
  would answer differently about the same field.

- b331412: A read-only segment means a read-only field, not a visible clock

  The number boxes carried `readonly` whenever the dial was the view — so a picker that opens on the
  face opened with its two keyboard-usable controls locked. That is also what produced the state class,
  which Angular emitted and Lit did not: one renderer painting a state the other never entered.

  `readonly` is a declared state of `hourControl` and `minuteControl` now, and it means what it says —
  **the field refuses edits** — rather than "the clock is showing". Both renderers derive the class
  through `stateClass` from the part that declares it, so neither writes the literal and the two cannot
  drift apart again.

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

- 9862d2f: A segment reads the numerals the field reads

  The timepicker declares that reading typed text is the host's job — _"a dependency because the reading
  is locale-aware and the locale belongs to the host"_ — and then the new segment reader tested
  `/^\d+$/`, which is `[0-9]`.

  So a host supplying a locale-aware `parseEntry` got its numerals read when the whole time was typed
  and **refused when the same numerals were typed into a box**. One library, one question, two answers,
  written a few lines apart.

  The fix is not a bigger alphabet in the regexp: this package cannot know what a numeral is anywhere,
  which is exactly why the reading is a dependency. `parseSegment` is that dependency for one bare
  numeral — a second _reading_, not a second answer, because `parseEntry` reads a whole time with the
  host's separator, ordering and AM/PM around it and a segment has none of that. A host that localises
  supplies both, in one place. Without one, segments read the digits every locale shares, as before.

  **And the renderers stop parsing their own boxes.** `type-segment` reports what was typed, as it was
  typed, and the controller decides — so the reader is reached by construction rather than by each
  renderer remembering to consult it. That is also where the padding and the refusing lived: one
  renderer reformatted after every keystroke and two reformatted the character away, which is three
  answers to "what is a half-typed number" that no longer have anywhere to be.

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

### Patch Changes

- 45720b9: The theme class audit resolves a state class composed from the contract

  `audit-theme-classes.mjs` reads renderer sources for class names as literal text. Angular writes
  `[class.mdy-input-wrapper--disabled]`; Lit stopped writing it and started composing it from
  `MDY_FIELD_STATE_CLASSES.control` and `.controlStates` — the right change, and the class is still on
  the element. Read as text it looked like a renderer that had dropped the state, so the gate reported
  **11 classes missing across 9 kinds** and punished exactly the refactor it exists to encourage.

  Confirmed at runtime before changing the gate: a disabled Lit field's wrapper reads
  `mdy-input-wrapper mdy-input-wrapper--disabled`.

  The scanner now resolves the three published base/modifier families the way it already resolved the
  chip alias — a member read off a published constant is as literal as the constant. Not an allowlist:
  eleven entries would hide the pattern, and the next renderer that does the right thing would hit it
  again.

  **What it still cannot see**, stated rather than discovered: a renderer that reaches for the family
  and then composes it wrongly. Falsified in both directions — a renderer that stops referencing the
  vocabulary is still reported (the 11 come back), and one that references it is credited with the
  whole family. A conformance check that reads source cannot see a contract being honoured _through_
  the contract, and cannot see it dishonoured there either; only a rendered DOM can.

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

- f0044c2: A ghost length CSS will actually take

  Fixing the centre opened the other end of the same guard. `pointerReach !== undefined` is true of
  `NaN`, so a malformed measurement stopped being treated as absent and started being treated as a
  number — and the result went into `--tp-ghost-reach`.

  **Non-finite is worse than wrong here.** CSS drops a declaration whose value does not parse rather
  than falling back, so the property keeps whatever it had and the hand freezes where it was. A frozen
  hand looks exactly like a hand that is tracking something. The previous guard's answer was the wrong
  length; this one's was no answer at all, delivered as if it were one.

  The reach is now checked for finiteness before it leaves, and asserted as a finite fraction in
  `[0, 1]` over every combination of inputs the signature admits — including `NaN` and both infinities
  on both parameters. Over the domain rather than at the values that broke, because this guard has now
  failed twice in opposite directions and a case-by-case check would have passed the second time.

  ADR 0121 carries it as an amendment rather than a second record: it is the same guard failing the
  other way, and splitting them would let a reader fix one and reintroduce the other. The record's
  rejected-alternatives section is corrected with it — a `null` sentinel closes none of these, because
  `NaN` is neither `null` nor `undefined`.

- 1b9ad89: A pointer at the centre is not a pointer nobody measured

  The ghost's length asked `pointerReach > 0`, which puts a pointer at the exact middle of the face in
  the same branch as a face nobody measured — and that branch answers with the **full** hand. So coming
  inward shortened the ghost all the way to a 2.5px stub and then, at the centre, jumped it back to its
  full length.

  The floor the user had removed, back in a different place: _"la fine sempre sotto il mio puntatore
  tranne quando la lunghezza eccede la circonferenza massima"_ — the centre is not the exception, the
  cap is.

  The guard now asks whether a measurement was **taken**, not whether it was non-zero. `handLength <= 0`
  is no geometry known and still answers with the full hand, because nothing better is available;
  `pointerReach === 0` is geometry known perfectly and answers `0`.

  Asserted as monotonicity over the whole radius rather than at the single point, so any later fallback
  that reintroduces the same thing at another radius fails too.

  ADR 0121 records the shape, because this is its fourth instance in one evening's work: an empty arc
  list, a `NaN` from an unresolved `calc()`, an `"outer"` from a rectangle that was never read, and now
  a real zero. Every one was silent because the wrong answer was also a correct answer to a different
  question, which is why unit tests agreed with all four.

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

- df918e6: The dead stretch across the top of the clock

  The dimmed arcs left a live-looking sliver at twelve o'clock. Two removed positions either side of
  0° — hour 11 at 330° and hour 12 at 0° — were drawn as two separate stretches with 7.4° of undimmed
  ring between them, at the most looked-at point on a clock.

  Two places asked the adjacency question and asked different things. The loop asked whether two
  removed positions were **neighbours on the full face**, which is the rule; the position at 0° has no
  predecessor in the list, so the seam was repaired afterwards by asking whether the first and last
  arcs **overlapped**. Neighbours on an hour face are 30° apart under an 11.3° half-width and can never
  touch, so that test only ever fired where nothing needed joining.

  A minute face hid it: 6° spacing under the same half-width overlaps anyway, so every declaration that
  thins minutes looked right and was right.

  The seam now asks adjacency, like the loop. Asserted generically — every pair of removed positions one
  step apart on the full face, across five granularities, three field/format pairs and both rings — so
  it holds when the arcs change shape again rather than pinning twelve o'clock.

- 22f79b3: The ring boundary is where the two digit boxes meet

  `MDY_TIMEPICKER_RING_BAND` goes back to `0.5`, and this time it is a derivation rather than a
  judgement. A digit box is `MDY_TIMEPICKER_NUMBER_SIZE` wide and the two rings are exactly that far
  apart, so the boxes touch: at a hand of 100 the inner spans 40–80 and the outer 80–120. "Midway
  between the end of one box and the end of the other" has a single answer — the point where they meet
  — and half the gap between the radii is its closed form.

  It sat at `0.35` because it was compensating for a broken measurement: `--tp-hand-length` was read
  back as an unresolved `calc()` and every renderer used half the face, 128 where the hand is 100. With
  the hand measured properly, `0.35` puts the edge at 74, so radii 74–80 sit inside the inner digit's
  own box while answering `outer` — point at the 21 and get the 9, which is the original complaint
  mirrored 6px wide.

  ADR 0120 carries the amendment. The number that was wrong is what makes the number that is right
  legible, so it is on the record rather than edited away.

- 638acb6: One edge where the two rings meet

  Which ring a press on a 24-hour face claims went through three rules, and the two that failed each
  fixed the other's defect.

  Everything inside the midpoint being `inner` meant a press aimed at the outer ring answered with an
  inner hour — most of a dial is empty middle. A symmetric band around the inner radius fixed that and
  introduced the opposite: the centre answered `outer`, so a pointer moving inward crossed
  outer → inner → outer and the hand snapped to the far ring exactly where its numbers are furthest
  away.

  It is one edge now, above the inner radius only, at `MDY_TIMEPICKER_RING_BAND` of the gap between the
  two painted radii — `0.35`, so the edge sits at 74 against digits drawn at 60 and 100. The centre and
  the inner digits answer inner; a press just inside the outer digit answers outer.

  One-sided on purpose, and it will look asymmetric: below the inner ring there is no other ring to
  belong to. Everything beneath the inner digits is nearer them than anything else on the face.

  ADR 0120 records the model and carries this as an amendment, including why the obvious geometric
  construction cannot decide the edge: the two digit boxes touch, so the midpoint of the gap between
  them is the edge itself whatever the box size.

- Updated dependencies [5262ad2]
- Updated dependencies [2dfa37b]
- Updated dependencies [841f0f9]
- Updated dependencies [53ecc1a]
- Updated dependencies [a0ab5de]
- Updated dependencies [6d90b06]
  - @modyra/core@2.4.0

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

### Patch Changes

- Updated dependencies [20c69d0]
  - @modyra/core@2.3.0

## 2.2.0

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

- 437bad1: A widget hook given its configuration as a literal at the call settles. Each hook memoized its
  controller on the configuration object's identity, so a new literal every render built a new
  controller, which resubscribed, which set state, which rendered — React reported "Maximum update
  depth exceeded" and kept going, and Preact did the same thing silently. The configuration is now
  compared by what it says (`sameControllerOptions`, published from `@modyra/widgets`), and a handler
  written at the call — a new function every render — is replaced by one stable function that calls
  whatever the latest render passed, so the controller keeps the handler it was built with and that
  handler is never stale. Memoizing the configuration still works and is still free.
- 1a8138f: `MDY_WIDGET_CONTRACT_VERSION` is 2

  Asked against the previous tag rather than the committed snapshot, this release removed
  `datepicker.actions` and `daterange.actions` and turned `multiselect.searchButton` from a `button`
  into an `input` with `role="combobox"` — four major entries — while the published contract version
  stayed at 1. A renderer written against "contract version 1" at 2.1.2 and one written against
  "contract version 1" now implement two different anatomies.

  The constant names the **anatomy**: an adapter reads it to say _"the parts I build are the parts this
  number describes"_, and it moves whenever a part stops existing, changes its element, or gains a role.
  That meaning is now written where the constant is declared rather than left to be inferred from an
  audit's `!== 1`.

  Anything pinned to `1` fails until it is re-read — which is what pinning it is for.

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

- 3bd2d09: A drag, tracked once

  The dial of a clock is turned by dragging, and that gesture cannot be tracked on the element it
  started on: the pointer leaves it immediately and the rest of the drag happens somewhere else. Every
  renderer solved that itself, and two of them solved it identically — `setupDragListeners` and
  `teardownDragListeners`, byte for byte.

  `createPointerDrag({ onMove, onEnd })` is the sibling `createLightDismiss` and `createFocusCustodian`
  already had: the plumbing of a gesture, not what the gesture means. What an angle becomes is still
  the widget's business.

  Two details in it are not cosmetic. `touchmove` is bound non-passive, because a dial that cannot call
  `preventDefault` scrolls the page under the finger instead of turning. And `dragPointOf` returns
  `null` for a touch event with no touches left — read as a point, the final `touchend` is the
  top-left corner, and a dial would jump there on release.

  Not yet adopted, and the reason is a finding rather than an omission: the third renderer listens on
  the dial face rather than on the document, so a pointer that leaves the dial stops turning it there
  and keeps turning it in the other two. That is a behaviour change, and it belongs to the batch that
  verifies one.

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

- a6dc4de: A list shows the choice it will not erase, and knows which choice it is

  Three defects across `createSelectController`, `createMultiselectFieldController` and
  `createOptionFieldController`, all landing on the same user: someone picks a customer, the list
  refetches without them.

  **The index collapsed for object values.** Both list controllers defaulted `keyFor` to
  `String(option.value)`, and `String({id: 1})` is `"[object Object]"` — as is every other object:

  ```js
  asked for { id: 1 }  →  held { id: 3 }
  asked for { id: 2 }  →  held { id: 3 }
  ```

  Not a failure to select — selecting the wrong thing, silently, while staying internally consistent.
  The default now keys a plain object by **what it holds**, the same rule `oneOf` uses. Primitives and
  arrays key exactly as before, because keys are consumer-visible: they become part ids and land in
  `aria-activedescendant`. `defaultOptionKey` is exported from the package root, so a consumer writing their own `keyFor` has the default to fall back to.

  **The survivor was unreadable.** A kept value was labelled `String(value)`, so an object read
  `[object Object]` — worse than clearing, because it looks like a value and gives nothing to act on.
  The controller now remembers the label each key was last painted with, so a refetch that drops Ada
  leaves _Ada_ on screen. `optionsWithUnrecognizedValue(s)` takes an optional `labelFor`.

  **The survivor had no part.** Both views built option parts from the _declared_ list while their own
  state contract says a renderer paints the painted one — so the single entry a user needs in order to
  replace their value rendered with no id, no `role="option"` and nothing `aria-activedescendant` could
  point at. Parts now come from the painted list.

  **A radio group follows the same rule now.** It painted nothing for a value its list did not offer,
  which left an unanswered question that has an answer, submitted unseen — and unlike a select it has
  no trigger to show the value in. A radio group holding an unrecognised value now renders an option
  for it, and `selectedKey` resolves where it previously read `null`.

  Recorded as [ADR 0054](https://github.com/modyra/modyra/blob/main/docs/architecture/0054-a-list-shows-the-choice-it-will-not-erase.md).
  Found by `battle-tests/adversarial/collections/`.

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

- 501dbb2: A multiselect's popup carries the role its opener promises

  Declaring the promise was half the answer. `MDY_POPUP_OPENERS.multiselect.promises` says `dialog`,
  and `MDY_WIDGET_CONTRACTS.multiselect.parts.popup` declared **no role at all** — so no renderer
  emitted one, nothing on screen answered to what the opener announced, and a person told "combobox,
  has popup dialog" got a `group`.

  That it failed identically in both renderers is what says this was the contract still being silent
  rather than a renderer being careless.

  The kind now declares `roles: { popup: "dialog" }`, and its projection reads the role from the
  catalogue instead of restating it. The popup is:

  - **named**, by the field's label — a dialog without an accessible name is a region an assistive
    technology cannot introduce;
  - **not modal**, deliberately. The panel is anchored to its field and the page behind it stays
    reachable, so `aria-modal` would say the opposite of what dismissal does.

  ## Migration

  **`MDY_WIDGET_CONTRACT_VERSION` moves from 2 to 3.** ADR 0084 puts a part gaining a role in the set
  that moves the number, and `contract:diff` classifies it major for the reason the number exists: a
  renderer built against 2 emits that panel with no role, which was conforming under 2 and is not
  under 3.

  **If you maintain a renderer**, add the role to the multiselect popup and name it. Take both from the
  projection rather than writing them out — `projectMultiselectFieldA11y(…).popup.attributes` now
  carries `role` and `aria-labelledby`, and a literal is how the promise and the popup came apart in
  the first place. Then re-pin whatever asserts the contract version.

  **If you only consume the tables**, nothing breaks: `MDY_WIDGET_CONTRACTS.multiselect.parts.popup.role`
  returns `"dialog"` where it previously returned nothing.

  `@modyra/plain` is updated. `@modyra/lit` builds this panel by hand and still drops the projection's
  attributes, so its multiselect stays non-conforming until it takes them.

  See ADR 0110, amended.

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

- 4d4110b: A radio group no longer declares Home and End

  `MDY_WIDGET_KEYBOARD` gave every kind that navigates options four `move` bindings — the two arrows,
  `Home` and `End`. `radio` and `segmented` are the only members with no overlay, so theirs were the
  only `Home` and `End` that landed as closed-state bindings, and a browser sweep pressing them found
  that nothing happened.

  `Home` and `End` jump to the first and last option, which is the listbox pattern and the grid
  pattern. A radio group is neither: the APG gives it Tab, Space and the four arrows, and its arrows
  both move and select, so there is no separate reading position for a jump to land on.

  **Nothing implemented it.** `@modyra/plain`, `@modyra/lit` and `@modyra/angular` all omit it
  independently — one oversight made three times, read as a defect; one rule applied where it does not
  belong, read as a contract error.

  The condition is asked of the catalogue rather than of a second list: a kind declaring a part with
  `role="radiogroup"` gets the arrows and not the jumps. The arrows are untouched.

  ## Migration

  **Four bindings leave the public contract**, which `contract:diff` classifies major. Nothing
  implemented them, so no renderer changes and no user loses a key that worked — but the declaration was
  public and its removal is a break.

  If you build a radio group from `MDY_WIDGET_KEYBOARD`, you now implement two fewer keys. If you had
  implemented `Home` and `End` there anyway, keep them: the table is a floor for implementers, not a
  ceiling.

  **`MDY_WIDGET_CONTRACT_VERSION` does not move.** It names the anatomy — a part existing, its element,
  its role — and a key binding is none of those. ADR 0021 withdrew eight bindings on the same footing.

  See ADR 0112.

- af002ed: The kind that had no controller, and what it cost

  `daterange` was declared in the catalogue and served by nothing, so each renderer built its range
  picker by copying its own datepicker. The intra-package check measured the result: **21 duplicated
  bodies across three packages, 17 byte-identical** — month navigation, year and month drill-down,
  disabled-month tests, and the three questions a range cell has to answer.

  Those three are the point. _Is this cell the start, is it the end, is it between them_ — answered
  three times, and one renderer answered the last by comparing ISO strings where the others compared
  dates. They are answered here once, against the range being **previewed** rather than the one
  committed, because that is what a person looks at while picking.

  `createDaterangeFieldController` owns what a range adds over a date:

  - **a draft.** The first pick opens a range and commits nothing; the second closes it and commits.
    Closing on half a range keeps what the form had, which is why the draft is separate from the value.
  - **a preview.** While the end is open, the cell under the pointer stands in for it — and the
    keyboard previews the same way, or someone navigating with arrows picks the second end having never
    seen the range they are making. A preview is not a decision and never reaches the form.
  - **ordering.** Picking right to left is the same five days, not an empty range.

  `projectDaterangeFieldA11y` gives each end its own accessible name: two boxes under one label are two
  boxes a screen-reader user cannot tell apart, and the field's own label twice does not answer "which
  end am I in". The opener carries the combobox semantics, not the inputs — one overlay serves both.

  No renderer consumes it yet. Adopting it changes what a renderer draws, which belongs to the batch
  that verifies a visual change; the adoption gate now lists all three as offered and not consumed.

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

- 70220fc: A state belongs to something that can be in it

  `aria-invalid` and `aria-required` describe a value. A `role="button"` has none, so an assistive
  technology has nothing to attach the claim to and drops it: the state is not reported wrong, it is
  absent.

  Swept across all seventeen kinds in both renderers, one kind carried them where they could not be —
  the multiselect. `MDY_POPUP_OPENERS` declares `role: "combobox"` for `select`, `datepicker` and
  `timepicker`, and declared nothing for `multiselect`, so its opener was a bare `<button>` wearing
  `aria-expanded`, `aria-invalid` and `aria-required`. Every other kind was clean in both renderers,
  which is what places the cause in the contract rather than in a renderer's habits.

  The multiselect's opener is now a combobox: it holds the field's value, the label points at it, and
  all three states are legitimate on it. `searchButton` is an `input` in the semantics table rather than
  a button — the multiselect has no typeable control, so this is the control. The opener projection's
  **role** now reaches the part contract as well as its attributes; spreading only the attributes is how
  a correct declaration produced markup that was not.

  `@modyra/lit` also put the same pair on the `role="group"` box around the chips. A group describes what
  it holds, not a value; it keeps its label and its description and nothing else.

  Anything selecting on `[role="button"].mdy-multiselect__search-btn` stops matching. The opener stays in
  the class list a theme sizes hit targets with — `trailingAffordances` keyed on the element being a
  button, and now also takes an opener drawn inside the field's header.

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

- b1a31dd: A widget announces only the states it has

  `MDY_WIDGET_STATE_SUPPORT` says a checkbox, a radio group and a range have no read-only rendering —
  "either operable or disabled" — and three projections announced it anyway:

  ```
  checkbox   aria-readonly="true" AND native readonly
  radio      aria-readonly="true" on the group
  daterange  native readonly on both controls
  ```

  The checkbox is the one that cost something. HTML **ignores** `readonly` on a checkbox, so a renderer
  binding it bound nothing and the box still toggled, while `aria-readonly="true"` told a screen-reader
  user it could not be changed. The halves failed in opposite directions.

  `readonly` is gone from those three, in both halves. The kinds whose contract declares it — text,
  email, password, textarea, number — keep both, pinned so a later fix cannot sweep them in. A form that
  means "this cannot be changed" on a checkbox says `disabled`.

  **`aria-checked` now holds one of the three values the standard allows.** It was
  `String(state.checked)`, so a state carrying `undefined` produced `aria-checked="undefined"` — a value
  that maps to nothing in any assistive technology, on the single attribute that says whether the box is
  ticked. `mixed` is deliberately not produced: `checked` is a boolean and no field in the engine has an
  indeterminate value.

  A theme selecting on `[aria-readonly]` for a checkbox, radio group or range will stop matching. The
  widget contract itself is unchanged — 17 kinds, version 1.

  Found by `battle-tests/adversarial/accessibility/undeclared-states.battle.test.mjs`. Recorded as
  [ADR 0052](https://github.com/modyra/modyra/blob/main/docs/architecture/0052-a-widget-announces-only-the-states-it-has.md).

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

- 5165a7b: A widget id may not contain whitespace

  `isValidWidgetId` refused an empty id and one containing the delimiter, and accepted `"my form"`.
  `aria-labelledby` and `aria-describedby` are space-separated **lists**, so a widget id with a space
  in it makes one reference into several:

  ```html
  <input aria-labelledby="my form__label" />
  <!-- read as `my` and `form__label` -->
  ```

  Each resolves to nothing anyone rendered, so the control has **no accessible name**.

  `for` is not affected: it compares a single id as one string, so the label still finds its control —
  measured, not assumed. That makes the failure harder to find rather than easier: the association
  survives, the label sits visibly beside the field, and the control announces nothing. It is the
  failure the delimiter rule already prevents, arriving through a character nobody thought of as
  structural.

  The guard now refuses any ASCII whitespace, which is the HTML rule written from the other side — and
  the **part-id builders refuse it too**, throwing where the ids are built. A predicate only protects
  the renderers that remember to call it, and this package is the surface third-party renderers are
  built on. `assertUsableWidgetId` is exported so a renderer can make the same refusal at its own
  boundary.

  `defaultWidgetIdFactory` is deliberately unchanged and still joins what it is given: it is a
  replaceable primitive documented as deterministic and reversible, and something constructing ids
  speculatively is entitled to use it.

  Nothing is repaired silently. An id is consumer-visible, so rewriting `"my form"` into `"my-form"`
  would change what a host's own tests, stylesheets and selectors look for. `@modyra/plain` already
  refused an invalid `idPrefix` at mount and now refuses this one too.

  Recorded as [ADR 0053](https://github.com/modyra/modyra/blob/main/docs/architecture/0053-a-widget-id-is-refused-where-it-is-used.md).

  Found by `battle-tests/adversarial/accessibility/whitespace-in-ids.battle.test.mjs`.

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

- 1aff75a: An empty date field can be asked whether its value is in range

  `dateWithinBounds(null, …)` raised `TypeError: Cannot read properties of null (reading 'slice')`.
  `MDY_VALUE_CONTRACTS` declares `datepicker` and `timepicker` nullable, so `null` is not hostile
  input — it is what the field holds before the user picks, and what a host reads off the field to grey
  a calendar.

  It answers `false` now: the question is "may I pick this", and nothing is not a date within any
  bound. Everywhere else in the engine emptiness is answered rather than refused, and this was the one
  place where asking about the field's commonest state ended the frame.

  The parameter type widens from `string` to `string | null | undefined`, which is why this is a minor
  rather than a patch: the function accepts more than it did, and every existing call still compiles.

  Found by `battle-tests/adversarial/localization/date-bounds.battle.test.mjs`.

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

- 8d0cadf: `comparableControllerOptions` and `stableControllerOptions` are published beside
  `sameControllerOptions`, and the two hook-shaped adapters read them instead of each keeping a copy.
  The rule for turning a configuration written at the call into one a controller can be memoized on is
  one rule — what to compare, and what to do with handlers — and two copies of it are two answers
  waiting to drift.
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

- e2828ed: Four Angular renderers stop deciding what their controller already decides

  Checkbox, toggle, radio and segmented drew their own conclusions from the field
  while the controllers for their kinds sat unused. They now send their intents
  through `createBooleanFieldController` and `createOptionFieldController`, which
  own what an interactivity state blocks, when a value becomes dirty, and what the
  projection then says.

  `MdyOptionFieldController` gains `setOptions`. The list was fixed at
  construction, which suits a renderer reading a document and not one whose
  options are an input that can change; rebuilding the controller instead would
  forget which option the keyboard was on, so a list reordering under an open
  group would drop the roving focus.

  **Nine renderers were telling the projection they draw a text field.**
  `widgetKind` was typed `string` and defaulted to `"text"`, and colors,
  daterange, file, multiselect, radio, segmented, select, slider and timepicker
  never said otherwise. The kind decides which native constraints a control can
  carry, so a slider offered `maxlength` and no range. Each renderer now names its
  kind and the field is typed `MdyWidgetKind`, which makes a wrong one unspellable.

  The slider's own narrowing moves from `[min]`/`[max]`/`[step]` in the template to
  `narrowedConstraints()`, the channel ADR 0030 established for it: the projection
  places those attributes, and a template writing them too leaves two answers whose
  order decides which one the user gets.

- ee8040c: The token that means any file takes any file, and a file field holds a list

  Two defects in one function, and the second is why the first was silent.

  **`accept="*/*"` — and a bare `*` — rejected everything.** They took the wildcard branch, which asks
  whether a file's type begins with `*/`, and nothing does. Measured in a page: a file field with that
  token takes a PNG, the model stays `[]`, and the field reads "No file selected". The most permissive
  value a form can declare was the only one that accepted nothing. `image/*`, `.png`, an exact type and
  no accept at all were all correct.

  **`fileSelectionTransition` returned a bare file when `multiple` was false.** `MDY_VALUE_CONTRACTS.file`
  declares `file[]` and is not nullable, so that shape is one the engine's own `matchesValueShape`
  refuses — a single-file field was invalid for _every_ file a person could choose, in any renderer that
  did not wrap the value on its way past. `@modyra/plain` wrapped it and never saw it; `@modyra/lit` did
  not and showed "This field holds file[]" for every choice.

  The transition now always answers with a list. `MdyFileSelectionTransition.value` narrows from
  `TFile | readonly TFile[] | null | undefined` to `readonly TFile[] | null | undefined`: a consumer
  reading it as a single file must read `value[0]`. What `multiple: false` narrows is how many
  candidates are accepted, which `accepted` already carried — not what the field holds.

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

- 7f738dd: Both remaining range pickers consume the controller for their kind

  Each held the whole of what a range means in its own state — the draft, the
  preview that follows the pointer, which pick opens the range and which closes it,
  the month on screen, the focused cell, the view — and decided every one of them
  for itself. The framework-free renderer had already stopped; these two were
  waiting on the view mode reaching the contract, and on the modal variant giving
  up its draft.

  The Lit component sheds nine reactive properties and subscribes through
  `subscribeController`, which existed for exactly this and had no consumer. The
  Angular calendar takes the controller as an input and keeps its own signals only
  for the standalone case, since it is public and mountable without a form.

  `MdyDaterangeFieldController` gains `setBounds`, the twin of the datepicker's:
  bounds move when a return date cannot precede a departure, and rebuilding the
  controller to carry that would forget the month on screen and which end the next
  pick closes.

  Intra-package duplication falls from 18 pairs to 11 — the seven that go are the
  calendar navigation each renderer had written twice, once for its date picker and
  once for the range picker copied from it.

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

- 0956768: Three widget runtimes answer about the moment they run in, not the one they were built in

  **Focus lands on the element the host rendered.** `createCommandRuntime` defers focus and scroll until
  after the host has rendered — because the render is what may replace the element — and then acted on
  a node it had resolved _before_ the render:

  ```
  close-overlay + restore-focus  →  the trigger is resolved
  the host renders, replacing it →  the resolved node leaves the document
  the microtask drains           →  focus() on a detached node
  ```

  A detached `focus()` is a silent no-op: no error, no warning, and the only symptom is a keyboard user
  quietly returned to the body. The deferred work now carries the **target** and resolves it again
  after the render. A target that no longer resolves is left alone, so a trigger that was removed
  outright still leaves focus on something the document contains.

  `MdyWidgetCommandContext.scheduleFocus`/`scheduleScroll` receive the target as a second argument. A
  caller that acts immediately can keep ignoring it.

  **A drag asks for the document when a gesture needs one.** `createPointerDrag` resolved it once at
  construction, so a controller built before a document existed stayed bound to nothing for its whole
  life — `bind()` returned immediately every time while `start()` still set `dragging`. A slider in
  that window never drags _and reports that it is dragging_. The window is the one
  `browserRuntimeCapabilities` probes on every call rather than once at module scope, and
  `options.document` widens it: a host in an iframe or a popup is exactly where the document arrives
  after the controller is made.

  **Typeahead and search compare text that reads the same.** `É` has two encodings — one code point, or
  `E` plus a combining acute — that render identically, and the two sides arrive from different places:
  labels from a CMS, an API or a file listing (macOS decomposes), keyboard input composed. So typing
  the accent visible on screen emptied the list. Both comparisons normalize to NFC.

  Deliberately **not** accent folding: `e` stays a different letter from `é`, so `resume` and `résumé`
  remain different options. Two spellings of the same character are the same character; that is all
  this claims.

  Found by `battle-tests/adversarial/accessibility/deferred-focus.battle.test.mjs`,
  `.../interaction/pointer-drag.battle.test.mjs` and `.../localization/typeahead-normalization.battle.test.mjs`.

- 324d2aa: Scrolling and resizing are not the same question

  `trackAnchoredOverlay` took one callback and two renderers could not use it.
  Both had drawn the distinction it was missing: a page that scrolls moves the
  anchor, so the popup follows keeping the side and height it opened with —
  re-deciding on every scroll frame is what makes a popup flip sides under the
  pointer — while a viewport that changes size changes what fits, so there the
  placement is decided again. A function written to end three copies was the one
  thing none of the three could adopt.

  It now takes `{ reposition, reflow?, isOpen, followsScroll? }`. `reflow` defaults
  to `reposition`, which is what the framework-free renderer passes because it
  re-decides on every reposition anyway. `followsScroll` exists because an overlay
  covering the viewport hangs off no control, and binding a capture-phase scroll
  listener for it is cost with no effect.

  Migration: `trackAnchoredOverlay(reposition, isOpen)` becomes
  `trackAnchoredOverlay({ reposition, isOpen })`.

  The Lit select stops answering its own keyboard. Its local switch differed in
  ways nobody chose: an arrow on a closed list moved an active option no one could
  see instead of opening it, `Tab` left the list floating over a form the user had
  already left, and a focused search field did not change what `Home` meant.

  A multiselect whose field has never been set reads as empty rather than throwing.
  A registry-backed control starts at null, and the controller assumed a list.

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

- 61b5b04: `messagesForLocale` — which words a locale gets, decided once

  The message tables were keyed by primary subtag and nothing turned a locale tag
  into one. Every renderer that wanted to translate had to parse `it-IT` itself,
  which is three answers to "what does `pt-BR` get" waiting to happen.

  `messagesForLocale(tag)` takes a tag in any case, matches on the primary subtag
  because a region does not change what a confirm button says, and falls back to
  English rather than to blanks.

  It does not yet have a consumer: the framework-free and Lit renderers still
  hardcode English, and this is the piece they were missing.

- d1733cb: Names that tell the truth, and one home per rule

  **The overlay had two homes.** `MDY_OVERLAY_GAP` was in `overlay.ts`,
  `MDY_OVERLAY_VIEWPORT_MARGIN` in the geometry module beside it. Two constants that govern the same
  decision have to be read together or they are not a rule; the geometry and the anchoring that reads
  it are one file now.

  **The package's two hubs no longer import each other.** `contract.ts` and `structure.ts` each took
  one thing from the other, and neither could be read or extracted alone. `MdyPartMap` — a record of
  `MdyPartContract` — moved beside the thing it is a map of, which was the whole cycle.

  **The text family is called what it is.** `createFieldController` serves text, email, password,
  textarea, number and slider; calling it and its projection `field-*` meant a reader looking for the
  text field did not find it, and a reader looking for the base every kind shares found a text field.
  Renamed to `createTextFieldController` / `projectTextFieldA11y` / `MdyTextField*`.

  `MdyFieldState` deliberately keeps its name. It is genuinely the base — value, invalid, disabled,
  interactivity, touched, dirty, pending — and every kind's state is that plus what the kind adds. What
  was text-specific were the _options_ and the _intent_, which carry `inputType`, `inputMode` and
  `autocomplete`; those moved to `text-field-types.ts`.

  **Two files named for what they were not.** `timepicker-field-types.ts` held two hundred lines of
  dial geometry, keyboard policy and ARIA — now `timepicker-dial.ts`. `slider-field-types.ts` declared
  no type at all: its one function lives with the controller that serves sliders.

  Migration is a rename with no behaviour change:

  | before                                                                 | after                                       |
  | ---------------------------------------------------------------------- | ------------------------------------------- |
  | `createFieldController`                                                | `createTextFieldController`                 |
  | `projectFieldA11y`                                                     | `projectTextFieldA11y`                      |
  | `fieldPartIds` / `fieldRootClasses`                                    | `textFieldPartIds` / `textFieldRootClasses` |
  | `MdyFieldController`                                                   | `MdyTextFieldController`                    |
  | `MdyFieldControllerOptions` / `MdyFieldIntent` / `MdyFieldA11yOptions` | `MdyTextField…`                             |

- 8478a18: Every kind has a controller, and no module has two jobs

  **The three kinds that had none.** `daterange` shipped last; `colors` and `file` land here. Each was
  wired by hand in every renderer from loose transitions, and what the transitions never carried is the
  state around them — which is where each renderer made its own decision:

  - **colours** keep the text being typed apart from the value being held. `#0` is three keystrokes
    from a colour and must survive being typed; committing would store black and rejecting would take
    the half-written value away from the person writing it. A preset closes the overlay because
    choosing one is an answer; typing does not.
  - **files** keep what a selection _refused_. A field that drops candidates silently leaves someone
    looking at a list missing the file they just chose, with nothing to explain it. `dragover` is a
    state the contract declares, so it belongs to the widget rather than to whichever renderer
    remembered to track it — and a field that cannot take a drop never lights up.

  **`behavior.ts` and `catalog.ts` are no longer one file each.** 800 lines and ≥10 unrelated domains
  became ten modules; 800 lines of vocabulary, builder, four side tables, semantic map and seventeen
  definitions became four. Both barrels re-export, so the surface did not move — and the catalogue's
  barrel is a named list rather than a wildcard, because splitting a file must not publish what it used
  to keep to itself.

  **The select is bound to a form like every other kind.** `createSelectFieldController` reads a field
  handle; the standalone controller stays for a host with no form, which is the case it was written
  for. The verdict rule arrives with the binding: `invalid` was a boolean a caller passed, so a select
  was as right about a disabled field as whoever wired it happened to be.

  Also: `projectSelectA11y` is exported — every other kind published the function that turns its state
  into ARIA, and this one published only the shape, so a renderer wanting its own select had to rewrite
  it. Its eight hand-spelled class modifiers now derive from the declared state vocabulary. The
  reconciliation module moved to neutral ground, closing the two-way import between `field/` and
  `select/`. The select's conformance fixtures left the runtime entry for `./testing`, where they stop
  shipping in a consumer's bundle.

### Patch Changes

- 61e814c: Unselecting a multiselect choice unselects it

  `option[]` is a multi-set on purpose — `MDY_CHIP_CLASSES` carries `counter`, `count` and `step` for a
  chip that raises and lowers a quantity — and the two presses mean different things:
  `multiselectValueTransition` removes **one** occurrence for `decrement` and **the option** for a
  toggle.

  The controller reimplemented the toggle and spliced one occurrence out. A value of `["a","a","a"]`
  took three presses of a chip that shows no count to clear, and after the first press the chip was
  still selected with two held:

  ```js
  multiselectValueTransition(["a", "a", "a"], { type: "toggle", value: "a" }); // []       the contract
  controller.dispatch({ type: "toggle", optionKey: "a" }); // ["a","a"] what happened
  ```

  It also compared by identity while the rest of the widget keys an option by what it holds
  ([ADR 0051](../docs/architecture/0051-an-option-is-recognised-by-what-it-holds.md)), so an object
  option could never be switched off at all.

  The controller now goes through the published transition. `increment` and `decrement` are unchanged —
  a counter chip still steps a quantity one at a time.

- a76fc10: `colorValueEquals` answers when either colour is missing

  The left side was guarded (`left ?? ""`) and the right was not, so comparing against a colour nobody
  has chosen threw a `TypeError` — including the easiest case, where neither side is set. Both sides
  now accept `null` and `undefined`: two absences are the same colour, one absence is not the colour
  opposite it.

- 9b89cd2: A disabled widget can still be left, and is not left holding an overlay

  `createCatalogWidgetController` guarded every intent behind `if (value.disabled) return []`. That is
  right for intents that _start_ something and wrong for `close`, which ends something already
  happening:

  ```js
  dispatch({ type: "open" }); // open: true
  dispatch({ type: "disable", disabled: true }); // open: true, disabled: true, no commands
  dispatch({ type: "close" }); // no commands — still open
  ```

  Every route out of an overlay goes through `close` — Escape, a click away, choosing an option — so a
  field disabled while its picker was open became a popup over a control that no longer responded,
  unleavable until something re-enabled the field. Ordinary rather than contrived: a form disables a
  field because a dependent value changed, and the user has the picker open at that moment because
  that is what they were doing when it changed.

  Two things change, which are one rule — a disabled widget is not operable and does not hold an
  overlay:

  - `close` passes the guard, whatever left the widget open;
  - `disable` closes what is open, emitting `close-overlay`. Disabling a _closed_ widget stays silent,
    so no renderer gets a command on every disable.

  **A destroyed controller answers without acting**, the rule the form engine already holds: `destroy()`
  was an explicit no-op, so a torn-down widget still handed its renderer `close-overlay` for elements
  that were gone. State stays readable, like a destroyed form's value.

  Found by `battle-tests/adversarial/lifecycle/catalog-controller.battle.test.mjs`.

- 111aa5b: A field that leaves play takes its overlay with it

  A field can leave play while its popup is open without anybody clicking anything — a document's rule
  takes it out when another field changes — and nothing happened: the calendar stayed on screen, the
  opener kept reporting `aria-expanded="true"`, and every cell in it still looked like a date somebody
  could pick. Clicking one correctly did nothing, which is what made it a control that looks live and
  answers nothing.

  The overlay-bearing controllers now watch their own handle and close when the field is disabled.
  Read-only is untouched: a value you may read is one whose popup may stay open. ADR 0093.

- aa09065: An option list carrying an inherited name — `__proto__`, `constructor` — draws. The per-option
  parts a controller publishes were accumulated in a plain object, so assigning the part for an option
  valued `__proto__` set that object's prototype instead of adding a member: the part vanished, the
  renderer was handed `undefined`, and the control disappeared from the page mid-draw with an uncaught
  error in an effect. The accumulator has no prototype for such a name to reach, in the select, the
  multiselect, the option field and both calendars.
- 1b24d8f: Replacing a select's options tells whoever is drawing it, and clears a keyboard pointer the new list
  no longer has. The declared list was rewritten in place, so the signal holding it published the same
  array it already held and nothing was told: `setOptions` — the only published route for changing what
  a select offers, called precisely when options have just arrived — left the old ones on the page
  until something else redrew it. And `aria-activedescendant` kept naming the option that left, so a
  screen reader was pointed at an element no longer in the document until the next keystroke.
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

- ecee2fd: A picker opens on the time the field holds, and a step lands where the step says

  **The timepicker replaced a value it could not parse.** `parseAnyTime` is strict per format — a
  `"12h"` picker reads `"10:37 AM"` and not `"10:37"` — so a value in the other notation parsed to
  nothing and the draft became the **current wall-clock time**, which confirm then wrote:

  ```
  field "10:37", 12h picker  →  dial shows now  →  confirm writes now
  ```

  The user opened a field already showing a time, saw a different one, and pressed the button the dial
  is for: the ordinary action lost the value while cancelling preserved it. Reachable from a draft
  written by a `"24h"` build, from an API, a patch, or a hand-written document — the value contracts
  say nothing about notation.

  Both notations are read now, and the field's format decides only how the value is written back. That
  last part is a representation repair, the same shape as replacing a loosely-matched option value with
  the option's own: **the time is preserved, its notation is normalised**. An empty picker still opens
  at the current time, which is what every picker does and what a heavy-handed fix would take away.

  **The stepper drifted off its own step.** `0` stepped up by `0.1` five times gave
  `0.1, 0.2, 0.30000000000000004, 0.4, 0.5`, and a price, a rating or a weight steps by a fraction. That
  value is what the field shows and what the form submits: it fails a `multipleOf` rule and is not
  equal to the `0.3` a server compares against. `<input type="number" step="0.1">` snaps to its step,
  and this widget stands in for that control.

  A stepped value is rounded to the step's own decimal places — a whole-number step leaves large
  integers exactly as they are.

  Found by `battle-tests/adversarial/interaction/`.

- e35174d: Every published `MDY_*` constant is frozen all the way down

  Twenty-two of the thirty-six already were; sixteen were not, and five of those were frozen on the
  surface only — an array frozen around live objects is a table anything sharing the page can rewrite
  one entry at a time. The kind lists, the diagnostic table, the icon geometry, the four locale message
  tables and the widget relation, transition and keyboard tables are now frozen at every level, with
  `Object.freeze` written where the value is built rather than through a new shared helper.

  Nothing in this repository mutated any of them, and the documented way to change UI strings is
  `provideModyraLocale(locale, { overrides })` or a table of your own — so nothing documented is taken
  away. `contract:diff` and `test:type-surface` are unmoved, which is what says no `as const` was lost.

- 9fc24f7: The state matrix inspects unsupported ARIA in the states a widget _is_ in

  `collectStateMatrix` asked `inspectUnsupportedStateAria` only in its second pass — the default state
  and the states a kind does not declare. A projection that emits a forbidden attribute
  unconditionally was caught there; one conditioned on a state the kind _does_ declare
  (`state.readonly ? "true" : null`) was absent everywhere that pass looked, and the loop that drives
  the declared states never asked. Which is the shape a real defect had.

  The check now runs after every drive, so between the two passes every state a kind can reach is
  inspected. No adapter in this repository changes verdict; a renderer outside it may start reporting
  a kind it was announcing for.

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

- 136fd3a: An intent a controller does not know does not take the host down

  A controller handles the intents its kind has — a text field has no popup, a checkbox no step, a
  select no cancel — and one it does not know answers with `undefined` rather than an empty list. The
  headless recipe feeds `dispatch` straight into `execute`, in the two lines it calls _"the only two a
  wrapper does for you"_, so `commands is not iterable` reached a host driving every widget from one
  generic handler — which is the reason to go headless in the first place.

  `execute` and `processWidgetCommands` now take nothing as nothing to do. An intent nobody declared is
  the same class of input as an operator nobody declared, and gets the same answer: it decides nothing
  instead of raising.

- 611fd20: An option whose value is an object is the same choice when it comes back as a fresh object — which is
  what a restored draft, a refetch and an import all produce. The reconciler compared object values by
  reference, so a select showing two options rendered three: the same customer twice, once by its label
  and once by its own JSON, with both entries sharing the key a part id and `aria-activedescendant` are
  built from. Objects are compared by the key an option is identified by, which is the rule `oneOf` and
  `defaultOptionKey` already use (ADR 0051). Primitives are unchanged, and a value the list genuinely
  does not hold is still kept and still shown.
- 1b24d8f: A file-rejection message renders whatever it is given rather than raising. Every language's
  `fileRejected` called `.join` on its argument, so a host calling the message directly — a log line, a
  translation check — got a `TypeError` and a control with no text at all, in that language only.
- d522e25: A widget that has handed focus back does not take it again

  `createFocusCustodian` restores focus to what the widget borrowed it from. A widget that closes and
  is then disposed calls `restore()` twice, and the second call found nothing remembered and fell
  through to the first focusable inside the widget:

  ```js
  custodian.remember(); // the trigger holds focus
  inside.focus(); // the widget takes it
  custodian.restore(); // → trigger, correctly
  custodian.restore(); // → inside — focus pulled back into the closing widget
  ```

  The custodian now tracks whether it is holding focus it borrowed, which is a different question from
  whether it holds a remembered element: a widget that opened while nothing was focused has still
  borrowed focus, and one that has already given it back owes nothing. A `restore(preferred)` naming an
  element is always honoured — that is the caller placing focus, not asking for what was borrowed.

  `release()` now ends the borrow rather than only forgetting the remembered element: a restore after
  it places no focus and returns `null`. The workspace's one caller releases at destroy, which is what
  the method is for. A consumer that released and relied on the next restore to place focus inside the
  widget names the target instead — `restore(preferred)` is honoured whether anything is borrowed or
  not.

  While the borrow is live and the remembered owner has left the document, the fallback inside the
  widget is unchanged: somewhere real beats nowhere, and that is the case it was written for.

  Recorded as [ADR 0049](https://github.com/modyra/modyra/blob/main/docs/architecture/0049-a-released-custodian-owes-no-focus.md).

  Found by `battle-tests/adversarial/lifecycle/focus-custodian.battle.test.mjs`.

- f207e5e: `MDY_FORM_SHELL_STRUCTURE` publishes its declared type

  Its two nodes have different shapes — one names a parent, the other does not — so an inferred type is
  a union of two object literals with optional members, and the two TypeScript implementations write
  that union's members in different orders. The emit-equivalence gate reported the difference.

  The constant is annotated as the `MdyWidgetStructure<MdyFormShellPart>` it already is, so the emitted
  declaration is the same from either compiler. A consumer reading `part` off a node now sees
  `MdyFormShellPart` rather than the literal of that position.

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

- e6ca669: Two controllers stopped keeping a copy of their own value

  `createOptionFieldController` seeded `selectedKey` from the handle and wrote it
  beside every commit; `createColorsFieldController` did the same with `text`.
  Neither carried information the value did not — selecting always writes both —
  but both could disagree with it: a value written from anywhere else (a draft
  restored, a server response, `patch()`) left the state reporting the live value
  beside a stale copy, and the option field decides which radio is checked from the
  copy. The key is derived now, and the colour's box shows the value except while a
  keystroke is on its way to being one.

  `packages/widgets/test/state-follows-its-handle.spec.mjs` is the property that
  found them: build a controller, write the handle from outside, and check that
  every part of the state derived from the value followed. It runs over seven kinds
  and the eighth arrives already covered.

  The Angular calendars share `calendarViewState`. Both are public and mountable
  without a form, so both need the signals that answer when no controller does —
  and written in each, the two were identical, which the similarity gate said the
  moment the single calendar adopted its controller. What differs between a date
  picker and a range picker is what a _pick_ means, never which month is on screen.

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

- 1aff75a: The state matrix drives the states a widget does not declare, and finds what they announce

  `collectStateMatrix` drove each kind through `MDY_WIDGET_STATE_SUPPORT[kind]`, then made one more
  pass — its own comment calls it "about the states a widget is _not_ in" — that mounted a fresh
  fixture and inspected it with **nothing driven**.

  So the check caught a projection that emits a forbidden attribute unconditionally, and could not
  catch the shape the defect actually has: `state.readonly ? "true" : null`, absent until a consumer
  sets a state the kind does not declare — which is what a consumer does the moment a form has a
  read-only mode. Three adapter suites asserted `matrix.unsupportedAria` was empty and all three were
  green while a checkbox announced `aria-readonly`.

  The pass now drives each kind into every state it does _not_ declare, mounting fresh for each one so
  an attribute left by an earlier drive cannot answer for the next.

  **It found one immediately.** `@modyra/plain` exposed `aria-readonly` and native `readonly` on every
  slider: a slider is structurally a numeric field and is drawn by `projectTextFieldA11y`, which
  announced read-only because of the file it lives in rather than because of the kind it was drawing.
  That projection now asks `widgetSupportsState` — the state belongs to the kind, not to the function.
  A kind this contract does not know keeps what it had.

  Found by `battle-tests/adversarial/accessibility/state-matrix-blind-spot.battle.test.mjs`.

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

- 2cbfb3f: Two option values never make one id, and an opener promises what opens

  **Every whitespace character was written as `%20`.** `idSafeKey` percent-encodes an item key because
  an option valued `New York` would otherwise split every ARIA reference built from it — but one
  sequence served all five characters, so three distinct values collapsed onto one id:

  ```
  "a b"   ->  w__option__a%20b
  "a\tb"  ->  w__option__a%20b
  "a\nb"  ->  w__option__a%20b
  ```

  The browser accepts duplicate ids without complaint, so `getElementById`, `label[for]` and every ARIA
  IDREF resolve to whichever element the document reaches first, and `aria-activedescendant` points a
  keyboard user at the wrong option. A tab or a newline inside an option's value is what a paste from a
  spreadsheet produces — the ordinary case, not a hostile one. The function's own comment claimed the
  encoding "stays reversible", and `%20` does not come back as a tab.

  Each character now carries its own code — `%09`, `%0A`, `%0C`, `%0D`, `%20`. Measured over twenty-two
  keys chosen where the encoding works hardest: twenty distinct ids before, **twenty-two** after, all
  reversible, and every id still splits into exactly its three segments. Ids for keys containing a tab,
  newline, carriage return or form feed change; a key containing only spaces is unaffected.

  **`aria-haspopup` is declared once, in the catalogue.** It was a literal at each opener — five in this
  package, nine more across the renderers — with no common source, and the copies had drifted. A battle
  that opens each popup and looks for the promised role found `multiselect` promising `listbox` over a
  `group`, and `colors` promising `dialog` over a `listbox` — in both renderers, which is what says the
  contract was silent rather than a renderer careless.

  `MdyPopupOpener` gains `promises`, and `projectOverlayOpenerA11y` emits the attribute from it. Values
  are read off the anatomy the same catalogue declares: `select` and `colors` promise `listbox`,
  `datepicker` and `daterange` promise `grid`, `timepicker` and `multiselect` promise `dialog`.

  **A consumer asserting `aria-haspopup="listbox"` on a multiselect will see `dialog`.** Its popup is a
  search field beside a grid of chips the contract declares a `group`, so `listbox` promised options with
  a selected state and a listbox's keyboard over a composite that has neither. The old value was measured
  false; nothing correct changes, but it is a rendered attribute a host's tests may name.

  See ADR 0110.

- a64a7a3: What `optional` means on a structure node, said where a reader looks

  Six kinds declare a required part inside an optional `popup` — `select.listbox`, `multiselect.listbox`,
  `datepicker.calendar`, `daterange.calendar`, `timepicker.container`, `colors.presets`. Read as "always
  present", that contradicts `overlayOnlyParts`, which names those same parts as ones a closed widget has
  no reason to build: an adapter author trusting one builds a listbox inside a closed select, and one
  trusting the other leaves a part marked required missing.

  `overlayOnlyParts` already stated the resolution in its own doc — _"a closed widget is not required to
  render any of them … what both must do is render them when open"_. `MdyWidgetStructureNode.optional`
  now says the same from the part's side, where someone deciding what to build actually looks: **required
  means required while its parent is on the page**, not for the widget's whole lifetime.

  Under that reading both statements are true and a lazy overlay and an eager one are both conformant,
  which is what `overlayOnlyParts` exists to say. No behaviour changes.

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
- Updated dependencies [bc1cc05]
- Updated dependencies [1c8e529]
- Updated dependencies [0a96145]
- Updated dependencies [e59d37c]
- Updated dependencies [ecca49f]
- Updated dependencies [2e005a4]
- Updated dependencies [892c01b]
- Updated dependencies [551320a]
- Updated dependencies [e6b35e4]
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

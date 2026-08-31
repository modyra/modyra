# @modyra/angular

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

- c0d035d: `<mdy-dynamic-form>` takes an id scope

  Ids come from the field's path, so two forms built from one document claim one set of them, and the
  library said so — advising `[idScope]` on the controls. A consumer of `<mdy-dynamic-form>` has no
  controls to bind it on: the component builds its own. The advice was correct for someone assembling
  controls by hand and impossible for everyone using the door the package advertises.

  The component now takes `idScope` and forwards it to every control it renders, which is the shape
  plain has had at its own document-level door. The collision warning names both routes.

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

- 99d9f75: An id that is a property of the document, not of what mounted first

  lit and Angular minted every widget id from a mount counter — `mdy-field-0__label`,
  `mdy-control-datepicker-2__label`. The same field declaration got a different id depending on what
  else was on the page first, which made three things impossible: a consumer could not write
  `aria-describedby="when__label"` in their own markup and have it resolve, a stylesheet or a test could
  not name one, and server-rendered markup disagreed with a client mount the moment their order did — a
  hydration mismatch on an accessibility attribute rather than on visible text.

  ADR 0135: **a widget bound to a field derives its id from that field's path, within its form's id
  scope.** plain already did. All three renderers agree now, and the same document renders the same ids
  every time it renders.

  ```
  before   mdy-field-0__label · mdy-control-datepicker-2__label
  after    when__label        · orders.0.due__label
  ```

  **A widget with no field keeps a mount counter**, and its ids are explicitly not stable: an unbound
  control is a documented shape in both packages and there is nothing to derive an id from.

  **Two forms built from one document need a scope**, which is what `idScope` is for — an input on
  Angular's controls and an `id-scope` attribute on lit's elements. Two fields called `when` on one page
  collide visibly without it, and that is the better failure: two counters never collided and never
  meant anything either.

  **Migration.** If you named a Modyra-generated id — in your own `aria-*`, a selector, or a test — it
  is now `<field-path>__<part>`. Angular's per-renderer `fieldId` members are gone; the base class
  derives it for all fifteen.

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

- fa5b612: A closed picker is gone, a form that ended takes no writes, and a document can keep a draft.

  - **The datepicker's popup is built when it opens and removed when it closes.** Drawn always, a
    closed field left forty-two gridcells on the page for a screen reader to walk, and a field taken
    out of play kept its calendar open — a control that looks live and answers nothing. Its opener also
    now owns the `open` state the widget controller holds, which is where the contract writes the rule
    that a field leaving play closes its popup, and emits `aria-controls` only while there is something
    to name.
  - **A control whose form has ended no longer writes into it.** The engine reports a destroyed form's
    fields as out of play; nothing in this adapter consulted that on the write path, so a control left
    on the page kept editing a form that no longer existed.
  - **`<mdy-dynamic-form>` takes `draftKey`.** A document rendered by this component could not be asked
    to keep a draft at all, while the other renderers take the option at their own door.

- e30b090: `<mdy-dynamic-form>` checks a field list handed to it directly.

  The `fields` input went to the template unchecked, so a list naming one field twice built a form with
  one field of that name and drew a control for each entry. The second control wrote into the first
  one's field — over what a person had typed — and the entry following the pair was not drawn at all.

  The list now passes through `assertSafeDynamicFieldNames`, the same guard `@modyra/plain`'s field-list
  door makes, and a list that fails it renders nothing rather than a form with controls that do not
  belong to it. The `document` input is unaffected: a document is already checked by the parser it
  arrives through.

  **Migration**: a consumer passing a list with a duplicate or unsafe name was already getting a form
  that did not match the list. Fix the list, or route it through `parseDynamicFields`, which drops the
  offending entries with a diagnostic instead of refusing.

- 9eff6ff: Five things the catalogue declares and this adapter did not draw or say.

  - **The timepicker's segments are spinbuttons again.** They carried the native `min`/`max` and
    neither the role nor `aria-valuenow`, so a screen reader announced an edit box holding nothing
    where the other renderers announce a value in a range.
  - **The number field draws its steppers by default.** `showSpinButtons` now defaults to `true`: the
    parts are the kind's anatomy, the foundation hides the native arrows, and a field drawing neither
    had no stepping affordance at all. Steppers on a disabled field are disabled with it. Pass
    `[showSpinButtons]="false"` for the box alone.
  - **An option a document disabled cannot be chosen.** The native list drew it like any other and took
    it when it was picked.
  - **The filter box in a multiselect popup has a name and says what it filters.** It was named by its
    placeholder, which stops naming it the moment somebody types into it.
  - **The datepicker's opener names the view on screen.** `aria-controls` was fixed on the day grid,
    which is replaced when the month or year list opens, so the reference resolved to nothing exactly
    while the popup was in use. The range calendar's month and year views also had no widget id, so
    their names pointed at `__label`.

- a7eddca: Focus comes back to the part the contract says opens the popup.

  Closing an overlay returned focus to the first interactive element in the wrapper — a description of
  one arrangement rather than a rule. A multiselect draws its chosen values ahead of the trigger and
  every chip is tabbable, so `Tab` closed the list, put focus on a chip, and let the browser carry on
  from there onto the trigger: the control the person was leaving.

  `MDY_POPUP_OPENERS` already declares the part a person opens each kind with — `trigger` for select and
  multiselect, `control` for the pickers, `toggle` for a range and for colours. The overlay control reads
  it and restores focus there, falling back to the old search only for a kind that declares no opener.

  This replaces the `restoreFocusTo` hook and the multiselect's own `restoreOverlayTriggerFocus`
  override, both added earlier in this same unreleased cycle: one kind naming its own element was the
  workaround for a base that was not asking the contract.

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

- 3cb5c9d: A document's supporting text reaches the slot in Angular too

  `MdyDynamicFieldBase.supportingText` gave every field a way to say what its description should read,
  and this adapter had no route for it: supporting text arrived only by projecting an
  `mdySupportingText` template, and a document has no template to project. So the words existed in the
  contract and reached three renderers of four.

  Every control gains a `supportingText` input, and the dynamic form forwards the document's. The
  projected template is now `projectedSupportingText`, which is what it always was — the _other_ way to
  supply the same slot, for a hand-written host.

  Angular already had the half the other two lacked: it omits both the element and the
  `aria-describedby` that names it when there is nothing to say, rather than pointing a reader at an
  empty slot.

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

- 2f62afe: The colour and file fields read their own controllers, and a palette that had stopped closing

  The last two kinds here still deciding their own behaviour now take it from the contract, which takes
  adoption to 51 of 51 renderer/kind pairs.

  **The colour field.** The rule for what a colour act does was shared already; the sequence around it
  was not — the transition, the write, the mark, and whether the palette has served its purpose were
  four decisions taken in the renderer. They are one dispatch.

  Adopting it revealed the shape of a half-adoption. The controller only reports a palette as closable
  if it knows the palette is open, and this renderer opened its overlay without telling it: a swatch
  chosen wrote the value and left the palette standing over the field a person had just finished with.
  Both directions are told now — opened, and closed by whatever closed it. **Nothing asserted the
  closing**, which is why it could break silently; a check now does, along with the field being marked
  as answered by the same act.

  **The file field.** Same adoption, and one behaviour change that comes with it: **clearing a file
  field now leaves `[]` where it left `null`.** The field is declared as a list, the contract answers
  `[]`, and the framework-free renderer already did — this one was handing hosts a shape the type does
  not allow.

  Its two outputs had no check at all. `filesRejected` is the only way a host learns a file was turned
  away — the value cannot say it — and `fileSelected` now stays quiet when a pick was refused
  outright, rather than announcing the previous selection as though it had just been made.

  Both checks were written before the adoption, and both mutations that survived the first attempt were
  coverage findings rather than passes: nothing had been asserting either behaviour.

  The readiness audit named `dispatchValueIntent` as this kind's evidence of taking its behaviour from
  the contract. Adopting the controller removes that call, which is the point rather than a gap — the
  audit's own header says so, and its table had not been brought along for these two.

- 26a585b: The Angular select reads its field, and a gate that had been measuring a three-week-old build says so

  **Breaking: `MdyAngularSelectAdapterOptions` now requires a `handle` and no longer takes `onChange`,
  `value`, `disabled` or `invalid`; `MdyAngularSelectAdapter` loses `setValue`, `setDisabled` and
  `setInvalid`, and gains `setDescribedBy` and `setPopupRendered`.**

  The select was the last kind here still driven by imperative setters where its eight siblings take a
  field handle and read it. It now builds `createSelectFieldController` like the others, and is built
  on the first read rather than in the constructor — a `name`-bound field has no handle until the
  registry resolves it, and a renderer that latched before it arrived cached nothing for the life of
  the component.

  Two things this surfaced, both worth more than the change itself:

  **`selectionChange` had stopped firing for the panel.** Choosing from the list the renderer draws
  went silent while the native control kept announcing, so a host binding the output heard half the
  choices. Nothing asserted it — the whole suite was green with the output dead on one of its two
  paths. It now emits after the write, comparing before and after, so both paths mean the same thing.

  **`test:type-surface` was comparing this package against a build from three weeks earlier.** It reads
  declarations, and for a package that emits them through a build it reads the build; nothing in the
  suite rebuilds one. It answered "unchanged" with a gate's authority for every change it could not
  see — including members removed in earlier work, which this release finally classifies. The audit now
  refuses a `dist/` older than its `src/` and names the command that repairs it, rather than measuring
  the past and reporting it as the present.

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

- c6bb5ba: `<mdy-dynamic-form>` draws every kind the contract publishes

  Its kind switch named fourteen of the seventeen. A document declaring `daterange`, `file` or `colors`
  mounted a form and rendered nothing for that field — no error, no diagnostic, an empty space where a
  control belongs. All three components exist and are exported; the switch simply never reached them.

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

- 056027b: A layout bound past the depth limit drops the arrangement and keeps the questions

  Angular's dynamic form applied the nesting limit by throwing from the computed that reads its
  `layout` input. A template has nowhere to catch: the exception took the whole view down — no
  sections and **no fields** — and in an application it reached the installed error handler, which
  swallowed it, leaving a form that reported itself mounted with no structure and nothing said.

  Strictly worse than the silence it replaced. A bound layout is now refused the way a document is:
  the arrangement is dropped, the questions still reach the person, and the reason — the depth, the
  path and why the limit exists — is stated where a developer looks.

  The dividing line is not imperative against declarative but whether there is anywhere to catch. A
  function call has a caller holding the result who cannot notice silence, so `mountMdyForm` still
  throws. ADR 0160 carries all three shapes.

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

- 93fdd47: A cursor with an element to point at

  Typing a letter at an open multiselect moved the cursor in lit and Angular and neither could say
  where it went: `aria-activedescendant` named an id no element carried. The projection gives every
  option an id and neither renderer put it on the element that draws the option, so the control
  announced a cursor pointing at nothing — type-ahead worked and was invisible.

  Both now carry the projected id, and mark the option the cursor is on.

  **lit also kept its own answer to whether the popup was open** and never told the controller. The two
  disagreed about a state only one of them owns, so everything derived from `open` — where the cursor
  is, whether it may be announced — was computed against a list the controller believed closed. Opening
  and closing now go through the controller and the element mirrors it.

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

- 410d564: Two forms of one document no longer share their ids

  Ids are built from the field's path, a path is unique within a form, and `getElementById` returns the
  first in the document. So with two forms of one document on a page, the reference in the second did
  not dangle — it resolved to the **first form's** element: somebody filling in the second with a screen
  reader heard the help text of a field they were not looking at. Nothing looks wrong and nothing
  throws; the page is answering a different question correctly.

  `<mdy-dynamic-form>` now derives a scope when none is bound, from the same primitive the
  framework-free renderer uses, so a document behaves the same whichever renderer draws it. The comment
  on `idScope` has always said the scope is taken at this door — it was not, and the default was empty.
  Binding `[idScope]` still decides: this fills the silence rather than overruling.

  The live scopes are tracked in memory rather than read from the page, which is the one place this
  differs from `mountMdyForm`. There, mounting is a call and the first form has written its ids before
  the second asks. Here both are computed in one change-detection pass, before either has rendered, so
  a form looking in the document finds an empty page and takes the same scope as its neighbour.

  Two forms of one shape is not exotic: a filter beside a form, a repeated row, two tabs side by side,
  a dialog over a page.

- baf32eb: The segmented control stops claiming Home and End

  It answered two keys the contract does not declare and the other two renderers do not offer, so
  somebody who learned the gesture here lost it by changing renderer — and the contract was silent
  about it, which under "everything adheres to the contract" is not an available outcome.

  Two ways to close that: declare them, and the other two renderers owe them on every kind that is a
  group of choices; or stop offering them, and the three agree. The second, because the authoring
  practices give a radio group the arrows and not these: Home and End serve a set longer than can be
  seen or held in mind, and three or four always-visible choices are crossed in three presses. Nobody
  expects them here, so nobody loses them.

  The shared `optionNavigationIndex` still answers Home and End — it serves lists too, where they are
  owed. What changed is that a group of choices stops asking it for them.

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

- 5f7f025: A calendar grid says which month it is showing

  Two renderers named the calendar's grid with the field's caption, which the dialog around it already
  says — so a reader heard the same words twice and nothing about _which month they are in_, the one
  thing that changes as they page through. The third named it with the month and year, which is the
  published grid pattern.

  All three say the month now. The dialog keeps the field's name; the grid inside it says where you
  are.

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

- 6d02a54: A key the contract does not declare

  The daterange's endpoint boxes opened the panel on ArrowDown. Nothing declares that: the keyboard
  table gives this kind Enter and Space on its toggle and nothing at all on the endpoints while the
  panel is shut, and no kind in the catalogue declares a closed-state arrow. So one renderer answered
  a gesture the other two do not offer, and somebody who learned it there lost it by changing
  renderer.

  It also took a key away from the person using the control. An endpoint is a box a date is typed
  into, and swallowing ArrowDown there sends the caret key to a panel instead of to the text.

  The contract stays as short as the practice: the extra gesture goes rather than the other two
  renderers gaining it. Same resolution as ADR 0112 took for Home and End on a radio group.

- 44b1125: A read-only file field says it cannot be operated

  The contract declares no read-only state for `file`, and the reason is written in the renderers: the
  picker belongs to the browser and the element's role has no `aria-readonly` to carry. What _is_
  expressible is that the affordance cannot be operated, while the field stays in play — focusable,
  submitted, validated. The plain and Lit renderers already said it that way.

  Angular did not: locking the field left the browse button, the drop zone and the clear button fully
  operable and looking it. Nothing on the page — and nothing in the accessibility tree — said the field
  was locked.

  The three now agree.

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

- a25e04b: Choosing an object-valued option stops emptying the field.

  A native `<option>` carries a string, and this renderer bound the value itself — so an object-valued
  list wrote `[object Object]` on every one of them, and the browser could not tell them apart. The
  change handler looked that string up among the options and, once the key derivation was corrected to
  describe an object by what it holds, found nothing: **choosing any option set the field to `null`.**

  The option carries its key now, which is the same string the lookup asks for. And whether an option is
  the chosen one is asked through that key rather than with `==`, which is identity for an object — so a
  fresh value from a restored draft or a refetch showed nothing chosen while the model held it.

  ```
  before   option values ["[object Object]", "[object Object]"]  ·  picking Beta → null
  after    option values ['{"id":1,…}', '{"id":2,…}']            ·  picking Beta → {"id":2,…}
  ```

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

- 3c05c8e: A placeholder the theme can reach

  Angular dimmed its native select with an inline `opacity: 0.6` while nothing was chosen. Two things
  were wrong with it beyond the duplication: it dimmed the whole control, arrow included, where the
  other shape dims only the placeholder's own text — and an inline style is the one thing a theme
  cannot override, so a design system had no way to change it.

  The foundation states it instead, and asks the element about its own state rather than requiring a
  renderer to say: the entry for "nothing chosen" is the option standing in a native chooser, so the
  control is showing a placeholder and takes the placeholder's colour. Both renderers of that shape get
  it without either of them knowing.

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

- c48e65b: A press on the caret opens the multiselect's list

  The caret takes no pointer events — the whole field is what opens the list — so a press aimed at the
  one mark a closed field shows lands on the box, and the box has to forward it. Plain and Lit did;
  Angular did not, so pointing at the affordance that means _this opens_ did nothing, and nothing else
  on the field said where to point instead.

  Forwarded only when the press landed on the box itself, never when it crossed something on the way
  up: a chip is a span, so a test on what was passed lets a chip through and one press both picks a
  chip up and opens the list.

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

- 58515c5: A tooltip that said "null"

  The checkbox's caption bound `[title]` rather than `[attr.title]`. The property is a DOMString, so
  the absent value in the no-error branch — which is every checkbox that is not failing — was coerced
  to the word `null` and shown as a tooltip to anyone who rested a pointer on the label.

  The attribute binding removes the attribute instead. Property and attribute are not two spellings of
  one thing: the property is what the element holds, and only the attribute can be absent.

- 78bbf9c: All three renderers read the binding for the parts no relation names

  The contract now says which message names a part nothing points at. These two were still choosing.

  One built `"<caption> — End date"` around a translated word — a sentence no table holds, so a
  translated page said half of it in the caption's language and half in English. The other named neither
  the second box of a range nor a panel's search input at all, and carried two more hardcoded English
  phrases behind them: `"Start date"` and `"End date"`, composed with the caption exactly as the first
  one did.

  Both read `MDY_PART_NAMES` now. The first box of a range keeps the caption that already points at it,
  which is what makes removing its composed phrase safe rather than a tidy-up that ships a nameless
  control — asserted, because that is not visible from the removal.

  **A mutation that survived, and what it says.** Pointing the range's second box at the _first_ box's
  message broke nothing: both the renderer check and its expected value read the same binding, so the
  two move together. That check is a tautology about following the table, which is worth having and is
  not a statement about the table being right. What can be said from the contract is now asserted
  there: two parts of one kind must not be named the same words, or a reader in one cannot tell it from
  the other.

  The readiness fixture asked the Angular renderer's source to mention `daterangeEndLabel`. It reads the
  binding instead, which is the stronger evidence — the name comes from the contract rather than this
  file happening to use the same word — so the token is the binding.

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

- 6587fdf: The affordance column reaches the field's edge again.

  `DESIGN.md` states the rule and names this exact failure in advance: _a control sized by its own text
  leaves the field's fill as empty space beside it, and the affordance lands next to the value instead
  of on the edge — the alignment reads as broken even though every affordance token is correct._ Every
  token was correct. Three separate boxes were sized by their content:

  - **The multiselect's own box** declared itself a row — "the trigger takes what is left and the
    clear-all sits at the trailing edge" — while being a flex item with no grow, so it took only the
    width its chips asked for. The clear-all then sat wherever the longest chosen word ended and moved
    whenever a value was added, removed or translated. Measured at **1073px** from a 1272px field's
    edge; now 4, the declared inset.
  - **`@modyra/lit`'s multiselect** drew its prefix and suffix slots whether or not anything was given
    to them, and an empty slot is not an empty box — the suffix took 16px at the trailing edge, so
    every affordance inside that field stopped 16px short. Drawn only when something is assigned.
  - **`@modyra/angular`'s number field** wraps its input in a span to position the steppers against it,
    and a span is inline: the box stopped after the number, putting the steppers beside the value.

  Two of the most destructive controls in a multiselect — the clear-all and a chip's ✕ — were 22px
  apart in the middle of the field as a consequence. At the trailing edge that adjacency does not exist.

- a14fa83: An error does not take the place of the instruction that would have prevented it

  Nine Angular renderers rendered the supporting text as the alternative to the error container:
  `@if (errorsReserved()) { … } @else if (supportingText()) { … }`. So a field that could fail lost its
  supporting text the moment the container was reserved — which is every field with a rule — and the
  person who most needed the instruction was the one who never saw it.

  `aria-describedby` named both throughout, because the shared projection says both: _an error does not
  take the place of the instruction that would have prevented it_. With only one of them on the page,
  three controls pointed at a description element that did not exist. A dangling reference is a
  description that comes back empty, which is what the accessible-description sweep read.

  Both render now, error first, in the order the reference names them.

- 34ab127: Every published id is composed the way the factory composes one

  Seven ids were joined with a hyphen — `field-start`, `field-label`, `field-trigger`, `field-hex` —
  where every id this library publishes is `scope__part`. They were unique and they worked, which is
  exactly why nothing caught them: what a hand-joined id cannot do is be **composed**. A consumer that
  knows the scope builds a part's id the same way the factory does, and reaches nothing for these.

  All seven now go through `defaultWidgetIdFactory.part`. Measured on the page afterwards: none left,
  in any renderer.

- 76e9cae: An id a factory can spell

  Three ids were written with names the contract does not use: `hex` for the `hexInput` part, `start`
  and `end` for `startControl` and `endControl`, and `__chiptip` spelled by hand for `chipTooltip`.
  Each resolved on the page and none could be derived by the published id factory, so anything building
  the same reference from the contract — a check, a fourth renderer, a host reaching for the element —
  pointed at nothing.

  They are spelled by `defaultWidgetIdFactory.part` from the part's own name now. The ids on the page
  change; they are per-instance and referenced through the same factory on both sides.

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

- 6ce348c: An id spelled from the field it belongs to

  Four ids were built in field initializers, which run before the host settles `fieldId` — so they
  spelled the id the component had _before_ it was given one, and read one lower than the field they
  name. `hexInput`, a range's two ends and the chip tooltip are computed now, like the label id that
  had the same fault.

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

- 7bba840: A draft is read back, not only written.

  `<mdy-form>` enabled the draft while constructing, and a declarative form holds no fields until its
  controls have claimed them. The engine names a form by the paths it holds, so the restore compared a
  draft written by a form of one field against a form of none, refused it as another form's work —
  correctly, by its own rule — and the page came up empty while the draft sat in storage untouched.

  The writing half worked throughout, which is what made it look like it worked: a consumer watching
  storage fill had every reason to believe the feature was fine, and the person who needed it found out
  at the moment they could least afford to.

  The draft now starts after the first render, when the form has the shape it will keep.

- 3685198: A swatch is announced as the colour it is, and the two buttons beside the field no longer share one
  name.

  Every swatch was named `Select color #hex` where the other two renderers name it `#hex`. The option
  role already says what pressing it does, so a palette of ten repeated the verb ten times and the
  three renderers announced the same control three different ways.

  The preview button and the presets toggle both answered to `Presets`. They are two controls doing two
  things: the preview takes the colour, the toggle opens the list of them.

- e491f11: A field taken out of play under the cursor no longer costs the person their place.

  Disabling a focused element blurs it, which is the platform; what followed was the adapter's. Someone
  typing into a field a rule disabled — a value arriving from a fetch, a condition turning false — was
  left on `<body>`, so their next Tab started at the top of the document and nothing said where they
  had gone. Read-only was already the proof it need not: a read-only field keeps the keyboard.

  Every renderer now calls `keepKeyboardInPlay` from `@modyra/widgets`, the same helper `@modyra/plain`
  and `@modyra/lit` call, which places focus on the next thing that can take it, the previous one
  otherwise, and the widget's own root as a last resort.

- a9a2989: Three things a document declares that this adapter dropped.

  - **`ariaLabel` never reached a control.** The dynamic form binds `[label]` on every kind and bound
    the spoken name on none, so a document deliberately giving a control a different spoken name was
    silently overruled by the visible one — and a name that differs from the label is the only reason
    anybody writes it.
  - **A field with no label at all was announced as nothing.** The name a control takes now follows
    `fieldAccessibleName`: the spoken name, the visible label, then the field's own name. A poor name
    is better than a text box announced as a text box on a form of them.
  - **A file field did not start as the empty list its contract declares.** Every other kind's case
    bound its empty value and this one did not, so a document's file field held `undefined` until
    something was picked and its payload had a different shape from its siblings'.

- c1ebec1: A field the form refuses now looks refused, and a locked field looks locked.

  Every renderer wrote `mdy-input-wrapper` by hand and bound only `--disabled` beside it, so the two
  other states the contract lists for that part — `--error` and `--readonly` — reached the page in one
  renderer of thirteen. A form rejecting what a person typed rendered the message and set
  `aria-invalid`, and nothing on the field itself changed. The label had the same shape: its
  `--has-error` class followed whether the message was drawn _inline_, so a field showing its errors in
  a list below never marked its label at all.

  The wrapper's classes are now composed from `MDY_FIELD_STATE_CLASSES` in one place, and the error
  state follows the same answer `aria-invalid` takes, so what a theme paints and what a screen reader
  is told cannot disagree.

- b0205f4: The pickers open from the part the contract names, by pointer and by keyboard.

  `MDY_POPUP_OPENERS` says which part a person operates to open each kind's popup. Two of them named
  parts this adapter did not answer:

  - The datepicker and the timepicker declare `opener: "control"` — the field's own input, the large
    target a person clicks to fill the field in — and only the small button beside it opened anything.
  - The daterange declares `opener: "toggle"`, and its toggle carried `tabindex="-1"`, so the one part
    the contract names as its opener could not be reached by a keyboard at all. The picker had no
    keyboard route in.

  Both are answered from the contract's table rather than per renderer.

- bbe5d1e: The calendars are named, and a date field says when it cannot read what it holds.

  Three things a person is told by the other renderers and was not told here:

  - **The day grid and the month and year views had no accessible name.** A `grid` is one of the roles
    ARIA requires to be named, and the name a calendar takes is the field's own label. The month and
    year views carried neither the name nor their id, so the header pointing at one by id pointed at no
    element at all.
  - **Text a date field could not read was discarded.** The renderer parsed the entry itself and
    dropped what did not parse, so the widget's controller never learned there was an outstanding
    entry: the form was told the field was empty while the person was looking at their own text, the
    message explaining it never appeared, and leaving the field replaced what they typed with the value
    they had not chosen. Parsing is the controller's now, through `parseEntry`, and the entry is
    reported to the form so it is one of the field's errors like any other.
  - **The timepicker erased an unreadable time on the way out**, for the same reason and with the same
    effect.

- 3a1614a: Tab out of an open picker closes it.

  `MDY_WIDGET_KEYBOARD` declares `Tab@open: cancel` for the kinds whose popup Tab leaves, and the
  datepicker, daterange and colors renderers answered it nowhere: the popup stayed open, so the keys
  still went to it and the next Tab walked its internals — a calendar cell, then the next cell — with
  nothing to tell a keyboard user that the way out was a different key.

  The binding is now answered once for every overlay control, asked of the contract rather than listed:
  the timepicker declares `Tab@open: move` because its confirm button lives inside the panel and Tab
  has to reach it, and it is unaffected.

- 42f7a43: A range's text inputs no longer promise a popup they cannot open.

  Both carried `aria-haspopup`, which tells a person operating that control that a popup opens from it.
  The catalogue names one opener per kind and for the daterange it is the toggle beside them: the
  inputs answer neither of the two keys the contract declares for opening, nor a pointer. The promise
  now sits only where the popup actually opens.

- 5ed2afc: The way back names the value it would restore, not its identifier.

  The visible offer resolved the removed value's label against the values still chosen — and a value
  that was just removed is, by definition, not among them. It fell back to the option key, so the strip
  read `opt_9271 removed` while the live region beside it said `Ferrovia removed`: the screen reader was
  told correctly and the eye was shown the identifier.

  Resolved against the options now, which is where a value that is no longer held can still be found,
  and which is what the other two renderers already did.

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

- f363c90: Fifteen host blocks stop repeating a class the control they extend already binds

  `mdy-renderer--touched` was declared on the control every renderer extends _and_ written again in
  fifteen component host blocks, identically. Angular inherits host metadata, so the copies did
  nothing: a rename would have had to reach sixteen places, and a renderer added without the line would
  have looked wrong and behaved correctly.

  Removed rather than routed through a shared helper. Deleting a redundant declaration is a smaller
  change than replacing it with a computed one, and the alternative — binding a class _record_ on the
  host — replaces what a static `class` put there unless the two merge, which would take a kind's own
  identifying classes away while every behavioural check stayed green.

  **Nothing asserted the class in a rendered document, in any renderer.** The only check that covered
  it reads renderer source for the names it mentions — it says so in its own header — so it establishes
  that a file names a class, not that an element carries one. A spec now mounts six kinds, marks each
  field, and asserts both halves: the state class arrives, and the kind's own classes are still there.
  Removing the one remaining binding turns all six red.

  The source-level manifest loses fifteen mentions, which is the change and not a regression.

- 766915c: Five things a document asked for and the dynamic form dropped

  `searchable` decides which control a select _is_ — a native chooser or a combobox with a filter — and
  the case never bound it, so a document asking for one got the other with nothing said. The component
  has always read it; the template was the only link that dropped it.

  Auditing the neighbouring cases with the same question — _what does a case not bind that its component
  reads?_ — found four more: a colour field's own `presets`, a file field's `accept` and `multiple`, and
  both calendars' `minDate` and `maxDate`. Each parses, validates and reached no control.

  Measured across the three renderers on one document: the select is a combobox everywhere, the file
  input carries `accept=".pdf"` and `multiple`, and Angular's palette draws the colours the document
  named.

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

- 0f5e4b1: Leaving an open multiselect with `Tab` no longer lands on the control being left.

  Closing an overlay places focus back in the field, and the element it chose was the first interactive
  one in the wrapper. In a multiselect that is a chip: the strip of chosen values sits ahead of the
  trigger and every chip is tabbable. `Tab` therefore closed the list, put focus on a chip, and let the
  browser carry on from there — onto the trigger, the very control the person was leaving.

  The multiselect now names its trigger as where focus comes back to, so the browser's next step goes
  past it. `Escape`, which asks for the same restore, is unaffected: it wanted the trigger all along.
  Hosts can override the same hook wherever their trigger is not the first interactive element.

- 9eb86d9: Focus that waits for the panel it is aimed at

  A popup rendered into the top layer exists in the document a frame before it is shown, and `focus()`
  on an element that is not being rendered is a no-op that reports nothing. A renderer focusing on the
  render it triggered therefore left the keyboard where it was — which is how Angular's colour palette
  took focus in its unit tests and not on a page.

  `focusWhenShown` verifies the attempt and retries on the next frame while the caller says the reason
  still holds, bounded rather than looping: a panel that never draws is a different defect and an
  endless retry would hide it.

- 1abbb45: Four kinds stop being announced as nothing when a document writes no caption

  A `label` is optional and a form may omit it. What is not optional is that somebody using a screen
  reader hears _which_ field they are on: with no name, a text box is announced as "edit text" on a form
  of them, and voice control has nothing to say to reach it at all. That criterion has no conditional
  clause.

  `slider`, `radio`, `segmented` and `file` had no name of any kind on such a document — no
  `aria-label`, no `aria-labelledby`, no `label[for]`, no wrapping caption. Eleven other kinds fell back
  correctly, so the gap was never the resolver that decides the fallback:

  The two groups pointed `aria-labelledby` at a caption that was not rendered — `label() ? labelId :
null`, which is `null` exactly when a caption is missing, so the one case the fallback exists for is
  the case nothing answered. They now point at the caption where there is one and carry a spoken name
  where there is not.

  The two inputs named themselves nowhere. In the file field only the clear button was named, which is
  the button that empties a control nobody could hear the name of.

  Guarded per kind: each of the four defects, replanted alone, turns exactly its own row red. The check
  asserts the floor — that _something_ is announced — because whether a raw field key should be shown
  as a name, and how, is a separate decision that belongs in a record before anyone builds it. Its
  control is a captioned field, so a renderer naming everything after its key would pass every row and
  fail that one.

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

- 82e7216: "No attribute" is said with `null`

  Taking `aria-checked` off the native checkbox left the key out of the object rather than setting it to
  `null`. This contract says "no attribute" with `null` everywhere — `aria-readonly` beside it does —
  and a key simply absent reads as `undefined` to anything asking the projection what the field says,
  which is a value no reader maps and outside the three the standard allows. Worse than the redundancy
  it replaced: an ARIA attribute holding an uninterpretable value beside a box that maps its own state.

  Also in Angular's colour field: `aria-label` was bound twice on the hex box, so one of the two names
  was silently discarded, and `aria-disabled` was written only while true where the other two renderers
  and the contract say it in both states.

- 2e6fbd0: One answer about being out of play

  The select renderer wrote `aria-disabled` from its own binding in both template branches. On the
  platform's own chooser that is a second answer to a question the element already answers: a
  `<select>` carries `disabled` as a property, and two sources for one fact is how they come to
  disagree.

  The projection had already stopped writing it for that shape; the renderer was answering for itself
  what the shared door now answers. The combobox branch keeps it, being a button standing in for a
  chooser with nothing else to say it is out of play.

- 3fd899b: A date range's two ends carry a class each, so a sheet stops counting `<input>` elements.

  `startControl` and `endControl` are two declared parts and they carried the same two classes, so the
  only way to round the left end of the pair was `:first-of-type` — a rule that counts elements of a tag
  while reasoning about a class. Put a hidden native input or a sizer of the same tag in the group and
  the rounding moves to the wrong end.

  Each part gains a class of its own — `mdy-daterange__input--start`, `mdy-daterange__input--end` — and
  the three renderers take their classes from the contract rather than repeating a string. The two
  positional rules, in the base sheet and in the iOS theme, name the end they mean.

  Additive: both parts keep the classes they had.

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

- 953381d: One name on a control, never two

  A multiselect's trigger was named by the caption in two renderers and by its own words in the third,
  so the same field said the same thing through two mechanisms — and any renderer carrying both would
  have said only the first, because `aria-labelledby` wins the name computation and silences whatever
  sits beside it.

  All three point at the caption now, and say the words only where a document wrote no caption. The
  contract's comment says which of the two applies and why, so a fourth renderer does not have to pick.

  Angular's `labelId` is computed rather than captured at construction: a field initializer spells the
  id the component had before the host gave it one, which resolves to no element.

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

- fac5b43: One promise about one popup, read from the catalogue

  Angular wrote `aria-haspopup` as a literal at ten openers, and two of them disagreed with the
  contract and with the other renderers: the datepicker promised a `dialog` where the catalogue and
  plain both say `grid`, and the colours field promised a `dialog` from one button and a `listbox` from
  the button beside it — over the same popup. The attribute is announced with the control, before
  anything has opened, so a person acts on a word that was chosen by whoever typed that line.

  Every opener now takes the projection `projectOverlayOpenerA11y` already returns, through the
  `mdyPart` directive that most of them were already carrying. Three shapes, because ARIA allows three
  different things:

  - **The control that holds the value** takes the whole projection, role included.
  - **A button that only opens the popup** takes the same projection without the role — a combobox is
    the element holding the value, and an icon button is not one.
  - **A range's two text inputs** take the promise alone. They open the calendar with `ArrowDown`, and
    `aria-haspopup` is a statement a textbox may make; `aria-expanded` and `aria-controls` are not, and
    adding them is a critical `aria-allowed-attr` violation.

  `MdyDatePickerComponent` also declared no `widgetKind` and so inherited `"text"`, which is what let
  its opener promise nothing at all once the promise was read from the kind.

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

- 91f61a9: The field's height joins the control scale, and one document is one date

  `--mdy-control-4: max(3.5rem, 56px)` is the height a single-row field takes. It was the literal
  `3.5rem` inside two `calc`s whose other term was a token, so a theme moving the scale moved everything
  around a fixed 56 — part system and part number. `DESIGN.md` recorded that as the open question about
  what the row system is: a kind is in it when its height comes from the control scale, and no kind's
  did, because the height they all share was not on it. It is now, and the record says so.

  Separately: Angular read a typed date only in the canonical spelling when the field displayed dates
  that way, so `01/02/2026` was refused where the other two renderers read it. How a control _writes_ a
  date is its own choice; what a person may _type_ is not one — they are looking at one document. All
  three now take the canonical form first and the locale's order after it.

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

- aaf5344: Two arrows that pointed the same way, and a description nothing named.

  **The arrows.** A chip's two move controls are drawn from one mask, and the rule giving the later one
  its own direction was `.mdy-chip__move:last-of-type`. `:last-of-type` counts buttons, and the last
  button in a chip is the one that removes it — so the rule never matched and both arrows pointed left.
  The names were right, so a screen reader could tell the two apart and an eye could not. The general
  sibling combinator asks what the rule meant: is there a move control before this one.

  **The description.** `@modyra/angular`'s multiselect writes how many values are chosen into its
  supporting text, and the base withholds that element's id unless a _consumer_ supplied words — so the
  sentence was on the page and `aria-describedby` named nothing. A person who could not see the chips
  was told the field's name and nothing about what it holds, with the text saying so one element away.
  The kind names its own description now, as the other two renderers do.

- 6992eaa: One field, one verdict

  The message under a field and the `aria-invalid` beside it answer the same question — is this person
  being told — and were computed from two different rules. The attribute had been taught that a
  traversal is not an answer; the text was still painted from _which refusals exist_. So a field said
  `aria-invalid="false"` and printed "required" at the same time, on sixteen of seventeen kinds in
  Angular and on the checkbox and toggle in Plain.

  Both now read the same rule. The error container is still reserved whether or not it holds anything,
  so a message arriving does not push the page down.

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

- 9e2b753: A popup closes when its field leaves play

  A field can leave play while its popup is open, and nobody has to click anything for it: a sibling's
  `when` predicate takes it out when a value arrives from a fetch. The widget contract has a rule for
  that — the popup goes — and Angular did not follow it. The dial stayed drawn and the opener kept
  announcing itself expanded, while `aria-disabled="true"` correctly reached the control: the field was
  visibly out of play and still offering something whose clicks correctly did not land.

  The rule was never missing. It writes the controller's `open`, and this renderer painted a cell of
  its own. `MdyOverlayControl` now reads and writes through whichever cell the kind's controller owns,
  and keeps a local one only for a kind that has no controller.

  Converted: **timepicker** and **multiselect**. Not converted, and stated rather than left to be
  found: **datepicker** and **daterange** drop the `restore-focus` command their controller returns, so
  routing their writes through it fails the canonical after-Escape comparison; **colors** adopts no
  controller in this renderer at all. Those three keep the old behaviour for now.

  ADR 0118 records the decision, including why `open()` is a method rather than a `computed`.

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

- 1980005: The number boxes stay typeable while the dial is showing

  Both renderers marked the hour and minute boxes `readonly` whenever the clock face was the view — so
  the picker opened on the face, and the two controls a keyboard can use were locked in the state it
  opened in.

  The rule the user gave for the hand settles it: a hand that follows a half-typed number needs the box
  and the hand usable at the same time. Locking the box while the hand is visible makes that rule
  unstatable, and it removes the keyboard from the affordance that most needs one — a dial is the one
  gesture a keyboard cannot make.

  Typing is unchanged in both: neither had a defect there, and the reported case works in both as it
  always did.

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

- 1a3d5c6: A handle from `mdyForm()` names the runtime that owns it

  A widget controller resolves which reactive runtime to observe a field handle through by asking the
  registry that handle was registered in. The handles `mdyForm().f.*` hands out were registered against
  their _form_ but never against their _runtime_, so `observerFor` fell back to a fresh vanilla runtime:
  the controller's own state — a timepicker's draft, a select's query, a calendar's month — lived on
  signals an Angular `computed` cannot read.

  Under Zone.js this is invisible. Zone redraws on every event, so a template binding that never
  established its dependency is repainted anyway and shows the right thing for the wrong reason. Without
  Zone.js the display simply freezes: on a timepicker the arrows, a dragged hand and a clicked number
  all move the draft and commit correctly, and the face never moves.

  The handles are now registered through the same `_own` the rest of the form's shapes use, which
  records the runtime as well as the form.

  One consequence worth stating: a form built outside an injection context has no `Injector`, so its
  controllers' effects are now reported as unavailable (`MDY_EFFECTS_UNAVAILABLE`) rather than silently
  running on a runtime whose signals nothing else could see. The diagnostic is the honest form of what
  was already not working.

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

- 769fd6e: A checked box is drawn checked again

  Moving a boolean's drawn part inside its label — so the empty remainder of the row would stop
  toggling the field — broke every rule that paints its state. Those rules name a _relationship_:
  `.mdy-checkbox__control:checked + .mdy-checkbox__indicator` is the input and the box **beside** it,
  and the box is no longer beside it. The state changed, the class stayed, and nothing repainted.

  Nine rules across checkbox and toggle now ask the wrapper instead —
  `.mdy-checkbox:has(.mdy-checkbox__control:checked) .mdy-checkbox__indicator` — which holds wherever
  inside the field the drawn part sits. All three renderers share the stylesheet and all three were
  affected.

  A toggle given no label also drew no track: the Angular and Lit templates built it inside their
  `@if (label())`. The track is anatomy — the catalogue declares it a part of every toggle — so it now
  renders either way, still inside the label element, because the native input is hidden and the label
  is what forwards a press to it.

  `packages/plain/test/state-rules-reach-their-part.test.mjs` is the check that was missing: it reads
  the shipped stylesheet, takes every selector that decides a boolean's state, and asserts each one
  still selects something in the rendered field. The theme audit compares class names on both sides and
  stayed green throughout, because both sides still named the class.

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

- d9ac833: The dial reports where the pointer is, and an arrow key stops fighting the binding

  Two defects a person met and neither test suite could: conformance asks whether a part is there with
  the right role, not whether clicking it does anything.

  **The dial could only name twelve of twenty-four hours.** The clock handed the renderer a formatted
  time, which it read back with `parseTime` — the _12-hour_ parser, whatever the picker's format — so
  every pointer landed on the outer ring by construction. It now reports the position it actually
  knows: the angle and which ring, from `pointerAngle` and `timepickerDialRing`, dispatched as
  `set-from-angle`. Dragging carries them too, so the hand follows a finger across both rings.

  **The arrow keys were undone before the frame painted.** The segment's template binds
  `[value]="value()"` and its arrow handler also assigned `input.value` and fired a synthetic `input`
  event. One value with two owners: wherever the round trip did not return the stepped value, the
  bound value was written back over it. The handler reports the value it asks for and the DOM follows
  the model, the same way a typed character does.

  The number fields and the period toggle also read their time with the picker's own format now, and
  send the hour in it — `parseTime` could not read the `"15:30"` a 24-hour picker hands back.

- 311575b: The overlay panel takes its role from the catalogue

  `MDY_WIDGET_CONTRACTS.multiselect.parts.popup` declares `role="dialog"` — the contract version moved
  2 → 3 for it — and this renderer drew a bare `<div>`. Plain and lit took the new contract; Angular
  did not, so its multiselect popup carried no role at all and the shared DOM-contract check reported
  `PART_ROLE:popup` in three specs.

  The panel now asks the catalogue for the popup role of the kind it belongs to, rather than deciding
  for itself. The modal rule stays underneath it as the fallback for kinds the catalogue says nothing
  about: a panel with a backdrop _and_ a name is still announced as a dialog, which is what the palette
  and the clock have relied on since the nameless-dialog finding. The multiselect passes a name for the
  same reason — a dialog without one is an axe violation, and it was the last failure left after the
  role landed.

  Swept rather than patched: the shared check runs over all seventeen kinds with no excused
  divergences, and the multiselect popup was the only role Angular was missing.

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

- 2e65423: `<mdy-dynamic-form [document]>` reads a document, instead of taking one already parsed

  The component is named for the dynamic contract and took only its parsed half — `[fields]` and
  `[layout]`, already typed — so the untrusted half stayed with the host, and an application rendering
  one server document here and on `@modyra/plain` wrote the parse step twice. The cross-field rules
  were the part that vanished quietly: a document saying "hide the VAT number unless the customer is a
  business" parsed, was accepted in strict mode, and produced a form that showed it always.

  `[document]` takes the document as it arrived and reads it here — `parseDynamicForm`, then the
  fields, the layout and `applyDynamicRules`. `[parseMode]` chooses how: `strict` (the default) renders
  nothing from a document carrying an error rather than the part of it that happened to be well formed,
  `lenient` renders what parsed. `(diagnostics)` emits what reading found either way.

  `[fields]` is no longer required — one of the two ways in is given. A template that forgot it used to
  be a compile error and is now a form with no fields. See ADR 0106.

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

- 9ee1390: A record row's own collection is typed all the way down.

  `MdyItemHandleTree` now maps a `record` or `array` descriptor inside a row to this
  framework's own handle types, so `form.f.orders.row(k).lines.row(k2).sku` carries
  Angular's signals exactly like a top-level handle instead of resolving to `never`.

### Patch Changes

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

- 2c4c53d: One answer for whether a control announces itself as failing

  Eight templates bound `aria-invalid` and one of them answered differently: the
  colours field waited for `touched`, so a screen-reader user met a control the
  form was rejecting while the control said nothing was wrong. The base names the
  question now — `paintsAsInvalid`, computed through the contract's
  `showsAsInvalid` — and every template asks it.

  Neither spelling was the contract's. `errors()` already withholds the errors of a
  field the form is not asking about, which is why seven of the eight were right by
  construction rather than by decision; a name makes that the reason.

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

- e853a48: `angularReactivity` asks whether effects can run, rather than inferring it from holding an injector

  `capabilities.effects` was `injector !== undefined` — a proxy for the question rather than the
  question. An injector created with no parent has no `ChangeDetectionScheduler`:

  ```ts
  angularReactivity(); // effects: false, degrades, warns — honest
  angularReactivity(Injector.create({ providers: [] }));
  // effects: TRUE, then NG0201 from inside
  // Angular when the engine calls effect()
  ```

  So the better-looking input produced the worse failure: no injector at all degrades honestly and
  warns, while a detached one promises effects and raises a raw framework error from inside the
  engine's own call.

  It creates and destroys one effect at construction now. Measured, so the boundary is stated rather
  than guessed: a parentless `Injector.create` raises, while `TestBed.inject(Injector)` and a
  `createEnvironmentInjector` child of an application injector both run — this is reached by a detached
  container rather than by anything `inject()` hands a component, which is why it is a small fix and
  not an urgent one.

  Same shape as `solidReactivity` probing its graph instead of matching a build: a capability that
  answers about the thing it was given rather than about the shape of the argument.

  Found by `@modyra/angular`'s battle sweep, which measured the failure and could not build the
  known-good case from outside — the third injector kind needed a real application, which this
  package's own suite has.

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
- Updated dependencies [965dd88]
  - @modyra/core@2.2.0
  - @modyra/widgets@2.1.0

## 0.7.1

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

- 2e29f30: A control rendered outside a form now says which control it is.

  `NG0201: No provider for InjectionToken MDY_FORM_ADAPTER` is true and unhelpful: it names the token,
  never the control, and the one that escaped the form is exactly the one that has to be found. The
  error now reads `<mdy-control-text> bound to "email" is outside a form`, and says that a control
  must be a descendant of `<mdy-form>` — including when it is rendered into an overlay or a dialog
  body, which is where this usually happens.

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

- 8d459d8: The published type declarations no longer import a path from inside this repository.

  `modyra-angular.d.ts` declared `import * as … from 'packages/core/dist/i18n'` — a module that exists
  only in the Modyra workspace. A consumer's build stopped with `TS2307: Cannot find module
'packages/core/dist/i18n'` on any project that type-checks its dependencies, and the only workaround
  was a `paths` entry in the consumer's `tsconfig.json` mapping that specifier onto
  `@modyra/core/i18n`. Every release from 0.2.0 to 0.7.0 shipped it.

  The declarations now name `@modyra/core/localization` and `@modyra/core/i18n`, both published entry
  points. **If you added that `paths` remap, remove it once you are on this version** — it maps a
  specifier the package no longer emits.

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

- dca6c26: A control bound to a row that has not been declared renders empty instead of throwing.

  `getField` answers `null` for exactly one reason — a path inside a keyed collection whose row is not
  declared — so the control now serves the inert state it already had for an unresolved binding, and
  binds when the row arrives. Every other path still creates its field on demand, so a mistyped name is
  unaffected by this.

- Updated dependencies [0b64826]
- Updated dependencies [ba5f5f9]
- Updated dependencies [faf3275]
- Updated dependencies [206b0b3]
- Updated dependencies [3d8391b]
- Updated dependencies [495ff44]
- Updated dependencies [8b88c9f]
  - @modyra/core@2.1.0
  - @modyra/widgets@2.0.1

## 0.6.2

### Patch Changes

- 974c73c: The Angular peer range starts at 21.2.19.

  `>=21.0.0` admits the patch releases carrying GHSA-jj27-h5hq-8x99 (i18n XSS in `@angular/core` and
  `@angular/compiler`) and the `HttpTransferCache` cache-key ambiguity in `@angular/common`. The range
  is what an installer resolves against, so a floor below the fix is an install that reproduces it.

  Consumers on Angular 21.0–21.2.18 update Angular to 21.2.19 or later. The exported surface is
  unchanged: `npm run contract:diff` classifies this patch.

## 0.6.1

### Patch Changes

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

- 02c4234: Angular derives its popup classes from the contract instead of restating them.

  Six templates carried the class list as a literal — `'mdy-datepicker__popup mdy-popup …'` — so a class
  added to the catalogue reached the renderers that derive and stopped at this one. That is how the
  popup-surface split passed conformance for two adapters and failed for the third until every template
  was edited by hand.

  Each component now reads `MDY_WIDGET_CONTRACTS.<kind>.parts.popup.classes`. Falsified rather than
  assumed: adding a class to the catalogue and rebuilding leaves Angular conformant with no template
  change, which is exactly the case that failed before.

  One consequence worth stating: the static Angular UI audit scrapes templates for class literals, so
  those classes leave its baseline — 31 entries. What it was guarding against is drift between Angular
  and the contract, and derived classes cannot drift. Conformance still verifies them, by mounting the
  component and inspecting the DOM, which is the stronger check of the two.

- 9144ce1: `@modyra/angular` ships a conformance config, so all three renderers answer to one driver.

  The adapter was already checked against the widget contract by its own suites — same
  `inspectWidgetDom`, same `MDY_WIDGET_CONTRACTS`. What it was not checked by is the kit, and the
  difference is what each covers: the jest suite calls `inspectWidgetDom` with no variant, so
  multiselect's counter mode was mounted nowhere in this package. The kit's anatomy pass mounts every
  declared variant, which makes coverage a property of the contract rather than of whichever suite was
  written.

  Run it with `npm run test:conformance`, which now runs all three.

  ```
  CONFORMANT WHERE CHECKED  ·  17 kind(s)  ·  6 of 8 section(s) run
  ```

  Two things the config measures rather than assumes, because the first attempt got both wrong: this
  renderer builds its overlays eagerly, so nothing is declared absent at rest; and the empty value of
  each kind comes from `MDY_CANONICAL_EMPTY` rather than from a table here, which had invented `""`
  where the contract says `null`.

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

- 6e25a0d: Every clock enforces the range the contract states, not just Plain's.

  Both renderers accepted a typed `25` or `61` through their own arithmetic and neither offered arrow
  stepping, so an impossible time was corrected somewhere downstream with nothing on screen to say the
  entry had been wrong.

  Both now consume `acceptTimeField` / `stepTimeField` / `timeFieldBounds`: an out-of-range segment
  carries `aria-invalid` and the range it expected, arrow keys wrap at both ends (12 → 1, 59 → 0), a
  step rescues a segment that is already out of range, and each box advertises its own `min`/`max`.
  Clearing a box is not an error — it is being cleared, not asserted.

  The three renderers now answer this the same way, with the ranges stated once. Each adapter's tests
  assert the _wiring_ rather than the arithmetic, since a contract nothing consumes is the failure this
  repo has recorded three times.

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

- 480c514: Supporting text is identified, so a screen reader can announce it.

  No element in the Angular package carried the `<fieldId>__description` id. All fifteen renderers
  emitted `<div class="mdy-supporting-text">` with no `id` at all, and two failures followed from that
  one cause:

  - **radio, slider, file and segmented** bind the shared projection, which names
    `<fieldId>__description` in `aria-describedby`. That id existed nowhere, so the reference
    **dangled** — the control claimed a description and the browser computed none.
  - **The other eleven** use a helper that only ever names the error list. Their supporting text was
    rendered, styled, and **announced to nobody**.

  The second is the failure `projectFieldShellA11y` already warns about for error lists — _"without
  `aria-describedby` the error list is rendered, styled, and announced to nobody"_ — reached from the
  description side instead.

  `descriptionId` now answers for the supporting-text element and every renderer binds it as `[id]`;
  `describedById` names the error list where there is one and the supporting text otherwise, so a
  control with neither still describes itself by nothing rather than by an id no element holds.

  Measured on the demo, before and after: **0 → 36** controls whose computed accessible description is
  non-empty, and **4 → 0** dangling `aria-describedby` references. Text like "Only PDF files are
  accepted" and "1 = Poor, 10 = Excellent" reached no assistive technology before this.

  Every existing check was green because they all stop at the attribute: they ask whether
  `aria-describedby` is present and whether it resolves in their own fixture, and those fixtures render
  errors. Nothing asked the browser what description it actually computed. `e2e/screen-reader.spec.ts`
  now does.

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

- a0717a3: The dynamic form arranges itself

  `<mdy-dynamic-form>` takes contract v2's `layout`: sections and column rows, nestable, with the
  classes and the column count coming from `@modyra/widgets` — the same vocabulary the framework-free
  renderer emits, so one declaration produces one grid whichever adapter drew it. Fields the layout
  does not name still render, after the arranged ones.

  Every field goes through a single template whether or not a layout is declared, so the two paths
  cannot drift apart, and the templates are declared inside `<mdy-form>` — outside it the controls
  lose the form's injector, which is exactly what the suite caught.

- a93815d: Angular names a popup's placement the way the catalog does

  `<mdy-overlay-panel>` emitted `mdy-overlay-panel--above` and `mdy-overlay-panel--overlay`. No
  stylesheet in the workspace has ever matched either — while the catalog had declared `above` and
  `overlay` as states of every popup part all along, and `@modyra/plain` now emits exactly that.

  The panel takes a `kind`, and reflects the placement through `partClasses(kind, "popup", …)`. A
  datepicker opening upwards wears `mdy-datepicker__popup--above`, which is the class the foundation
  styles and the class Plain writes. `below` carries none, as the catalog documents.

  `mdy-overlay-panel--above` and `--overlay` are **no longer emitted**. Nothing styled them, so no
  theme changes; a host that had written its own rule against those names should move it to the
  widget's popup class. `--right`, `--modal` and `--visible` are unchanged — they describe the panel
  element rather than the popup part, and the catalog names no state for them.

  Wired for datepicker, daterange, timepicker and multiselect. `select` and `colors` reach the same
  class without the panel — they own the element the state belongs on — and compute it directly.

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

### Patch Changes

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

- cc07c47: The adapters write custom properties by name, not by literal

  Angular and Lit each spelled `--mdy-overlay-left` and its seven siblings out by hand — Lit to write
  them onto the host and read them back into a style string, Angular to parse the numbers back out for
  the CDK. Both now take the names from `MDY_CSS_PROPERTIES` in `@modyra/widgets`, which is where
  `anchorOverlay` writes them, so the two sides of the same handover cannot drift apart. The slider's
  fill percentage follows the same route in both adapters.

  Lit's popup also sets `--mdy-overlay-max-width`, which it computed and then dropped: a content-sized
  popup near the edge of the viewport had nothing bounding its width.

  **Golden baseline change, classified as an extraction artefact.** `angular-ui.json` loses four
  entries — `mdy-slider-fill-pct`, `mdy-segments-count`, `mdy-label-left-offset` and
  `mdy-fl-input-padding-with-prefix`. None was ever a class: they are custom properties that the
  extractor's `\b` boundary matched without their leading `--`, so a manifest of classes had been
  carrying four properties since it was first written. The extractor now excludes them and the
  remaining 237 classes, 16 ARIA attributes and 40 selectors are unchanged.

- 6806ed2: Consolidate date-range endpoint input handling and reduce Angular renderer duplication without changing the Widgets-owned value policy.
- 65a93ce: Reduce multiselect renderer boilerplate while preserving the Widgets-owned value and overlay behavior.
- 5130090: Record and enforce the Patch 3 Angular renderer LOC baseline, including explicit budgets for the largest renderer hotspots.
- dcaaad9: Reduce boilerplate across the complete Angular renderer catalog while preserving templates, public APIs, Widgets-owned transitions and DOM behavior.
- 9113b69: Hold the Angular renderers to the runtime DOM contract in TestBed, with the same
  `inspectWidgetDom` the Lit and Plain suites use, so all three adapters answer to one gate. Eight
  renderers conform with no recorded divergences.
- 4d1f49d: Consolidate select adapter synchronization, remove unused exposed reconciliation state and lower the enforced renderer LOC budget.
- d12c02b: Restore the Widgets-to-Angular overlay lifecycle bridge so selecting a custom Select option hides the real overlay panel.
- c6a5654: Consolidate option identity, temporal display, calendar navigation and scalar DOM projection across the Angular renderer catalog without changing Widgets-owned transitions or semantic UI output.
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

- 9c0cd79: `aria-describedby` names an error list that exists

  Thirteen renderers pointed `aria-describedby` at the error list whenever the field had errors, and
  rendered that list under a different condition — only once the field had been touched, and only when
  inline errors were off. The two predicates disagreed on both axes.

  So an invalid but **untouched** field described itself by an element that was not in the document.
  That is not an edge case: it is the resting state of every required field on page load. A field using
  inline errors dangled even after being touched. A screen reader following the reference found
  nothing.

  The text kinds had the inverse defect and so never showed up as dangling: their fallback tested
  `inlineErrors &&` — the inverse of the render condition — so in the ordinary case they emitted no
  `aria-describedby` at all, and announced their errors to nobody.

  One predicate on the base control, `describedById`, now answers both questions: it returns the id
  the error-list component actually renders, and `null` when no list is there to name. Angular's
  supporting text carries no id, so a control with no errors describes itself by nothing rather than
  by an id nobody rendered.

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

- ff4edb2: One backdrop, not five names for it

  Every adapter draws exactly one backdrop — `mdy-overlay-backdrop`, from the overlay panel — and has
  since the panel took the job. The stylesheets had not caught up: `mdy-datepicker__backdrop`,
  `mdy-timepicker__backdrop` and `mdy-select__overlay-backdrop` were still styled across the foundation,
  Material and Angular's own timepicker sheet, matching nothing.

  `mdy-datepicker__popup--modal` and `mdy-timepicker__popup--modal` went with them, including the whole
  M3 dialog block keyed on the first. A modal panel wears `mdy-overlay-panel--modal`; the popup inside
  it keeps its own name and never had the modifier. The `__modal-header`, `__modal-label` and
  `__modal-value` parts _are_ emitted and are untouched.

  None of this changes a pixel: every rule removed was already matching nothing. What changes is that
  the dead category of the contract-coverage audit is now **empty** — 116 allowlisted entries down to
  111, and 30 fewer theme classes emitted by nobody.

  The audit itself was part of the problem: it read class names out of CSS **comments**, so the note
  explaining why a rule had been deleted kept the deleted rule alive in the report. It strips comments
  now, exactly as it already did on the TypeScript side.

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

- 9f20c63: An overlay is positioned once, by the box that draws it

  `<mdy-overlay-panel>` placed itself — `position: fixed` with all four insets, a width and a
  max-height — and _also_ published `--mdy-overlay-*` for the popup inside it, which the foundation's
  `.mdy-overlay` rule reads to place itself. Two boxes, at identical coordinates, agreeing only
  because both were derived from one measurement.

  Measured, in the built demo: unposition the wrapper and the popup does not move (`534×324@373,385`
  before and after); unposition the popup and the wrapper places it instead. Either one alone is
  sufficient, so one of them was always doing nothing. The popup is the one kept — it is the box
  anyone can see, the box the contract names, and the box the framework-free renderer positions.

  **The split was hiding a real defect.** `max-height` was applied to the wrapper, whose only child is
  out of flow, so it clamped nothing — while `--mdy-overlay-max-height` was never written at all and
  the popup fell back to the foundation's `50vh`. The room the placement policy measured did not reach
  the element it was measured for: 323px allowed, 360px granted. A popup with more content than room
  grew straight past the allowance the policy had just calculated for it. It now stops at it.

  The wrapper keeps what a wrapper is for — the top layer, the backdrop, the focus trap — and gains
  `inset: auto`, without which the UA's `inset: 0` for popovers would stretch it over the whole
  viewport now that it states no insets of its own, swallowing every click on the page behind it. The
  test measures that corner rather than trusting it.

  Visibility stayed on the wrapper: whether an overlay is showing is state, not placement. A browser
  without the Popover API keeps the panel in the page — the component says as much and carries on —
  so this is the only thing hiding a closed overlay there. Removing it surfaced a closed calendar to
  axe, which is how that was established rather than assumed.

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

- c1253e3: One way a popup appears, in every renderer

  The three adapters show a popup three different ways — Plain clears `hidden`, Angular calls
  `showPopover()`, Lit renders the subtree — and each appeared instantly. Except Angular, which forced
  itself visible with `visibility: visible !important; opacity: 1 !important` from a component-scoped
  `styles:` block. Being component-scoped, no theme could reach it; nothing in the foundation or any
  theme ever made the panel invisible, so it was guarding against nothing while pinning the one
  property an open/close animation needs.

  The shared `.mdy-popup` container now owns the transition, spelled through the motion tokens
  `modyra-base.css` already ships. `transition-behavior: allow-discrete` on `display` and `overlay` is
  what makes one declaration cover all three: the fade finishes before the popup leaves the layout or
  the top layer, instead of being cut off on the first frame. `@starting-style` gives it a value to
  animate _from_ — without it the popup still appears instantly however long the transition says it
  lasts.

  Opacity only. `transform` carries the centring translate a modal placement writes through
  `--mdy-overlay-transform`, and animating it would drag the popup across the viewport on the way in.

  The blanket `prefers-reduced-motion` rule already covers this: it matches `[class*="mdy-"]`, so the
  transition is neutralised for anyone who asked for that, with no new guard.

  Degrades safely. A browser without `@starting-style` or `allow-discrete` has no start value to
  interpolate and shows the popup instantly — exactly today's behaviour.

  Angular's component `styles:` block is removed. `mdy-overlay-panel--visible` is still emitted and
  still unstyled, as before.

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

- 2679735: The accessibility suite opens the popups it audits, and three defects fall out

  The axe suite ran over a form with every popup closed. Closed, they are invisible to axe — an
  overlay panel carries `visibility: hidden` and axe skips hidden subtrees — so everything a popup
  _contains_ was outside the suite entirely: the calendar's grid, the clock's dial, a listbox's
  options. That is most of the ARIA in the library, untested by construction rather than by decision.
  Each popup is now opened through its own trigger, the way a user opens it, and audited open.

  Three violations were waiting.

  **Calendar rows had no grid (critical).** `.mdy-datepicker__row` and the weekday header declare
  `role="row"`, which ARIA requires to sit inside a grid, table or rowgroup. `<mdy-calendar-grid>` and
  `<mdy-range-calendar-grid>` declared no role at all, so every row in every calendar was an orphan.
  Both hosts now carry `role="grid"`.

  **A modal panel was a nameless dialog (serious).** `<mdy-overlay-panel>` took `role="dialog"`
  whenever it had a backdrop and never had a name. For the datepicker it was worse than nameless:
  `<mdy-calendar>` inside already declares a _named_ dialog, so a screen reader was handed a nameless
  dialog wrapping a named one. The rule is now that **the element carrying the role is the element
  that has a name** — a popup whose content announces itself leaves `dialogLabel` unset and the panel
  goes back to being a positioned host; the clock and the palette, whose content does not, pass a name
  and are announced there. The focus trap is unchanged and still keyed on the backdrop: trapping focus
  is not the same question as who says the word "dialog".

  **A colour input nested inside a button (serious).** An invisible `type="color"` was stretched over
  the picker button as its click surface — a focusable control inside a focusable control. The button
  beneath already carried the same handler, the same disabled state and the accessible name, so the
  input contributed the defect and nothing else. It is now a sibling and takes no pointer.

  One thing worth writing down: the first attempt to explain these fixes in comments broke the golden.
  The audit greps `aria-*` out of renderer source, and axe _rule names_ — `aria-required-parent`,
  `aria-dialog-name` — read exactly like attributes the renderers emit. Two rule names entered the
  golden as ARIA surface. Teaching the audit to strip comments looked right and was worse: it also
  dropped genuinely emitted attributes, shrinking what the golden guards. The comments were reworded
  instead, and the golden verifies byte-identical at 237/16/40.

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

- d082bf8: The colour palette is placed by the contract, and three stylesheets stop placing it

  The `material-positions-colors-popup` debt, closed — and its cause was not in the themes.

  **Angular's palette was the one popup in the catalog not wearing `mdy-popup`.** The catalog declares
  `partClasses("colors", "popup") === ["mdy-colors__dropdown", "mdy-popup"]`; the framework-free
  renderer applies it, Lit derives it, and the Angular renderer spelled a single class by hand. The
  foundation therefore could not place it — so the foundation, Material and iOS each carried a copy of
  the popup primitive for this one widget: position and insets, `display` for open and closed, and
  their own `--above` and `--overlay` rules re-deriving the placement class names
  `popupPlacementClass` already produces. The theme rules were the consequence; the missing class was
  the cause.

  The palette now wears `mdy-popup mdy-overlay` and the three copies are gone. What the stylesheets
  still say is what a palette looks like — and no longer where it goes.

  Two things measurement decided rather than reasoning:

  - **`mdy-popup` alone put it off-screen at `x: -928`.** A popup inside an overlay panel is not itself
    the popover, so it stays `position: absolute` and resolves its insets against whatever is
    positioned above it. `mdy-overlay` is the portal variant that means viewport coordinates — which
    is exactly why the framework-free renderer has carried both all along.
  - **A widget cannot state its own surface in an earlier layer than the primitive it opted into.** The
    palette's background and its roomier padding sat in `mdy.base`, and `.mdy-popup` is in
    `mdy.components`; the palette lost both the moment it joined. Restating them as
    `--mdy-overlay-padding` and `--mdy-overlay-surface-color` fixes it wherever the primitive's own
    declarations win — and where a theme declares `padding` on `.mdy-popup` outright, as
    `modyra-modern.css` does, the theme has to say it for the palette too. It now does.

  Measured across all four stylesheets after the change: `position: fixed`, drawn, inside the viewport,
  below its control, each with its own surface and its 20–24px of padding. The new demo test asserts
  exactly that, per theme, and fails against the previous code.

  Two findings recorded rather than fixed: `modyra-material.css` collapses the palette's trigger to
  zero height, and every popup in `modyra-modern.css` re-declares what the overlay properties exist to
  carry.

- 182dfe8: The select's list is placed by the contract, not by a copy of it

  Closing the colours-palette debt turned up the same shape one widget over. The foundation carried a
  second implementation of the popup primitive for the select list: `.mdy-select__dropdown` positioned
  itself `absolute` at `top: 100%` while closed, and a sibling rule re-read every `--mdy-overlay-*`
  property to switch it to `fixed` while open. Both said what `.mdy-overlay` already says.

  That duplicate is also why nobody noticed the class was missing: Angular's select popup wore
  `mdy-popup` but not `mdy-overlay`, and the copy was quietly doing the primitive's job. The
  framework-free and Lit renderers have carried both all along. Angular's does now, and the two rule
  blocks are gone.

  Measured before and after, across all four stylesheets — `modyra`, `modyra-modern`,
  `modyra-material`, `modyra-ios` — the list's position, offset below its control, width against the
  trigger, left edge, radius and background are **byte-identical**. The duplication went; nothing
  moved.

  A census while there: `multiselect`, `datepicker` and `timepicker` still carry the same copies, and
  so does every widget's `--overlay` modal block. Recorded rather than swept in — each is a renderer
  class plus a stylesheet block, and each deserves its own before-and-after.

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

- 92d6155: Move HEX normalization, invalid draft preservation, preset selection and active-color comparison into Widgets.
- 4b2560b: Complete normalized Angular structural parity evidence for overlay, temporal, color and file controls.
- d981a2f: Add explicit per-renderer contract-part and ARIA projection evidence and make Patch 3 readiness fully enforceable.
- 6bff3da: Move datepicker modal draft, confirm and cancel transitions into Widgets while leaving Angular responsible only for rendering and DOM focus execution.
- bbb575e: Move datepicker bounds validation and canonical value transitions into Widgets, removing duplicated Angular dirty and touched mutations.
- 8061d1d: Move date-range modal draft, completeness, confirm and cancel transitions into Widgets.
- de65e03: Move date-range normalization, bounds, filter and endpoint-order transitions into Widgets and route Angular dirty/touched state through the shared bridge.
- 93a65aa: Move file accept, size, count, single/multiple, rejection and clear transitions into Widgets.
- 2388e2a: Move multiselect overlay keyboard, active-option navigation, close and restore-focus decisions into Widgets.
- cf9b772: Move multiselect toggle, counter, clear and overlay selection transitions into Widgets and remove duplicated Angular mutations.
- dc7acff: Move segmented option navigation and selection transitions into the framework-agnostic Widgets contract.
- e6e592d: Move overlay open, toggle, outside interaction, Escape, destroy, announcement and restore-focus decisions into Widgets.
- 3846236: Replace the stale Patch 3 readiness heuristic with explicit per-renderer behavior evidence, shared overlay checks and the first normalized Angular structural parity fixtures.
- ca2ad59: Route remaining user-driven text, segmented, color and select state transitions through Widgets and enforce the Angular renderer ownership boundary.
- c136ad1: Move scalar input, selection, dirty, touched, disabled and readonly transitions into a shared framework-agnostic Widgets controller, and make Angular scalar renderers dispatch intents through that controller.
- 0b4298b: Move select keyboard decisions and native value transitions into the framework-agnostic Widgets contract.
- 847f436: Move select option normalization, parking and restoration into Widgets and remove the final renderer ownership exception.
- 9b2646a: Move timepicker clock hour, minute, period and dial snapping transitions into Widgets.
- fd6e967: Move timepicker draft, confirm, cancel and typed-input transitions into Widgets and route dirty/touched state through the shared bridge.
- 4206be3: Establish the complete canonical Widgets catalog and machine-verifiable Angular ownership matrix while preserving the protected Angular semantic UI surface.
- ff10fc7: Replace self-declared widget completeness with typed anatomy, runtime controllers, source evidence, and observable Angular contract consumption while preserving the protected Angular UI surface.
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

## 0.4.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [318e721]
- Updated dependencies [1bb844f]
  - @modyra/core@0.4.0
  - @modyra/widgets@0.4.0

## 0.3.0

### Minor Changes

- 7554cc8: Injection prevention at the engine's write choke point. New `security` form option: sanitization profiles (`"text"` strips control/bidi/zero-width characters, `"strict"` also strips markup characters), per-field overrides and custom sanitizer functions via `field(..., { sanitize })`, `maxValueLength` string caps, and an `onViolation` telemetry hook. Always-on structural checks: restored draft entries are shape-validated against the declared field type, and submit-returned errors with prototype-polluting paths are dropped. Sanitization is opt-in in 0.x (`"off"` by default) and covers every write path — user input, `patch`/`setValue`, draft restore, array operations. See `docs/guides/security.md`.
- fc22197: Option whitelisting (client-side anti-tampering). New `oneOf`/`eachOneOf` validators: a select offering "one"/"two" now rejects a scripted `set("three")`. Option-based dynamic fields get the whitelist automatically — `buildDynamicFieldValidators()` constrains `select`/`radio`/`segmented` values and every `multiselect` element to the declared `options`, and `<mdy-dynamic-form>` uses it, so CMS/LLM-generated configs are tamper-resistant with zero extra code. `docs/guides/security.md` gains a trust-model section: client checks are defense-in-depth, and the same schema can gate the API server-side (isomorphic pattern with `@modyra/zod`).

### Patch Changes

- f0c8697: Fix invalid `aria-expanded` on datepicker, daterange and timepicker text inputs (axe `aria-allowed-attr`, critical): the expanded state now lives on the toggle button that controls the overlay, matching the APG date-picker-dialog pattern. Adds axe-core accessibility tests over the main renderers and a Playwright browser smoke test over the packaged demo.
- Updated dependencies [c7dadfb]
- Updated dependencies [7554cc8]
- Updated dependencies [fc22197]
  - @modyra/core@0.3.0
  - @modyra/widgets@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [fd1e9d8]
  - @modyra/core@0.2.0
  - @modyra/widgets@0.2.0

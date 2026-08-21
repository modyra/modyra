# @modyra/angular

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

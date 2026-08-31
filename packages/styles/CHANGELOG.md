# @modyra/styles

## 0.9.0

### Minor Changes

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

- 217a3b7: The steps every length is written in terms of.

  `modyra-scale.css` is tier one: eight scales — space, size, leading, radius, stroke, control, focus,
  duration — and the only place in the system where a length is a number. Nothing consumes it yet; it
  exists so that what does can be checked against it.

  Measured before it: 206 custom properties, every one per-component, no shared step of any kind, and
  167 sizing declarations written as literals — eleven distinct `gap` values, ten `font-size`, sixteen
  `padding`. The scale was already latent. `0.875rem` appeared seven times and is a type step; `16px`
  and `1rem` are one step written in two units.

  Each scale states its basis in the header, because a list of numbers gets edited by whoever needs a
  different number. Three of those bases are conformance rather than taste:

  - **0.75rem is a floor**, not a smallest-so-far: below 12px, text stops being readable for a large
    population and zoom does not recover it for everyone.
  - **1.5 line height is the body default**, not the top of the scale, because a reader may set it
    there and the content must survive.
  - **28px is the smallest control height that can hold a conformant 24px target**, so it is the floor
    of the control scale and not a style choice — and 36px holds one with clear zone on each side, so
    the minimum target size is satisfied by construction rather than by measurement.

  A theme keeps everything it had: it still says what a component is, and may replace this file
  wholesale to shift every step at once. What it gives up is inventing a value between steps.

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

### Patch Changes

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

- 9a98126: A chip's ceiling bounds it again.

  The previous release replaced two constant caps with `max-width: 100%`, meaning "as wide as the strip
  and no wider". **Inside a scroller `100%` resolves against the scrolled content**, and the scrolled
  content is as wide as the chips make it — so the ceiling was the thing it was meant to bound, and a
  long value grew past the field that holds it:

  ```
  before   field 684px  ·  chip 1299px  ·  label 1177 of 1177, nothing cut
  after    field 684px  ·  chip  668px  ·  label  594 of 1177, cut with an ellipsis
  ```

  The machinery for shortening was still there — `overflow: hidden`, `text-overflow: ellipsis` — with
  nothing left to bite on.

  The ceiling is now `100cqw` against the widget's box, which takes its width from the field rather than
  from the chips. The strip cannot be the query container: its own width _is_ the chips, and a container
  that sizes to its contents cannot also size them — asked to, it collapses to zero.

  The strip still scrolls. Scrolling is for reaching the chips past the edge, not for reading one chip in
  instalments.

- b287f3f: A chip's ceiling is the strip it sits in, not a constant.

  A value chip was capped at 12rem, and a second cap of 11rem sat on the base chip. Both are constants,
  so a label was cut while three quarters of the field around it was unused — and a label cut to a few
  characters renders two different values identically, which is the strip no longer saying which one was
  chosen. Bounded by its container instead, a chip is shortened only when one value really is wider than
  the room there is, and the strip scrolls before that.

  `--mdy-chip-max-width` is gone from the base and from the material and iOS themes: a theme that set it
  was setting a constant this rule no longer has.

- d5e02f1: A value chip stands on the control scale.

  Its height was `calc(var(--mdy-chip-height) - 0.5rem)` — the filter chip's 32px less half a rem,
  arriving at 24. That is below the floor at which a control can hold a conformant 24px target, and it
  was reached by an arithmetic nobody could argue with because nothing said what it was for.

  It is `--mdy-control-1` now: 28px, the smallest height that can hold that target with its border. The
  strip is 4px taller for it, and the remove button no longer needs the 24px floor it was carrying — it
  grew into the chip's border to reach a size the chip could not give it. The floor belongs to the
  control scale, not to every control that has to reach it.

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

- 6fab2aa: A closed popup's contents are not drawn in the page

  The browser hides a closed popover, and any author rule that states `display` on the panel beats it.
  A panel class that lays its contents out — `.mdy-multiselect-overlay__panel { display: flex }` — is
  exactly such a rule, so Angular's shut multiselect drew its whole option list in the page: every option
  seen twice, announced twice, and clickable in two places.

  `[popover]:not(:popover-open) { display: none }` is stated once in the foundation rather than by
  scoping each panel class to `:popover-open`. The property being defended belongs to the popover and
  not to any one widget, and a class added later would otherwise have to remember.

- 57fcb30: The reading position in an option list is visible

  A multiselect's cursor was announced through `aria-activedescendant` and drawn by nobody. Lit and
  Angular each set `mdy-chip--active` on the option the keyboard stands on — a class the catalogue never
  declared and no stylesheet drew — and plain set nothing at all, because it applied the projected part
  and then wrote a locally built class list over it.

  `multiselect.option` now declares the `active` state, the projection emits it for the option
  `activeKey` names, plain stops overwriting what it was given, and the theme draws it. Renderers
  already using the class keep working unchanged; one that draws its own cursor should drop it in favour
  of the part's.

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

- 3bc4695: The two modern units carry a literal fallback.

  `max-width: 100cqw` and `min-height: 1lh` are each preceded by a literal, which is the cascade's own
  fallback: a browser that does not know the unit drops the second declaration and keeps the first.
  Measured with an unknown unit standing in for an unsupported one — `320px` and `21px` instead of
  nothing at all.

  Without it, the failures are silent and each undoes a decision: a chip with no ceiling grows past the
  field it sits in, and the way-back row reserves no line, so the page steps down 21px on every removal.

  **Neither may be stated through a custom property.** A `var()` parses whatever it holds, so the failure
  moves from parse time to substitution — where it takes the _inherited_ value rather than the
  declaration above, and the fallback is gone with the linter still green. The tier-1 scale therefore
  holds plain values, and a rule that wants a modern unit writes it with its literal beside it.

- b7f8ee4: The chip strip wraps by how wide the field is, not how wide the window is.

  WCAG 1.4.10 asks content to reflow to 320 pixels without a second scroll direction, and the strip
  answers by wrapping at that width. It asked the **viewport**, and the thing it is about is the strip:

  ```
  viewport 1400, field 284   before: no wrap, 1067px of chips in 252px of view
                             after:  wraps
  viewport  320, field 288   wraps, before and after
  ```

  A multiselect in a narrow column inside a wide page was in exactly the state the rule exists to
  prevent, and the query could not see it. **A component that asks the viewport is guessing about a page
  it cannot see.**

  The box already declares itself a container — the chip ceiling reads it — so this costs nothing but
  the word. The threshold stays 320 and now means the field: at a 320px viewport the field measures
  about 284 with the page's own padding, so it covers that case and the narrow-column one with it.

  This was the sheet's only width media query. The other fifteen are preferences and capabilities —
  `prefers-color-scheme`, `prefers-reduced-motion`, `forced-colors` — which are the window's to answer.

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

- 5631dcc: A target keeps its floor when the page shrinks the root.

  A `rem` grows with a reader who enlarges their text — and **shrinks with an application that writes
  `html { font-size: 62.5% }`**, the ten-pixel trick, still common. Nothing here controls that
  declaration and nothing can see it.

  Measured at three roots, identically in all three renderers:

  ```
  62.5%   chip 202×18 · its buttons 32×16 · clear-all 18×35     under the 24×24 floor
  100%    none
  200%    none
  ```

  **200% is the direction everyone tests, and a target can only grow there.** 62.5% is the only one where
  it falls through, and it was the one nobody ran.

  The control steps and the affordance sizes are `max(<proportional step>, <floor>)` now: the step still
  rises with the reader, and it cannot fall through a conformance floor on the way down. The scale's own
  comment already said _"the floor is not a style choice"_ — the value did not carry it.

  `px` for strokes and the focus ring stay `px`, for the reasons already recorded.

- f2a4c03: A label that floats where the text begins

  The floating label was positioned with `left` and shrunk from `transform-origin: left top`, so under
  `dir="rtl"` it stayed on the left while the field it labels ran the other way — measured 10px from
  the left in both directions, on a control whose own text begins 10px from the right. At rest the
  label stands in for the placeholder, so it belongs at the edge that text starts from.

  `inset-inline-start` now, with the origin flipped for `rtl` because `transform-origin` has no logical
  keyword with usable support — so the one case that needs it is stated rather than derived.

  No screenshot changed, and that is the finding underneath: **nothing on any demo page draws this
  mode**, in any of the three renderers, though two of them publish it. A block of the foundation was
  covered by no picture and no check. `e2e/lit/a-label-that-floats-where-the-text-begins.spec.ts` is
  the first, applying the class lit's own `floatingLabel` property toggles.

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

- b1ec5c8: Four marks survive a forced palette.

  When a person turns on a high-contrast palette, the system replaces backgrounds, borders and text
  with colours it guarantees. Two techniques in this sheet conveyed meaning by colour alone and both
  came out blank:

  - **A mark made by masking a coloured box.** The mask survives — the shape machinery is untouched —
    but the box it clips is repainted the surface colour, so the mark is still being drawn, in the
    colour of what is behind it. The chip's remove and move marks are drawn that way. A comment beside
    them claimed a mask "takes the system's own colour"; measured, only the shape survives, and the
    comment has been corrected.
  - **A box that is only a fill.** The toggle's thumb, and the slider — whose line is a gradient, and a
    forced palette drops background _images_ outright. Its track and its handle both vanished, leaving
    a control that keeps its size, its name, its role and its keyboard with nothing on screen, for
    exactly the people who turned the palette on because they could not see well enough without it.

  Repainted in the system's own text colour, which a forced palette keeps. The slider's line is drawn
  as a border and its handle where the platform actually puts it, because neither survives as a
  background.

  Not `forced-color-adjust: none`: that opts the element out of the palette and keeps our colours for
  the one person who has said they cannot use them.

- 8007ed6: Pressing the mark that says "this opens" no longer empties the field.

  Reported by a person, reproduced in all three renderers. Scanning what answers a press across the
  caret, at its own height:

  ```
  before   1144 clear-all   ← the caret starts here
           1160 clear-all   ← clear-all starts here
  after    1144 trigger     ← the caret's press opens the list
           1160 clear-all
  ```

  **A 44px target on a 28px control has sixteen pixels to put somewhere, and at a multiselect's trailing
  edge both directions are taken**: outwards is whatever the form draws next — a press three pixels past
  the border once activated the colour toggle, which is why it was grown inwards — and inwards is the
  caret, which is exactly sixteen pixels wide. Grown inwards it covered the caret whole: the value went,
  the list did not open, and nothing said why.

  No choice of direction resolves that. What does is that the overlay is not needed: the floor is 24×24
  (WCAG 2.5.8, the exception `DESIGN.md` already records for stacked steppers) and both controls are a
  control step wide and the row's full height. **The box is already the target.** The overlay was left
  from when it was not.

  `a-target-too-small-to-hit` is green, so nothing fell under the floor with it.

- 816c6bd: Thirty-one declarations move onto the scale, most of them the timepicker's.

  A length written in `px` stays where it is while everything around it grows for a reader who enlarges
  their text, and a length written as a literal is a value nothing else in the library shares. These are
  now steps where a step is exact — `gap: 16px` is `--mdy-space-4`, a 20px glyph is `--mdy-size-5` — and
  `rem` where none is.

  Three are judgement rather than arithmetic:

  - **A date control's right-hand clearance** was `40px` and is now the affordance column's own
    arithmetic, `calc(box + inset * 2)`. Four pixels tighter, and it follows the column instead of
    sitting near it.
  - **The timepicker's mode toggle** was 32×32. It is a control inside a dialog, so it takes the step
    every other in-field affordance takes.
  - **The hour and minute numerals** are 45px, which is no step and should not be forced into one: a
    numeral read across a room is not a word read in a line. The size scale gains a display step at
    Material's display-medium, exact at the same 45px.

  `em` is converted along with `px`, for the reason `DESIGN.md` gives for leading: it multiplies a size
  the theme chose by a number the host chose, and only some of those products land on the pixel grid.

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

- 840fec6: A colour panel keeps its colours under an imposed palette

  Where a person imposes their own colours, the system repaints backgrounds — and six swatches became
  two. The question "which colour do you want" was asked over a row of near-identical squares, and every
  contrast check passed the whole time, because each forced tint contrasts well with the surface and
  nothing measures whether they differ from _each other_.

  This is the one control in the library whose colour is its content rather than its decoration, so it
  is the one place a forced palette is refused. Only the fill: the border, the selected ring and every
  word in the panel obey the imposed palette as before, and the swatches carry a name, so they stay
  distinguishable without their colour at all.

- 3c05c8e: A placeholder the theme can reach

  Angular dimmed its native select with an inline `opacity: 0.6` while nothing was chosen. Two things
  were wrong with it beyond the duplication: it dimmed the whole control, arrow included, where the
  other shape dims only the placeholder's own text — and an inline style is the one thing a theme
  cannot override, so a design system had no way to change it.

  The foundation states it instead, and asks the element about its own state rather than requiring a
  renderer to say: the entry for "nothing chosen" is the option standing in a native chooser, so the
  control is showing a placeholder and takes the placeholder's colour. Both renderers of that shape get
  it without either of them knowing.

- f72210b: A toggle and a checkbox show their refusal to the eye, not only to a reader

  A refusal is painted from `[aria-invalid="true"]`, and everywhere else that attribute sits on the
  element that is drawn. On these two it belongs to the control — a native input the eye never meets,
  because the track and the indicator are what is painted — so the rule landed on nothing.

  The field announced itself refused to a screen reader and looked exactly like one that works. A
  person who can see it tries it, gets nothing, and is told nothing.

  Written through the control rather than on it, which is the shape the checked state already uses two
  rules away: `.mdy-toggle:has(.mdy-toggle__control[aria-invalid="true"]) .mdy-toggle__track`. The edge
  takes the error colour, which is what a refusal is drawn in everywhere else in this sheet.

  Found by asking which element carries `aria-invalid` for each kind: four carry it on the surface a
  person sees, and these two do not. No theme in this repository has a single `--invalid` class rule —
  the refusal has always been drawn from the attribute — so the gap was exactly as wide as the two
  kinds whose attribute is out of sight.

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

- c5da035: A multiselect keeps one line, as its own decision record says it must.

  With eight values the chips wrapped to a second line **outside the field's border**, painted over
  whatever the form drew underneath, and pushed the count and the affordances below the box meant to
  contain them. Three properties held at once: the row could wrap, the field could not grow, and nothing
  clipped what did not fit. Any two of those are a design.

  ADR 0127 already decided between them — _"the row keeps one line and scrolls horizontally… a wrapping
  row grows with what is put in it, so wrapping and that rule cannot both hold"_ — and `modyra-modern`
  set `flex-wrap: wrap` twice anyway: on the chip strip, and on the widget's own box, where it let the
  opener and the clear-all drop to a second line of their own.

  Both removed. The foundation still wraps the strip below 320px and only there, where reflow is worth
  more than equal heights, with the reasoning written beside the rule.

  The two affordances at the end of the field take the row's height and carry their 44px pointer target
  as an overlay, which is what every other trailing affordance already did.

- ab52de5: A multiselect fits a 320px screen, as ADR 0137 decided it would

  The record chose one line at comfortable widths and several below a breakpoint, on the ground that a
  page which scrolls down must not also make a person drag sideways to read a value. The rule was
  written, and it applied to the wrong element: `flex-wrap` sat on the strip while the chips are held by
  the row inside it, and a flex container with one child wraps nothing however it is told to.

  The row was inserted between the two by a later decision, which left the rule addressing a tree that
  no longer existed — visible in the sheet, satisfied by nobody. Wrapping is now stated on the element
  that holds the chips, and the chips are allowed to give way so one long label cannot make the row wide
  on its own.

- d19a7ad: A slider that wears its own theme, and a control beside its button rather than inside it

  **The slider's track read the raw system colour where every other accented control reads the theme's
  own accent.** Material tones its primary — `oklch(from …)` — so the slider came out near-black under a
  theme whose accent is indigo, and the two were never compared because both are "the primary" one
  indirection apart. `--mdy-comp-slider-active-track-color` follows `--mdy-primary`, with the system
  colour as the fallback for a theme that does not derive one.

  **And lit's colour field put a native `<input type="color">` inside a `<button>`** — a control nested
  in a control, which is invalid HTML and reachable only by accident: the outer one takes the press, and
  what a pointer lands on depends on which browser is asked. The input sits beside the button now.

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

- 7c5f09a: A switch that is on no longer looks unavailable

  The themes reached a switch's state through `.mdy-toggle:has(input:disabled)` — any input inside the
  switch. That was correct while a switch held one input. It now holds two: the hidden companion that
  makes a boolean submit as `false`, and that companion is disabled **exactly while the box is ticked**.

  So a switch that was on was painted with the treatment for one that cannot be used: pale track, grey
  thumb, `opacity: 0.5`, across four themes.

  The rules now name the switch's own control — `.mdy-toggle__control` — as the checkbox rules beside
  them already did. Nothing else moves: a genuinely disabled switch still gets the disabled treatment,
  verified by forcing it.

  **If you wrote a theme rule that reaches a control with a bare `input` selector, it now has two
  elements to choose between.** `.mdy-toggle__control`, `.mdy-checkbox__control` and the other part
  classes name the one a person sees.

- d3dc6d0: A chip's remove button is a target a person can hit, and pressing a chip's body does one thing.

  **The target.** The ✕ measured 32×22 — two pixels short of the 24 CSS px **2.5.8 Target Size
  (Minimum)** asks for, because the chip is 24 tall counting its own border and the button inside it
  took `height: 100%` of what was left. The spacing exemption was unavailable: the nearest other target
  is 13px away. The button now states a 24px floor and grows into the chip's border, so the row does not
  grow around it.

  Two pixels is not a rounding error for the people that criterion exists for. Aiming for the middle is
  the only strategy a head pointer or a switch has, and the control beside this one deletes a value.

  **The body.** `@modyra/lit` opened the list when a chip's body was pressed, where the other two
  renderers focused the chip and left the list closed. Its box asked whether the press had crossed a
  `<button>` on the way up, and a chip is a `<span>` — so a chip fell through to the opener. The box now
  forwards a press on **its own** area only, which is what ADR 0142 says it does: what a press does is
  decided by what it landed on, not by what that thing is made of.

  All three now focus the chip and open nothing, which is the published answer for a composite with a
  roving tab stop — it puts the keyboard where the pointer went, and it is the only route by which
  somebody who arrived with a mouse reaches the strip's key map.

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

- f77657b: Twenty-three component tokens hold a step instead of a number.

  A token below the scale holding a literal is a value a theme cannot move: change the scale and
  everything follows except those. Padding, gaps, offsets and hairlines now read from the scale —
  `--mdy-input-padding` is `space-2 space-4`, a `1px` border is `--mdy-stroke-1`, the focus underline is
  `calc(-1 * var(--mdy-stroke-2))`.

  Two moved to the nearer step rather than staying literal: the chip's internal gap (0.375rem → 0.5rem)
  and the overlay's padding (1.25rem → 1.5rem). The number stepper's size stops being its own 1.5rem and
  reads `--mdy-affordance-target-stacked`, the token `DESIGN.md` already names for a stacked control.

  Eleven properties are deliberately left, in two groups: three have no scale to belong to — a popup's
  maximum height is a viewport question, not a spacing one — and eight are the floating label's `calc`
  derivations, where a step inside the arithmetic would not make the result a step.

- 013ca17: A way back a person can see

  The control that takes a file off was painted in the error colour, which is a saturated red used as
  small text — and a saturated red clears 4.5:1 on neither a light surface nor a dark one. Measured at
  2.88:1, 3.22:1 and 1.61:1 across the themes, on the one glyph a person needs in order to undo a file
  they attached by mistake.

  It takes the surface's own text colour now, which is readable on that surface by construction, and
  the destructive meaning arrives on hover and on focus, where a colour has a state to carry rather
  than a permanent cost. That is also what the platforms do: a removable attachment is dismissed with
  a neutral mark, not a warning.

  `DESIGN.md` said muted text is reading text and said nothing about a control's glyph. It says both
  now: a control's glyph is reading text too, and the reason is that the affordance a person needs in
  order to correct a mistake is the last one that may be hard to see.

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

- 34dc12d: A field keeps its edge when the system supplies the palette

  `.mdy-input-wrapper` draws its edge with an inset `box-shadow`, and a forced palette drops shadows
  outright — along with the wrapper's background, which is repainted the surface colour. So the box a
  person uses to see _where_ the input is had no edge at all, in the one mode chosen by people who need
  edges most.

  What survives is a border, which is the answer the slider's track already needed one rule below. Only
  on the block end, because that is the edge this shape has: a filled field is a surface with a line
  under it, not a box. Focus and refusal keep their heavier weight.

  **It was reported against the wrong part, and the reason is worth keeping.** The sweep named
  `email.errors` — 5.6% of its pixels painted, then nothing. But the fields in that sweep are mounted
  with no rules and never touched, so no kind has an error message at all: what it photographed was not
  the error text. `.mdy-control__errors` is transparent and absolutely placed at the bottom of the
  renderer, directly over the wrapper's underline, so the crop caught the edge _behind_ it. And
  `inputWrapper`'s own crop starts at its top and stops short of a 56px-tall field's bottom line, so the
  only part that could see that edge was the one it does not belong to.

  Not `email` either: it was the one kind whose error box happened to overlap an edge.

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

- 97b964d: Three strays off the size alphabet: the slider's box, the standalone button, and three spellings of a
  full corner.

  - **A range input stood 20px tall.** Its height was the track's 4px and it took a text field's padding
    on top, as `content-box`, so the control was whatever the sum happened to be — under the 24px a
    pointer target needs. The element is a control step now, `border-box`, and the 4px track paints on
    `::-webkit-slider-runnable-track` / `::-moz-range-track` where its thickness is its own.
  - **`.mdy-button` was 40px**, four short of WCAG 2.5.5 and a fourth height in a library that names
    three. It stands on its own with no overlay to carry a target for it, so it takes the 44px step.
  - **A full corner was written three ways** — `50%`, `calc(height / 2)` and `9999px`. One spelling now,
    on the radio, the two round toggles and the switch track; on a square they draw the same circle.
  - **The checkbox's 2px corner** is Material's own and the only 2 in the library. The default takes a
    radius step; the Material theme points back at the reference token, where fidelity is the point.

  The radius alphabet is within its scale: three values where five are allowed, from six.

- 72d5689: Everything in a field's row shares its centre line.

  A multiselect's chips sat 8px below the middle of their field and hung 3px past its bottom edge. The
  cause was not the field's height: it is `--mdy-input-height`, which is already `control-2`.

  **Three affordances were sized to a tap target instead of to a control step.** The caret, the clear-all
  and the overflow button each took `--mdy-affordance-target` — 44px — as their _height_, inside a field
  whose row is 36. The flex line became 44, so a 28px chip centred against it landed 8px low and its
  lower edge fell outside the box.

  A target is not a size. The caret takes the glyph's box, because it is `aria-hidden` decoration and the
  opener is what a person presses; the clear-all and the overflow stretch to the row, as the opener now
  does. Measured in the demo, every part of the row is 28px tall at the same offset:

  ```
  before   chips 28h at 13   trigger 44h at 5   3px past the bottom
  after    chips 28h at  5   trigger 28h at 5   inside, and on one centre line
  ```

  The four per-theme centre-line checks pass in all four shipped themes.

- df866d8: A chip is one height, and the affordance column does not bend around one kind.

  Two more values left off the control scale by the same half-migration:

  - **A chip was 28 in the field and 32 in the popup.** The value chip moved onto `control-1`; the chip
    a person picks from did not, so one control was two heights depending on where they were looking at
    it. Both are `control-1` now, including the counter variant that carries its own height so its step
    buttons have something to be 100% of.
  - **The clear-all was 44 wide** where every other trailing affordance is 28, so its centre sat 8px
    further in and the column bent around one kind. Its width is a control step; its 44px pointer target
    is the overlay it already carries, which needs no width from the box.

- 3fd899b: A date range's two ends carry a class each, so a sheet stops counting `<input>` elements.

  `startControl` and `endControl` are two declared parts and they carried the same two classes, so the
  only way to round the left end of the pair was `:first-of-type` — a rule that counts elements of a tag
  while reasoning about a class. Put a hidden native input or a sizer of the same tag in the group and
  the rounding moves to the wrong end.

  Each part gains a class of its own — `mdy-daterange__input--start`, `mdy-daterange__input--end` — and
  the three renderers take their classes from the contract rather than repeating a string. The two
  positional rules, in the base sheet and in the iOS theme, name the end they mean.

  Additive: both parts keep the classes they had.

- 52a3b07: Three things a field draws, corrected.

  **One name, one element.** `@modyra/lit`'s colours and daterange fields each rendered their own
  `.mdy-input-wrapper` inside the one the base already draws — two elements answering to `inputWrapper`,
  one inside the other. A selector returns the outer, a measurement may take either, and a reading
  cannot say which it meant; it is the ambiguity ADR 0143 forbids, and the height comparison that
  record was written from was made of it. Both kinds now decline the base's wrapper through the
  mechanism that already exists for it, and draw their own affixes as they already did.

  **An affordance a kind removed and did not give back.** The foundation takes the platform's arrow off
  every native chooser so a form of them looks like one form. `@modyra/lit`'s native select drew neither
  that one nor its own, so the field had nothing at its trailing edge saying it opens — while four other
  kinds in the same renderer draw theirs.

  **The caret sits where the column is.** A multiselect's arrow was packed at the start of the opener,
  so it stood wherever the chips left off — a different distance from the field's edge on every value,
  and a different one again from the clear-all beside it. At the opener's trailing edge now, which is
  what `DESIGN.md` asks of a trailing affordance: one column, whatever the field holds.

- 8642d4c: The reserved line is under the fields that can fail a rule, not under every field

  The stylesheet has reserved a line of feedback since `9ff66356`, and its comment gives the reason
  exactly: _"validating must never move the control the user is reaching for."_ It reserved it under
  **every** field — `padding-block-end` on `.mdy-renderer`, unconditionally — including fields with no
  rule that could ever fill it. On a long form on a phone that is a line of scrolling per field, bought
  for a message that cannot arrive.

  The contract now says which fields can fail, and the renderers answer it by drawing the error
  container. The reservation follows that answer — `.mdy-renderer:has(> .mdy-control__errors:not([hidden]))`
  — rather than holding a second opinion about it. Two mechanisms answering one question is how they
  come to disagree, and these already did: the stylesheet reserved for all, the contract for some.

  `:has` is the technique this stylesheet already uses in forty-six places, and `:not([hidden])` covers
  both shapes a renderer uses — omitting the element, or keeping it and hiding it.

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

- c946eed: Where the writing begins

  A field's inner inset was declared twice. The inliner carries it as an asymmetric logical pair, and
  the control inside carries its own symmetric padding — so where the inliner is drawn both applied and
  the writing began at their sum: 28px in the renderer that draws it against 16 in the two that do not,
  from one document.

  The inset is declared in one place now and applied once. Where the inliner is drawn it is the
  declaration and the control carries no inline padding; where it is not, the control's padding is the
  inset. The number is `1rem` either way, so the two spellings put the writing in the same place.

  Every page screenshot moves, in every theme and every renderer, because the text moved in every
  field. See ADR 0182.

  Two things the rule had to be written around, both properties of the cascade rather than of this
  change: a zeroing rule beside the inliner sits in `mdy.base` and loses to the control's component
  rule whatever its specificity, and inside the winning layer a one-class selector loses to the
  two-class one that states the control's padding. A rule that loses is correct, ineffective, and looks
  applied.

## 0.8.1

### Patch Changes

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

- 554f4d8: The themes carried the same orphaned rules

  The foundation's state rules were repaired when a boolean's drawn part moved inside its label; the
  themes restate some of the same rules in their own idiom and were not. Six survived in three files —
  `modyra-material.css`, `modyra-ios.css` and `modyra-ionic.css` — plus one in the foundation itself,
  which had escaped because it was the **first line of a two-line selector list** and only the second
  line was rewritten.

  That last one is worth naming: a toggle answered a keyboard focus and did not answer a pointer
  resting on it, because `:focus-visible` and `:hover` sat in one rule and one of them was fixed.

  All seven now ask the wrapper with `:has()`, the way the foundation already did elsewhere.

  `state-rules-reach-their-part.test.mjs` now reads every sheet rather than the foundation alone, and
  covers `radio` beside the two booleans. It records one rule it cannot reach —
  `.mdy-radio-group--horizontal` — because this renderer has no `layout` input and never emits that
  class, where Angular and Lit do. The exemption is asserted in both directions, so a renderer that
  grows the variant fails until the exemption is removed.

  Two of the seven are **repaired by pattern and not measured anywhere.** The checkbox
  `:focus-visible` rules in `modyra-ios.css` and `modyra-ionic.css` need a pointer or a keyboard focus,
  which jsdom cannot produce, and the browser tier builds and links the foundation sheet alone — so no
  tier loads a theme at all. They were changed because they carried the same orphaned combinator as
  the five that were measured, which is a good reason and not evidence.

## 0.8.0

### Minor Changes

- 2d01ed6: The default primary is a colour its own text clears AA on

  `.mdy-button` is a filled accent control — `background: var(--mdy-primary)` under
  `color: var(--mdy-on-primary)` — and in the default theme that pair shipped at **4.09:1**, against the
  4.5:1 WCAG AA asks of normal text. An auditor running axe over a page of every widget kind reported it
  ten times.

  Nothing was wrong with the derivation. A light `on-` colour is chosen while light clears
  `MDY_ON_COLOR_FLOOR`, and on `#7067FF` it does. The floor decides _which_ colour; AA is what the pair
  must then reach, and they are different numbers. The colour simply could not carry it: the derived
  light `on-` colour gives 4.09, `#f8fafc` gives 3.96, and pure white — the ceiling for any light text
  on that background — stops at 4.14. Only black reaches AA there, and black on a saturated indigo is
  the defect ADR 0015 exists to refuse.

  So the seed moved rather than the rule. `--mdy-ref-color-indigo` is now **`#6458EF`**: the same OKLCH
  hue and chroma at a lightness of 0.561 instead of 0.607. The derived `on-` colour reaches **4.96:1**
  and the pivot still selects light, so the rule governs the choice exactly as before.
  `MDY_ON_COLOR_FLOOR` is unchanged, the stylesheet's pivot is unchanged, and a host supplying its own
  primary is unaffected.

  **Every filled accent surface is 4.5% darker.** The brand assets carry the same value, so the mark and
  the product stay one colour. Against a dark ground the mark moves from 4.62:1 to 3.81:1 — still above
  the 3:1 AA asks of a graphical object — and improves against light grounds, 3.96 to 4.80 on cloud.

  `modyra-salience.theme.css` keeps `#7067ff` deliberately: it pins its own `on-` colour to black, which
  reaches 5.07:1. A theme that answers this question itself is not answering it wrongly.

  See ADR 0108.

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

### Patch Changes

- 439d615: A corner of sRGB is judged to be inside sRGB

  `isInSrgb` is asked after a round trip through Oklch, so its tolerance exists to absorb that
  transform's error. **The tolerance was smaller than the error it exists to tolerate:**

  ```
  #ff0000  overshoot 3.047e-8   in
  #ffffff  overshoot 6.953e-8   in
  #00ff00  overshoot 1.001e-7   OUT      ← against a tolerance of 1e-7
  #ffff00  overshoot 1.303e-7   OUT
  ```

  Two of the eight corners of sRGB were outside sRGB, and a seed passes through a palette as its
  `primary` — so `derivePalette("#ffff00")` emitted a colour this package's own predicate rejects.
  White clearing the old threshold by a factor of one and a half was luck rather than a margin:
  nothing about `#ffffff` at `6.95e-8` is safer in principle than `#00ff00` at `1.00e-7`.

  `MDY_SRGB_EPSILON` is `1e-6`, **derived in both directions** rather than picked:

  - **large enough** — the measured worst-case overshoot for a colour that _is_ in gamut is `1.303e-7`
    over a 4096-colour grid plus the eight corners, leaving roughly seven times that as headroom;
  - **small enough** — a colour one part in a million of chroma past the true boundary overshoots by
    `7e-7` to `2e-6`, so this admits at most about `1.5e-6` of chroma beyond the edge. Chroma runs to
    `0.45`: three orders of magnitude below anything a consumer could act on.

  The premise is now **checked rather than trusted**: a test measures the worst in-gamut overshoot over
  the same grid and fails if it ever exceeds the tolerance, so a change to the transform's coefficients
  says the constant needs revisiting instead of putting a corner of sRGB back outside it. A colour
  genuinely past the boundary is still refused.

  Found by `battle-tests/adversarial/security/palette-contrast.battle.test.mjs`.

- 85a7ad0: A calendar's adjacent-month days are readable

  The days a calendar greys out — the ones belonging to the month either side — measured **3.06:1**
  against the surface behind them, where AA asks 4.5:1 of normal text. They are not decoration: they
  are dates a person reads and can click.

  The mechanism was `opacity: 0.5` on the cell, not a muted colour, and that is why the defect was
  invisible to the palette checks. A faded value composites against whatever is behind it, so one
  number is several contrasts — 3.06:1 on the resting surface, 3.01:1 on a hovered cell, and different
  again in the dark scheme.

  `--mdy-comp-date-picker-cell-outside-opacity` is **0.7**, chosen against the worst of those grounds
  rather than the resting one. Measured across light and dark, resting and hovered, the tightest is
  5.40:1 and the day still reads as clearly muted — full-strength text on that surface is 14.05:1.
  A disabled day is the exception AA itself makes and keeps its own 0.25.

  A theme overriding the token takes the same obligation with it.

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

- 0211979: A theme selector cannot close the stylesheet it is written into

  `compileMdyTheme` guarded its `selector` against breaking out of the **CSS rule** — `}`, `;`, `@` and
  comment sequences all end a rule and turn what follows into a stylesheet nobody wrote. It did not
  guard the other container. A stylesheet is often written into a `<style>` block, and `</style>` ends
  that block wherever it appears, including inside a selector:

  ```js
  compileMdyTheme({
    name: "acme",
    seed: "#6458ef",
    selector: "</style><script>alert(1)</script>",
  });
  // compiled, character for character, into the CSS
  ```

  `seed` and `name` already refused it; `selector` did not, because none of the guarded characters
  appear in `</style>`.

  `<` is now refused. It is not valid anywhere in a CSS selector — proposed as a combinator and
  abandoned — so nothing correct is taken away. **`>` is deliberately still allowed**: `.a > .b` is the
  ordinary child combinator, and a guard that took the pair for symmetry would break every theme
  scoping a rule to a direct child.

  Nothing in Modyra feeds this: Studio does not call `compileMdyTheme`. It matters where an application
  compiles a theme from a name a customer supplies — per tenant, per brand — which is what a theme
  compiler is for.

  **`serializeMdyThemeCss` now validates too, and that is the larger half.** The guard above is in
  `compileMdyTheme` — the function that _builds_ the theme. The one that _writes the sheet_ is exported,
  takes a plain frozen object, and checked nothing, so a caller holding its own tokens reached it
  without passing the compiler at all. Measured: the same payload landed verbatim, and `seed` and
  `model` escaped the header comment with `*/` before doing the same.

  It refuses every field it interpolates now — the selector by the rule above, `seed` and `model` by
  what they are rather than by characters they lack, and each token name and value by the same
  containment. A theme this package compiles is unaffected, and `.a > .b:not(.c)` still serializes.

  The guard still does not decide _which_ selectors a theme should accept. That remains the caller's.

  See ADR 0111.

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

## 0.7.1

### Patch Changes

- 20f90ef: Material's filled fields and its filled button take their colour from Material's own ramp.

  Two roles were read against each other. `.mdy-button` painted `--mdy-input-focus-color` — the
  field's focus indicator, which is the brand colour — while its label stayed `--mdy-on-primary`,
  derived for `--mdy-primary`: on a light brand that is white on light amber, **1.70:1**. And the
  field container came from `--mdy-sys-color-surface-container-highest`, the palette's brand-tinted
  surface, while the text on it came from Material's `--mdy-on-surface-variant`: in dark that pairs
  at **3.80:1**.

  Both now read one ramp: the button paints `--mdy-primary`, and
  `--mdy-comp-field-container-color` resolves to Material's `--mdy-surface-container-highest`. Filled
  fields in this theme are neutral-tinted rather than brand-tinted, which is what M3 specifies, and
  both pairings clear AA.

## 0.7.0

### Minor Changes

- fa6d81e: A control fills the field it sits in, and iOS states single choice the way the platform does.

  `.mdy-select` and `.mdy-radio-group` were sized by their own content, so in every theme the field's
  fill extended past the control and the trailing affordance sat beside the value instead of on the
  field's edge. Both now occupy the field, which is what the affordance column has always assumed.

  Under the iOS theme, a vertical radio group is now an inset grouped list — one surface, 44pt rows,
  hairline separators inset to the text, and an accent checkmark on the selected row's trailing edge.
  The circle part remains in the tree and carries the checkmark; a horizontal group keeps its circles.
  The checkbox's row text takes the primary label colour rather than the field-caption colour, and
  field text is regular weight throughout, matching the value of a control that is not an `input`.

  Migration: a host that styled `.mdy-radio-circle` under the iOS theme expecting a circle now styles
  the checkmark. A host that relied on `.mdy-select` or `.mdy-radio-group` being content-width should
  constrain the field instead.

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

- 14bdd6a: A theme states its design system's colour model, and derives every role from it.

  Setting a brand colour is what this product is for, and two themes did not survive it. Measured over
  four themes and two schemes, every element that owns text against the surface behind it:

  |                                               | before      | after              |
  | --------------------------------------------- | ----------- | ------------------ |
  | Material, white on a gold brand primary       | **1.85:1**  | derived, clears AA |
  | Material dark, field text on a gold container | 2.98–3.29:1 | clears AA          |
  | every theme, labels and supporting text       | 3.87–4.24:1 | ≥ 4.5:1            |

  **Material is tonal now.** A role is a tone on a tonal palette at an assigned chroma — M3's own model
  — rather than a `color-mix` toward white, which is the same ramp for one seed and a different ramp
  for every other. On a gold seed the six surface steps had collapsed into a lightness span of 0.018
  where M3 specifies 0.10: the surface hierarchy disappeared, and contrast was the symptom. Every tone
  and chroma is a variable (`--mdy-md-tone-*`, `--mdy-md-chroma-*`).

  The seed is never rewritten. `--mdy-sys-color-primary` stays exactly what a host sets; `--mdy-primary`
  is that seed at tone 40, which is why M3's white-on-primary holds again. **Material's palette changes
  for every seed but its own** — for a light brand colour the primary becomes a dark tone of that hue,
  which is surprising and is what Material Design 3 does.

  **iOS names its pairs.** `--mdy-ios-on-blue` is the label colour Apple pairs with system blue, read by
  the five sites that sit on the accent instead of `#ffffff` written at each. A host supplying its own
  accent supplies both halves.

  White on system blue is 4.02:1 and **stays** — it is in the HIG, and a theme that darkened it to reach
  4.5:1 would stop being iOS. It is a named allowance in `e2e/palette.spec.ts`, asserted in both
  directions so an allowance that stops applying also fails.

  **Muted text holds AA.** `--mdy-sys-color-on-surface-variant` paints labels, placeholders, supporting
  text and weekday headers — reading text — and cleared the floor only for dark and cool seeds. Swept
  over ten seeds and carried to the lightest value that clears 4.5:1 for all of them.

  Also fixed: `.mdy-button` and the number stepper took a background from one role and text from
  another; a `<button>` in a themed subtree now inherits colour, since user agents set `buttontext` and
  a host slotting a plain button into a field got black on the theme's surface, measured at 1.10:1.

  Migration: a host that pinned `--mdy-on-primary` keeps working. One relying on Material's or iOS's
  literal white sees the derived colour. Material's surface and accent roles move for any seed other
  than its own.

- 2c6ff57: A field's hover and focus tint is a state veil, not a fourth colour mixed from three derived ones.

  `--mdy-input-bg-hover` is **removed**. It mixed the field's background with the text colour, and both
  of those are themselves mixed from a primary a host may set at runtime — so what was finally painted
  composed three levels deep and had a shape no declaration stated. A host that overrode it should
  override `--mdy-state-veil` instead:

  ```css
  :root {
    --mdy-state-veil: rgb(0 0 0 / 0.06);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --mdy-state-veil: rgb(255 255 255 / 0.08);
    }
  }
  ```

  The veil is laid over whatever the field is already painted, so it is one legible value per colour
  scheme instead of a colour that depends on how deep the derivation beneath it goes. The appearance is
  materially the same; the screenshot baselines, which capture widgets at rest, are unchanged.

  It also fixes a crash. In WebKit, painting that nested value during hover or focus **ended the page** —
  contract gap O, and the same cause as gap N one element over. Two `demo.spec.ts` rows quarantined
  against it are un-quarantined and pass.

- 7ecaef6: The iOS theme speaks the full HIG vocabulary.

  It carried three of Apple's thirteen accents, two of four fill levels, three of four label levels, two
  of six backgrounds, one of two separators and two loose tracking values. A theme that cannot name a
  colour cannot use it, so anything outside that set arrived as a hex written at the site that needed
  it — which is how a theme stops being the system it is named after.

  The vocabulary now follows the iOS and iPadOS 27 design kit's own collections:

  - **Colors** — all twelve accents, light and dark, each its own value rather than a tint of the other.
  - **Fills** — `system`, `secondary`, `tertiary`, `quaternary`. The two it had were the tertiary and
    system levels under names that described strength instead of level, so a rule asking for "the
    weaker one" got whichever existed. iOS 27's stepper change — idle fill from quaternary to tertiary
    — is now a value this theme can state.
  - **Labels** — four levels including quaternary.
  - **Backgrounds** — plain and _grouped_ families, plus the **elevated** tier dark mode uses inside
    anything presented over the screen. Without it a sheet took the base surface and had nothing left
    to separate it from the page, which is why dark iOS modals in web ports look flat.
  - **Separators** — translucent and opaque.
  - **Text styles** — the eleven Apple ships, as size / leading / tracking. Every `letter-spacing` in
    the theme is now one of them; they were `em` values, which scale with the font and so became a
    different tracking on every element that inherited them — the one thing Apple's tables never do.

  **The slider is a slider again.** It set only a shadow and inherited the rest, arriving as a thick
  tinted bar inside a filled rectangle with an accent-coloured handle. It is now a 4pt track, blue to
  the left of the knob, and a 28pt white knob with a shadow, with no box: the knob stays white in both
  schemes because on iOS it reads as an object above the track, and tinting it removes the only cue
  that says so.

- e5f45bb: One elevation ramp, and a state channel a theme can decline.

  **Elevation.** Four overlays of the same rank wore four different shadows: `--mdy-shadow-depth-2`,
  the same two layers written in the opposite order, an unrelated `0 8px 32px`, and a literal buried in
  a `var()` fallback chain where which shadow won depended on which of two other tokens happened to be
  defined. A fifth — `0 18px 48px` in pure black, unlayered, so it outranked all of them — put the
  modern theme's panels visibly higher above the page than its own 36px fields ever suggested.

  There is now one ramp, `--mdy-sys-elevation-shadow-1|2|3`, in the token tier and per colour scheme.
  Levels are meanings: 1 is a thing lying on the page, 2 is a panel the page opened — every dropdown,
  calendar, clock and palette — and 3 is a surface over the whole page.

  Shadows are tinted with `--mdy-sys-color-shadow`, which the system already derived and nothing read.
  A shadow on a tinted page now belongs to that page; pure black over a coloured surface greys it.

  **The state veil is a token.** `--mdy-sys-state-veil` is the tint a control carries while hovered or
  focused. A filled control has only its surface to speak with and tints it; a bordered one says it
  with its edge and sets the veil to `transparent`. The foundation lays the veil as a background
  _image_, which a theme's `background-color` cannot displace — so a theme that overrode the colour
  looked like it had opted out and quietly painted both, which is what the modern theme was doing.

  **Also fixed:** `--mdy-comp-date-picker-in-range-bg` mixed toward a literal `#fff`, producing a pale
  lavender band across a near-black calendar in dark mode; it is `primary-container`, which is derived
  per scheme. Sixteen date-picker tokens were declared twice in one file — the second block won, and
  five of the first block's names were read by nothing. Migration: a host that set
  `--mdy-comp-date-picker-hover-bg`, `-selected-bg`, `-selected-color`, `-disabled-opacity` or
  `-outside-opacity` was already setting a token no rule consulted; the live names carry a `cell-`
  prefix.

  Nothing moved in the 216 zero-tolerance screenshot baselines: every change here is a hover, focus or
  open state, and the baselines capture widgets at rest.

### Patch Changes

- aeca6f4: A visually hidden native control is never painted.

  Checkbox, radio, toggle, segmented and file keep a real `<input>` for the accessibility tree, the tab
  order, the form post and the keyboard model, clipped to a single pixel while a sibling draws the
  appearance. The general field rules reached those inputs and gave them a focus background and shadow
  — invisible by construction on a clipped pixel, and in WebKit fatal: focusing a checkbox or a radio
  under `modyra-modern` ended the page, so a keyboard user lost the document on reaching one.

  The six duplicated copies of the hiding pattern are now one rule that clears `background-color` and
  `box-shadow` along with the geometry.

  No migration. Nothing visible changes — the affected elements had no visible surface, and the
  screenshot baselines are unmoved. A host that copied the hiding pattern into its own stylesheet
  rather than using the shipped one should clear both properties there too.

- 0f45da0: The field label has its own leading, so a form sits on the pixel grid.

  `.mdy-label` carried a size token and a weight token and no line-height, so its height was whatever
  the host page's `line-height` produced against the theme's font size. At a common `1.5` against a
  13px label that is 19.5px — which made **every control in the column a half-pixel tall, in every
  theme**. Measured across the catalogue: 81.5, 133.5, 105.5, 39.5, 113.5, 180.5. Nothing sat on the
  grid, so every edge below a label rendered soft.

  The label now takes its leading from the typescale in px, as the input, helper and error already did.
  The same controls measure 82, 134, 106, 40, 114, 181.

  A ratio cannot be relied on here: it multiplies a size the theme chose by a number the host chose, and
  only some of those products are whole. A text role with a size token and no leading token is a gap the
  host fills silently.

  Baselines re-recorded: every widget moves by half a pixel.

- 1a4d6f2: Liquid Glass is built as the material's own layers.

  The iOS kit composes it out of four named layers — **Blur**, **Tint**, **Specular Light**, **Shadow** —
  and the tint carries a _Plus D_ and a _Plus L_ component. Those names are blend modes: the tint and
  the highlight **add** light to what is behind them rather than painting over it, which is the whole
  difference between glass and frosted plastic. A highlight painted as flat white is the same white on
  a dark wallpaper and on a light one; one that adds is bright over dark and blows out over light,
  which is what glass does.

  It was one seven-part `box-shadow` — three hairlines, three inset "lens" bands and a cast — doing all
  four jobs at once, which is why the highlight could not follow the panel's corner and never varied
  with what it covered.

  Now: the blur is the backdrop, the tint is the surface, and the specular light is a real layer that
  follows the panel's radius and blends with `plus-lighter` where the engine supports it. Where it does
  not, the highlight is painted rather than accumulated and the material still reads correctly — the
  blend is an enhancement, never a requirement.

- 81171c9: A theme is one request.

  The source is composed — a theme imports the token file and the foundation, the foundation imports
  the structural sheet — and that shape was shipped as written. A browser cannot discover an `@import`
  until it has downloaded and parsed the file containing it, so linking a theme was three serial round
  trips before the first rule applied, every one of them blocking render.

  Each published entry point now carries its whole graph inlined. Measured on the modern theme over a
  150 ms link at 1.6 Mbps, gzipped, three runs each:

  |        | time to a styled page |
  | ------ | --------------------- |
  | before | 701 ms                |
  | after  | **415 ms**            |

  The source files are unchanged and still composed; this is a property of what is published. Only the
  entry points named in `exports` are flattened — the internal sheets stay small, because flattening a
  file nobody links to costs its full size and buys nothing.

  The cost is the package: 29 kB to 111 kB, since five themes each carry the foundation. That is a
  one-time cached install against 286 ms on every first paint for every end user.

  No API change: the same import specifiers resolve to the same names.

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

## 0.6.0

### Minor Changes

- ebc9014: `--mdy-comp-field-*`: a field's tokens stop being Material's.

  The foundation described what a field looks like in Material's vocabulary — `container-height`,
  `active-indicator-color` and thirteen more, all spelled `--mdy-comp-filled-text-field-*`. _Filled_ is
  one of Material's two field variants, so a theme that is not Material still had to say "filled text
  field" to change a border radius. `@modyra/styles/foundation.css` is a published entry point, which
  made that vocabulary part of the contract a consumer theme reads.

  Fifteen neutral tokens now carry the same values, and the foundation reads those instead. The Modern
  theme, which had to override three Material-named tokens to restyle its fields, now names none.

  **The old names keep working and are deprecated.** Each neutral token reads its Material predecessor
  first and falls back to the same value:

  ```css
  --mdy-comp-field-container-height: var(
    --mdy-comp-filled-text-field-container-height,
    56px
  );
  ```

  so a theme that still sets the old name is picked up, and a theme that sets the new one overrides the
  declaration outright. Neither spelling is lost while both exist. The aliases are removed no earlier
  than the next minor, and not in this change.

  Nothing renders differently: every declared value is unchanged, and the only difference in what the
  foundation reads is those eight names. `--mdy-comp-filled-text-field-*` is still declared, so a
  consumer setting it sees the same result as before.

  This closes the last place the foundation encoded a _variant_ of one design system. Other component
  families still carry Material's component names — `--mdy-comp-switch-*`, `--mdy-comp-filter-chip-*`
  and others — but those name a widget rather than a Material variant of one, which is a different
  question and a different batch.

- ba9d206: The segmented control's checkmark settles instead of overshooting, and the motion vocabulary drops
  to three curves.

  `--mdy-sys-motion-easing-spring` is **removed**. Its curve —
  `cubic-bezier(0.175, 0.885, 0.32, 1.275)` — carried the check past full size and back on every
  selection. A 250ms confirmation reads better arriving and settling than bouncing, and the token had
  exactly two consumers, both the same `mdy-segmented-check-pop` animation.

  Both now use `--mdy-sys-motion-easing-decelerate`, which already existed for precisely this —
  "entering the screen, quick to arrive, slow to settle". No new curve was minted: the vocabulary is
  smaller, not merely different.

  **If you override `--mdy-sys-motion-easing-spring`**, that override no longer applies. Nothing else
  read it, so there is no other effect. Override `--mdy-sys-motion-easing-decelerate` to change how the
  check arrives.

### Patch Changes

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

- ed2b5c1: A field's inner padding follows the writing direction.

  `.mdy-input-wrapper__inliner` set `padding: 0 0.25rem 0 0.75rem` — more room where the text starts
  than where the affixes sit, which is right, written physically, which is not. Under `dir="rtl"` the
  8px difference stayed on the left, so everything at the field's inline end — the colour picker's
  toggle, and anything else living there — sat 8px inside where it belonged.

  Measured rather than eyeballed: the RTL fixture put the colour toggle 189px from the inline start in
  LTR and 181px in RTL. **All sixteen measured families now mirror**, and the fixture's ledger is empty.

  The floating-label variant's `padding-left` is logical for the same reason.

- b020a7b: The multiselect popover shows its contents in Safari.

  `.mdy-multiselect-overlay__grid` sized itself with `max-height: 100%`. Its parent states a
  `max-height` and no `height`, so the parent's height is **indefinite**, and a percentage against an
  indefinite containing block is undefined territory: one engine resolves it to `none`, another to
  zero. On Safari the grid collapsed and the panel showed the search box with nothing under it —
  exactly as if the panel had no minimum height.

  Expressed as flex instead: `flex: 1 1 auto` takes the space the search box does not, and
  `min-height: 0` is what lets it actually scroll — a flex item's default `min-height: auto` refuses
  to shrink below its content, so an `overflow-y: auto` item grows past the max-height it was given
  rather than scrolling inside it.

  A side effect worth naming: an _empty_ popover now hugs its content instead of stretching to the
  height the placement policy allowed it. That is the same rule doing its job, not a second change.

  Reported from real Safari. Playwright's WebKit does not reproduce it — it resolves the percentage
  the way Chromium does — so nothing in the browser suite would have caught this, on any of the three
  engines it now runs.

- f107368: The readable text colour degrades instead of failing.

  `--mdy-sys-color-on-*` derives black-or-white from the background with a `clamp()` step, inside a
  feature query for relative colour syntax. The step needs more than that: it needs `pow()` and `cos()`
  **inside a colour channel**, which is a narrower capability. An engine with one and not the other
  parsed the declarations, failed them and dropped them — and what caught them was a fixed
  `color-mix(primary, white 95%)`, which is 95% white whatever the background is. Measured at 1.10:1
  on a light primary: white text on a light background.

  Three tiers now, each guarded by what it actually uses:

  | tier                   | needs                               | worst pair measured |
  | ---------------------- | ----------------------------------- | ------------------- |
  | chroma-corrected pivot | `pow()`/`cos()` in a colour channel | 4.35:1              |
  | lightness pivot        | relative colour syntax              | 4.09:1              |
  | fixed mix              | nothing                             | unchanged           |

  The middle tier is new and is what stops the fall. It takes the same `clamp()` step over a plain
  lightness pivot — the cube root of the luminance crossover, exact for a grey — and every engine with
  relative colour computes it identically. It picks the worse of black and white 38 times in 1080
  against the corrected form's 16, which costs a fraction of a ratio point rather than legibility.

  `e2e/palette.spec.ts` now holds each tier to its own measured floor, chosen by `CSS.supports` rather
  than by browser name, so an engine that gains the maths is held to the better floor the day it ships.

  **This is a repair, not a solution.** No tier reaches AA's 4.5:1, because a stylesheet cannot measure
  what it is approximating: it has the colour in OKLCH and the ratio wants sRGB luminance. The exact
  computation exists — `onColorFor` in `@modyra/core/color-utils` measures both candidates and keeps
  the better — and the themes do not use it. Recorded as finding **M** in `docs/contract-gaps.md`.

- b067cdc: A visual change is a diff.

  Geometry was measured everywhere — heights, insets, angles, icon sizes all had assertions — and
  nothing answered _did this change something it should not have_. That question went to a person every
  time a stylesheet was edited.

  Screenshot baselines now answer it: two renderers × three engines × four themes, a full page and six
  widgets each, 168 images committed. A failure names the widget and the theme.

  **The tolerance is zero pixels**, and that is measured rather than strict for its own sake. With
  animations disabled and the clock pinned, repeated runs are pixel-identical — so zero costs nothing
  in flake and gives the most discrimination available.

  It had to be. At a 0.2% tolerance the first version of this suite **passed with every icon 2px
  larger**: it looked like coverage and was not. The mutation was verified to reach the browser before
  that result was believed, which is the only reason it was caught rather than shipped.

- 57a0daf: A prefix and a suffix pad along the writing direction.

  The same defect as `.mdy-input-wrapper__inliner`, one level out and missed by the sweep that fixed
  it. `.mdy-input-prefix` and `.mdy-input-suffix` set `padding-left: 0.75rem; padding-right: 0.25rem`
  and its mirror — roomy on the outer edge, tight against the input, which is right, written
  physically, which is not. Under `dir="rtl"` the 8px stayed where it was, so the suffix sat 8px inside
  where it belonged in all four packaged themes.

  The two sibling rules that tighten the input beside an affix are logical now for a subtler reason:
  DOM order does not change under `dir="rtl"`, so `.mdy-input-prefix+input` still matches — and a
  physical `padding-left` there tightened the side the _suffix_ had moved to.

  Measured, not eyeballed. `e2e/rtl.spec.ts` read the suffix at 222px from the inline start in LTR and
  214px in RTL; all sixteen families now mirror on Chromium, Firefox and WebKit.

  This had been red since before the engines were added, on Chromium too. `npm test` does not run
  Playwright, so nothing routine was saying so — recorded as finding **L** in `docs/contract-gaps.md`.

- 643ac13: An icon has a size wherever it is drawn.

  Two rules were scoped to `.mdy-renderer`, and a portalled popup is not a descendant of one — it
  renders at the document root. So nothing sized what was inside a popup, and an `<svg>` carrying only
  a `viewBox` has no intrinsic size: the size a replaced element takes without one is not specified.
  `.mdy-popup` and `.mdy-overlay-panel` are now named beside `.mdy-renderer`.

  The second half is the same shape one level down. A button inherits neither its font family nor its
  font size, and a user-agent default is not part of any specification — so every control that sizes
  something from its own font was unspecified until the size was stated. Eight of the nine controls in
  this sheet that reset the family already reset the size; the reset is now stated once for all of
  them, at zero specificity so it loses to any button that names a size deliberately.

  Measured across the demo, every icon on the page: sizes were unequal between rendering engines
  before, and identical after.

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

- 34c5fd6: The Material theme declares its own secondary and tertiary, from Material's own arithmetic.

  Zinc's chroma measures 0.0059. Modyra's OKLCH palette _scales_ the seed's chroma, and scaling almost
  nothing leaves almost nothing: the derived secondary came out `#1b191c`, and the container a selected
  chip paints from measured **1.00:1 against `surface-container-highest`** — one value apart in one
  channel, so the selected state was invisible on that surface. Segmented buttons paint from the same
  token.

  Material 3 _assigns_ chroma rather than scaling it — secondary is chroma 16 whatever the seed — which
  is why an M3 palette looks like an M3 palette however neutral its source. A Material theme should
  take Material's answer, so these are `deriveHctPalette("#18181b")` from `@modyra/core/color-utils`:
  Google's own algorithm, already in this repo, rather than a colour someone picked. A test asserts
  they still equal what that function returns, so they cannot drift from the algorithm they cite.

  This is the escape hatch working as designed — the same one this theme already used to force its own
  red — not a change to the derivation, which is unchanged for every other theme.

  **What it does not fix**: the chip goes from 1.00:1 to 1.15:1 and gains an identifiable tint, but
  neither value meets WCAG 1.4.11's 3:1 for non-text contrast. The container tone is an 80% white mix
  whatever the seed, so that is a question about container tones rather than about the accent, and it
  is left open rather than quietly folded in here.

- c783668: Material's colour toggle pulls along the flow, not to the right.

  `margin-right: -0.75rem` pulls the toggle back over the field's inline-end padding so it sits flush
  with the edge. Written physically it kept pulling leftwards under `dir="rtl"`, where that toggle is
  on the left — opening a gap at one end and overhanging the other.

  Found by measuring, not by reading: the RTL fixture now runs every family against **all four
  packaged themes**, and this was the one case where the default theme mirrored and a theme did not.
  "Geometry is theme-independent" was an assumption, and it was wrong exactly once.

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

## 0.5.0

### Minor Changes

- 33eeeae: A finer slider, and a focus indicator it never had

  Reported as reading chunky. A 20px handle on a 4px rail is M3's proportion, and a column of them
  reads as a row of knobs on a rail they barely touch. The **Modern** theme inverts the emphasis: a
  6px track so the filled part is legible, a 16px handle that sits on it rather than straddling it,
  and a growth on hover and press so it answers the pointer. Material and iOS keep their own faces —
  none of them is the base of another.

  **The slider gains a visible focus indicator.** The foundation sets `outline: none` on the control
  and leaves the indicator to the theme; Modern supplied none, so the control could be tabbed to with
  nothing on screen to say so. It now draws a halo around the handle — a ring rather than an outline
  around the rail, which would trace a band the full width of the form and say nothing about where the
  handle is. It is a shape change, so it does not depend on colour alone, and it survives
  `prefers-reduced-motion`, which drops the growth but never the indicator.

  Nothing here restates a foundation rule: the sizes are `--mdy-slider-*` on the container, and the
  fill stop already reads `--mdy-slider-thumb-size`, so shrinking the handle keeps the fill under its
  centre with no arithmetic anywhere. Measured across four stylesheets at the minimum, the midpoint
  and the maximum: the fill lands on the handle's centre to within half a pixel in every one, with the
  handle at 20px in three of them and 16px in Modern.

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

- 9ff6635: Validation feedback no longer moves the form, and the selected segment shows its tick

  Each renderer reserves one line for validation feedback and paints the error list into that band
  instead of laying it out in flow: a message appearing on blur used to grow the field by ~24px and
  push everything below it down, which moved the control the user was reaching for. Supporting text
  stays in flow — it is present from the start, so it shifts nothing.

  The segmented tick is keyed on the contract's selected class and its gutter is reserved on every
  segment, so it appears and disappears without changing any segment's width. A renderer that ships
  no icon set leaves the element empty and the theme draws the glyph.

- 14ba12d: Material stops being everyone's base

  Material 3's floating label — the pattern that made the default stylesheet a Material stylesheet —
  moves into `material-filled-field.css`, and `modyra-foundation.css` becomes the structural layer the
  themes build on. Modern, iOS and Ionic import the foundation instead of the default theme, so none
  of them inherits a field it then has to undo; Material imports the same foundation and its own
  field, as a sibling.

  `@modyra/styles/default.css` keeps exactly the look it has always had — it now resolves to
  foundation plus Material's field — and `@modyra/styles/foundation.css` is published for anyone
  building a theme of their own. Verified in the browser: the five packaged themes render the same
  geometry, to the pixel, as before the split.

  The architecture audit gains the rule that replaces the debt it just retired: a theme may not
  import another theme. The demo build also ships every CSS file the package produces instead of a
  hand-kept list — the list had gone stale the moment the package grew a file, and a theme whose
  foundation 404s still renders, just unstyled.

- 8a5aff2: One overlay container for the whole catalog

  A select's list, a calendar, a clock and a palette differ in what they hold, not in what holds
  them. The container — surface, outline, radius, elevation, padding, scrolling and out-of-flow
  placement — now belongs to `.mdy-popup`, which every `popup` part in the contract carries;
  `.mdy-overlay` narrows to the portalled variant, adding only the viewport coordinates a popup
  lifted out of its field needs.

  Lit's date, range and time pickers drew their content straight into the overlay panel, so they were
  the only popups in the catalog with a container of their own and no contract part to name it. They
  now render the same `popup` part as everything else, and a Lit multiselect opens from anywhere on
  its trigger rather than only from the search button — clicks that land on a chip or a step button
  still belong to that control.

  Verified in the browser: nine overlays across the Plain and Lit demos resolve to the same
  background, outline, radius and padding.

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

- 0d22b78: Motion is one vocabulary, and reduced motion is honoured everywhere

  Six durations and seven easings were spread across the foundation and the four themes — including
  `cubic-bezier(0.4, 0, 0.2, 1)` written two ways, the same curve spelled differently in two files. A
  control that opens in 0.15s under one theme and 0.2s under another is not the same control, and
  nothing could tell you the two had drifted.

  `modyra-base.css` names them in the tier every other value comes from: three durations (`fast`,
  `base`, `slow`) and four curves (`standard`, `decelerate`, `spring`, and Material's `emphasized`,
  which is genuinely a different curve rather than a fourth spelling of one). The foundation and the
  themes read those tokens, each with the tier's own value as its fallback, so a stylesheet loaded
  without `modyra-base.css` still moves.

  **The half that matters more:** the foundation honoured `prefers-reduced-motion` for two parts out of
  fifty-three — the checkbox's indicator and the toggle's thumb — and every popup, chip, focus ring and
  calendar cell animated regardless. Ionic honoured it nowhere. One rule now covers the whole `mdy-`
  vocabulary, so a control cannot be added that quietly ignores a preference someone has stated.

  `audit-styles-architecture.mjs` gains the matching rule, over the themes as well as the foundation: a
  literal duration or curve is a defect, and a stylesheet that animates without ever reading
  `prefers-reduced-motion` is a defect.

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

- 65ca85b: Every theme derives its palette from the colour it actually chose

  The maths landed in `modyra-base.css` but could not reach two of the themes, because they never
  declared a primary where the maths could see it. Material set `--mdy-primary: #18181b` and iOS
  `--mdy-primary: var(--mdy-ios-blue)` — the _short_ tier, which is downstream of the derivation. Their
  identity colour arrived after the palette had already been built from a primary they never chose.
  Both declare `--mdy-sys-color-primary` now, and the short names still bridge from it.

  **`modyra.css` imports `modyra-base.css`.** It was documented as the file to import and did not
  import the file holding the `--mdy-ref-*` / `--mdy-sys-*` / `--mdy-comp-*` tiers — so a page loading
  a theme on its own, which is what every framework-free example does, had no `sys` tier at all and ran
  entirely on the literal hex fallbacks spelled into the `var()` chains. Fixed hex cannot follow a
  chosen colour. Only the Angular demo and Studio were loading base separately.

  Measured across the four stylesheets, before and after: **`modyra-modern` changed in nothing at all**
  — it already imported base, which makes it the control that says the import itself is inert. The
  other three gain the 311 `sys` tokens they were missing and change 8 to 16 values each, every one of
  them the derivation taking effect: chips, segmented buttons, the slider's inactive track, and the
  `on-` colours that were 95% white regardless of what they sat on.

  **Two consequences worth stating rather than burying:**

  - **Material's accents become grey.** Its primary is `#18181b`, whose chroma measures 0.006, so a
    palette derived from it has almost no colour: `--mdy-sys-color-secondary` comes out
    `oklch(0.217 0.006 316)` and its chips go from lavender to light grey. This is coherent rather than
    broken — the theme's own block is headed _"Key Palette (Zinc Neutral)"_ and already derived every
    surface from that zinc. The chips were lavender only because they fell through to base's fixed
    violet, which was an accident of the theme not owning that token, not a decision. Whether Material
    should now _force_ an accent is a design call and is left open, which the derivation allows.
  - **Material keeps its own red.** `--mdy-sys-color-error: #dc2626` is declared outright instead of
    derived — exactly the escape hatch the derivation leaves for a theme that wants its own palette.

  iOS needed nothing beyond the declaration move: its blue drives a secondary at 287° and a tertiary at
  347°, and its chips stay iOS blue because that theme forces them.

- 25b9dd7: Every control that reads as a field is the same height

  The height was stated for a list of input types — text, number, date, email — so a password box, a
  select's trigger and a picker's input each stood a dozen pixels shorter than the field beside them,
  from the same `--mdy-input-height`. It is now stated for what a control _is_, and the audit fails a
  height stated per input type: an enumeration is only ever as complete as the day it was written.

  `box-sizing: border-box` goes with it. Without it the token meant two things — a text input laid out
  as `content-box` added its padding on top — which is where most of the difference came from.

  Two structural rules a theme had taken over came back to the foundation: a picker's own box is a row
  (Material declared it a block, and a date range's two inputs and its toggle stacked three fields
  tall), and the colour field no longer sets its own height. The audit now fails a theme that sets
  `display` on a control's box.

  Measured across all five themes: every field-like control is one height — 38px in Modern, 56px in
  the others — where before a single theme ranged from 38 to 205.

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

- 3eb8a33: The architecture is enforced, and `[hidden]` is the foundation's word

  `scripts/audit-styles-architecture.mjs` (run by `test:themes`) holds the migration's premise to
  account: a theme may not name an adapter, position an overlay, or re-declare `[hidden]`, and the
  foundation may not carry a brand face or a literal palette. What remains is listed as debt with the
  reason it is still there — Material and iOS still placing the colours popup, and every theme still
  importing the default one — so the list can shrink but not grow unnoticed.

  Hiding is now stated once, by the foundation, for anything inside a renderer or a popup. Modern had
  restated it four times because a theme's `display` beats the UA's `[hidden]`, and each restatement
  was a bug already met. The default theme also stops naming Roboto as its clock's fallback face.

- 0e38698: The floating label belongs to the foundation, not to Material

  `mdyFloatingLabels` did nothing under Modern, iOS and Ionic. The host took `.mdy-floating-label`,
  the renderer set `.mdy-label--filled` at the right moments, and no stylesheet answered any of it:
  measured across all four states, the label stayed `position: static`, `transform: none`, sitting
  21–26px above the field exactly as it does with the feature off. An opt-in that silently does
  nothing is worse than one that is absent, because nothing says so.

  The manoeuvre moves to `modyra.css` — where the label rests, where it rises to, the padding the
  control gives up so the risen label has somewhere to land, and the placeholder suppression that
  stops a resting label from sitting on a second line of text. None of the numbers move with it.
  Every one is a custom property a theme owns:

  | property                                      | what it decides                   | default                    |
  | --------------------------------------------- | --------------------------------- | -------------------------- |
  | `--mdy-fl-height`                             | the field's height while floating | `3.5rem`, tracking density |
  | `--mdy-fl-rest-y` / `--mdy-fl-rest-scale`     | where the label sits at rest      | centred, unscaled          |
  | `--mdy-fl-active-y` / `--mdy-fl-active-scale` | where it goes when active         | `0.5rem`, `0.75`           |
  | `--mdy-fl-label-left`                         | its inline offset                 | `1rem`                     |
  | `--mdy-fl-label-height` / `--mdy-fl-gap-mid`  | the room a risen label needs      | `0.75rem` / `0.125rem`     |

  **Material's geometry does not move.** The defaults are its numbers, so it declares none of them and
  measures identical before and after: resting `translateY(18px) scale(1)`, active `translateY(8px)
scale(0.75)`. What is left in `material-filled-field.css` is its face — the label's size, colour and
  weight — and its prefix composition.

  Modern and iOS declare their own. Modern's field is 36px and a label cannot rise inside 36px, so a
  floating Modern field grows to 52px rather than Material's 56px, with a floor at 44px: unclamped,
  density −3 drove it to 36px and put the risen label on top of the value. Its label lines up with the
  control's own 10px inset. iOS lines up with its 14px inset and shrinks to 0.8 rather than 0.75,
  because iOS reduces a risen label less far. Ionic declares nothing — its 56px field and 16px inset
  are what the defaults already describe.

  Verified in the built demo, five stylesheets × four states, plus the resting position that the demo
  itself cannot reach: every text field it ships is required and pre-filled, so emptying one makes it
  invalid and raises the label anyway. That gap is why this went unnoticed, and it is worth closing
  with a fixture that can actually rest.

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

- 2074ba4: The themes drop the spellings from before the contract

  Eighteen classes were styled by the shipped stylesheets and emitted by no renderer in any adapter.
  They are what the contract's own vocabulary replaced — `mdy-switch` before the toggle's wrapper was
  `mdy-toggle`, `mdy-multiselect__chip` before the chip primitive, `mdy-multiselect__option` before the
  chip took over the option, `mdy-radio-group-label` and `mdy-segmented-label` before a group's label
  was the shell's, `mdy-colors__swatch-toggle` and `mdy-colors__native-picker` before the colours field
  was rebuilt, `mdy-datepicker__input-group` before the picker became a row, `mdy-range-calendar`
  before the range shared the calendar. Rules that match nothing, kept alive only because deleting CSS
  felt riskier than leaving it.

  Removed from all five stylesheets, and the contract-coverage allowlist shrinks from 138 entries to
  120 — none added. What the browser resolves is unchanged: every deleted selector matched nothing.

  `--mdy-toggle-thumb-size-checked` goes with them. It was documented as deprecated and "remove with
  the next major", and it is inert already: the foundation reassigns it to `--mdy-toggle-thumb-size`,
  so a theme setting it was overwritten, and nothing reads it. Ionic's setting of it is removed too.

  Two selectors were narrowed rather than deleted, because their live half is real:
  `.mdy-input-wrapper input:not(.mdy-checkbox, .mdy-switch)` loses the dead half of its negation — a
  toggle's wrapper is `.mdy-toggle`, so that rule never reached it — and
  `.mdy-renderer--open .mdy-multiselect-overlay__panel:not(…--overlay)` loses a `:not()` that always
  passed.

  **Found while doing this, not fixed here.** The themes styled
  `.mdy-multiselect-overlay__panel--above` and `--overlay`, but the renderer puts the placement on the
  shared panel as `mdy-overlay-panel--above` / `--overlay`. The multiselect's above-placement and
  modal-placement styling has therefore never applied — a rule matching nothing, which is exactly the
  silent failure the contract exists to prevent. The dead selectors are removed; the fix is to style
  the class the renderer emits, and it belongs with contractualising popup placement.

  **Deliberately kept**, because they are a missing capability rather than a dead spelling:
  `mdy-datepicker__backdrop`, `mdy-timepicker__backdrop`, `mdy-select__overlay-backdrop`,
  `mdy-datepicker__popup--modal`, `mdy-timepicker__popup--modal`. A modal placement needs a backdrop
  and the contract has no `backdrop` part; a popup does not reflect the placement it ended up in.
  Those five are the whole remaining dead list, and each is a contract entry to add.

- 4128b40: The switch was invisible in two themes, and now wears a state layer

  `--mdy-comp-*` belong to the token tier (`modyra-base.css`), which a theme need not load — so
  `width: var(--mdy-comp-switch-track-width)` resolved to nothing and the switch was drawn 0×0 in the
  default and Material themes. Every component token the foundation reads now carries the tier's own
  value as its fallback, and the audit fails a fallback-less one: a foundation that assumes a theme
  loaded something is not a foundation.

  The toggle gains a state layer — a halo around the thumb on hover and focus, sized from the handle
  and coloured from it, so it reads as the same control lighting up rather than a second thing
  arriving. Themes can size, colour or silence it through `--mdy-toggle-state-layer-*`.

  Measured in all five themes, off and on: the track keeps its size and its radius, the thumb keeps its
  size, and only its position changes.

### Patch Changes

- 1f09875: A field with no placeholder stops floating its label

  Material's floating label raised itself on `:has(input:not(:placeholder-shown))`. An input that
  declares no `placeholder` attribute never matches `:placeholder-shown`, so the negation always
  matched and the label sat permanently in its active position — shrunk to 0.75 and pinned 8px from
  the top of a field that was empty, with the space its resting position should have occupied left
  blank. Measured on the built demo, one field, empty and blurred, under `material.css`: with a
  placeholder the label rests at `translateY(18px) scale(1)`; with the attribute removed it jumped to
  `translateY(8px) scale(0.75)` and stayed there.

  The selector is now scoped to `input[placeholder]`, so it can only speak about inputs that have a
  placeholder to show. It is a fallback and nothing more: `.mdy-label--filled` is the renderer-owned
  signal for value-present and it measured correct in every state, focused, filled and error alike.
  What is left of the `:placeholder-shown` line catches a value the renderer never saw, a native
  autofill being the case that matters.

  No geometry moves for a field that does declare a placeholder — resting 18px, active 8px, before and
  after.

- 766851c: A panel that is a popup keeps what a popup has

  The reset that stops an overlay wrapper painting a surface of its own said, in its comment, that it
  was for "an overlay wrapper that is a popover, but is not itself a popup". The selector did not say
  it. Some renderers put the popup's own classes _on_ the panel — the datepicker's panel is its popup,
  via `panelClass` — and for those this rule out-specifies `.mdy-popup` and would strip the background,
  border, padding and shadow the popup is supposed to draw.

  Measured in the built demo, the datepicker's surface is intact today, which means something else is
  currently winning the cascade. That is not a state to leave a rule in: it works until a rule moves.
  `:not(.mdy-popup)` states the intent, and the measurement is unchanged before and after — surface
  kept, still anchored, and the select's wrapper still draws nothing at all.

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

- b45d649: An overlay draws one surface, not a wrapper's as well

  Reported as visual friction around overlays in some cases. Measured, it is a leak from the UA
  stylesheet.

  Angular's `<mdy-overlay-panel>` — and Lit's equivalent — puts the **wrapper** in the top layer and
  the widget's popup inside it. The wrapper therefore carries `popover`, and with it the UA popover
  defaults: `background: canvas` and `padding: 0.25em`. Nothing answered them; the rule that answers
  them for a popup is keyed on `.mdy-popup`, which the wrapper is not.

  Its only child is `position: fixed` and so out of flow, contributing no height — so the wrapper
  collapsed to exactly its own padding: an **opaque bar the popup's full width and 8px tall, painted at
  the popup's own origin**. Behind a popup with 10px corners it showed through the corner cutouts,
  which is a white notch at each top corner and worse the darker the theme.

  Measured before: `background rgb(255,255,255)`, `padding 4px`, box `534×8`. After: transparent,
  `0px`, `534×0`, with the popup unchanged at `534×324` and still on its control.

  The wrapper now answers the UA popover styles and paints nothing at all. It never had a surface of
  its own to draw: the popup inside it already states the background, border, radius, shadow and
  padding, and that is the one surface an overlay should have.

  Covered by a demo e2e that measures both boxes, because this is exactly the kind of thing that reads
  as correct in the markup.

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

- fbf1fa7: The chip, the segment and the slider paint through their own tokens

  A census of every colour those three controls declare: 30 declarations already went through a
  component token, 45 reached past their own tokens into a system colour, and **2 were literals** —
  both in a hover state.

  **`.mdy-chip__btn:hover` was `rgba(255, 255, 255, 0.2)`.** White, calibrated for the selected chip,
  which is dark. Measured on an _unselected_ chip in all four themes, the hover moved the rendered
  pixel by exactly **0** — white over white. The +/− steppers on a counter chip had no hover feedback
  at all, in every theme, since they were written. It is now `--mdy-chip-btn-hover-bg`, mixed from
  `currentColor`: on those buttons that is the chip's own label colour, so the tint darkens a light
  chip and lightens a dark one by construction — the same contrast that makes the label readable makes
  the hover visible. Measured after: 31 on the unselected chip, 23–31 on the selected one.

  **`.mdy-segmented__button:hover` in iOS was `rgba(120, 120, 128, 0.1)`** — a near-twin of that
  theme's own `--mdy-ios-fill`, except that being a literal it kept its light-mode alpha in dark mode
  while every fill around it moved. It reads the token now.

  Four colours these controls paint had no token to reach them by, so a theme wanting any of them had
  to restate a rule. They have one, each defaulting to exactly what was computed before:

  - `--mdy-segmented-btn-bg-hover` / `--mdy-segmented-btn-color-hover` — the unselected button's hover
    had none while the selected button's did, so a theme could restyle half a control.
  - `--mdy-slider-value-color` — the readout beside the track.
  - `--mdy-slider-thumb-shadow` — the handle's elevation, which every theme was writing **twice**, once
    per vendor pseudo-element.

  Material and iOS now set those on `.mdy-slider-container`, the part the contract already gives the
  slider, and delete the rules they were restating.

  Two things measurement decided:

  - **iOS keeps its segmented hover rule**, tokenised rather than deleted. It flattens the button with
    `background: transparent` in `mdy.themes`, and a later layer beats any specificity in an earlier
    one — so the foundation's `:hover` in `mdy.components` cannot reach past it. A theme that
    neutralises a background must restate the states that background had.
  - **The handle's shadow is asserted on the control, not on `::-webkit-slider-thumb`.** Chromium's
    `getComputedStyle` reports `none` for that pseudo-element whether the shadow comes from a rule or
    from the token — verified by putting the old literal rule back and reading `none` again.

  The new demo test hovers each control in all four themes and measures the composited pixel. It fails
  against the previous stylesheets.

- 881d3e5: The demo's colour picker sets one property

  It set both `--mdy-sys-color-primary` and `--mdy-primary`, and had to: the themes declared their own
  primary at the short tier, so setting only the `sys` one could not reach them. But setting both also
  _froze_ the bridge — an inline `--mdy-primary` outranks the rule that derives it from `sys` — so the
  palette could not follow the picker even in principle.

  One declaration point makes one line enough. Measured: setting `--mdy-sys-color-primary` to a green
  moves `--mdy-primary`, the derived `--mdy-sys-color-secondary` (to hue 176.5, the primary's 146.5
  plus the model's 30) and `--mdy-chip-selected-bg` with it.

- 9e06022: The foundation stops carrying a second copy of the palette

  `modyra.css` spelled a literal into almost every `var()` it wrote:
  `var(--mdy-sys-color-primary, var(--mdy-ref-color-indigo, #7067FF))`. **147 hex literals**, each a
  copy of a value `modyra-base.css` already owned.

  They existed for a real reason — base was a separate file a theme might not load, and an unresolved
  `var()` drops the whole declaration it sits in, which is how the switch once rendered 0x0 and the
  chips lost their border. The foundation imports the tier now, so that cannot happen, and what the
  copies actually did was defeat the point of deriving a palette: **a literal cannot follow a chosen
  colour.** A page that picked a green primary still got indigo out of the fallback, because the
  fallback is a fixed hex and always was.

  147 of them are gone; 2 remain, both `var(--mdy-on-surface-variant, #3f3f46)` on the short tier
  rather than the `sys` one, left alone because that is a different rule and this batch is not it.
  The file is 13KB smaller.

  Verified inert rather than assumed: every `--mdy-*` token was read from a browser in all four
  themes, before and after — **2016 readings, zero differences**, including `modyra-modern` which was
  already whole.

  `audit-styles-architecture.mjs` enforced the old invariant, that the foundation must never use a
  `sys` or `comp` token without a fallback. That premise was deliberately replaced, so the rule is
  replaced too: it now asserts the foundation **imports** the token tier, which is the thing that
  actually prevents the dropped declarations the old rule was written for. Confirmed to still bite —
  removing the import produces the defect.

- 031f820: Lit draws the contract's multiselect, and the switch travels evenly

  Lit's multiselect showed a summary of what was already taken and kept its options in the popup. It
  now draws the anatomy the catalog names and Angular established: every option is a chip in a grid in
  the field, each in its wrapper, with the same grid in the popup under the filter. Its chips take
  their classes and their parts from the contract, tick included — the single-mode chip had no
  `mdy-chip__check`, which the cross-adapter audit reported the moment the literal was removed.

  The switch's handle moved unevenly between its two states: the off track carries an outline, the on
  track did not, and the handle is inset from the padding box — so it sat two pixels closer to the edge
  when the switch turned on. The outline is now the same width in both states, transparent when on, and
  the travel subtracts it. Measured off and on in all five themes: the gap at the left when off equals
  the gap at the right when on.

  A handle can also be a capsule now, through `--mdy-toggle-thumb-width`/`-height`. iOS's is 38×24,
  measured from the platform, and it was getting that by re-implementing the thumb — which cost it the
  contract's travel and the state layer. It sets the two tokens instead.

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

- 5e23a94: Material's colour trigger can be clicked

  Under `modyra-material.css` the palette's chevron measured **44×0** — no height at all — so it could
  not be clicked by a user or by a test. The other three stylesheets gave it 36–56px.

  The theme set `height: 100%` on it. The foundation already stretches that button with
  `align-self: stretch`, and a percentage height on a flex item whose parent has no _specified_ height
  resolves to nothing: the theme's declaration wins the cascade and then amounts to zero. Stretch is
  what fills the row; a percentage only claims to.

  The cross-theme palette test now clicks the trigger like a user in every theme, rather than reaching
  past the pointer to open the popup — which is how this was found in the first place, and what it
  takes for the test to catch it. It fails against the previous stylesheet.

- 7dfad3e: No popup positions itself any more, and the primitive gained the coordinate it was missing

  The last copies of the popup primitive are gone: the `--overlay` blocks that centred a modal
  placement with `position: fixed`, `top: 50%`, `left: 50%` and a translate — which is exactly what
  `anchorOverlay` writes through `--mdy-overlay-top/left/transform` when it gives up on both sides. The
  select's block also carried a `width: min(24rem, 90vw)` that had been dead for some time: the
  primitive's `width: var(--mdy-overlay-width)` outranked it.

  **Removing them exposed a real gap.** `.mdy-popup` read every coordinate the anchoring writes except
  the transform — only `.mdy-overlay` did. A popup that is not also an overlay, which is every one
  whose classes sit on the panel, was therefore pinned by its top-left corner to the middle of the
  screen instead of centred on it. Measured: the clock at `450,160` in a 900×320 viewport. The
  duplicated blocks had been hiding it. `.mdy-popup` reads it now.

  Reaching the modal placement takes a viewport with no room on either side — 900×320 does it — which
  is why this had gone unmeasured. Before and after, four stylesheets × two widgets docked and modal:
  **identical in every case**, twenty measurements.

  What survives is what the primitive cannot know: a modal list scrolls as a column
  (`display: flex`, `max-height`), and a picker is content-sized rather than control-width
  (`--mdy-overlay-width: auto`). Both are said as one property or one intent, not as a rule restating
  placement in order to change one value in it.

  A grep for a popup class declaring `position`, `top`, `left`, `right`, `bottom`, `inset`, `z-index`
  or `transform` in the foundation now returns nothing.

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

- 9d7b426: Give the boolean controls the anatomy Angular and Lit already render: one clickable
  `.mdy-checkbox` / `.mdy-toggle` wrapper holding the input, the drawn `.mdy-toggle__track` >
  `.mdy-toggle__thumb`, and the text after it. A switch is a checkbox input with `role="switch"`, and
  the wrapper — not the input — carries the component class. The theme's Plain-only
  `.mdy-switch-control` and input-drawn checkbox rules are gone with the markup that needed them.
- e0a4cef: Render `file` and `colors` for real, retiring the placeholder renderer: a drop zone with a browse
  button, a file list and a clear action driven by `fileSelectionTransition`, and a colour control with
  a preview swatch, hex field and preset palette driven by `colorValueTransition` — which is also what
  decides that picking a preset closes the popup while typing a hex value does not. Popups are placed
  through a shared helper that applies `decideOverlayPlacement` and writes the `--mdy-overlay-*`
  properties the themes read. The catalog now names the classes for these parts, so an adapter takes
  them from the contract instead of inventing them, and the caret a renderer without an icon set
  leaves empty is drawn by the theme through `:empty` rather than by naming that renderer.
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

- 1292b5f: A slider's track fills up to its handle

  Reported as reading like "a circle sliding in a controller box" rather than a slider. It was neither
  the box nor the circle: **the track never filled**, in any theme, so what was on screen really was a
  uniform rail with a knob on it.

  `--mdy-slider-track-color` composed the split gradient inside a _token_:

  ```css
  --mdy-slider-track-color: linear-gradient(
    to right,
    var(--mdy-slider-active-color) var(--mdy-slider-fill-pct, 0%),
    var(--mdy-slider-inactive-color) var(--mdy-slider-fill-pct, 0%)
  );
  ```

  A custom property substitutes what it references when **its own** declaration is computed, not when
  it is used. Declared at token scope, where `--mdy-slider-fill-pct` is unset, both stops were frozen
  at the `0%` fallback and inherited down that way. The renderer wrote the real percentage onto the
  control on every value change, and by then the gradient it was meant to feed had already been built
  without it. Measured on a slider sitting at 5 of 10: `linear-gradient(…, rgb(103 80 164) 0%, … 0%)`
  while `--mdy-slider-fill-pct` on the same element read `44.44%`.

  The gradient is now composed in the rule that uses it, on the element carrying the percentage. Same
  two colours, same token names, one stop that is actually the value.

  `modyra-material.css` had a second version of the problem: it set `background` outright to one flat
  colour, so even a working gradient would have been replaced and that theme's slider could never show
  a filled portion. It sets `--mdy-slider-inactive-color` now — the empty part of the track, which is
  what it was describing — and the foundation composes the split.

  The test moves the handle and asserts the fill grows with it, in all four stylesheets, rather than
  checking a remembered number.

- fbef1f6: The calendar, the clock and the chip list are placed by the contract too

  Three more copies of the popup primitive removed from the foundation, following the palette and the
  select list. Each said what `.mdy-popup` already says: `position: absolute` at `top: 100%` while
  closed, and a sibling rule re-reading every `--mdy-overlay-*` property to switch to `fixed` while
  open.

  These three put their popup classes on the overlay panel itself, and the panel is a popover — so the
  primitive was already placing them through `.mdy-popup[popover]`. The duplicates were not doing
  anything; they were merely agreeing.

  What survived is what the primitive has no way to know: a picker is content-sized rather than
  control-width, and now says so with `--mdy-overlay-width: auto` — one property the primitive reads,
  instead of a rule restating placement to change one value in it.

  Measured before and after across `modyra`, `modyra-modern`, `modyra-material` and `modyra-ios`, for
  all three widgets — position, gap from the control, box, left edge, in-viewport, radius, background
  and padding: **byte-identical**, twelve cases out of twelve.

  Left standing: the `--overlay` modal blocks, which duplicate the centring the primitive does through
  `--mdy-overlay-transform` but also carry the modal's own sizing. That placement needs a viewport with
  no room on either side to reach, so it needs its own verification path before being touched.

- b4b236d: Make filtering part of the contract: an option a query does not match is projected as `hidden`
  (plus a `--hidden` class) by the select and multiselect controllers, so every renderer filters
  identically by applying the part instead of reimplementing the match. The theme stops its own
  `display` from beating `[hidden]` on options and chips.
- 9c8a238: Emit the canonical class vocabulary from the widget controllers: `mdy-description` becomes
  `mdy-supporting-text`, `mdy-error` becomes `mdy-control__errors`, the control part carries no
  `mdy-input` class of its own, and `aria-modal` is emitted as the string `"true"`. Plain builds its
  field shell from the contract (so a radio group is `mdy-renderer--radio-group`, as in Angular and
  Lit) and no longer stacks a duplicated class on a part.

## 0.4.0

## 0.3.0

## 0.2.0

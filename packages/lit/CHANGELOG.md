# @modyra/lit

## 0.5.0

### Minor Changes

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

- f580d4b: Take the Lit elements' vocabulary from the contract: each element declares its widget kind and
  reads root, shell and part classes from `MDY_WIDGET_CONTRACTS` instead of repeating literals, and
  its ids follow the shared id policy. The supporting-text container is always rendered with the id
  the controllers describe the control by, so `aria-describedby` no longer dangles. Angular emits the
  contract's boolean control class for the same parts, and a jsdom conformance suite holds the Lit
  elements to the same runtime DOM gate as the other adapters.
- ebca870: Route every Lit overlay through the widgets lifecycle policy: the dropdown, both pickers, the date
  range and the colour palette open, close, answer Escape and dismiss on an outside pointer through
  `overlayLifecycleTransition` rather than each element deciding locally.
- daaabe1: A loading field says so without being opened. The `loading` part now hangs from the control rather
  than the popup, so an indicator reachable only by opening the list no longer satisfies the loading
  state. `empty` keeps its popup parentage: "no options match" is a statement about the list and has
  nothing to say until there is a list on screen.

  Lit's multiselect renders its loader on the search button, which is what its own select and the
  contract already did.

  **Breaking.** `loading` hangs from the control, so a renderer whose only loading indicator lives
  inside the popup no longer satisfies the loading state. Move it to the control, as every first-party
  renderer now does.

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

### Patch Changes

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

- 80706ff: Lit elements take their semantic state from the shared projection

  Every element named its own ARIA attributes, and between them they covered different subsets: none
  emitted `aria-disabled` at all, and `aria-invalid` was absent from the slider, toggle, segmented
  control and colour picker.

  Elements now bind `${mdyPart(this.controlPart(handle))}` and receive `aria-invalid`,
  `aria-required`, `aria-disabled` and `aria-describedby` from the projection in `@modyra/widgets`.
  An attribute added there reaches the DOM without an element being touched.

  Placement follows the contract rather than the markup: the segmented control carries the field's
  state on its group, since each button carries its own option state, and the colour picker carries it
  on the native input the contract names as its control.

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

- 50c2e11: A Lit control re-renders when the form marks it read-only

  `MdyFormController` subscribes to a hand-written list of the field handle's signals, and `readonly`
  was not on it. The read-only bindings added in the previous release were therefore correct and
  inert: marking a field read-only changed nothing in the DOM until some _other_ tracked signal —
  a value edit, a validation error, a disabled toggle — happened to fire and drag a re-render with it.

  A signal missing from that list does not produce a missing attribute, which is what a conformance
  suite looks for. It produces a binding that renders once and then stops tracking, which is harder to
  see and easier to trust.

  The element's own state matrix could not catch it, because the harness called `requestUpdate()`
  before asserting and forced the render it was meant to be testing for. That call is gone: the suite
  now waits for the element to update on its own, so an untracked signal fails it.

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

- e01fc47: Every Lit overlay dismisses on a pointer outside it

  The dropdown base flipped its own `_open` flag on an outside pointer without telling the widget
  controller underneath it, so the select reopened on the next update when the flag was read back
  from the controller. The base now asks the policy whether the pointer dismisses and closes through
  `close()`, which each subclass already overrides to close its controller.

  A Lit multiselect also opens from its trigger, not only from the search affordance, matching every
  other widget in the catalog. The conformance suite now enumerates every kind whose contract
  declares `dismissOnOutsidePointer` instead of checking one hand-picked element.

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

### Patch Changes

- Updated dependencies [318e721]
- Updated dependencies [1bb844f]
  - @modyra/core@0.4.0
  - @modyra/widgets@0.4.0

## 0.3.0

### Patch Changes

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

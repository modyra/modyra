# @modyra/widgets

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

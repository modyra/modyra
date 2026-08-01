# @modyra/angular

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

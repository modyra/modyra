# @modyra/styles

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

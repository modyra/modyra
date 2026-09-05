# Design rules

The decisions a renderer or a theme must not make for itself.

Modyra draws the same form through three renderers — Angular, Lit and the framework-free one — and
six shipped themes, four of which carry pixel baselines. Anything left to each of them diverges — not through carelessness, but because every local choice is defensible alone and only a
column of controls shows the mismatch. So the rules below are stated once, and most are enforced by a
check rather than by review.

This file is normative for anything visual. Where it is silent, choose what is most consistent with
what it already says, then extend it with the new rule and the reason.

---

## Icons

**One grid, one stroke.** Every icon in `packages/core/src/icons.ts` is drawn on a **24 grid** with
**stroke 2**, round caps and round joins. The live area is **20 units, from 2 to 22** — nothing
touches the edge of its box.

**Three span classes**, because one span for everything is wrong in both directions: a chevron drawn
20 units wide stops reading as a chevron, and a calendar drawn 12 wide loses the detail that makes it
a calendar.

| class | span | icons |
| --- | --- | --- |
| `full` | 20 (2–22) | `CALENDAR`, `CLOCK`, `ERROR`, `LOADER`, `KEYBOARD` |
| `compact` | 14 (5–19) | `SEARCH`, `CHECKMARK`, `CLOSE`, `PLUS`, `MINUS` |
| `directional` | 12 (6–18) | `CHEVRON_*`, `SPIN_UP`, `SPIN_DOWN` |

**An icon is geometry, never a character.** No emoji, no `⌕`, no `‹`, no text node. A character
renders in the reader's font at that font's size and baseline, in colours the theme does not choose,
and changes shape between platforms — which is why a set drawn this way can never match itself.

**Rendered size is a property of the set, not of the control holding it.** One rule gives every icon
in a field `--mdy-affordance-glyph`. Written per affordance it was written five times, two spellings
were missed, and those rendered at 28px beside a 16px calendar.

*Enforced by* `packages/core/test/icons.test.mjs` — grid, stroke, span, live area, centring, round
joins, and no pictographic character. *And by* `e2e/plain/size-uniformity.spec.ts` — one rendered
size, centred, no character.

---

## Trailing affordances

The controls at a field's inline end: a calendar button, a clock button, a colour swatch, a search
button, the steppers, and the caret marking a select as openable. A user reads them as one column.

| token | value | what it is |
| --- | --- | --- |
| `--mdy-affordance-glyph` | 1rem | the icon inside |
| `--mdy-affordance-box` | 1.75rem | the box it occupies **in the layout** |
| `--mdy-affordance-target` | 2.75rem | the pointer target, as a centred overlay |
| `--mdy-affordance-inset` | 0.25rem | the gap a container leaves at its trailing edge |

**No horizontal axis at 320px.** Nothing inside a field may require sideways dragging on a page that
already scrolls vertically — WCAG 1.4.10, and the cost falls on the person, not the layout. A strip
that grows *downward* is fine at that width; one that reaches past the field's own edge is not, even
by five pixels, because the second axis is what costs the reader rather than the distance.

**A floor is a promise against collapse, not against the viewport.** The row floor exists because an
opener measured zero and could not be pressed; that is its whole reason. So the rule is
`min(floor, available)`, and what *available* means depends on the part: a control laid out in the
form is bounded by its container, because a control does not break the layout that holds it; a
floating panel is bounded by the viewport less its margins, because a panel may overflow the slot its
anchor sits in — that is what panels do — and may never overflow the viewport.

**A control that shares its row keeps a floor.** A target drawn over a small control cannot rescue
one with no width, and a flex row hands all its shrinking to whichever child allows it: the
multiselect's opener had `min-width: 0`, so a row holding three chips squeezed it to **zero** — in the
tree, `display: flex`, `visibility: visible`, `opacity: 1`, one client rect, and nothing on screen to
press. Every flag a check reads says shown; only the box says otherwise. So a control a person
presses declares its own minimum, and the decoration beside it yields — the chip strip already
scrolls sideways, and what is past its edge is reachable by wheel and by the roving focus.

**The target is not the box.** Sized to WCAG 2.5.5's 44px, the box grew three fields to 46px while
the rest stayed 38. The target is an overlay — centred, out of flow, affecting nothing.

**Stacked steppers take WCAG 2.5.8's 24px** (`--mdy-affordance-target-stacked`). Two controls inside
one 3.5rem field cannot both be 44px; this is an exception with a reason, not an oversight.

**A control's position may depend on the field, never on the value.** The value changes under a
person's hands; the field does not. A command placed after a variable-length row — a strip of chosen
values, a wrapping list — moves whenever that row does, and the control that arrives where another
one was is pressed by a hand that is already there. Standing a command beside its subject is a
discoverability rule; not moving under a hand is a safety rule, and where they disagree the safety
rule decides. ADR 0173.

**The opener is outermost in the trailing column, on every kind.** That is the one affordance every
field draws there, so the eye's line down the form lands on openers whatever a kind draws inboard of
them. Where two commands share that column, a full target of empty space separates a destructive one
from the control that reverses it — these carry no target overlay, so the box is the target and the
gap between hit areas is the margin.

**A button whose visible content is a mark is named by its action, and the mark is hidden from the
accessibility tree.** `×` and `↶` are drawings made of characters; a reader that sees them announces
"multiplication sign" before the name. The same control carries a `title` with the words of its name,
because somebody driving by voice can only say what they can read.

**Only the select caret is decorative.** It is `pointer-events: none` and the trigger behind it is the
target. Everything else is pressed, and the set is derived from the catalogue by
`trailingAffordances()` rather than listed.

**A control fills the field it sits in.** The affordance column only exists if the control reaches
the field's inline end. A control sized by its own text leaves the field's fill as empty space beside
it, and the affordance lands next to the value instead of on the edge — the alignment reads as broken
even though every affordance token is correct.

*Enforced by* `e2e/plain/affordance-alignment.spec.ts` — one inset, one vertical centre, the 44px
target measured on the overlay. *And by* `scripts/audit-styles-architecture.mjs`, which fails a
literal size or inset on an affordance.

---

## The scale is public surface

**A step's name is API.** A consumer builds a theme by setting `--mdy-control-1` or `--mdy-space-4`, so
renaming one breaks them exactly as renaming a widget part does. `contract:diff` records the step
names and reports a lost one as **major** and a new one as **minor**.

**Names, not values.** Changing what a step *is* is what a theme is for, so recording values would
report every theme as a contract change. What a consumer cannot survive is a name that stops
answering.

The names are read from `modyra-scale.css` rather than listed anywhere, so a step added or renamed is
seen without anybody remembering to record it.

### Two kinds of length are not steps, and saying so is the rule

Every length in the sheets is a step, except two categories. Both are named here because "not a step"
is otherwise indistinguishable from "nobody has migrated it yet", and a list of exceptions somebody
maintains is the thing the scale exists to replace.

**A length with no scale to belong to.** A popup's maximum height is a question about the viewport and
about how much of a list a person can take in — not about spacing, not about type. Giving
`--mdy-select-dropdown-max-height`, `--mdy-multiselect-max-height` or `--mdy-chip-w` a step of their
own would put a number in the alphabet that nothing else in the library ever uses, which makes the
scale longer without making anything answer to it. They stay in `rem`, where a reader's own text size
still reaches them.

**A length that is arithmetic, not a measurement.** A floating label's positions are `calc`s over the
field's height and a density factor. Forcing a step into `calc(0.125rem + (density * 0.03125rem))`
does not make the result a step — it makes the expression look migrated while the position is still
computed, which is worse than the literal because it hides what kind of thing the value is. These are
`--mdy-fl-rest-y`, `--mdy-fl-active-y`, `--mdy-fl-gap-mid`, `--mdy-fl-pad-bottom` and
`--mdy-fl-pad-top-textarea`.

**Named one by one, not as the family.** The shared prefix — spelled here in prose, because written as
a name it would be read as the exemption this paragraph argues against — would be shorter and it would
silence a namespace rather than a set of values: a member added later that *is* a step — a border, a radius —
would be born exempt and nobody would ever see it. Named individually, a new one is red on the day it
arrives, and its author either migrates it or argues it here. Both of those are the outcome this
section wants; silence is not.

### The field's own height is on the scale, which is the answer to what the row system is

The field's height token and the floating variant's — spelled without the markup that would make this
sentence exempt them, mdy-input-height and mdy-fl-height — are `calc`s, and their base used to be the
literal `3.5rem` while the control scale stopped at `--mdy-control-3: max(2.75rem, 44px)`. So the
height every single-row field took was a number the scale did not contain, and a theme moving the
scale moved everything around a fixed 56.

That was recorded here as the open question about what the row system is: **a kind is in it when its
height comes from the control scale**, and no kind's did. It is answered in the direction of the
system rather than of leaving it alone — `--mdy-control-4: max(3.5rem, 56px)` is that height, the
same number reachable by the same kind of name as every other step, and both `calc`s read it.

What that buys is the thing the question was about: a theme that changes the scale now changes the
field with it, and the disagreement between three renderers about which kinds are peers has one place
to be settled rather than a literal in two rules. What it costs is a fourth step on a scale whose
first three are pointer targets and whose fourth is a row — a step that is not a target size, which
is a distinction this document now has to keep making.

**The properties this section exempts:**

- `--mdy-select-dropdown-max-height`
- `--mdy-multiselect-max-height`
- `--mdy-chip-w`
- `--mdy-fl-rest-y`
- `--mdy-fl-active-y`
- `--mdy-fl-gap-mid`
- `--mdy-fl-pad-bottom`
- `--mdy-fl-pad-top-textarea`

Whole names, one line each, and nothing above this line exempts anything. The prose is where the
reason lives and the list is where the decision is taken — a paragraph has to be able to name a
property in order to argue about it, including to argue that it is **not** exempt, and for a while it
could not: the sentence saying these two were not exempt exempted one of them, and the paragraph
arguing against a family exemption *was* the family exemption.

Two names are absent on purpose, and they are the ones the paragraph above argues about.

The test that tells them apart: **would moving the scale move this?** A padding must move with it, and
a token that did not would leave a control spaced by two systems at once. A popup's ceiling must not —
it is bounded by the window, which no theme changes. And a derivation moves already, through the
terms that are steps, so pinning the constant would move it twice.

---

## Size

**A field is one height.** Every single-row field shares it, whether or not it carries an affordance.
A control with a height token of its own is the defect: segmented had one saying 40px where the field
said 36, and its explicit height beat the `min-height` sitting beside it.

**Two kinds legitimately grow**, and only two: `textarea` (multi-line) and `radio-group` (as tall as
it has options). Both are asserted as growing, so "taller" cannot spread to a kind with no claim.

**Leading is stated in pixels, never as a ratio.** A ratio multiplies a size the theme chose by a
number the *host* chose, and only some of those products are whole. The label carried a size and a
weight and no leading, so its height was the host page's `line-height` applied to the theme's font
size: at 1.5 against a 13px label that is 19.5px, which made every field — and so every control in
the column — half a pixel tall in every theme. Nothing sat on the pixel grid.

Every text role takes its leading from the typescale, in px, as the input, helper and error already
did. A role with a size token and no leading token is the defect; the host fills the gap and the
system never sees it.

**A chip is one height in both modes, and that height is a control step.** `--mdy-chip-height` meant
the height *including border* — left to `content-box`, one token measured 34px in counter mode and 32
in toggle. It is `--mdy-control-1` now, wherever a chip is drawn: the chip in the field moved onto the
scale first and the chip in the popup did not, so one control was two heights depending on where a
person was looking at it.

**A control is `border-box`.** Left as `content-box`, whatever padding reaches an element is added to
its height rather than taken out of it, and the control is whatever the sum happens to be — a range
input whose track is 4px stood 20px tall because a text field's padding reached it. The element's box
is a control step; a track, a rail or a groove drawn inside it is painted on its own pseudo-element,
where its thickness is its own.

**A full corner has one spelling.** `--mdy-radius-full`. The sheet wrote `50%`, `calc(height / 2)` and
`9999px` for the same curve, which is three values in an alphabet that has one — and on a square they
all draw the same circle, so the difference was never visible and never checked.

**A control standing on its own takes the 44px step.** A control *inside* a field carries its pointer
target as a centred overlay and its box stays 28; a button with no field around it has no overlay to
carry one, so its box is the target.

*Enforced by* `e2e/plain/size-uniformity.spec.ts` and, for the count of distinct values a measurement
may take, `battle-tests/browser/an-alphabet-larger-than-its-vocabulary.spec.ts`.

**Interactive height is not one population.** The alphabet check counts three, and the system
documents more than three before a button is drawn: 24px for a stacked stepper (2.5.8, above), 28px
for an affordance box, 56px for the field. A control inside a field, a field, and a control standing
on its own are three scales that happen to share a unit. Recorded here as a known disagreement between
this document and that check, not as a licence to ignore either.

---

## Motion

**Three curves, named in the token tier**, and no fourth without a reason recorded here:

| token | curve | for |
| --- | --- | --- |
| `--mdy-sys-motion-easing-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | most things start and stop on it |
| `--mdy-sys-motion-easing-decelerate` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | entering: quick to arrive, slow to settle |
| `--mdy-sys-motion-easing-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | a longer, flatter settle |

**No overshoot.** A confirmation reads better arriving and settling than bouncing. The former
`--mdy-sys-motion-easing-spring` was retired rather than revalued: with the overshoot gone the name
would have lied.

**Motion moves transforms and opacity, never layout.** Animating `width`, `height`, `padding`,
`margin` or `left` relays out the element and its children every frame. Where the visual effect
genuinely needs reserved space rather than movement, say so in the rule.

**A transition on a property that never changes is not motion.** Check the property actually varies
by state before animating it.

**One rule takes the reserved-space exception**, and it is named here so the exception stays one. A
centred chip keeps its label optically still while the tick takes one side, by growing the spacer in
front of it — so the spacer's `width` is the mechanism, not a shortcut around a transform. A
transform moves a spacer without reserving anything, which is the single thing a spacer is for. The
cost is a relayout per frame per chip while a selection settles.

*Enforced by* `scripts/audit-styles-architecture.mjs` — a literal curve or duration outside the token
tier fails, as does animating without ever reading `prefers-reduced-motion`.

---

## State

**A visual state keys on the state the contract declares, never on a proxy.** The select caret turned
on `:focus-within` where the catalogue declares `arrow: ["open"]`. Focus and open are different
questions: the popup is portalled, so focus while open landed outside the wrapper and the rule fired
on selection instead — leaving the caret pointing up at a closed list.

**A focus ring is the browser's judgement.** Use `:focus-visible`, not `:focus`. A pointer user who
clicks an option should not be given a keyboard ring; the browser has already computed that, and bare
`:focus` overrides it.

**Hover and focus are one channel per theme, chosen by the control's shape.** A filled control has
only its surface to speak with and tints it — `--mdy-sys-state-veil`, a flat veil laid over whatever
the control already carries, one value per colour scheme. A bordered control has an edge and says it
there, and sets the veil to `transparent`. Saying it both ways makes one state read as two events at
different strengths.

The veil is a **token**, so a theme declines the channel rather than fighting it. The foundation lays
it as a background *image*, which a theme's `background-color` cannot displace — so a theme that
overrode the colour looked like it had opted out and quietly painted both. A channel a theme cannot
cleanly decline is a channel the theme will restate at higher specificity, which is how a stylesheet
becomes an argument.

**A visually hidden native control carries state and focus, never paint.** Several widgets keep a
real `<input>` for the platform — the accessibility tree, the tab order, the form post, the keyboard
model — and let a sibling draw the appearance. The input is clipped to a pixel rather than removed,
because `display: none` takes all four away with it.

Nothing about it is visible, so nothing may paint it, and a rule that matches every input inside a
renderer must be prevented from reaching it. Such a declaration cannot be judged by looking: a
background on a clipped pixel renders identically whether it is right or wrong, so it survives review
and screenshots alike. It is asserted in a browser instead —
`e2e/shared/hidden-controls.spec.ts`, on every renderer and engine.

**A theme may move a state onto a different part, never remove the part.** Where a platform has no
equivalent of the shape the foundation draws — single choice expressed as a list row and a trailing
checkmark, rather than as a group of circles — the part that would have drawn the control carries the
state instead: it keeps its place in the tree, its selector and its ARIA, and only its appearance
changes. This is what lets a theme restyle a control down to its anatomy while the conformance
checks, which assert that every declared part is present, keep passing unchanged.

## Overlays

**The primitive positions; a separate class paints.** `.mdy-popup` owns where a popup is, how it is
clipped and how it opens. `.mdy-popup--surface` owns what it looks like. They were one class, and a
container that paints is a wrapper around the thing it was meant to present — a material applied to
the content then sits on an opaque panel rather than on the page, which is a translucent effect with
nothing to be translucent against.

**A material belongs to the element it is a material *of*.** Never to a wrapper around it. A theme
whose popup is its content neutralises the surface class and leaves the coordinates alone.

**The radius lives on both.** On the primitive it is what `overflow` clips to and what a material's
specular layer inherits; on the surface it is appearance.

**A popup that cannot be shown whole is centred, not clamped** — when its kind declares
`capabilities.overlayScrolls: false`. The test is the whole box on both axes: no side holds its
height, or no edge holds its width. A list may be clamped, because that is what scrolling is.

### The anchoring state classes are hooks, and emitting one is not painting it

**A renderer always emits the class for where a panel ended up** — `--above` when it flipped,
`--right` when it hangs from the other inline edge, `--overlay` when it covers rather than hangs.
That is not a request for a rule; it is the positioning saying what it decided, and it is the same
statement in every adapter because the contract derives it.

**A class earns a rule where the popup has an asymmetry to answer, and not otherwise.** The select
and the multiselect paint `--above`, because a panel that opens upward puts its filter box nearest
the trigger and no arrangement of coordinates says that. A calendar has nothing to flip, so its
`--above` is emitted and painted by nobody; no kind yet looks different for hanging off the other
edge, so every `--right` is. That is the finished state and not a gap: a rule written so a class has
a reader in this repository is CSS maintained to quiet a report.

**So the two halves answer to different owners.** Emitting is the contract's — an adapter that omits
a state class is wrong even where no stylesheet matches it, because a theme outside this repository
may match it today, and the information ("this panel is anchored right") is true whether or not
anything here acts on it. Painting is this document's, and the day a right-anchored panel should look
different, the class is already there and the rule has a place to go.

*Enforced by* `npm run test:contract-coverage`, whose `_unpainted` list may only shrink, so a class
that stops being painted cannot arrive unnoticed. Its entries for this family cite this section
rather than restating it: an exemption argued in two places stops agreeing with itself the moment
either moves.

---

## Elevation

**Three levels, and every raised surface takes one of them.** They are meanings, not sizes:

| level | what sits there |
| --- | --- |
| `--mdy-sys-elevation-shadow-1` | a thing lying on the page — a toggle's handle, a swatch |
| `--mdy-sys-elevation-shadow-2` | a panel the page opened — **every** dropdown, calendar, clock and palette |
| `--mdy-sys-elevation-shadow-3` | a surface over the whole page |

**One rank is one level.** A select's list, a calendar and a colour palette differ in what they hold,
not in what holds them, so they sit at the same height. Four of them once carried four different
recipes — one of them the same two layers as another written in the opposite order, one an unrelated
`0 8px 32px`, one a literal buried in a `var()` fallback chain where which shadow won depended on
which of two other tokens happened to be defined.

**A shadow is two layers**, because a real one is: a short dense contact shadow that says the surface
has an edge, and a long soft cast that says how far it is off the page. One layer alone reads as a
sticker or as a smudge.

**Its colour is the surface's, never black.** `--mdy-sys-color-shadow` is the primary carried nearly
to night, so a shadow on a tinted page belongs to that page. Pure black over a coloured surface greys
it, which is the difference between depth and dirt.

**Dark carries its own ramp.** A shadow on a dark page has almost no room below it to darken, so the
same opacities vanish; the cast is carried further and deepened while the contact layer stays short.

**Level 3 currently has no consumer**, and that is stated rather than left to be discovered: the
modal placement is written at runtime through `--mdy-overlay-transform` and has no class to hang a
level on. A surface that earns level 3 needs that hook first.

---

## Colour

**Text on a filled surface is light while light is readable.** Not "whichever has the higher contrast
ratio" — the ratio's luminance formula weights blue at a fourteenth of green, so it prefers dark text
on a saturated colour where a reader plainly prefers light. Choosing by ratio alone put black on a
saturated blue in every theme.

The bound is a floor, not a metric swap: light while it clears **3.5:1**, the higher ratio below
that. `MDY_ON_COLOR_FLOOR` in `@modyra/styles/color-utils` is the number, and
[ADR 0015](docs/architecture/0015-light-text-while-it-is-readable.md) is why.

**The floor chooses which colour; AA is what a pairing must reach.** They are two different numbers
and this paragraph read as one: the floor decides between a light `on-` colour and a dark one, and
`e2e/palette.spec.ts` then holds every pairing to **4.5:1** — 3:1 for large text — with named
per-theme allowances for the ones a design system fixes below it. A derived `on-` colour that clears
3.5:1 has satisfied the rule *for choosing it* and has not been excused from AA.

**A theme states its design system's model, and derives every role from it.** Material is tonal — a
role is a tone on a palette at an assigned chroma — and iOS is paired, naming the label colour that
goes with each system colour. A literal written at the site that paints it is half a pair: a host
replacing the accent replaces one half, and the other keeps whatever it was. Every one of them is a
variable, so a design system is retuned in numbers rather than rewritten in rules.

**A seed Modyra ships is a colour its own text can be read on.** The floor and AA leave a band —
13% of sRGB, measured — where the rule selects light because light clears 3.5:1 and light does not
reach 4.5:1. Nothing in that band is unusable: 100% of sRGB clears AA in one direction or the other.
But a colour standing there cannot carry the pairing the rule builds on it, so the seeds in this
repository stay out of it. `--mdy-ref-color-indigo` is `#6458EF` for that reason, and
[ADR 0108](docs/architecture/0108-a-seed-a-theme-can-be-read-on.md) is the record. A host that sets
its own primary is not bound by this and owns what it picks.

**Where a design system's own pairing sits below the floor, the system wins and the exception is
named.** White on Apple's system blue is 4.02:1; it is in the HIG and it stays. A theme that darkened
it to reach 4.5:1 would stop being iOS, which is the worse defect. `e2e/palette.spec.ts` lists such
allowances per theme and asserts them in both directions, so one that stops applying fails too.

**Muted text is reading text.** Labels, placeholders, supporting text and weekday headers hold 4.5:1
like anything else — "secondary" is their weight in the hierarchy, not the standard they answer to.

**A control's glyph is reading text too**, and where the control is the way back from a mistake it is
the last thing that may be hard to see. The mark that takes a file off was painted in the error
colour and measured 2.88:1, 3.22:1 and 1.61:1 across three themes: a saturated red is small text that
clears 4.5:1 on neither a light surface nor a dark one, so a hue chosen to mean *destructive* cannot
also carry the glyph at rest. It carries it on hover and on focus, where a colour has a state to
carry rather than a permanent cost.

**Opacity is a colour that has not been decided yet.** Muting text by fading it composites against
whatever is behind, so one number is several contrasts: the adjacent-month days in a calendar were
`opacity: 0.5` and measured 3.06:1 on the resting surface and 3.01:1 on a hovered cell. Where a
faded value is the mechanism, the number is chosen against the **worst** ground the element can sit
on and not the one it is usually seen against. A disabled control is the exception AA itself makes
and keeps its own.

**A stylesheet cannot check what it computed.** It has the colour in OKLCH and a ratio wants sRGB
luminance, so every `on-` colour a theme derives live is an estimate of the rule rather than the
rule. Where a palette can be generated ahead of time, `color-utils` applies it exactly.

---

## How a visual change is reviewed

By diff, not by opinion. Screenshot baselines per renderer and theme make an unintended change a
failing test; the rules above make a *new* decision answerable without a round-trip.

```sh
npx playwright test e2e/plain/visual.spec.ts e2e/lit/visual.spec.ts     # against the baselines
npx playwright test e2e/plain/visual.spec.ts --update-snapshots         # accept an intended change
```

**A baseline update is the reviewable artefact, not a chore before the commit.** Re-recording is how
an intended change is accepted, and it is also how an unintended one disappears — so a diff that
updates baselines and does not say which widget changed and why is the thing review exists to catch.
The test names carry both: `select renders as it did under modyra-ios` names the widget and the
theme, so a re-record has nothing vague to hide behind.

The tolerance is **zero pixels**, because repeated runs are pixel-identical once animations are
disabled and the clock is pinned. That is not strictness for its own sake: at a 0.2% tolerance,
growing every icon by 2px passed every baseline. A suite that cannot fail is not coverage. If a
baseline starts flapping, find the input that moves — a font still loading, an unpinned date — rather
than widening the number.

Baselines are per engine and per platform, and they compare a renderer to *itself*. Nothing here
claims two engines look alike.

If a change is visual and none of these rules covers it, that is a gap in this file. Extend it.

## Enterprise demo pages

The demos exist to be understood by someone who has never seen the engine. Three rules, enforced by
review of screenshots before any push:

**A demo opens with its scenario.** Two or three sentences in business language — who you are, what
you are doing, what the demo proves — before any control. A demo that needs the reader to infer its
point from buttons has not stated it.

**State is sentences, not JSON.** The panel says "Fattura INV-1 — ripartito 95%, manca 5%", with
validity as ✓/✗ and errors as phrases naming the thing, not the path. The raw JSON stays available
behind a `<details>` for the reader who wants it — the default is the sentence.

**Hierarchy is drawn, not implied.** Levels are indented under a coloured left border
(`--mdy-primary` at decreasing strength per depth), each level is captioned (Ordine / Riga /
Allocazione), a locked row carries a badge, and a collapsed level says what it hides ("2
ripartizioni nascoste") instead of disappearing. Buttons carry a one-line subtext of what they will
do. The vocabulary is identical in all three renderers.

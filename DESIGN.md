# Design rules

The decisions a renderer or a theme must not make for itself.

Modyra draws the same form through three renderers and four themes. Anything left to each of them
diverges — not through carelessness, but because every local choice is defensible alone and only a
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

**The target is not the box.** Sized to WCAG 2.5.5's 44px, the box grew three fields to 46px while
the rest stayed 38. The target is an overlay — centred, out of flow, affecting nothing.

**Stacked steppers take WCAG 2.5.8's 24px** (`--mdy-affordance-target-stacked`). Two controls inside
one 3.5rem field cannot both be 44px; this is an exception with a reason, not an oversight.

**Only the select caret is decorative.** It is `pointer-events: none` and the trigger behind it is the
target. Everything else is pressed, and the set is derived from the catalogue by
`trailingAffordances()` rather than listed.

*Enforced by* `e2e/plain/affordance-alignment.spec.ts` — one inset, one vertical centre, the 44px
target measured on the overlay. *And by* `scripts/audit-styles-architecture.mjs`, which fails a
literal size or inset on an affordance.

---

## Size

**A field is one height.** Every single-row field shares it, whether or not it carries an affordance.
A control with a height token of its own is the defect: segmented had one saying 40px where the field
said 36, and its explicit height beat the `min-height` sitting beside it.

**Two kinds legitimately grow**, and only two: `textarea` (multi-line) and `radio-group` (as tall as
it has options). Both are asserted as growing, so "taller" cannot spread to a kind with no claim.

**A chip is one height in both modes.** `--mdy-chip-height` means the height *including border* —
left to `content-box`, one token measured 34px in counter mode and 32 in toggle.

*Enforced by* `e2e/plain/size-uniformity.spec.ts`.

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
that. `MDY_ON_COLOR_FLOOR` in `@modyra/core/color-utils` is the number, and
[ADR 0015](docs/architecture/0015-light-text-while-it-is-readable.md) is why — including the cost,
which is that this sits below AA for normal text on purpose.

**A theme states its design system's model, and derives every role from it.** Material is tonal — a
role is a tone on a palette at an assigned chroma — and iOS is paired, naming the label colour that
goes with each system colour. A literal written at the site that paints it is half a pair: a host
replacing the accent replaces one half, and the other keeps whatever it was. Every one of them is a
variable, so a design system is retuned in numbers rather than rewritten in rules.

**Where a design system's own pairing sits below the floor, the system wins and the exception is
named.** White on Apple's system blue is 4.02:1; it is in the HIG and it stays. A theme that darkened
it to reach 4.5:1 would stop being iOS, which is the worse defect. `e2e/palette.spec.ts` lists such
allowances per theme and asserts them in both directions, so one that stops applying fails too.

**Muted text is reading text.** Labels, placeholders, supporting text and weekday headers hold 4.5:1
like anything else — "secondary" is their weight in the hierarchy, not the standard they answer to.

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

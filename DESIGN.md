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

---

## How a visual change is reviewed

By diff, not by opinion. Screenshot baselines per renderer and theme make an unintended change a
failing test; the rules above make a *new* decision answerable without a round-trip.

If a change is visual and none of these rules covers it, that is a gap in this file. Extend it.

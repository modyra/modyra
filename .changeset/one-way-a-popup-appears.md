---
"@modyra/styles": minor
"@modyra/angular": patch
---

One way a popup appears, in every renderer

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
animate *from* — without it the popup still appears instantly however long the transition says it
lasts.

Opacity only. `transform` carries the centring translate a modal placement writes through
`--mdy-overlay-transform`, and animating it would drag the popup across the viewport on the way in.

The blanket `prefers-reduced-motion` rule already covers this: it matches `[class*="mdy-"]`, so the
transition is neutralised for anyone who asked for that, with no new guard.

Degrades safely. A browser without `@starting-style` or `allow-discrete` has no start value to
interpolate and shows the popup instantly — exactly today's behaviour.

Angular's component `styles:` block is removed. `mdy-overlay-panel--visible` is still emitted and
still unstyled, as before.

---
"@modyra/core": major
"@modyra/angular": patch
"@modyra/vue": patch
"@modyra/solid": patch
---

Remove the deprecated surface

**`@modyra/core/overlay-position` is gone.** It held the placement policy Modyra had before there was
a contract — it never knew how big the popup was, so it chose a side with *enough* room rather than
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

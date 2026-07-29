---
"@modyra/core": minor
"@modyra/angular": patch
"@modyra/vue": patch
"@modyra/solid": patch
---

Remove the deprecated surface

**Breaking, and it rides the minor.** The workspace is pre-1.0 and every package moves together, so
this lands as `0.5.0` rather than claiming a `1.0.0` the framework has not earned — Lit still has no
config-driven form and Studio's preview still draws its own controls rather than mounting real ones.
Pin exactly if you depend on any of the removed names.

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

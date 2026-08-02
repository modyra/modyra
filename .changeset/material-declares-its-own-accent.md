---
"@modyra/styles": patch
---

The Material theme declares its own secondary and tertiary, from Material's own arithmetic.

Zinc's chroma measures 0.0059. Modyra's OKLCH palette *scales* the seed's chroma, and scaling almost
nothing leaves almost nothing: the derived secondary came out `#1b191c`, and the container a selected
chip paints from measured **1.00:1 against `surface-container-highest`** — one value apart in one
channel, so the selected state was invisible on that surface. Segmented buttons paint from the same
token.

Material 3 *assigns* chroma rather than scaling it — secondary is chroma 16 whatever the seed — which
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

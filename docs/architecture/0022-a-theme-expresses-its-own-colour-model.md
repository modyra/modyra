# ADR 0022: A theme expresses its own colour model

Status: Accepted

## Context

A brand colour reaching every widget is the product's headline feature. Measured across four themes
and two schemes, every element that owns text against the surface behind it, it did not survive
contact with two of them:

| theme | pair | measured |
| --- | --- | --- |
| Material | white on a gold brand primary | **1.85:1** |
| Material, dark | field text on a gold container | 2.98–3.29:1 |
| every theme, light | labels, placeholders, supporting text | 3.87–4.24:1 |

The immediate cause was literals. `--mdy-on-primary: #ffffff` in two themes, four more whites in
iOS, a surface ramp written as `color-mix(seed, white N%)`. Removing them raises the numbers, and
the first attempt did exactly that — and produced themes that were no longer Material and no longer
iOS. **That is a worse defect than the one it fixes.** A theme exists to be faithful to the system it
names; a contrast score is not a licence to delete a design language.

The real fault is that neither theme could *express* its own system. Material 3 defines a role as a
tone on a tonal palette; the theme wrote "how much white", which is the same ramp for one seed and a
different ramp for every other. Measured on a gold seed, six surface steps collapsed into a lightness
span of **0.018** where M3 specifies **0.10** — the hierarchy disappeared, and contrast was the
symptom. Apple's HIG defines named system colours in pairs; the theme wrote `#ffffff` at four sites,
so a host replacing the accent replaced half a pair.

## Decision

**A theme states its design system's own model as variables, and derives every role from it.**

**Material is tonal.** Palettes are the source hue at an *assigned* chroma — assigned, not scaled,
because scaling a near-neutral source leaves a near-neutral palette and an M3 palette looks like one
however neutral its source. Roles are tones on those palettes: `primary` is tone 40, `on-primary` is
tone 100, surfaces run 98 down to 90 in light and 4 up to 22 in dark. Every number is a variable, and
changing one moves that role on every seed without disturbing its neighbours.

**The seed is never rewritten.** `--mdy-sys-color-primary` is what a host sets and what every role is
read from; what components paint is `--mdy-primary`, the seed at tone 40. Used raw, the seed carried
M3's white on whatever lightness the brand happened to be.

**iOS is paired.** `--mdy-ios-on-blue` names the label colour Apple pairs with system blue, and the
five sites that sat on the accent read it. A host supplying its own accent supplies both halves.

**A design system's own pairing is kept even below the floor.** White on system blue is 4.02:1. It is
in the HIG, it is what every iOS control does, and it stays — listed as a named allowance with the
reason, not waived silently and not "corrected" into something Apple does not ship.

**The muted text tier is not a design-system question and does hold AA.** Labels, placeholders and
supporting text are reading text; "secondary" describes weight in the hierarchy, not the standard.
The tier was swept over ten seeds and carried to the lightest value that clears 4.5:1 everywhere.

## Consequences

- **Material's palette changes for every seed but its own**, which is the point: it is M3's palette
  now rather than one seed's approximation. For a light brand colour the primary becomes a dark tone
  of that hue — surprising, and exactly what Material Design 3 does.
- **A theme's design system is now editable in numbers.** Retuning a Material step is a tone; before
  it was a mix percentage that meant something different per seed.
- **Two engines' worth of behaviour to keep aligned.** The tonal derivation needs relative colour
  syntax, so each theme carries its pre-derivation values as a fallback. They are the same palette by
  construction — Material's are what `deriveHctPalette` returns — but they are a second copy and can
  drift.
- **The tonal block must be last in the layer.** Declared before a scheme's own fallbacks, those
  fallbacks win and the scheme keeps the ramp the tones were written to replace. That is a cascade
  ordering the file now depends on, and it is fragile in the ordinary way of CSS.
- **`--mdy-md-*` is public surface.** A host may retune Material's tones, which also means it may
  break them.

## Alternatives rejected

**Delete the themes' ramps and let the token tier own everything.** Tried first, and it worked by
every number: all four themes reached AA. It also removed M3's tonal ramp and Apple's system colours,
leaving two themes that scored well and no longer resembled what they are named after. Rejected on
the owner's correction, which is the right one.

**Keep the pinned literals and record the limitation.** Honest, and it leaves a documented 1.85:1 in
the product for anyone using the feature the product advertises.

**Force every theme to 4.5:1, including iOS.** Rejected: it would ship an iOS theme Apple does not
ship. Where a system's own choice sits below the floor, the theme follows the system and the
allowance is named.

**Derive Material's roles from `deriveHctPalette` at build time.** Exact, and it gives up the
runtime-settable seed — the same trade finding M defers for the base palette. Not foreclosed by this.

## Verification

- `e2e/palette.spec.ts` — every element that owns text, against its first opaque ancestor, over four
  themes and two schemes. Seven of the eight combinations report zero; the eighth is iOS's named
  allowance. The allowance is asserted in both directions, so one that stops applying fails too.
- The walk counts what it measured and fails below a floor, because a stale selector list passes by
  checking nothing.
- Falsified rather than assumed: re-pinning `--mdy-on-primary: #ffffff` in Material reproduces
  exactly the 1.85:1 the analysis found, in both schemes, and removing it clears it.
- 216 screenshot baselines re-recorded. Material and iOS move; Default and Modern do not.

Two corrections to the measurement itself are recorded in the spec, because a contrast audit is only
as good as its colour parser: `rgb()` is 0–255 while `color(srgb …)` is 0–1, and reading both on one
scale reported forty readable pairs as `1:1`; and assuming a white page where no opaque ancestor
exists fabricated a dark-scheme failure for every light-on-transparent label.

## Security and privacy

None. A colour model decides what is painted; nothing is stored, transmitted or parsed differently,
and no trust boundary is touched.

The accessibility impact is the substance. The defect this record fixes was text at 1.85:1 — not a
near miss but unreadable — reached through the ordinary act of setting a brand colour. What it
deliberately does not fix is 4.02:1 on iOS, because that is the platform's own pairing; the choice is
named rather than hidden, which is what lets someone overrule it.

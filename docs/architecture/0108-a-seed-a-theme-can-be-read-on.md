# ADR 0108: A seed a theme can be read on

Status: Accepted

## Context

`.mdy-button` is a filled accent control: `background: var(--mdy-primary)`, `color:
var(--mdy-on-primary)`. In the default theme the background is `--mdy-ref-color-indigo` and the text
is the `on-` colour derived from it. An auditor running WCAG 2.1 AA over a page of every widget kind
reported the pair ten times: foreground `#fcfeff` on background `#7067ff`, 10.5pt, **4.09:1** against
the 4.5:1 that AA requires of normal text.

The derivation was not broken. [ADR 0015](0015-light-text-while-it-is-readable.md) chooses a light
`on-` colour while light clears `MDY_ON_COLOR_FLOOR`, 3.5:1, and light on that indigo clears it. The
floor decides *which* colour; AA is what the pair must then *reach*, and the two are different
numbers. So the rule behaved as specified and the result was still below the standard.

**No rule change can rescue that pair, because the colour cannot carry it.** Measured with the
package's own `contrastRatio`: the derived light `on-` colour gives 4.09, pure `#f8fafc` gives 3.96,
and pure white — the ceiling for any light text on that background — stops at **4.14**. Black reaches
5.07, which is the same choice ADR 0015 exists to refuse: its own table lists `#7067FF` as a colour
where the ratio prefers dark text and a reader prefers light.

Sampling the sRGB cube at a stride of 8 — 32 768 colours — says how general this is:

| | |
| --- | --- |
| clears AA under the rule | 86.9% |
| clears AA if free to choose either direction | 100.0% |
| chosen light, clears 3.5:1, misses 4.5:1 | **13.1%** |
| no `on-` colour reaches AA | 0.0% |

No colour is unusable. There is a band, 13% of the cube wide, where the rule selects light because it
clears the floor and light does not reach AA — and `#7067FF` sat in it. That band is the price of ADR
0015, paid by whichever colour is standing in it.

## Decision

**A seed a Modyra theme ships is a colour on which its own derived `on-` colour clears AA.**

`--mdy-ref-color-indigo` is `#6458EF`: the same OKLCH hue and chroma as the colour it replaces
(h 280.3, c 0.218) at a lightness of 0.561 instead of 0.607. The derived `on-` colour reaches
**4.96:1**, and the pivot still selects light, so ADR 0015 governs the choice exactly as before.

This is a constraint on the seed, not a change to the rule. `MDY_ON_COLOR_FLOOR` is unchanged, the
stylesheet's pivot is unchanged, and a host that supplies its own primary is unconstrained — it may
stand anywhere in the band, and owns the consequence.

The brand assets carry the same value. Indigo is the identity colour, not only a UI token: it is in
the logo gradients, the favicon, the social previews and `brand/02-color/`. A seed that met AA while
the mark stayed at the old value would be two colours claiming to be one.

## Consequences

**Every filled accent surface is 4.5% darker in OKLCH lightness**, and every committed screenshot
baseline changes with it. The diff is reviewable and the direction is uniform.

**The mark loses contrast on dark grounds.** Against `--mdy-ref-color-night` it moves from 4.62:1 to
**3.81:1**. It stays above the 3:1 that AA asks of a graphical object, and the other end of the logo
gradient — violet, at 4.83:1 — does not move. Against light grounds it improves: 3.96 to 4.80 on
cloud, 4.14 to 5.02 on white.

**A future brand colour is no longer a free choice.** Anything in the 13% band cannot be a shipped
seed without failing the same audit, which narrows what a rebrand may pick to what a reader can read
on. That is the intended cost.

**`modyra-salience.theme.css` keeps `#7067ff`, deliberately.** It pins `--mdy-sys-color-on-primary`
to `#000000` rather than deriving it, which reaches 5.07:1 and passes. Moving its seed to `#6458EF`
would drop that black to **3.28:1** and break a theme that is currently correct. A theme that pins its
own `on-` colour is answering this question itself.

**The band is still there.** This record removes Modyra from it and leaves it in place for everyone
else. A host that sets a primary inside it gets light text below AA with nothing to warn it, which is
the open edge named under *Verification*.

## Alternatives rejected

**Raise `MDY_ON_COLOR_FLOOR` to 4.5 for normal text.** Light on `#7067ff` is 4.14, below the new
floor, so the rule would fall through to the higher ratio and return **black** — reinstating the exact
defect ADR 0015 was written to remove, on the exact colour its table cites. ADR 0015 had already
measured the same move: "4.5:1 flips one pair of 112 and fixes nothing."

**Name the pairing as a system allowance.** `e2e/palette.spec.ts` carries `SYSTEM_PAIRINGS`, and
`DESIGN.md` states the condition for entering it: *where a design system's own pairing sits below the
floor, the system wins and the exception is named*. The one entry is `modyra-ios`, for white on Apple's
system blue, which is in the HIG and cannot be darkened without the theme ceasing to be iOS. Modyra has
no external authority imposing `#7067FF` on a filled button; it chose that colour and can choose
another. An allowance here would be a project excusing itself.

**Pin `--mdy-sys-color-on-primary` to black in the default theme, as salience does.** Reaches 5.07:1
and is what salience does on purpose. Rejected because salience is a theme that opts out of derivation
for its own reasons, while the default theme is where the derivation is meant to be seen working. Dark
text on a saturated indigo is the reported defect behind ADR 0015, not a fix for it.

**Move only `--mdy-sys-color-primary` and leave the brand token.** Confines the diff to `packages/styles`
and leaves `brand/` untouched. Rejected because it splits the identity: the logo, the favicon and every
social preview would keep a colour the product no longer paints, and the next reader would have to
discover which of the two is the brand.

## Verification

- `npx playwright test -c battle-tests/playwright.config.ts every-kind-under-an-auditor` — axe-core
  over a page carrying every declared kind, restricted to the WCAG 2.0/2.1 A and AA tags, asserting
  zero violations. `color-contrast` on `.mdy-button` is what fails here if the seed moves back into
  the band.
- `npx playwright test e2e/palette.spec.ts` — walks every rendered text colour in four themes against
  the surface behind it and holds each to 4.5:1, 3:1 for large text, with `SYSTEM_PAIRINGS` asserted in
  both directions so an allowance that stops applying also fails.
- `npm run test:styles` — `packages/styles/test/color-utils.test.mjs` holds the rule the seed is chosen
  against: light wherever light clears the floor, the better ratio below it, and the stylesheet's
  threshold equal to the floor expressed as a luminance.

**What is not guarded.** Nothing fails when a *host* sets a primary inside the 13% band. The checks
above measure the seed this repository ships and the palettes the suites sample; a runtime brand colour
is neither. A predicate a host can ask before choosing, and a picker that shows the band, are the way
to close that and do not exist yet.

## Security and privacy

No trust boundary is touched. A colour is a value the host supplies to itself; nothing is stored,
transmitted, or parsed differently, and an attacker gains nothing if the arithmetic is wrong.

The impact is accessibility, and it is the whole reason for the record. It reduces the standing risk
ADR 0015 accepted rather than removing it: that record knowingly ships text below AA for normal text in
exchange for text a reader finds easier, and this one takes the colours Modyra itself ships out of the
range where that trade has to be made. A product with a strict AA obligation and its own brand colour
still has to check it.

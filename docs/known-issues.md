# Known issues

The widget contract's defects are tracked in the open, not privately. This page lists the ones that
are not fully closed and says who each one affects. The full register — every finding, its evidence,
and the reasoning behind its status — is [`docs/contract-gaps.md`](https://github.com/modyra/modyra/blob/main/docs/contract-gaps.md)
in the repository.

Thirty-five findings have been filed. Twenty-six are fixed, two were closed deliberately, six are
partly fixed, and one is open.

## Open

- **Open** — R

**The iOS theme pairs white text on Apple's system blue**, which measures 4.02:1 in light and 3.65:1
in dark against a 4.5:1 floor for body text.

*Who it affects:* anyone using `@modyra/styles`' iOS theme for body-sized text on a blue surface.

*Why it stays open:* that is the pairing Apple specifies, in the Human Interface Guidelines and on
every iOS control. A theme exists to be faithful to the system it names, and one that quietly
darkened this would ship an iOS theme Apple does not ship. The value is exposed as
`--mdy-ios-on-blue`, so replacing the accent replaces both halves. If you need AA on that surface,
override it.

## Partly fixed

- **Partly fixed** — C2, E2, F, L, M, S

**C2 — some popup placement classes are declared but unpainted.** The classes are derived correctly
and emitted; the themes react to only some of them. A placement class earns a rule only where the
popup has an asymmetry to answer — a select flips its search box, a calendar has nothing to flip.
*Affects theme authors* selecting on placement classes that no shipped theme uses.

**L — browser coverage is no longer Chromium-only, but the engines disagree.** Three engines now
run; where they differ, the difference is recorded rather than resolved. *Affects anyone shipping to
WebKit or Firefox* who wants a per-engine guarantee rather than a Chromium one.

**M — a readable text colour is estimated, not measured.** The contrast metric is decided; the
estimate behind automatic colour selection is still approximate. *Affects theme authors* generating
palettes rather than writing them.

**S — the conformance kit's two browser sections do not run in this repository.** *Keyboard
behaviour* and *Accessibility audit* need a browser transport no config here supplies, so the kit
reports eight sections of ten. The questions are answered anyway, by this repository's own browser
suite — nineteen keyboard cases and three accessible-name cases, on every renderer. *Affects an
implementer* conforming a fourth renderer, who gets eight sections from the kit and must write those
two checks themselves.

**E2 and F** are internal: test scripts that `npm test` did not reach, and contract tables keyed by
a bare `string` where a narrower type belongs. Neither changes what a consumer sees.

## Closed without a fix

- **Closed without a fix, deliberately** — C4, E3

**C4** — two exported values with no consumer. Removing them is a breaking change with no benefit;
adding a consumer would mean inventing one.

**E3 — conformance covers the three renderers.** Angular, Lit and Plain are judged by the DOM
conformance suite. The five headless adapters render nothing, so there is no anatomy to check. This
is the design, described in [what "headless" means](https://github.com/modyra/modyra#what-headless-means-for-conformance),
and it is recorded as a finding so that nobody has to rediscover why the numbers differ.

## Everything else

- **Fixed** — A1, A2, A3, B1, B2, B3, C1, C3, C5, D, E1, G1, G2, G3, G4, H, I, J1, J2, J3, J4a, J4b, K, N, O, P, Q, T

Each carries its evidence in the register. `npm run test:docs` fails if this page and the register
disagree about a finding's status.

# ADR 0023: A popup is positioned, not dressed

Status: Accepted

## Context

`.mdy-popup` positioned a popup *and* painted it — background, border, radius, elevation, padding.
One class, two jobs, and the second one made the first a lie: a container that paints is a wrapper
around the thing it was meant to present. A material applied to the content then sits on an opaque
panel rather than on the page, which is a translucent effect with nothing to be translucent against.
Liquid Glass rendered correctly in isolation and could not be perceived in the product for exactly
this reason.

Two more defects lived on the same surface.

**A popup that could not fit was clamped rather than moved.** `decideOverlayPlacement` promoted to the
modal placement only when the roomier side fell under `minSpace` — a fixed 180. A clock face is
~256px, so with 200px below it the rule called that a fit, docked, and `max-height` turned it into
something you scroll a clock in. The modal placement already existed and was correct; nothing routed
to it.

**Overlays juddered against page scroll.** The framework-free renderer repositioned synchronously on
every `scroll` event, non-passive and uncoalesced: a measure-and-write per event, far more often than
frames, each one reading layout and then writing it.

## Decision

**The primitive positions and clips; a separate class paints.** `.mdy-popup` keeps position, insets,
width, the height ceiling, transform, overflow, isolation and the open/close transition.
`.mdy-popup--surface` takes background, colour, border, elevation and padding. The catalogue emits
both on every `popup` part, so nothing changes by not asking, and a theme whose popup *is* its content
neutralises one class without touching the coordinates.

The radius stays on **both**. On the primitive it is what `overflow` clips to, and what the glass
material's specular layer inherits; on the surface it is appearance. A popup that scrolls content past
a rounded corner squares it off.

**A kind declares whether its popup scrolls.** `capabilities.overlayScrolls` — `true` for `select` and
`multiselect`, `false` for the four pickers. A list is meant to be clamped; a clock face, a month grid
and a swatch grid have one size.

**Promotion is about the whole box.** When the content does not scroll and *no placement holds it
entirely* — neither side vertically, neither edge horizontally — it centres. The vertical test alone
would leave a popup docked and clipped on the axis nobody checked. A modal placement of
non-scrolling content is also given the viewport rather than 70% of it: the framing that suits a
clamped list reintroduces, one step in, the scrollable stub the promotion exists to avoid.

**Following the page is passive and frame-coalesced**, in one place. `trackAnchoredOverlay` in
`@modyra/widgets` listens `{ capture: true, passive: true }` and collapses a burst of scroll events
into the single placement that will be painted.

## Consequences

- **`mdy-popup--surface` and `overlayScrolls` are public surface** 1.0 must keep. `contract:diff`
  classifies both as minor.
- **A renderer that hardcodes its popup classes must be updated by hand.** Angular restates them in
  six templates rather than deriving them from the contract, so the class addition did not reach it
  and its conformance run failed until each was edited. Plain and Lit derive and needed nothing. That
  divergence is now visible and is not fixed here.
- **A host that styled `.mdy-popup` expecting a surface** gets a transparent box. The migration is one
  selector.
- **The specular layer's radius now depends on the primitive keeping one.** Moving it wholly to the
  surface class would make the highlight cross the corner as a straight line.

## Alternatives rejected

**Each widget skins its own popup.** The most faithful reading of "the content presents itself", and
six popups × four themes of duplication — the drift the shared primitive exists to prevent.

**Remove the skin and add nothing back.** Cleanest contract, and it ships every popup transparent
until all four themes are updated in the same change.

**A per-call anchoring option instead of a capability.** No contract change, and three call sites to
keep in step — the divergence this repository keeps recording.

## Verification

- `npm run contract:diff` — classifies the class and the capability; both minor.
- **216 screenshot baselines unchanged by the split.** The skin is the same value and still applied by
  default, so any diff would have meant the split leaked. This was run first, for that reason.
- `decideOverlayPlacement`, measured directly: content that fits both axes docks; too tall for both
  sides, too wide for both edges, or both, centres; content that scrolls docks and clamps in every
  one of those cases.
- In a browser: the clock in a 620px viewport is centred with `scrollable: false`, where before it
  docked and scrolled.
- `npm run test:conformance` — three adapters conformant.

## Security and privacy

None. Placement and appearance decide where a popup is and what it looks like; nothing is stored,
transmitted or parsed differently, and no trust boundary is touched.

The accessibility impact is in the promotion rule. A control clamped into a scrollable stub of itself
is hardest on the people least able to work around it — a clock face reachable only by scrolling
inside a 200px window is not an accessible time picker, and it is now centred and whole instead.

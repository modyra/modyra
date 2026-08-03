# ADR 0014: The contract names the responsible element

Status: Accepted

## Context

Four findings, J1–J4 in `docs/contract-gaps.md`, were filed as separate defects. Closing three of
them turned out to be one decision made three times, and it is worth recording once rather than
being rediscovered on the fourth.

Each was a place where the contract named a **region** and left the **element responsible** for
something inside it undescribed:

| finding | the region named | what was undescribed |
| --- | --- | --- |
| J3 | `timepicker.hour` — the segment the header lays out | the `<input>` inside it that a user types into |
| J4a | the widget, for a state's ARIA | which part announces `aria-expanded`, `aria-disabled`, `aria-invalid`, `aria-readonly` |
| J4b | `popup` — a positioning box, deliberately unconstrained | what the box must frame |

The consequence is the same each time, and it is not a cosmetic one. A `<div>` in the timepicker's
segment conformed. A select announcing `aria-expanded` on its root while its trigger said nothing
conformed. An open popup framing nothing conformed. All three are widgets that pass every check and
that a screen-reader user cannot operate.

The shared cause is that a class, a container and a region are all things a *theme* needs to know
about, and the contract had been written in that vocabulary. Assistive technology asks a different
question — which element is this — and nothing answered it.

## Decision

**Where behaviour or semantics belong to one element, the contract names that element as a part.**
A part that contains the responsible element is not a substitute for naming it.

Three applications, each now enforced:

1. **A container that holds a control declares the control.** `timepicker` names `hourControl` and
   `minuteControl` with the `input` semantic, parented to their segments. The segment carries the
   state a theme paints; the control carries the role, the name and the value.

2. **A state names the part that announces it.** `stateCarriers(kind, state)` returns the part or
   parts a kind must expose a state on, and the conformance check asserts presence on each. `open`
   is *derived* from `MDY_POPUP_OPENERS[kind].opener`, which the contract already declared —
   restating it would be a second derivation of one fact. `invalid`, `disabled` and `readonly` are
   declared in a per-kind table.

3. **A popup declares what it frames.** Every overlay kind names at least one `required` part inside
   its popup. No new vocabulary: `required` already meant "this must be rendered", and
   `overlayOnlyParts` already scoped it to an open widget.

The corollary, which is what makes 3 checkable: **a part required inside an overlay is required of
an *open* widget.** A closed picker renders no popup, so nothing inside one can be demanded at rest.

## Consequences

**What this costs.**

- The catalogue grows. Four parts, four `required` entries and a seventeen-row carrier table, all
  hand-maintained. Each is a place that can drift from the renderers.
- The carrier table is not derivable, and that was measured rather than assumed. The catalogue's
  per-part `states:` is a *class* vocabulary — which element a theme paints `--disabled` on — and it
  names `inputWrapper` where `aria-disabled` belongs on the control, `option` where it belongs on the
  group, and nothing at all for `invalid` in sixteen kinds of seventeen. Deriving from it would have
  been confidently wrong.
- A renderer that put a state or a control in a defensible-but-different place is now
  non-conformant. Three did, and all three were genuine defects rather than legitimate variation.
- Naming an element the contract had left free forecloses a renderer's choice. This is the intended
  trade and it is not free: every future part added under this decision narrows what an implementer
  may do, so it must be reserved for elements that carry semantics, never for elements that carry
  layout.

**What it makes possible.** A conformance failure now names a part rather than a widget. "The
multiselect is wrong somewhere" became "`searchButton` does not announce `aria-disabled`", which is
what turned two latent renderer defects into one-line fixes.

## Alternatives rejected

**Derive the carrier from the catalogue's per-part `states:`.** Tried first, and measured: it answers
a different question and would have named the root as `open`'s carrier in five of six overlay kinds.
Rejected on evidence, not on taste.

**Derive the carrier from the label relation** (`label[for] → control`). Closer — it gives `control`,
`trigger`, `searchButton`, `startControl` — but it names exactly one part, and `daterange` genuinely
has two. It also says nothing for the four kinds whose label names a group.

**A new popup-contents declaration.** Rejected as a second vocabulary for one idea. `required` plus
the containment rule already say "the popup must contain a listbox"; a parallel table would restate
it and be free to disagree.

**Require `timepicker.dialog`, the part the contract already declares.** Rejected because no renderer
draws it: Plain applies it to the popup element itself, Lit puts `role="dialog"` on `container` and
never emits the class. Requiring it would demand markup that does not exist. `container` is required
instead, and where the `dialog` role belongs is left open in `docs/contract-gaps.md` rather than
settled by default.

**Constrain the popup element itself.** Rejected, and this predates the decision: a popup is a
positioning box and giving it a role would force one that says nothing. Its semantics live in what it
contains, which is exactly why the contents had to be named.

## Verification

- `npm run test:widgets` — `packages/widgets/test/j-gap-blindspots.spec.mjs` holds one fixture per
  finding. Each asserted the old false-negative until the day the rule landed and was inverted in the
  same commit, so no rule here is one nobody watched fail (ADR 0010).
- `packages/widgets/test/mutation-suite.spec.mjs` — mutations 16–18 break a state's carrier three
  ways: on the root instead, on one of two carriers, and with the opposite value. `EXPECTED_UNCAUGHT`
  is empty and must stay so.
- `npm run test:conformance` — the CLI's **DOM anatomy while open** pass drives every overlay kind
  open and inspects it there. Without that pass, application 3 above is enforced against nothing:
  at rest, every part inside a popup is skipped by design. This was found by mutation — emptying
  Plain's select popup, which the resting pass reported as conformant.
- A carrier naming a part outside its kind's anatomy is a **compile error**: `ARIA_STATE_CARRIERS` is
  typed `{ [K in MdyWidgetKind]: Partial<Record<…, readonly MdyWidgetPart<K>[]>> }`.
- `npm run contract:diff` classifies each change. It does not see everything — public surface outside
  the catalogue is invisible to it, recorded as finding **K**.

## Security and privacy

No trust boundary is touched: the contract describes markup, and every change here is to what a
renderer must emit. Nothing is stored, transmitted or parsed differently.

The one adjacent property worth stating is accessibility, which this decision exists to protect. It
is not a security control, and describing it as one would be the kind of claim ADR 0010 was written
against. An attacker gains nothing if these rules are wrong; a screen-reader user loses the widget.

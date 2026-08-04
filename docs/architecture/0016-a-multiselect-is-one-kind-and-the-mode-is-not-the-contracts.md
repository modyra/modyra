# ADR 0016: A multiselect is one kind, and its mode is not the contract's

Status: Superseded by [ADR 0017](0017-a-varianted-kind-names-its-anatomy-per-configuration.md)

> Its central premise was false: `mode` was already in the Dynamic Form Contract, in
> `dynamic-config.ts` and spelled `"single" | "multi"`. Everything below follows from that error,
> and it is kept because the reasoning it applied to the other options is what makes 0017 legible.

## Context

`multiselect` renders a choice two ways. In **toggle** mode an option is a `<button>` carrying a tick
and a label. In **counter** mode it is a container holding a count between two step buttons — a
container rather than a button, because it holds buttons and a button may not.

The contract has no way to say "this part's element depends on that option", so `option` is declared
`presentation` and no anatomy check reaches it in either mode. That is finding **J2**, and it is the
last of the four.

Three facts decided this, and all three were measured rather than assumed.

**The mode is not in the Dynamic Form Contract.** `@modyra/core`'s field config has no `mode`. Each
renderer exposes it in its own idiom — a function parameter in `@modyra/plain`, a Lit property, an
Angular signal — and all three branch on it internally. Nothing in the document format, and nothing
in either SDK, knows the concept exists.

**The modes share almost all of their anatomy.** Of 25 declared parts, exactly three are
mode-specific: `optionCheck`, `optionStep`, `optionCount`. The other 22 are common.

**The parts for both modes already exist**, with `optionStep` already declared `button` and parented
to `option`. What is missing is not vocabulary; it is a rule that bites.

Two closed findings bear directly on this. [ADR 0014](0014-the-contract-names-the-responsible-element.md)
established that where behaviour belongs to one element, the contract names that element rather than
the region containing it — the answer to J1 and J3 both. And J4b closed with no new vocabulary at all:
`required` plus the containment rule already in place said everything that needed saying. Both point
the same way, which is that J2's answer is more likely to be a rule than a mechanism.

## Decision

**One kind. The contract does not know about the mode, and will not learn.**

An `option` is a **container that must be operable**: either it is itself a button, or it contains at
least one `optionStep`. Toggle mode satisfies the first, counter mode the second, and a `<div>` with
a click handler satisfies neither — which is what J2 is about.

That is a disjunction, and it is the one new thing here: a part may be satisfied by an alternative
rather than by a single declared element. It is stated in the catalogue and never in the config, so
no consumer learns a new concept and neither SDK carries one.

**The steppers stay one part with a cardinality of two**, not two parts. `increment` and `decrement`
are already taken — `number` declares them with `mdy-spin-btn` classes — and minting them again would
either collide or create two vocabularies for one idea. What the contract requires instead is that
the two steps carry **distinguishable accessible names**: a chip with two identically-named buttons
is a chip a screen-reader user cannot operate, whatever its anatomy says.

That requirement is not hypothetical. Measured across the three renderers:

| renderer | the steppers announce |
| --- | --- |
| `@modyra/plain` | "Decrease ⟨label⟩" and "Increase ⟨label⟩" |
| `@modyra/angular` | its `i18n.decrease` and `i18n.increase` |
| `@modyra/lit` | **nothing — icon-only buttons with no accessible name** |

**Deferred, explicitly: whether a multiselect should be a listbox with `aria-multiselectable`** rather
than a grid of chips. The grid is what all three renderers implement and it is written down nowhere,
which is what makes it look accidental. It is a question about what a multiselect *is*, independent
of how many modes it has, and answering it here would bundle two decisions into one record. It stays
open in `docs/contract-gaps.md`, and plan 42 left multiselect's popup contents loose for it.

## Consequences

- **No public surface is added.** Not a kind, not a config field, not a discriminant. This is the
  reason the option was chosen over the other three, under the standing principle that the smallest
  public surface wins.
- **The catalogue gains a concept**: a part satisfied by an alternative. That is real complexity, and
  it is bounded — one rule, one part, expressible as data. If a second kind ever needs it, that is
  the moment to ask whether it deserves a general mechanism; one instance is not evidence for one.
- **`@modyra/lit`'s steppers become non-conformant** the day the check lands. That is a defect this
  decision found rather than caused, and it is a one-line fix per button.
- **The mode stays a renderer concern**, which means the contract cannot check that a renderer's two
  modes agree about anything. Nothing did before either; what changes is that this is now a stated
  boundary rather than an omission.
- **Conditional anatomy is not built.** If a future kind genuinely needs a part's element to depend on
  configuration, this ADR is the record to overturn, and the reason to overturn it would be a second
  case rather than a nicer model of the first.

## Alternatives rejected

**A discriminant in the public config drives the anatomy.** The faithful model of what the renderers
do, and the largest surface: `mode` would have to enter the Dynamic Form Contract, which is a document
format that the Rust and Java SDKs carry and that 1.0 must keep stable. It would put a rendering
choice into the format that describes *what a form is*. Rejected on the standing principle, and the
measurement is what made the cost concrete — the concept is currently absent from core entirely.

**Two kinds.** Simple static anatomy and no new machinery, which is genuinely attractive. Rejected on
the split: 22 of 25 parts are shared, so two kinds duplicate almost everything to separate three
parts, and `MdyWidgetKind` is a public union every renderer switches on and both SDKs enumerate. It
buys clarity in the catalogue by spending it in every consumer.

**Mode fixed at construction rather than at runtime.** Attractive because it collapses the post-mount
state space, which helps SSR and the conformance manifests. Rejected because its premise is false
where it matters: `mode` is a *public property* on the Lit element and a signal on the Angular
component, settable at any time. The contract cannot forbid what it does not know about, so this
would be an unenforceable convention — and enforcing it would mean first adding the concept the ADR
above rejects adding.

**Leave `option` unconstrained and record it as deliberate.** What the contract does today. Rejected
because it is what J2 *is*: a choice a pointer can make and a screen reader cannot announce, in the
one kind where the anatomy has two shapes.

## Verification

Plan 44 builds these; none of them exists yet, and that is the honest state of this record.

- An option that is neither a button nor a container of steps must fail `inspectWidgetDom` with an
  issue naming `option`. The fixture belongs in `packages/widgets/test/j-gap-blindspots.spec.mjs`
  beside the other three, which inverted when their gaps closed.
- Both admitted shapes must pass — one fixture per mode, so the rule cannot be accidentally narrower
  than the decision. This is the check plan 40 wished it had had: a rule written from one renderer's
  markup is a rule against the others.
- Two steppers in one option must carry different accessible names, and `@modyra/lit` must stop
  failing it.
- `npm run test:conformance` on all three renderers, in both modes. The state matrix drives mode
  today only in the renderers' own fixtures.

## Security and privacy

None. The mode is a rendering choice over options the host already supplies; nothing here changes
what is stored, transmitted or parsed, and no trust boundary is touched.

The accessibility impact is the substance of the decision rather than a side effect: an option that
announces nothing, and two buttons that announce the same thing, are both defects this record exists
to make checkable.

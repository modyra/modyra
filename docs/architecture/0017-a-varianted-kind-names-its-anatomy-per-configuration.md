# ADR 0017: A varianted kind names its anatomy per configuration

Status: Accepted — supersedes [ADR 0016](0016-a-multiselect-is-one-kind-and-the-mode-is-not-the-contracts.md)

## Context

ADR 0016 decided that `multiselect` stays one kind and that its mode stays out of the contract, with
an option required to be *operable* — a button, or a container of steppers. It was `Accepted` for one
day. It rested on a measurement that was wrong.

**Its central claim was that the mode is absent from the Dynamic Form Contract.** It is not.
`MdyDynamicOptionsField` in `packages/core/src/dynamic-config.ts` has carried
`mode?: "single" | "multi"` all along, documented as "Multiselect only". The error was in how it was
looked for: `packages/core/src/types.ts` rather than `dynamic-config.ts`, and the words "toggle" and
"counter" rather than the words the config actually uses.

Everything 0016 concluded followed from that. It rejected a discriminant because one "would have to
enter the document format two SDKs carry" — the entry was already made, and paid for, years of
releases ago. With the premise corrected, the option it rejected costs nothing that has not already
been spent.

**And the rule it chose does not satisfy [ADR 0014](0014-the-contract-names-the-responsible-element.md).**
"A button, or a container of steppers" is a disjunction: it says *something here* is operable and
never says which element. ADR 0014 exists because naming the region instead of the responsible
element is what let three widgets conform that nobody could operate. A contract that will not say
which element is the control has not met it — it has restated the problem more precisely.

## Decision

**A kind whose anatomy depends on its configuration declares a `variant` per configuration, and each
variant names the elements and required parts of that configuration.**

For `multiselect`, keyed by the `mode` the config already carries:

```ts
variants: {
  single: { elements: { option: "button"    }, required: ["optionCheck"] },
  multi:  { elements: { option: "container" }, required: ["optionStep", "optionCount"] },
}
```

In `single` the option **is** the control. In `multi` it **contains** them. Both stated, neither
implied — which is what ADR 0014 asks for and what a disjunction cannot give.

**The variant names are closed, and defined once.** `MdyWidgetVariant` is an alias of core's own
`MdyMultiselectMode`, so the variant key *is* the value a form document carries and the two cannot
drift. An invented name is a compile error — `Type '"counter"' is not assignable to
'MdyMultiselectMode | undefined'` — with a runtime guard behind it for callers without types. Left
open, a consumer could ask for a variant nothing describes and receive a widget checked against no
anatomy at all, which is the gap this record exists to close, re-entered through the front door.

**A new semantic, `container`**, for a part that holds controls and is not one. `presentation` could
not express it: it admits everything, which is its purpose, so it cannot refuse a `<button>` holding
a `<button>` — invalid HTML that a single unconditional element declaration would have forced on one
of the two modes.

**What a variant may say is deliberately narrow**: elements and required parts, nothing else.
Different parents or different relations would make it a second catalogue rather than a
qualification of this one.

**The mechanism is general; the vocabulary is not.** Any kind may declare variants — `variants` is on
the shape and every definition carries the field, empty for sixteen of seventeen. But the *names* are
a multiselect's modes, because that is the only axis in the catalogue that varies anatomy. A second
kind varying on something else widens `MdyWidgetVariant`, and that is the moment to ask whether two
axes belong in one union or whether a kind should key its variants by its own. Answering it now, with
one case, is the failure the strategy document names.

**And the part names inside a variant are the kind's own.** `MdyWidgetShape` is generic over its
parts, so `required: ["notAPart"]` does not compile. That needed `NoInfer` on the shape parameter to
work at all: without it the shape is a second inference site, a name appearing only there widens the
part union to include it, and the declaration is checked against itself. The catalogue has shipped
that class of stale key twice — `optionControl` on segmented's `required`, and `PARENT_CANDIDATES`
before it — so the guard is against a demonstrated failure rather than a hypothetical one.

## Consequences

- **The contract can finally be wrong about a multiselect**, which it could not before. Both modes
  are checked against their own anatomy, and a mode's markup judged as the other's fails.
- **`optionCheck` cannot be required in counter mode**, and that is a compile error rather than a
  runtime check. Proven by prototype before any of this was written, which is what plan 44's gate
  demanded.
- **The catalogue carries machinery for one kind.** That is real cost and it is bounded — two fields,
  one lookup. If a second kind ever needs it, that is the moment to ask whether it deserves a general
  model; one instance is not evidence for one.
- **Adapters must declare which variants they support** and mount each. A config that declares none
  is checked exactly as before, so this is additive for every kind that has no variants — which is
  sixteen of seventeen.
- **`contract-diff` learned to see variants**, so declaring, withdrawing or re-requiring one now has
  a classification. Recording the concept without teaching the differ would have widened finding
  **K**, which had already bitten twice.

## Alternatives rejected

**Everything ADR 0016 decided.** Its option — one kind, mode out of the contract, an operable-option
disjunction — is rejected for the two reasons above: its premise was false, and its rule does not
name the responsible element. Its *analysis* of two kinds and of construction-time modes still holds
and is not repeated here; read it there.

**Two kinds.** Rejected in 0016 on evidence that survives the correction: 22 of 25 parts are shared,
so two kinds duplicate almost everything to separate three, and `MdyWidgetKind` is a public union
every renderer switches on and both SDKs enumerate.

**Open variant names.** Considered and rejected on the owner's objection, which is the right one: a
name a consumer can invent is a name the catalogue cannot describe, and an instance checked against
an anatomy that does not exist is worse than one checked against a weak anatomy, because it reports
success.

**A general conditional-anatomy language** — conditions over arbitrary config fields. Rejected as the
failure mode the strategy document named: designing the machinery for one case before a second exists
to constrain it.

## Verification

- `packages/widgets/test/j-gap-blindspots.spec.mjs` — six J2 fixtures: each mode conforms to its own
  anatomy; a toggle option that is not a control fails; a counter option missing its steppers fails;
  a counter option that is itself a button fails; a toggle chip judged as a counter fails, which is
  what proves the variant decides rather than the markup satisfying both; and an undeclared variant
  is a caller error.
- `npm run test:conformance` — the anatomy pass mounts **each declared variant** and inspects it
  against that variant's anatomy. Without it the run reported CONFORMANT having rendered one mode,
  which is this finding's own shape one level up and is how it was caught: **no fixture mounted
  counter mode at all** before this work.
- `npm run contract:diff` — variants are snapshotted and compared.
- Falsified rather than assumed: removing one stepper from Plain's counter chip fails the run with
  `multiselect[multi]`, naming the variant. The same mutation was invisible before.

## Security and privacy

None. A variant selects which anatomy a rendered widget is checked against; nothing is stored,
transmitted or parsed differently, and no trust boundary is touched.

The accessibility impact is the substance rather than a side effect. The rule this record makes
checkable is that a choice announces itself — and applying it found `@modyra/lit`'s counter steppers
to be icon-only buttons with no accessible name, which is now fixed.

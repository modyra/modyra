# Roadmap

Modyra makes a **narrow promise over a small, verifiable surface**, rather than putting one version
number over everything that ships. This page describes what is ahead. What already happened is in
the [changelog](CHANGELOG.md) and the per-package release notes.

## What carries a promise

**In scope, versioned together, currently at 2.5.0:**

| Package | Why it is in |
| --- | --- |
| `@modyra/core` | The form engine and the Dynamic Form Contract. Zero dependencies |
| `@modyra/widgets` | The widget contract: anatomy, states, relations, behaviour. Depends only on `core` |

Nothing in either is removed or changed in a breaking way outside a major release. The
[compatibility policy](docs/contract-compatibility.md) says how that is classified and checked, and
`npm run contract:diff` is what classifies it.

The perimeter is real rather than asserted: `scripts/audit-package-independence.mjs` passes,
`@modyra/core` declares no dependencies at all, and `@modyra/widgets` declares exactly one.

**Outside that promise, shipping, versioned independently — all still below 1.0:**

- **the three renderers** (`@modyra/angular`, `@modyra/lit`, `@modyra/plain`) — held to the contract
  by conformance, and they reach 1.0 after it does, not with it;
- **the five headless adapters** (React, Vue, Solid, Preact, Svelte) — they render nothing, so the
  DOM contract cannot judge them;
- **Studio** and its ten packages — the largest unbounded surface, with a project format and
  migration story that are not settled;
- **the Rust and Java SDKs** — they track the Dynamic Form Contract rather than defining it.

The risk to this project is not code quality. It is that the contract, the framework matrix, the
SDKs and Studio grow faster than any promise a consumer can rely on. A version number over all of it
would be a promise about the parts least ready to make one.

## Ahead

### Reduce the drift between the contract and the themes

`scripts/audit-contract-style-coverage.mjs` currently reports **41 off-contract classes** and **46
contract classes no theme paints**, every one of them allowlisted. The two halves have moved in
opposite directions since this was written: off-contract fell from 76, and unpainted rose from 39 —
so the allowlist is shrinking where a class was reclaimed and growing where the contract declared
something no theme answers. Each entry needs a verdict: it belongs in the contract, it belongs to a
theme, or it should be deleted.

**Done when** the off-contract count has a stated target and is measurably below it.

### The renderers toward 1.0

Conformance already judges Angular, Lit and Plain against the same suite. What is missing before
they can make the same promise `core` and `widgets` make is a stable answer on the remaining
anatomy questions and a coverage floor each renderer commits to.

### 3.0.0 — the same capability behind a smaller thing to learn

The criterion is the user's: *easy to use, the same functionality, the complexity hidden*. It is not
"fewer exports", which is a different and poorer measure — a library can halve its export count and
be harder to start. What it is measured against are three scenarios written down in
`examples/baseline/`, each carrying its specification in prose so the after-version is re-implemented
from the same words rather than edited from the same file:

```
(a) a starter                 1–3 doors · 8–10 named symbols
(b) a form described by data  2 doors · 3 symbols · 8 concepts · 9 keys on the parse result
(c) a reactivity binding      1 door · 3 symbols · 2 interfaces · 10 members
```

**3.0.0 at the criterion is: these numbers fall, at unchanged prose.** Concepts before symbols — a
symbol is counted, a concept is paid for.

Six items, in the order their dependencies allow:

1. **The surface tool, first, because the inventory depends on it.** `audit-type-surface.mjs` keys
   its baseline by bare name, so two packages exporting one name produce one entry and the last
   scanned wins — `MdyFieldState` is declared in eight packages and recorded once. Until the key
   carries the package, a census of the surface cannot say whose a type is, and `@modyra/core`'s
   recorded shape is whatever `@modyra/angular` last overwrote it with.
   It also answers only "did somebody forget to update the baseline", never "what changed since the
   release": there is no `--since`, so its green means less than the question everybody asks it.

2. **Layer one — the hand-written path reaches the declarative vocabulary that already exists.**
   Counted on imports rather than on names — `min` and `max` are also schema keys — 25 of the 37
   files outside the packages that import from `@modyra/core` name a validator, and **24 of those 25
   import `required`**. The most-used rule in the repository is the one that costs an import
   everywhere, so this item pays on the dominant case rather than on a tail.

   The vocabulary is not to be invented: `MdyDynamicValidators` already states rules as data, and a
   document written in it already becomes functions. Only the hand-written path still names them one
   at a time. So `rules:` on a field is *that same language*, not a third one — learned once, spoken
   in two places.

   **Reconciled, not merged.** The two vocabularies are two species and must keep diverging where
   they do: `MdyDynamicValidators` states an author's *intention* (`required`, `email`), and
   `MdyValidatorFacts` states the *consequence* on the native control (`inputMode`, `step`). `email`
   belonging only to the first and `inputMode` only to the second is correct, and a single merged
   list would end that distinction the first time somebody wrote `inputMode` as a rule. What is owed
   is the declared map between them.

   One gap is real rather than legitimate, and it is not the one the key names suggest. `step` is a
   consequence like `inputMode` — `integer()` attaches `{ step: 1 }` exactly as `email()` attaches
   `{ inputMode: "email" }` — so a document has no business declaring it. What a document cannot
   declare is **`integer` itself**: the rule of which `step` is the consequence. That is the whole
   gap. `oneOf` and `eachOneOf` are already covered, because a field states its list as `options`,
   and they stay out of `rules:` for that reason — two places for one list diverge. At 2 files of
   use, that exclusion costs almost nothing.

   And a door that parses, applies and mounts in one act closes both of scenario (b)'s traps by
   construction: rules the parser reads are not applied unless a second call applies them, and a rule
   written on the field instead of beside it is still *kept* — both modes now refuse the document,
   and what they disagree about is what survives it (strict keeps none of the field, lenient keeps
   it), so a reader consulting only the verdict cannot tell that a constraint was dropped.

3. **The contract teaches itself.** A renderer written from the published contract alone reports
   `NOT CONFORMANT — 8 findings · 6 of 10 sections` ([issue #2](https://github.com/modyra/modyra/issues/2)),
   and the three reasons are small pieces of work rather than a sentiment: the meaning of *required
   under an optional parent* stated where an author looks — `overlayOnlyParts` explains seven of the
   thirteen and six are not overlays; the five required controls that carry no class, role or
   attribute made findable, or the guide saying plainly that they are reached only through `parts()`;
   and a reference config that shows the members of `MdyStateFixture` instead of delegating them to a
   fixture the reader does not open.

4. **The two capabilities that nothing reads gain their consumers.** `graphInspection` and
   `serverSnapshots` are declared by every runtime, answered `no` by all eight, and read by no code —
   a column constant on every row carries no information. They stay because their consumers are in
   scope here: the devtools panel reads the first, an SSR path uses the second.

5. **The deprecation harvest.** The aliases 2.5.0 shipped, and the names kept pointing at an older
   meaning, fall here. It is the cheapest item and the only one already fully specified, which is
   exactly why it is the one that gets forgotten.

6. **The conformance bench reports what it skipped.** Five capability flags select which checks apply
   rather than what runs, so declaring `false` skips a check and nobody is told — the dangerous
   direction is downward, not upward. For every `false`, the bench names the semantics it did not
   test, with the count: *proven on 7 of 10*. A report, not a gate, because `false` is usually true.

Each item opens the same way, because the first one earned it: **before an artefact more than one
tool reads is changed, its readers are listed.** Regenerating the type surface under a new key broke
two audits that read it, one of them a gate — a minute of `grep -rl` beforehand would have found
both. The item where this will matter most is the deprecation harvest, where every alias removed has
readers by definition.

**Done when** the three scenario numbers are lower against the same prose, and a renderer written
from the contract alone reaches conformance without the contract or the suite changing to admit it.

## Deferred, with reasons

Sequenced rather than abandoned; each is waiting on something specific.

| Item | Waiting on |
| --- | --- |
| Nested popups: dismissal order, no duplicate transitions | A real case. No kind declares an overlay inside another kind's popup |
| A `reason` on every close (`outside-interaction`, `escape`, `selection`, …) | Settling the taxonomy against three engines rather than one |
| The full pointer device matrix: pen, scrollbar drag, Shadow DOM | The same multi-engine work |
| Branded types for schema, instance and migration paths | The Studio shape freeze |
| Visual regression across renderers and themes | Multi-engine screenshots. Diffing one engine's pixels is the same mistake twice |
| Property-based coverage | Aimed at the contract gates, never at the repository generally |
| A committed bundle-comparison harness | Competitor figures in the [comparison](docs/guides/comparison-form-libraries.md) come from a harness that is not in this repository, so they cannot be re-measured here |

## Not planned

- new framework adapters without demonstrated demand;
- readiness claims that apply equally to every adapter, when they demonstrably do not;
- enterprise features without a concrete use case;
- React Native beyond documentation, until a Metro and device-level test exists;
- widening the Dynamic Form Contract into a general-purpose configuration language.

This list is the perimeter freeze. Adding to the system is what the roadmap is sequenced to avoid.

## Known open

The contract's defects are published in [known issues](docs/known-issues.md) rather than kept
private. One is open and stays open on purpose: the iOS theme pairs white on Apple's system blue,
which measures below the 4.5:1 floor. It is the pairing Apple specifies, and a theme that quietly
darkened it would ship an iOS theme Apple does not.

---

Design decisions belong in [architecture decision records](docs/architecture/README.md), not here. A
decision recorded only in a roadmap is a decision the next reader relitigates.

# ADR 0024: An author-time check calls the parser

Status: Accepted

## Context

The Dynamic Form Contract already knows what is wrong with a bad document. `parseDynamicForm`
returns `MdyDynamicDiagnostic` values — a code, a severity, a JSON-pointer path, a message — and
sixteen `MDY_DYNAMIC_*` codes cover unknown kinds, options-less choices, duplicate and unsafe
names, layout slots naming fields that do not exist, rules and validations referencing fields that
were never declared, and documents past the schema's depth and node limits.

Every one of those findings arrives at runtime, on a dev build, in a console. The author learns that
a `select` needed options by noticing that no select appeared. The knowledge is complete and it is
delivered after it is useful.

Moving it earlier — into the editor of whoever writes a contract on top of these libraries — is
worth doing, and it creates the pressure this record answers. The obvious way to build an editor
check is to write the rules again in the tool that runs there: a list of valid kinds, a table of
which kinds need options, a name grammar. That is a second statement of what a valid contract is.
The two would agree on the day they were written. The parser gains a code, the plugin does not, and
from then on the repository has two answers to the same question and no way to tell which one a
consumer met.

The same shape has cost this project before: a contract whose truth was spread across a catalogue,
an override table and an allowlist, where no single place could be read to know what a widget
required.

## Decision

An author-time check over a Dynamic Form Contract obtains its findings by calling
`parseDynamicForm` and reporting the diagnostics it returns.

It holds no independent notion of validity. Not a list of kinds, not a table of which kinds require
options, not a name grammar, not a depth limit. The code it reports is `diagnostic.code`, the
severity is `diagnostic.severity`, the message is `diagnostic.message`, and the position comes from
resolving `diagnostic.path` against the document it was given.

Where a check cannot reconstruct the whole document — a source literal assembled from a spread, a
helper call, or an imported constant — it reports **nothing**. A partial document yields findings
about absences that are not absent, and the first consumer to meet one turns the check off.

These checks ship as `@modyra/eslint-plugin`: development-only, no runtime API, its own release
cadence.

## Consequences

**Precision is bounded by the parser's path granularity, not by the check's effort.** Field-level
diagnostics are stamped `/fields` by the diagnostic sink rather than `/fields/3`, so a bad field
underlines the `fields` property rather than the field. Sharpening that is a change to
`dynamic-config.ts` — which then sharpens the console, the CI gate and the editor at once. That is
the intended shape: the check is never the place to fix a diagnostic.

**Silence is chosen over noise.** A contract built by composition gets no findings at all. Real
defects go unreported in exchange for never reporting a defect that is not there. The fraction of
real-world contracts this excludes is a number worth measuring rather than assuming.

**A further package to version, release and support.** Dev-only and runtime-free, but the cost is
real and the count is already high.

**The parser becomes load-bearing for a surface it was not written for.** Its signature, its codes
and its path spellings are consumed by a published tool. Changing a code string is now a change
somebody sees.

## Alternatives rejected

**Reimplement the rules in the plugin.** Faster to write, and every incentive afterwards is to keep
the copy rather than reconcile it. Two normative sources for one question is the failure this record
exists to prevent.

**Ship the rules as a `@modyra/core/eslint` subpath**, avoiding a new package. Core's bundle is
already over its budget, and the plugin needs `eslint` and `@typescript-eslint/utils` at
development time; putting a linter inside the runtime package makes every consumer carry the tool
whether or not they lint.

**JSON Schema alone.** It gives editor diagnostics for `.json` contracts with no extension at all,
and it is worth having for that. It cannot express a cross-reference: a duplicate field name, a
layout slot naming a field that does not exist, a validation reading a path that was never
declared. Those are the findings that matter most, so schema is a complement, not a substitute.

**A Visual Studio Code extension.** Justified only by what ESLint and JSON Schema cannot do — hover
anatomy, go-to-definition from a slot to its field. It is a standing maintenance surface, and this
project cannot open one before the cheaper surfaces have users.

## Verification

`node --test packages/eslint-plugin/test/*.test.mjs` builds its cases from
`spec/fixtures/dynamic-form/**` — the corpus the TypeScript, Rust and Java parsers already share. A
fixture the parser rejects is a fixture the check must report, so the two cannot diverge without a
red test.

That comparison is necessary and it is not sufficient, and the reason is worth stating because the
obvious check is the wrong way round. Renaming a `MDY_DYNAMIC_*` code in `dynamic-config.ts` moves
**both** sides of every assertion — the expectation is the parser's answer too — so the suite stays
green whether or not the rule holds a copy of the rules. Green after a mutation proves nothing.

What proves it is an absence. `packages/eslint-plugin/test` asserts that no source file in the
package contains the string `MDY_DYNAMIC`, so a rule that reports a code cannot be holding a list of
them. Under a deliberately renamed code the rule was observed emitting
`MDY_DYNAMIC_OPTIONS_ABSENT_MUTANT`, a code that appears nowhere in its source — which is the
coupling being live rather than agreed.

`node scripts/audit-contract-schema.mjs` holds the second surface honest: it asserts the schema's
verdict against the parser's across the same corpus, and records the cross-reference fixtures as
knowingly accepted by the schema rather than passing them silently.

## Security and privacy

The checks run in an editor, over repository content, which for anyone reviewing an unfamiliar
project is untrusted input. Reconstructing a contract from a source literal must therefore be static
evaluation of literal syntax — no `eval`, no `new Function`, no module execution, no resolution of
imported values by loading the module that defines them. A check that executed source to learn what
a contract said would run attacker-controlled code on file open, from a tool the user believes only
reads.

This is ADR [0007](0007-expressions-are-data.md)'s rule arriving at a second boundary: the contract
is data at runtime, and it is data at author time too. The refusal to evaluate non-literal input is
the same refusal, and the "report nothing" clause in the decision is what keeps it affordable —
there is no pressure to execute anything in order to say more.

No contract content leaves the machine, and nothing is written outside the editor's own diagnostic
surface.

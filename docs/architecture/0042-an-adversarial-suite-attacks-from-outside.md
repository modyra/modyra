# ADR 0042: An adversarial suite attacks from outside

Status: Accepted

## Context

Every suite in this repository asks the same shape of question: does the implementation satisfy the
contract it declares? Unit tests import a package's own source, conformance runs a renderer against
the widget contract, the contract audits compare a snapshot to itself. All of that is necessary, and
none of it can answer a different question — does the contract still hold for a consumer who does
something nobody wrote a test for?

The failures that reach users have that shape. A control claims a cell of a row that has not been
declared. A validator answers after its row was removed. A draft restores a numeric key and the
collection comes back as an array. A form is valid because the invalid cell was scrolled out of
view. Each is a combination of individually correct operations, and each survives a suite whose
tests were written by the same reasoning that wrote the code.

Two properties make such a suite possible at all, and both are lost if it lives inside `packages/`:
a test that imports a sibling source file can rely on a symbol no consumer can reach, and a test
written next to the implementation inherits its author's assumptions about what is worth trying.

## Decision

`battle-tests/` is an independent adversarial suite, outside `packages/`, which consumes Modyra only
through published entry points and exists to falsify public claims rather than to confirm them.

Four rules give it its character:

- **A battle cites a registered public claim.** `battle-tests/models/claims.mjs` is the registry;
  citing an unregistered id fails. A break is triaged by the promise it broke, not by the test name.
- **A battle proves it attacked.** The wrapper counts operations, structural changes, mount and
  unmount phases, observations compared and async runs started, and fails a battle that exercised
  nothing. A suite that can go green while doing nothing is worse than no suite.
- **A failure is a replayable artefact.** Every failure writes the seed, the schema as data, the
  operation log and both diverging states, with the command that replays them. One interpreter
  executes operations for hand-written battles, generated campaigns and replay alike.
- **A break is followed through.** It is preserved, minimised, promoted to a red regression, and then
  fixed — the point of the suite is a framework that is harder to break, not a longer list of known
  breaks.

The suite runs on `node:test` with plain `.mjs`, adding no dependency and no fourth test runner;
seeded generation and shrinking are implemented in its own harness rather than by adopting a
property-testing library.

## Consequences

Modyra now has a suite that is expected to go red on purpose. That is the intended failure mode, and
it changes how a red run is read: a battle failure is a finding about the framework until proven to
be a harness defect, which is the opposite of how the other suites are triaged.

The black-box rule costs convenience. Setting up a hostile state through public API only is more
work than reaching into the engine, and some claims — that destroy left no live subscription, for
instance — are observable from outside only indirectly. `harness/internal-probes/` exists for those
and is deliberately narrow: a probe may explain a break, never carry a public claim alone.

Building the harness rather than adopting fast-check means the shrinker, the generators and the seed
policy are this repository's to maintain. The trade is deliberate: no new runner, no new dependency
in a repository that publishes packages, and a report format shaped by what replay needs.

The suite consumes built output, so it needs the packages built before it runs — `npm run battle`
builds them. A stale build shows up as a break, which is why the environment block of every report
names what was consumed.

## Alternatives rejected

**Adding adversarial tests inside each package.** Cheapest, and it loses both properties that make
the suite worth having: source-level imports and shared assumptions. It also makes "no test may reach
past a package entry point" unenforceable, since the neighbouring unit tests must do exactly that.

**Vitest with fast-check, as the implementation specification sketched.** It would follow the
specification literally and bring a mature shrinker. It also adds a fourth test runner beside
`node:test`, jest and Playwright, and two dependencies to a repository whose independence audits
exist to keep that surface small. The specification permits `node:test`; the deviation is recorded in
`battle-tests/README.md`.

**Generating attacks without a claim registry.** Faster to write, and it produces failures nobody can
route: severity, ownership and the decision of whether a difference is a break at all all follow from
which promise was made, so the promise has to be written down first.

**Treating found breaks as findings to file.** Rejected because a backlog of known contradictions is
not evidence of a robust framework; the loop from break to red regression to fix is what turns an
attack into a guarantee.

## Verification

`npm run battle` runs the suite; `npm run battle:audit` runs the black-box rule alone.
`battle-tests/harness/harness.test.mjs` is the check that fails if this decision is violated:

- a deliberately failing battle must produce a JSON report whose replay reaches the recorded state;
- a battle that records no action must fail;
- the black-box audit must report zero violations over a non-empty corpus, and must catch a planted
  source-level import.

The last two are mutation-tested by construction — each runs a fixture that is designed to fail, and
the check is that the suite noticed.

## Security and privacy

The suite attacks the paths where untrusted data enters a form — record keys, dynamic contracts, flat
patches, restored drafts, server error paths — so `SEC-001` (unsafe segments never register fields or
pollute prototypes) is one of its registered claims and prototype pollution is classified S0.

Reports are written to disk and attached to CI runs, so what may go into them is constrained:
fixtures are synthetic, and a battle that attacked with real application data would produce artefacts
nobody could share. Nothing in the suite reads credentials, and the packed-consumer batch installs
from local tarballs rather than from a registry, so no publish credential is involved.

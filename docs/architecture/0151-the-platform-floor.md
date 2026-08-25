# ADR 0151: The floor is Baseline widely available, and everything below it is declared

Status: Accepted

## Context

This library does not say anywhere which browsers it works in. There is no `browserslist`, no CSS
lint, no target in any configuration, and no sentence in any document. It arrived at its present
shape one rule at a time: 85 uses of `:has()`, 144 of `color-mix()`, 34 of relative colour syntax,
container queries, `@layer`, the Popover API.

That is not a problem while every feature happens to be old enough, and it is undetectable when it
stops being one. The first rule that lands newer than the browsers somebody is actually using breaks
their page, and nothing in this repository would have said so — not at review, not in CI, not to the
consumer deciding whether they can use this.

The discipline already exists in places and is not required anywhere. Every `backdrop-filter` is
inside `@supports` with a solid colour declared outside it; the relative colour syntax likewise; the
Popover API is called behind a `typeof` check with the failure path written out. All correct, all
voluntary, and none of it checked. Three fallbacks were stated in comments and exercised by no test
at all.

## Decision

**The floor is Baseline widely available** — interoperable across Chrome, Edge, Firefox and Safari
for at least 30 months. A feature at or above that line needs no declaration.

**A feature below the floor is allowed, and only with a fallback that a check demonstrates.** It is
declared in `packages/widgets/contract-baseline/platform-floor.json` with:

- **what is lost** without it, in the terms of what a person can no longer do or see;
- **its role**: *load-bearing* — something a person cannot do at all without it, which needs the same
  capability reachable another way — or *enhancement*, which must degrade rather than break;
- **the proof.** For a style, that every use sits inside `@supports` with the fallback declared
  outside, read directly from the stylesheet. For a script, the file that exercises the missing-
  feature path, since a branch is a claim about behaviour and only a check can hold it.

`npm run test:platform-floor` fails the build on a breach, and runs in the contract gates.

**The allowlist is also the documentation.** What somebody under the floor loses is a question a
consumer asks and nothing else here answers; the file that permits the feature is the file that says
it.

## Consequences

- **A rule below the floor cannot land unnoticed.** It fails, with the guard or the proof named.
- **Three fallbacks are now exercised** rather than asserted in prose. Writing the first one found
  that nothing had ever run the popover-less path.
- **The floor moves with time and the file does not.** Baseline dates are recorded by hand, so an
  entry stays in the allowlist after its feature has crossed the line — it becomes stale permission
  rather than a false alarm, which is the safer of the two failures but still needs a periodic read.
- **The feature list is a set of patterns, not a parser.** A feature nobody added a pattern for is
  invisible, so this catches what it knows about. It is a floor with a growing list of doors, not a
  proof that every door is closed.
- **A style guarded by `@supports` costs a duplicated declaration** — the fallback outside, the
  enhancement inside — and that duplication is now mandatory rather than a matter of taste.
- **Turning a feature off is not using it.** `backdrop-filter: none` under reduced motion asks for
  the plain surface a browser without the feature already has; requiring a guard there would demand
  a fallback for a fallback.

## Alternatives rejected

**`browserslist` and a CSS linter.** The conventional answer, and it answers a different question: it
tells you a feature is unsupported, not what a person loses or whether anything catches them. It also
needs a dependency and a build step in a repository whose CSS is emitted by its own script.

**The `web-features` package as the source of Baseline data.** Strictly better than dates typed by
hand — it is the same data this file transcribes, kept current. Rejected *for now* only because
adding a dependency is a decision this repository takes deliberately and separately; the hand-written
dates are recorded above as a known cost, and this is the first thing to revisit.

**A floor of Baseline newly available.** Would permit the Popover API and `backdrop-filter` outright
and shrink the allowlist to nothing. Rejected because it makes the allowlist disappear along with the
question it exists to answer: *what does somebody under the floor lose?* A newly available feature is
exactly the one whose absence needs a written fallback.

**Report without failing.** The shape used for the renderer budget, and right there: a budget crossed
by every legitimate change is a record, not a limit. This is the opposite — a floor is crossed only
by a mistake, and a record nobody reads is indistinguishable from not having one.

## Verification

- `npm run test:platform-floor` (`scripts/audit-platform-floor.mjs --check`), in the contract gates.
- Five mutations, each caught: a new rule outside `@supports`; a `provenBy` file that does not exist;
  a proof that never mentions the feature; an entry that does not say what is lost; and an entry for
  a feature nothing uses.
- `packages/widgets/test/platform-fallbacks.spec.mjs` holds the popover fallback: a popup with no
  Popover API still opens, still closes, and still reports which of the two it just did — the answer
  a renderer reflects on every render. It also covers the platform refusing rather than being absent.

## Security and privacy

No trust boundary is touched and nothing is transmitted. One indirect effect is worth stating: the
floor names the oldest browsers this library expects to work in, and an old browser is an unpatched
one. Declaring the floor makes that population visible rather than creating it — the same people were
already running this code, with nobody able to say so.

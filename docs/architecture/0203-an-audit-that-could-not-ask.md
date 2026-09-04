# ADR 0203: An audit that could not ask is not an audit that found nothing

Status: Accepted

## Context

`pnpm audit --prod` ran as a bare step in two workflows. It exits non-zero when it finds a
vulnerability, and it exits non-zero when it cannot reach `registry.npmjs.org`. Those are different
facts leaving through the same door.

On `ba989cd6` the step failed with `ERR_SOCKET_TIMEOUT` after three retries. Main went red, and the
next person to read the verdict concluded the tree was broken and stopped pushing under the standing
rule that only a repair may push over a red main. The tree was fine. The cost was a person held for
ten minutes by a defect that did not exist, and the same shape would hold a release.

A gate that cannot say which of the two happened teaches its readers to discount it, which is worse
than the false red itself.

## Decision

The step reads `pnpm audit --prod --json`, where the two answers are already distinct: a failure to
ask returns `{ "error": { … } }`, a verdict returns an advisory report. `scripts/audit-production-dependencies.mjs`
decides from which one arrived.

**A verdict decides the exit code.** Advisories against production dependencies exit 1, wherever the
script runs. A clean answer exits 0.

**Where no verdict was obtained, the caller decides, and the asymmetry is the decision.** On every
push (`ci.yml`) the script announces and exits 0: no commit can repair a network, and blocking every
push on a third party's availability costs more than it protects. At the release boundary
(`release.yml`, `--required`) it exits 1: publishing without ever having asked is precisely what the
audit exists to prevent, and there the account reverses.

**Neither branch is silent.** A run that obtained no verdict prints, in these words:

    PRODUCTION AUDIT — NO VERDICT
      The registry could not be asked: <reason>
      Nothing is known about the dependencies from this run — neither that they are clean
      nor that they are not. This is a failure to obtain a finding, not a finding.

That paragraph is the report's contract. An absence must never be able to read as a pass, and the
exit code alone cannot carry that distinction — which is the whole defect being repaired.

## Consequences

A network failure on a push now announces instead of blocking. That is a real loosening and it is
paid for at the boundary: nothing reaches a registry without a verdict, because `--required` refuses.

The exit code stops being a summary of two unrelated questions. A reader who sees a red audit step
now knows it is about dependencies.

The residual risk is stated rather than argued away: if the registry is unreachable for an extended
period, pushes proceed unaudited. They proceed *announced*, and a release still cannot.

## Alternatives rejected

**Leave it as it was.** The false red is not rare — it is one lost packet — and its cost is measured:
a reader stops working. Worse, it trains readers to disbelieve the step, which spends the credibility
the gate needs for the day it has something real to say.

**`continue-on-error: true` on the step.** The repository already uses that for the form-scale
budgets, with its reason recorded. Here it is the wrong instrument: it discards the *verdict* too, so
a genuine advisory would also stop blocking. The distinction this record exists to draw is between a
transport error and a finding, and that option erases it in the other direction.

**Retry harder.** The step already retried three times over more than a minute. More retries move the
threshold and leave the conflation in place.

## Verification

Eight decisions, exercised deterministically: transport error, unreadable output, clean verdict and
advisories, each in both modes. The decision is separated from the fetch precisely so the branch that
only exists when the registry is unreachable can be taken without a network.

That separation came from a failure. The first probe forced the branch by setting
`npm_config_registry` to an unreachable address; pnpm never saw the override and the script printed
`PRODUCTION AUDIT CLEAN`. Stopping there would have recorded as proven the one branch never executed
— a check tested only where it cannot fail. **A probe that cannot be shown taking the branch it
claims to test has not tested it**, and that is why the verification here does not depend on the
network being down.

A live run against the real registry reports `CLEAN` over 82 production dependencies.

## Security and privacy

This weakens one gate in one direction and the weakening is deliberate and bounded. A push may now
proceed when the audit could not be obtained; a release may not. An advisory that *is* obtained
blocks exactly as before, in both workflows.

Nothing about the audit's content changes: the same query, to the same registry, over the same
production dependency set. No new data leaves the runner, and the report adds no information about
the repository beyond what `pnpm audit` already printed.

The failure mode this leaves open — a sustained registry outage during which pushes are unaudited —
is visible in every run's output rather than silent, which is the property that makes it acceptable
rather than the low probability.

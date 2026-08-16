# ADR 0083: A form reports what it could not do

Status: Accepted

## Context

A form degrades rather than failing. An async check a reactivity cannot run is skipped; a draft
without effects is not started; a control that claims a row before it exists waits. Each of those is
right, and each is invisible: measured side by side, a form whose uniqueness check never ran and a
form whose check passed are identical on every surface an application reads — `valid`, `canSubmit`,
`pending`, `errors`, and what `submitValue()` returns.

The vocabulary for saying so was already published. `MdyDiagnostics`, `createConsoleDiagnostics`,
`createSilentDiagnostics`, and the codes: `MDY_ASYNC_FEATURE_DISABLED`, `MDY_EFFECTS_UNAVAILABLE`,
`MDY_SCOPE_DESTROYED`, `MDY_UNSUPPORTED_ADAPTER_OPTION`, `MDY_SSR_SNAPSHOT_MISMATCH`. Nothing took
one. The only published option accepting an `MdyDiagnostics` belonged to one adapter's reactivity, so
a consumer reading that surface built a sink, named the codes they cared about, and waited for
something that could never arrive — and `createForm` told them, in development, that it had been
given an option it does not read.

This is the fifth time in this pass that the same shape has turned up: a property the contract
declares and nothing pronounces. `announce` on the overlay transition, `rejected` on the file
transition, the multiselect opener's role, the daterange opener's role, and now the diagnostics sink.

## Decision

**`createForm` takes `diagnostics`.** What the form could not do goes there as a code, a severity and
a message.

**The sink replaces the console rather than doubling it.** A consumer who supplied one asked for these
as events; printing them as well duplicates every degradation into a channel they did not ask for.
With no sink the console stays the fallback, under `devWarnings`.

**A degradation is reported whether or not this is a development build.** A check that is not running
is not a development-time nicety. `devWarnings` remains what it always was — the console channel —
and a sink is a different question from a build flag.

**`setInitialValue` accepts an ancestor path**, moving every leaf beneath it to its current value.
A collection's keys are data: a row a user added has a path nobody could have written down, so an API
that names only leaves can never move the baseline of what a user built. This is the same question
[ADR 0081](0081-a-secret-is-excluded-by-the-name-a-person-writes.md) answered for `exclude`, and the
same answer.

**`rebaselineToCurrentValue()` is on the form.** It was published on the engine and announced in a
release note; the engine behind a form is not the consumer's to reach, so the capability existed and
the surface did not.

## Consequences

**A form with a sink prints nothing to the console about degradations.** A consumer who supplies a
sink and expects the console output as well loses it — deliberately, and it is the reason to have
supplied one.

**Two more optional members on published option types**, classified minor. A consumer who implements
`MdyFormEngineOptions` structurally is unaffected.

**`setInitialValue` on an ancestor is a loop over the fields beneath it.** For a large collection that
is proportional to what is under the path, which is what the caller asked to move.

**The sink is not yet routed everywhere.** This decision wires the engine's own channel; the codes
emitted from the adapters' reactivity still travel their own way. That is stated as a gap with a name
rather than left as an implication.

## Alternatives rejected

**Keep it to the console and document the codes.** The codes were already documented. A console line
is not something an application can route, filter or alert on, which is the whole reason the sink
vocabulary exists.

**Report to the sink *and* the console.** Noise, and the kind that gets switched off along with the
useful part.

**Make the sink a global.** A form is the unit a consumer builds and disposes; a process-wide sink
cannot say which form degraded, and two forms in one page would share whatever the last one set.

## Verification

- `packages/core/test/diagnostics.test.mjs` — a skipped check reports `MDY_ASYNC_FEATURE_DISABLED`
  with `devWarnings: false`, so it is not the console channel answering; and with `devWarnings: true`
  the console stays quiet, so the sink replaces it.
- `battle-tests/adversarial/reactivity/a-check-nobody-runs.battle.test.mjs` and
  `a-sink-with-nowhere-to-stand.battle.test.mjs` — the attacks that found both halves.
- `battle-tests/adversarial/persistence/a-baseline-only-the-engine-can-move.battle.test.mjs` — the
  surface a consumer holds.

## Security and privacy

A diagnostic carries a code, a severity and a message naming a field path — never a field's value.
A consumer routing diagnostics to a remote logger sends the shape of a form, not what was typed into
it. That is worth stating because the sink is exactly the kind of thing that gets pointed at telemetry.

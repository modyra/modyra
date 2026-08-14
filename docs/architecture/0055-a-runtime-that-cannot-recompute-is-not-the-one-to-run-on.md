# ADR 0055: A runtime that cannot recompute is not the one to run on

Status: Accepted

## Context

Node resolves `solid-js` to `dist/server.cjs` unless the `browser` export condition is set. That is
not an exotic configuration: it is what a **server render** uses.

On that build `createMemo` computes once and never again, and `createEffect` never runs. Every
derived value in a form therefore freezes at the state it was created in:

```js
createForm({ name: field("", [required()]) }, { reactivity: solidReactivity() });

form.state.valid();      // true
form.state.canSubmit();  // true
form.errorsFor("name")() // []
form.f.name.set("x");
form.state.valid();      // still true — nothing recomputes
```

The dangerous direction is the one it fails in. A server consulting the form to decide whether to
accept a submission is told **yes** about a form that is not valid, and nothing raises. The adapter
meanwhile reported `capabilities.effects: true`, which its own suite tests as "capabilities never
claim a fictitious guarantee".

Found from the side: a differential drove three adapter factories through one sequence and Solid
disagreed with Vue and Svelte about a required field. It was classified as an artefact of the export
condition the battle tier runs without — correctly, for the *suite*. The same condition is the
production SSR path.

## Decision

**`solidReactivity()` probes the graph it resolved and, when computations do not re-run, returns the
framework-agnostic graph wearing Solid's name.** One signal and one memo, **once per process**: the
question is whether a computation re-runs, and asking it directly answers for any build, bundler or
version, where matching a filename would answer for one. Which build was resolved is fixed when the
module loads, so a consumer building many forms does not pay for the answer many times.

A server render reads each value once and emits markup. Vanilla does that correctly and the inert
build cannot do it at all, so the fallback renders a form that tells the truth. The client build has
a live graph, never reaches the fallback, and hydration runs on Solid's own signals exactly as
before.

The runtime keeps `kind: "solid"`, so handle ownership and the cross-runtime observation guard see
the identity the consumer chose.

It is reported once per process, naming the cause and the consequence. Silence would make a
substituted runtime the kind of thing someone discovers while debugging something else.

## Consequences

A Solid server render now produces correct validity, errors and `canSubmit`. It previously produced
markup that was right about values and wrong about verdicts.

Modyra's signals are not Solid's during that render, so a Solid SSR component cannot track them —
which costs nothing, because nothing re-renders on a server: values are read once as the markup is
emitted.

`@modyra/solid`'s own hook tests do not pass under the server resolution, and cannot: they assert
that reads are tracked by Solid's primitives, which is the guarantee that build does not offer. The
adapter's suite runs under `--conditions=browser`, which is the environment those hooks are for.

A future Solid build whose server graph does recompute would take the live path automatically, since
the probe asks about behaviour rather than about a file.

## Alternatives rejected

**Throw.** Honest, and it takes server rendering away from every Solid consumer to fix a verdict most
of them do not consult on the server. Refusing renders nothing where falling back renders something
true.

**Report `effects: false` and change nothing else.** The engine would stop wiring async validators,
drafts and history, and the form would still be frozen and still claim to be valid. It fixes the
claim about the capability and not the answer the form gives.

**Match the filename or read `process.env`.** Answers for today's Solid and today's bundler. The
probe answers for the graph in front of it.

**Leave it and document it.** The failure is silent, the wrong answer is the safe-sounding one, and
the guide would be warning about something the library could detect.

## Verification

- `packages/solid/test/solid.test.mjs` — under `--conditions=browser` the live graph is used and all
  32 assertions hold, which is the check that the fallback does not fire where it must not.
- Measured directly on the server resolution: a required field reports `valid: false`,
  `canSubmit: false` and its error, before and after a write.

## Security and privacy

`canSubmit: true` for an invalid form, on a server, is the shape a submission guard has. Nothing here
changes what a server *should* do — client-side validity is defence-in-depth
([ADR 0009](0009-client-validation-is-defence-in-depth.md)) and a server must re-validate — but a
library that answers that question at all must not answer it wrongly in the permissive direction.

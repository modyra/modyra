---
"@modyra/solid": minor
---

A Solid server render no longer reports an invalid form as valid

Node resolves `solid-js` to its **server build** unless the `browser` export condition is set — which
is what a server render uses. On that build `createMemo` computes once and never again and
`createEffect` never runs, so every derived value in a form freezes at the state it was created in:

```js
createForm({ name: field("", [required()]) }, { reactivity: solidReactivity() });

form.state.valid();       // true
form.state.canSubmit();   // true  ← for a form with an empty required field
form.f.name.set("x");
form.state.valid();       // still true — nothing recomputes
```

It failed in the permissive direction, silently: a server consulting the form to decide whether to
accept a submission was told yes. The adapter meanwhile reported `capabilities.effects: true`.

`solidReactivity()` now probes the graph it resolved — one signal, one memo, once per process, since
which build was resolved is fixed when the module loads — and when
computations do not re-run it returns the framework-agnostic graph carrying `kind: "solid"`, warning
once with the cause. A server render reads each value once and emits markup, which that graph does
correctly and the inert build cannot do at all.

**The client build is untouched**: it has a live graph, never reaches the fallback, and hydration
runs on Solid's own signals exactly as before. The probe asks about behaviour rather than matching a
filename, so a future Solid build whose server graph recomputes takes the live path automatically.

Found while checking a differential's Solid disagreement that had been classified as an artefact of
the test runner's export condition. It is an artefact there and the production SSR path here.
Recorded as [ADR 0055](https://github.com/modyra/modyra/blob/main/docs/architecture/0055-a-runtime-that-cannot-recompute-is-not-the-one-to-run-on.md).

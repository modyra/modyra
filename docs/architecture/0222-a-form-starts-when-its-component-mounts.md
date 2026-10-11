# ADR 0222: A form a component owns starts when the component mounts

Status: Accepted

## Context

A form's effect-dependent features — draft persistence, history recording, per-field async
validators — start at construction unless the form is built with `autoActivate: false`. Construction
happens in a component's setup, and setup also runs during a server render. React and Preact's
`useMdyForm` already build inactive and activate in a mount effect. Vue's `useVueForm` and Solid's
`useSolidForm` did not: a server render started storage reads, timers and validator requests on the
server. A Vue server render never stops the component's scope, so the form was not destroyed there
either. `docs/guides/typed-forms.md` stated that Vue, Solid and Svelte never need `autoActivate`,
which was false for a server render.

Svelte's adapter has no lifecycle-bound form: only `createSvelteForm`, a factory with no component to
follow.

## Decision

- `useVueForm` called in a component's setup builds the form with `autoActivate: false`, activates
  it on `onMounted` and deactivates it on `onBeforeUnmount`. Called outside a component it builds an
  active form. In both cases an active effect scope destroys it on dispose.
- `useSolidForm` called inside an owner builds the form with `autoActivate: false`, activates it on
  `onMount` and destroys it on owner cleanup. With no owner it builds an active form.
- The factories `createVueForm`, `createSolidForm` and `createSvelteForm` keep the core default:
  active at construction. Their caller owns the lifecycle.
- Svelte gains no hook. Its documentation shows the lifecycle a component owns:
  `createSvelteForm(schema, { autoActivate: false })` and `onMount` calling `activate()` and
  returning `deactivate()`.

## Consequences

- On the client, a hook-built form starts one mount later than before: a draft restores, and async
  validators first run, after the first render rather than during setup. Code that read `hasDraft`
  or a pending async verdict synchronously in setup sees the inactive state.
- A Svelte page rendered on the server with the factory still starts the form there unless its author
  follows the documented pattern. The guarantee covers the hooks, not the factories.
- The Solid package's test script runs one file twice, under the browser and the server condition,
  because the two builds differ exactly on whether a mount happens.

## Alternatives rejected

- **A `useSvelteForm` hook.** Closes the Svelte gap by construction, but adds an export every Svelte
  consumer must learn and 1.0 must keep, for a pattern three lines long.
- **Factories detect the server (`typeof window`, or `esm-env`).** No new export, but a heuristic
  that is wrong on edge runtimes and under a DOM shim, a hydration mismatch risk, and `esm-env` would
  be a new runtime dependency.
- **Factories inactive by default.** Breaks every existing caller, including every example, which
  would have to call `activate()`.

## Verification

- `packages/vue/test/a-form-rendered-on-the-server-stays-still.test.mjs`: a form built in a
  `renderToString` setup stays deactivated; a mounted one activates and deactivates on unmount; one
  built outside a component is active.
- `packages/solid/test/a-form-rendered-on-the-server-stays-still.test.mjs`, run under both Solid
  builds by the package's `test` script: inside an owner the form is inactive at construction and
  active after mount only on the client build; with no owner it is active.
- Nothing checks the Svelte documentation pattern.

## Security and privacy

A form with drafts reads and writes storage, and an async validator sends field values over the
network. Before this decision a server render could do both on the server, with whatever storage
and credentials the server process holds, for a request whose page never reached a browser. The
hooks no longer do. A factory called during a server render still can.

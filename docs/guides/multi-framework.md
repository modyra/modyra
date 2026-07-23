# Multi-framework architecture

What is framework-agnostic today, what is deliberately Angular, and the
concrete recipe each adapter follows.

## The split as it stands

**`@modyra/core` — zero dependencies, runs in plain Node:**

- Form engine: fields, sync/async/cross-field validation, submit + server
  errors, drafts, undo/redo, `mutate()` (coalesced history entries),
  `getChanges()` (`MdyFormEngine`).
- Typed layer: `createForm()`, `field()`, `group()`, `array()`, handle tree.
- Validators (`required`, `min`, …, `crossField`).
- The reactive contract (`MdyReactivity`: `signal`/`computed`/`effect`/
  `untracked`, plus optional `capabilities`/`createScope`/
  `MdyReactiveScope`, typed errors and structured diagnostics — see
  [Writing a reactivity adapter](reactivity-adapter-guide.md)) plus
  `vanillaReactivity()`, the reference implementation (real `batch()`/
  `flush()`/`observe()` too).
- `@modyra/core/testing` — `runReactivityContractTests`, the conformance
  suite every adapter below is checked against.
- Headless widget logic: calendar math and localized date parsing
  (`date-utils`), time parsing/formatting and clock geometry
  (`time-utils`), overlay positioning geometry (`overlay-position`),
  option filtering (`options-utils`), value serialization (`serialize`),
  dynamic-form config domain + runtime validation (`dynamic-config`,
  Contract v1 and v2 — see [AI-generated forms](ai-generated-forms.md)),
  i18n message catalogs en/it/de/fr/es (`i18n`).

**`@modyra/widgets` — headless widget controllers, framework-free:**

Field/boolean/option field controllers and a select controller (listbox
navigation, active descendant, search-to-select) — state machines that
used to live only inside the Angular components, now shared by every
adapter that binds `@modyra/widgets` (React, Vue, Solid, Preact, Svelte
all do; see [headless recipes](headless-recipes.md) for shadcn/Radix/
Kobalte prop-mappers over them).

**`@modyra/angular` — the Angular adapter (this repo's `packages/angular`):**

- `angularReactivity()` — binds the contract to native Angular signals;
  hardened (real `capabilities`, typed error instead of a silent no-op
  effect without an `Injector`, `onError` respected) — see the reactivity
  adapter guide.
- Thin typed wrappers (`MdyDeclarativeAdapter`, `mdyForm()`).
- DI plumbing: tokens (`MDY_I18N_MESSAGES`, `MDY_DATE_LOCALE`, …),
  `provideModyraLocale()`.
- **The renderer catalog, wizard, devtools, dynamic-form component and all
  directives.** These are intentionally Angular: templates, content
  projection, signal inputs, host bindings. A renderer is Layer 3 — it is
  *supposed* to be framework-native.
- **Datepicker and timepicker interaction state machines** (grid focus
  movement, segment editing) — still Angular-only; see "not extracted
  yet" below.

So: yes, the renderer catalog is Angular-centric — by design. Field-level
interaction logic (select, boolean, text) is not: it moved to
`@modyra/widgets` once the other adapters needed it too.

## What each adapter implements

An adapter provides two things:

1. **A reactivity binding** (or uses `vanillaReactivity()`): the
   `MdyReactivity` contract, nothing framework-shaped about its shape —
   real implementations exist for Angular, Vue and Solid signals today.
2. **Bindings/hooks** that connect DOM inputs to field handles
   (`value()`, `set()`, `markAsTouched()`, `errors()`), reusing
   `@modyra/widgets`' headless controllers for composite widgets
   (select, checkbox/switch) instead of reimplementing their state
   machines per framework.

### React (`@modyra/react` — shipped)

No native signals: the engine runs on `vanillaReactivity()` and
components subscribe through `useSyncExternalStore`. `createFieldStore()`
resolves the reactivity that actually created a field handle via
`getFieldHandleOwner()` instead of building an unrelated one — building a
fresh `vanillaReactivity()` just to observe someone else's signals is the
cross-runtime bug [the reactivity adapter guide](reactivity-adapter-guide.md#5-cross-runtime-observation-is-a-bug-not-a-shortcut)
warns against (found and fixed in this package during the
reactivity-adapter-api plan):

```ts
// packages/react/src/index.ts, simplified
export function createFieldStore(handle: MdyFieldHandle<unknown>) {
  return createStore(
    [handle.value, handle.errors, handle.touched, handle.dirty, handle.valid, handle.pending, handle.disabled],
    getFieldHandleOwner(handle), // the handle's REAL owner, not a fresh instance
  );
}
```

`useMdyForm(schema, options)` constructs with `autoActivate: false` and
activates/deactivates from its own `useEffect` — safe under React Strict
Mode's dev-only double-invoke and during SSR (see
[Typed forms](typed-forms.md#construction-vs-activation-ssr-strict-mode)).
Headless field/select controllers come from `@modyra/widgets`.

### Preact (`@modyra/preact` — shipped)

A thin variant of the React adapter: same `vanillaReactivity()` +
`getFieldHandleOwner()` + `autoActivate: false` pattern, `useSyncExternalStore`
via `preact/compat` (no `getServerSnapshot` third argument — Preact's
signature differs from React's here, the one real API gap between them).

### Vue (`@modyra/vue` — shipped)

Vue's reactivity maps 1:1 onto the contract — the binding wraps
`shallowRef`/`computed`/`watchEffect`:

```ts
export function vueReactivity(): MdyReactivity {
  return {
    canEffect: true,
    signal: (v) => { const r = shallowRef(v); const s = () => r.value;
      s.set = (x) => (r.value = x); /* update/asReadonly analogous */ return s; },
    computed: (fn) => { const c = computed(fn); return () => c.value; },
    effect: (fn) => { const runner = vueEffect(() => fn(...));
      return { destroy: () => stop(runner) }; },
    untracked: (fn) => { pauseTracking(); try { return fn(); } finally { resetTracking(); } },
  };
}
```

Components use `createVueForm(schema)` (or `useVueForm` inside an active
effect scope, for automatic disposal) and bind with `v-model`-style
wrappers over the handles. Headless field/select controllers come from
`@modyra/widgets`. Not yet migrated to declare real `capabilities`/
`createScope` (tracked as a reactivity-plan follow-up).

### Solid (`@modyra/solid` — shipped)

Solid's primitives map almost 1:1: `createSignal` → signal, `createMemo`
→ computed, `untrack` → untracked. The one gap is a manually-destroyable
effect handle — the engine calls `effect(...).destroy()` imperatively
outside any component (async validators/drafts/history), so each
`effect()` wraps `createEffect` in its own `createRoot`. Testing/SSR note:
solid-js's plain Node import condition resolves to a non-reactive SSR
stub, so any Node consumer (`node --test`, ts-node, a server-rendered
handler) needs `--conditions=browser` or every signal silently goes
inert. Headless field/select controllers come from `@modyra/widgets`.

### Svelte (`@modyra/svelte` — shipped)

Svelte 5 runes (`$state`/`$derived`) are compiler macros meant to be
transformed by the *consumer's* bundler, not something a library's own
build step can resolve — confirmed by trying: the compiled output still
contained literal `$state(...)` calls. So this adapter runs the engine on
`vanillaReactivity()`, same shape as React, and `toStore()` bridges it to
a real Svelte `Readable` store (`svelte/store`'s `writable`/`derived`/`get`
run as plain, uncompiled JavaScript — no compiler needed). One caveat:
`toStore()`-backed state is microtask-batched, unlike Svelte's own
synchronous `writable()` — await a tick after a write before asserting.
`examples/svelte` compiles through `esbuild-svelte` — the same "keep the
example pipeline on esbuild" call as Solid's `esbuild-plugin-solid`, no
separate Vite toolchain needed.

### Lit (`@modyra/lit` — shipped)

Run on `vanillaReactivity()`; a `ReactiveController` subscribes an element
to the handles it renders:

```ts
class FieldController implements ReactiveController {
  hostConnected() { this.ref = rx.effect(() => { this.handle.errors(); this.host.requestUpdate(); }); }
  hostDisconnected() { this.ref.destroy(); }
}
```

Because Lit ships web components, this adapter is also the path to using
Modyra controls *inside any framework* — including Angular-free pages.
Ships its own themable custom elements (`<mdy-*-field>`), not just a
headless binding.

### Astro (recipe, not a new binding)

Astro has no client reactivity of its own: the engine already works
server-side (no DOM, storage inert), so `createForm()` can render initial
markup in `.astro` frontmatter; interactive islands then use whichever
adapter matches the island's framework (React/Vue/Lit/Preact/Solid/Svelte
above).

## What is NOT extracted yet (honest list)

- **Datepicker and timepicker interaction state machines** (grid focus
  movement, segment editing) still live inside the Angular components —
  unlike select/boolean/text, which moved to `@modyra/widgets`. Same
  "the math is already in core" situation `@modyra/core/keyboard`/
  `date-utils`/`time-utils` describe; the remaining work is the
  stateful navigation logic itself.
- **Overlay orchestration**: positioning *geometry* is core; the
  listener/lifecycle management is per-framework by nature.
- **A11y announcer, devtools UI, Angular's renderer catalog**:
  framework-native forever, by design (Layer 3).
- **Reactivity contract migration**: Vue, Solid, Preact, Svelte and Lit
  don't declare real `capabilities`/`createScope` yet (only vanilla and
  Angular do) — see the
  [generated capability matrix](../reactivity-capability-matrix.md).

## Package policy

`@modyra/vue`, `@modyra/react`, `@modyra/solid`, `@modyra/preact`,
`@modyra/svelte` and `@modyra/lit` are shipped, tested engine bindings
(published on npm at `0.3.0`, a `0.4.0` reactivity-plan bump pending) —
reactivity adapter + typed form factory (+ hooks/controller/composable),
plus headless field/select controllers via `@modyra/widgets`. They do not
ship a themed UI component library the way `@modyra/angular`'s renderer
catalog does (Lit ships its own custom elements, which is closer to a UI
kit than the others); see [headless recipes](headless-recipes.md) for
pairing them with shadcn/Radix/Kobalte/your own design system.

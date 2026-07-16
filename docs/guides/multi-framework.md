# Multi-framework architecture

What is framework-agnostic today, what is deliberately Angular, and the
concrete recipe for each future adapter (React, Vue, Lit, Astro).

## The split as it stands

**`@modyra/core` — zero dependencies, runs in plain Node:**

- Form engine: fields, sync/async/cross-field validation, submit + server
  errors, drafts, undo/redo, `getChanges()` (`MdyFormEngine`).
- Typed layer: `createForm()`, `field()`, `group()`, handle tree.
- Validators (`required`, `min`, …, `crossField`).
- The reactive contract (`MdyReactivity`: `signal`/`computed`/`effect`/
  `untracked`) plus `vanillaReactivity()`.
- Headless widget logic: calendar math and localized date parsing
  (`date-utils`), time parsing/formatting and clock geometry
  (`time-utils`), overlay positioning geometry (`overlay-position`),
  option filtering (`options-utils`), value serialization (`serialize`),
  dynamic-form config domain + runtime validation (`dynamic-config`),
  i18n message catalogs en/it/de/fr/es (`i18n`).

**`@modyra/angular` — the Angular adapter (this repo's `projects/modyra`):**

- `angularReactivity()` — binds the contract to native Angular signals.
- Thin typed wrappers (`MdyDeclarativeAdapter`, `mdyForm()`).
- DI plumbing: tokens (`MDY_I18N_MESSAGES`, `MDY_DATE_LOCALE`, …),
  `provideModyraLocale()`.
- **The renderer catalog, wizard, devtools, dynamic-form component and all
  directives.** These are intentionally Angular: templates, content
  projection, signal inputs, host bindings. A renderer is Layer 3 — it is
  *supposed* to be framework-native.

So: yes, the controls are Angular-centric — by design. What was wrong (and
is now fixed) is that ~1.5k lines of pure logic (dates, time, overlay
geometry, i18n data, dynamic config) lived in the Angular package; they are
now core modules the Angular files simply re-export.

## What each adapter implements

An adapter provides two things:

1. **A reactivity binding** (or uses `vanillaReactivity()`): four
   primitives, nothing Angular-shaped about them — they map to Solid,
   Preact Signals, Vue and the TC39 Signals proposal.
2. **Bindings/components** that connect DOM inputs to field handles
   (`value()`, `set()`, `markAsTouched()`, `errors()`), reusing the core's
   headless logic for the composite widgets.

### React (`@modyra/react` — available, early)

No native signals: run the engine on `vanillaReactivity()` and subscribe
components through `useSyncExternalStore`:

```ts
// sketch — the adapter's whole bridging surface
export function useField<T>(handle: MdyFieldHandle<T>) {
  const subscribe = (notify: () => void) => {
    const rx = vanillaReactivity();
    const ref = rx.effect(() => { handle.value(); handle.errors(); notify(); });
    return () => ref.destroy();
  };
  const value = useSyncExternalStore(subscribe, () => handle.value());
  return { value, set: handle.set, errors: handle.errors, ... };
}
```

`useForm(schema, options)` memoizes `createForm()`; field components are
plain controlled inputs over `useField`.

### Vue (`@modyra/vue` — available, early)

Vue's reactivity maps 1:1 — the binding wraps `.value` access:

```ts
export function vueReactivity(): MdyReactivity {
  return {
    canEffect: true,
    signal: (v) => { const r = ref(v); const s = () => r.value;
      s.set = (x) => (r.value = x); /* update/asReadonly analogous */ return s; },
    computed: (fn) => { const c = computed(fn); return () => c.value; },
    effect: (fn) => { const stop = watchEffect((onCleanup) => fn(onCleanup));
      return { destroy: stop }; },
    untracked: (fn) => { /* pause tracking */ return fn(); },
  };
}
```

Components use `createForm(schema, { reactivity: vueReactivity() })` and
bind with `v-model`-style wrappers over the handles.

### Lit (`@modyra/lit` — available, early)

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

### Astro (`@modyra/astro` — future / documentation)

Astro has no client reactivity of its own: the engine already works
server-side (no DOM, storage inert), so `createForm()` can render initial
markup in `.astro` frontmatter; interactive islands then use whichever
adapter matches the island's framework (React/Vue/Lit above). Astro support
is therefore mostly a recipe + an `astro` example, not a new binding.

## What is NOT extracted yet (honest list)

- **Widget state machines**: the keyboard/focus logic of select
  (listbox navigation, active descendant), datepicker (grid focus
  movement) and timepicker (segment editing) still lives inside the
  Angular components. Full "headless UI" extraction (à la Zag/TanStack)
  means porting those interaction state machines to core with
  DOM-attribute outputs. Planned as exploratory work — the math they rely
  on is already in core.
- **Overlay orchestration**: positioning *geometry* is core; the
  listener/lifecycle management is per-framework by nature.
- **A11y announcer, devtools UI, renderers**: framework-native forever.

## Package policy

`@modyra/vue`, `@modyra/react` and `@modyra/lit` exist as **engine
bindings** (0.1.0, implemented and tested): reactivity adapter + typed form
factory (+ hooks/controller). They do not ship UI components yet — the
renderer catalog remains Angular-only until the widget state machines are
extracted (listbox and calendar keyboard navigation already live in
`@modyra/core/keyboard`). `@modyra/astro` stays a recipe: core in SSR,
bindings inside islands.

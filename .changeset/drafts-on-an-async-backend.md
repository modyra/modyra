---
"@modyra/core": minor
---

`@modyra/core/async-draft-storage` — drafts on a Promise-based store.

`MdyDraftStorage` is synchronous by design: a field writes a draft while the user types, and there
is nothing useful to hand a caller that cannot wait. React Native's standard storage is
Promise-based, so the two never met. The React Native guide documented the workaround — hydrate a
`Map`, read and write it synchronously, flush in the background — and said it was "not built, not
tested here". This is that adapter, built and tested; the guide now links to it.

```ts
const storage = createHydratedDraftStorage({ backend: AsyncStorage, keys: ["checkout-draft"] });
await storage.ready;
```

No new dependency: the backend is an argument, so anything with `getItem`/`setItem`/`removeItem`
returning promises works — AsyncStorage, an IndexedDB wrapper, or a test double.

Two semantics the shape does not make obvious, both chosen deliberately and both covered by a test
that fails when they are reversed:

- **A read before hydration finishes returns `null`** — "no draft", never a stale or partial one. A
  synchronous read cannot block, and restoring the wrong draft is worse than restoring none. `ready`
  exists so a caller can wait before restoring, and a write that lands during hydration wins over
  what the store held: the user is allowed to be faster than the disk.
- **A failed flush is never thrown into the form and never loses the draft.** The value stays in the
  cache, so the user keeps typing and the next write retries it. `onError` reports it; without one
  the failure is silent, which is the bargain the default `localStorage` storage already makes with
  quota errors.

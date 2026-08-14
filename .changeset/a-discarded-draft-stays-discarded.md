---
"@modyra/core": patch
---

A draft discarded while the store is still reading stays discarded

`createHydratedDraftStorage` answers reads from a cache it fills in the background. A write landing
during hydration was already protected — it is newer than what the store held — and a removal was
not:

```js
const store = createHydratedDraftStorage({ backend, keys: ["draft"] });
store.remove("draft");
store.read("draft");        // null
await store.ready;
store.read("draft");        // "older, from the backend" — it came back
```

An absent cache entry meant two different things during hydration: never set, and thrown away by the
user. The guard read both as the first. In an app that restores a draft on startup — what
`docs/guides/react-native.md` documents this store for — a user who presses discard before startup
finishes finds the draft again.

The store now tracks the keys removed while hydration is in flight and drops the arriving value for
them. A write clears that state: a write is newer than the removal that preceded it.

Found by `battle-tests/adversarial/persistence/hydrating-store.battle.test.mjs`.

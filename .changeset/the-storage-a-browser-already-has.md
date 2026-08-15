---
"@modyra/core": minor
---

The storage a browser already has is taken as it is

The draft guide says the default storage is `localStorage`. A consumer reading that and then naming it
— for a different key prefix, a session instead of a local, a wrapper that counts writes — passes
`window.localStorage`, which is the object the sentence names. `MdyDraftStorage` is
`{read, write, remove}` and Web Storage is `{getItem, setItem, removeItem}`; nothing published
converted between them, and the mismatch was not refused. The first read threw
`this._storage.read is not a function`: a private field, from a stack inside the engine, about an
argument the caller had passed.

`draft.storage` now takes either shape. A Web Storage is adapted at the boundary, with its methods
bound to the object they came from. Anything that is neither is refused where it is passed, naming
what was expected.

`MdyWebStorageLike` is published for the second shape, and `MdyDraftOptions.storage` widens to
`MdyDraftStorage | MdyWebStorageLike`.

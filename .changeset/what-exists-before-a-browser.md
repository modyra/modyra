---
"@modyra/widgets": minor
---

The runtime report probes the environment, and the anatomy says what a server can emit.

`browserRuntimeCapabilities()` hardcoded `dom: true` and `hydrated: true`. Called in a Node process
with no `document`, no `window` and no `HTMLElement`, it reported a browser. A controller consults
the report precisely to decide whether a command can be executed — the module's own header gives
"focus commands during SSR" as the example — so the one function that answers *where am I* could
not tell a server from a browser. `ssrRuntimeCapabilities` was exported and consumed by nothing, so
no test could have caught it.

It now probes every dimension, and with no DOM returns `ssrRuntimeCapabilities` exactly. `hydrated`
is the one dimension no global can answer — a browser that has parsed server markup but not yet
attached to it is indistinguishable from one that has — so it follows `dom` and a renderer that
knows it is still hydrating passes `browserRuntimeCapabilities({ hydrated: false })`.

New: `staticParts(kind)`, `dynamicParts(kind)` and `isFullyServerRenderable(kind)`. A widget's
anatomy divides into the closed control, which is markup a server can emit and which every kind
has, and the overlay — the popup and everything under it. The split is **derived** from the popup
subtree rather than restated as a second table, because a hand-maintained copy would drift the
moment a kind gained a part, and it would drift silently.

This is a statement about anatomy, not a rendering strategy: a renderer that mounts its popup
eagerly emits the dynamic parts while closed, one that mounts lazily emits them on open, and both
are conformant. The split is what makes that choice expressible.

Proved by a suite that runs in a process with no DOM, and which asserts the absence of one first —
every other suite in the package runs beside one that installs jsdom, and a DOM leaking in would
make every assertion pass without meaning anything.

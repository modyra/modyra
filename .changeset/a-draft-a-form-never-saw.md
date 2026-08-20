---
"@modyra/core": patch
---

A hydrating draft storage does not let a form overwrite the draft it never saw

`createHydratedDraftStorage` answers a read before hydration with `null` — "no draft", never a stale
one — and that is documented. What was not is the other half: a form built without awaiting `ready`
restored nothing, the person typed, the debounce fired, and the write went through the cache to the
backend **over the draft that was still in flight**. Their earlier work was gone from the only place
it was kept, and they were never shown it.

A write for a key that has not hydrated is now kept in the cache and not flushed: the live form sees
what is being typed, the stored draft survives, and the key writes through as normal once its value
has arrived. A `remove` still goes through — it is a decision about the key itself — and leaves
nothing for a later write to overwrite, so that write is not held back either.

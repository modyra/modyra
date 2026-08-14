---
"@modyra/widgets": minor
---

Three widget runtimes answer about the moment they run in, not the one they were built in

**Focus lands on the element the host rendered.** `createCommandRuntime` defers focus and scroll until
after the host has rendered — because the render is what may replace the element — and then acted on
a node it had resolved *before* the render:

```
close-overlay + restore-focus  →  the trigger is resolved
the host renders, replacing it →  the resolved node leaves the document
the microtask drains           →  focus() on a detached node
```

A detached `focus()` is a silent no-op: no error, no warning, and the only symptom is a keyboard user
quietly returned to the body. The deferred work now carries the **target** and resolves it again
after the render. A target that no longer resolves is left alone, so a trigger that was removed
outright still leaves focus on something the document contains.

`MdyWidgetCommandContext.scheduleFocus`/`scheduleScroll` receive the target as a second argument. A
caller that acts immediately can keep ignoring it.

**A drag asks for the document when a gesture needs one.** `createPointerDrag` resolved it once at
construction, so a controller built before a document existed stayed bound to nothing for its whole
life — `bind()` returned immediately every time while `start()` still set `dragging`. A slider in
that window never drags *and reports that it is dragging*. The window is the one
`browserRuntimeCapabilities` probes on every call rather than once at module scope, and
`options.document` widens it: a host in an iframe or a popup is exactly where the document arrives
after the controller is made.

**Typeahead and search compare text that reads the same.** `É` has two encodings — one code point, or
`E` plus a combining acute — that render identically, and the two sides arrive from different places:
labels from a CMS, an API or a file listing (macOS decomposes), keyboard input composed. So typing
the accent visible on screen emptied the list. Both comparisons normalize to NFC.

Deliberately **not** accent folding: `e` stays a different letter from `é`, so `resume` and `résumé`
remain different options. Two spellings of the same character are the same character; that is all
this claims.

Found by `battle-tests/adversarial/accessibility/deferred-focus.battle.test.mjs`,
`.../interaction/pointer-drag.battle.test.mjs` and `.../localization/typeahead-normalization.battle.test.mjs`.

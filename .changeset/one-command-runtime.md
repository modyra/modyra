---
"@modyra/widgets": minor
"@modyra/react": patch
"@modyra/preact": patch
"@modyra/vue": patch
"@modyra/svelte": patch
"@modyra/solid": patch
"@modyra/lit": patch
"@modyra/angular": patch
"@modyra/plain": patch
---

Executing widget commands, written once

Eight adapters had the same command executor: collect focus and scroll into a queue, run everything
else now, drain the queue after the host has rendered. What differed was the id of a live region and
one call — `queueMicrotask`, `requestAnimationFrame`, `afterNextRender`, `host.updateComplete.then`.

`createCommandRuntime({ announcerId, defer })` in `@modyra/widgets` is that function. Each adapter
passes its own beat and writes nothing else, which is also where the difference becomes visible: the
framework-free renderer's `defer` runs immediately, because it writes to the document itself and has
nothing to wait for.

Two more shapes every binding was writing itself:

- `subscribeController(controller, reactivity, notify)` — watch a controller and hand back the
  teardown for it and the subscription. Six of the eight hooks in the two hook-based adapters watched
  `state` alone and were right by coincidence: every controller's view is currently a function of its
  state, and the contract does not promise it.
- `fieldCommandHandlers(handle)` — what a control with no overlay gives a command executor. `setOpen`
  is a no-op rather than absent, because one vocabulary means answering the question rather than
  crashing on it.

`MdyAngularCommandHandlers` and `MdyLitCommandHandlers` are aliases of `MdyWidgetCommandHandlers`
instead of member-by-member copies, which is what the other five adapters always did.

A guard moved upstream with the code: the framework-free renderer checked for `scrollIntoView` before
calling it, because the DOM implementation every adapter's suite runs under does not have it. That
check now protects all of them.

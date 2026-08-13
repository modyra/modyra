---
"@modyra/widgets": minor
"@modyra/plain": patch
---

A teardown releases what it was observing, and the check can see when it does not

`renderField` hands back a teardown and nothing asserted it. Only the whole-form entry point was
covered by the lifecycle suite, so the entry point a host uses when it composes its own layout — one
field at a time — had its most important obligation unchecked. It is now asserted for all seventeen
kinds.

`inspectUnmount` gained the case it could not see. It compared the document before and after a poke,
and swallowed every throw as "the handle refused, and refusing is correct". That is true of a handle
and false of an effect: an effect still subscribed after teardown does run, reads a form that is
gone, and raises — leaving nothing in the document, so the check read the leak as a clean teardown.
`MdyUnmountObservation.errorsAfterDispose` supplies what the runtime reported, and
`MDY_LIFECYCLE_ISSUE.effectThrewAfterUnmount` names it.

`renderField` also documents which runtime it observes on. The default builds a fresh one, which is
right for a field rendered alone and wrong for a field belonging to a form: two runtimes over one
handle are two schedulers with no ordering between them, and only one of them stops when the form
does. Pass `form.reactivity`.

---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A tap outside dismisses on Safari.

The light-dismiss gesture completed on `click`, deliberately — a drag ending elsewhere produces no
click, which is the gesture a touch user makes to scroll the page behind an open popup, so the
browser's own judgement of an activation filtered it out.

One engine does not supply that judgement. WebKit synthesises no mouse events and no `click` for a
tap on an element it does not consider clickable, and a page's own background is not one:

| engine | events delivered for a tap on `<h1>` |
| --- | --- |
| Chromium | `pointerdown` `touchstart` `pointerup` `touchend` `mousedown` `mouseup` `click` |
| WebKit | `pointerdown` `touchstart` `pointerup` `touchend` — and nothing else |

So on Safari, desktop and iOS, the pair never completed and an open popup stayed open. Nothing in a
Chromium-only suite could see it.

`MdyLightDismiss` gains `pointerup(target, pointerId?)`, which completes the interaction under the
same origin and pointer-identity rules. `click` stays and normally does nothing — the release has
already left the machine idle — but catches an interaction whose release never arrived. The scroll
gesture is still protected, by `pointercancel`: a browser that takes a gesture over to scroll says so
directly, and the absence of a click was standing in for that signal.

**One behaviour changes beyond the fix**, and it is a correction: pressing outside and releasing
*inside* the popup no longer dismisses. It used to, because the click landed on a common ancestor
outside the branch — but the interaction ended inside, which ADR 0013's own rule says must not
dismiss.

**Migration:** a renderer that wires the policy itself must add a capture-phase `pointerup` listener
beside its `click` one. The three rendering adapters do this already.

[ADR 0013](https://github.com/modyra/modyra/blob/main/docs/architecture/0013-the-dismissal-names-its-gesture.md)
is amended in place, with the original reasoning kept — the risk it named is real, and what it got
wrong is which signal guards against it.

**Classification.** `contract:diff` reports `patch`: the catalogue is untouched and the differ sees
nothing else. This ships as `minor` for the added method — the same blind spot recorded as finding K.

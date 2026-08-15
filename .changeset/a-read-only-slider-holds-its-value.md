---
"@modyra/lit": patch
---

A read-only slider holds its value

Read-only is not disabled: the field is submitted, validated and reachable, and the one thing it does
not do is change. `<input type="range">` ignores the native `readonly` attribute, so a renderer that
relies on it refuses nothing — `@modyra/plain` routes the slider through the scalar controller, which
declines the write; `@modyra/lit` wrote `handle.set(...)` straight from the event, so a read-only
slider moved on a click and on an arrow key.

It now asks `blocksValueChange(handle.interactivity())` and puts the thumb back where the value still
is. A rail that slides and then reports the old number shows one thing and holds another.

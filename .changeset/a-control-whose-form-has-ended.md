---
"@modyra/core": patch
---

A control whose form has ended is out of play

A framework destroys a model and removes its nodes at two different moments. In the window between
them the controls are live: they take text, the browser paints it, and the write is refused — the
form keeps the value it ended with and will never submit the other one. Nothing on the page said so.

`destroy()` now takes every field out of play, and a handle handed out before the end answers
`interactivity: "disabled"` instead of falling back to `"enabled"` when its record is gone. Renderers
already read that verdict, so the controls grey out wherever they are drawn.

Migration: a consumer reading `disabled()` or `interactivity()` from a handle after `destroy()` gets
`true` / `"disabled"` where it used to get `false` / `"enabled"`. Values, `getValue()` and
`submitValue()` are unchanged — they still answer with what the form held when it ended.

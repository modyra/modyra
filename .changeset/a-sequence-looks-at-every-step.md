---
"@modyra/studio-editor": patch
---

A sequence command looks at every step, and an advisory one no longer hides an invalid one

`createSequenceCommand.validate` threads the project through each step — the careful half — and
returned at the first step that produced **anything**, whatever its severity. `CommandHistory` rejects
on an *error*, so the two together meant:

```
one invalid step               →  CommandRejectedError
advisory first, invalid last   →  applied, all three steps
```

Latent today, because every diagnostic in `commands.ts` goes through one helper that hardcodes
`severity: "error"` — which is exactly why it is worth being right about now. The day a warning is
added, sequences stop being validated, and nothing about that change looks like it touches sequences.

Every step's findings are collected now. An **error** still stops the walk, because a step that must
not apply cannot be threaded through to give the next one a project to look at; an advisory is
collected and the walk goes on.

Found by `battle-tests/adversarial/studio/`.

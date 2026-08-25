---
"@modyra/widgets": minor
---

The scale's step names are recorded as public surface.

A consumer builds a theme by setting `--mdy-control-1` or `--mdy-space-4`. Renaming one breaks them
exactly as renaming a widget part does, and until now nothing could see it: the tokens were in no
snapshot at all.

`contract:diff` reads the step names from the sheet — not from a list somebody has to remember to
update — and reports a step that stops answering as **major**, a new one as **minor**.

**Names, not values.** Changing what a step *is* is what a theme is for, so recording values would
report every theme as a contract change.

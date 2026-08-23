---
"@modyra/widgets": patch
---

The UI contract gates report every failure, not the first one.

`test:contracts` was twenty-six checks joined by `&&`. A chain reports the thing that broke and says
nothing about the rest, so a pipeline red in five places looked exactly like one red in one, and each
repair revealed the next wall instead of the remaining distance.

`scripts/run-contract-gates.mjs` runs the same commands in the same order, with the same exit code, and
does not stop. The first run of it found five failures where the chain had been reporting one.

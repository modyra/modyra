---
"@modyra/styles": patch
---

A number field's steppers are pressed where they are drawn

In a field shorter than two stepper targets (48px of `--mdy-input-height`, such as the 36px field of
a compact theme), the stacked Increase and Decrease buttons overlapped, and a press on the centre of
Increase landed on Decrease. Below that height the two steppers now stand side by side at their full
24px, both centred, Decrease before Increase at the trailing edge. Fields of 48px or more still stack
them as before.

**Migration.** In those short fields the input keeps a 48px trailing margin so the value never runs
under the pair; a number field sized to its content is 48px wider than before. No change for fields
48px or taller. The threshold is read from `--mdy-input-height`, not from the rendered box: a field
made shorter without lowering that token still stacks its steppers.

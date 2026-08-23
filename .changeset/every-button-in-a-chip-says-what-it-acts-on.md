---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Every button inside a chip names the value it would act on, not only the one that removes it.

Read from the accessibility tree — the first time anything here has been — a two-chip strip offered:

```
listitem "Alfa, 2"   button "One fewer"   button "One more"   button "Remove Alfa"
listitem "Beta"      button "One fewer"   button "One more"   button "Remove Beta"
```

Four controls that sound like two, in the same chip that already knew how to say it. And **the unnamed
pair is the one that destroys**: stepping down from one takes the value off, so the control that can
delete was the control that did not say what it would delete. The movers had it too.

**Migration.** `chipRemoveName` is `chipActionName`, same signature and same rule — the verb and the
object — because it was never only about removal. A caller composing a chip button's name should use it
for all of them.

Now, in all three renderers: `Move earlier Alfa`, `One fewer Alfa`, `One more Alfa`, `Move later Alfa`,
`Remove Alfa`.

Angular's `removeName` goes with it: one method names every button in the chip, which is the same
consolidation one function up.

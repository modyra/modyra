---
"@modyra/widgets": minor
"@modyra/angular": minor
"@modyra/lit": patch
"@modyra/plain": patch
---

A picker a keyboard can finish

All three renderers now do the same thing from open to commit, without a pointer:

```
open → focus on the hour box → type → Tab → type → Tab → Tab → Enter → 14:30
```

**Angular had never executed a widget command.** `dispatch(...)` was called and its return discarded
at every call site, so `focus`, `open-overlay` and `restore-focus` had no route to the DOM at all —
not wired wrongly, not wired. It goes through the `MdyWidgetRuntime` the select adapter already used,
with the same `afterNextRender` beat. Its local `scheduleMinuteSwitch` and the two different delays
are gone; the controller owns the handover.

**Angular focused the dial face on open.** The face is a slider a keyboard can operate and it is not
where a person types, so the two controls that accept typing were never reached — which is why Tab
walked out of the popup without entering it. It focuses the box the contract names.

**`action` named two buttons.** Cancel and confirm carry one part between them, so a tab order that
named the part reached whichever was drawn first — cancel. Tab to the end of the dialog, press Enter,
and the draft was discarded instead of committed. The order names both, told apart by the `confirm`
state the catalogue already declares.

**Lit rewrote the box on every keystroke.** With `.value` bound to the draft, each input triggered a
render that wrote the canonical form back over what had just been typed: backspacing an hour from `09`
produced `12`, and `14` could not be typed at all. It reports what was typed and leaves the box alone
until the person leaves it — the same rule plain took, from the same contract.

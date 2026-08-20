# ADR 0115: An hour carries the half of the day it is in

Status: Accepted

## Context

Reported from use: *on Angular there is no way to set a time before 13:00, as if pinned to PM.* It is
not an Angular defect. Measured on a 24-hour picker seeded from `"21:00"`, asked for 9:

    set-hour 9   -> draft {hour: 9, period: "PM"}   committed "21:00"
    set-hour 14  -> refused, silently, draft unchanged
    set-hour 0   -> refused, silently, draft unchanged

And symmetric, so it is not "stuck on PM" — it is stuck wherever it opened:

    24h seeded "09:00"   ask 3   -> 03:00      (wanted 15:00, no way to say so)
    24h seeded "21:00"   ask 9   -> 21:00      (wanted 09:00, no way to say so)
    12h control          9 + AM  -> 09:35      works: the period is reachable

The working copy is canonically 12-hour, and `period` is the only route to the afternoon. A 24-hour
picker correctly has no period control — a 24-hour clock does not have one — so it had no route at
all. `set-hour` refused everything outside 1–12 and refused it by returning no commands, which is why
this survived the life of the feature: nothing failed and nothing was reported.

**Every other surface of a 24-hour picker already speaks 0–23.** The face draws `00` and 13–23 on an
inner ring; `timeFieldBounds` answers `{min: 0, max: 23}`; `acceptTimeField` accepts `"13"`;
`stepTimeField` wraps 23 to 0; the End key asks for 23. One seam took 1–12, and it was the seam that
writes. So the typed segment was broken too, not only the dial — which matters, because the picker
now opens on the segments.

The design said so, in `timepicker-dial.ts`: *"Hours are held 1–12 in the draft whatever the format; a
24-hour face names 0–23, and the host converts at the boundary."* It published no function to convert
with and no intent carrying the hour and the period together. Three renderers were each asked to
reinvent that conversion. **None of them did.**

## Decision

**An hour is sent in the picker's own format, and carries the half of the day with it.** `set-hour`
takes 1–12 for a `12h` picker and 0–23 for a `24h` one; the controller derives `period`. Midnight is
`0` and noon is `12`, which is what the face's own labels say.

**`set-from-angle` carries the ring.** `ring?: "outer" | "inner"`, optional and defaulting to outer,
because on a two-ring face the same direction is 3 outside and 15 inside. The arithmetic is
`dialHour(angle, ring)` in `@modyra/core/datetime`, beside `angleToHour`, where the rest of the dial's
arithmetic lives. Which ring a pointer landed on is `timepickerDialRing`, in widgets beside
`timepickerDialNumbers`, because a renderer that works out which ring it drew is a renderer that can
disagree with its own drawing.

**A refused intent says so.** An hour or minute this clock does not have answers with an `announce`
command instead of nothing — the same sentence ADR 0078 makes about a read-only field.

**The popup opens on the number fields.** `viewMode` defaults to `"input"` and is a controller
option; opening returns to whatever the host configured rather than to a hard-coded view. The dial
stays one toggle away.

Anatomy does not move, so `MDY_WIDGET_CONTRACT_VERSION` does not either.

## Consequences

`set-hour 3` on a **24-hour** picker now means three in the morning, where before it meant "the third
hour of whichever half the draft was already in". That is the defect being removed, and it is also a
behaviour change for any caller that was relying on the inheritance — there was no way to reach the
afternoon, so what such a caller was relying on is that the picker could not do what it was for.
Nothing changes for a 12-hour picker: 1–12 with `set-period` is what it always was.

A host that opened onto the dial now opens onto the segments unless it says otherwise. The value
`"dial"` is one option away and the toggle is unchanged.

`dialHour` and `timepickerDialRing` are two more published names to keep. The alternative was one
fewer — publish `hourToDraftParts(hour24)` and keep the delegation — and it is rejected below.

## Alternatives rejected

**Keep the delegation and publish the missing helper.** Faithful to the written design and one small
addition. Rejected on evidence: three hosts had to remember to call it, and all three had already
failed to do the equivalent for the life of the feature. A contract that is only implementable by
remembering an undocumented step is not a design, it is a defect generator — and the renderer knows
only what its own face shows, which is exactly what it now sends.

**Make the renderer convert and keep `set-hour` at 1–12.** The same objection, restated: it puts the
one piece of arithmetic that must agree everywhere in the three places most likely to disagree.

**Give a 24-hour picker a period control.** A 24-hour clock does not have one, and adding it would
make the picker disagree with the thing it is drawn as.

## Verification

- `battle-tests/adversarial/widgets/a-face-with-hours-nothing-can-choose.battle.test.mjs` — sweeps
  `timepickerDialNumbers` rather than a list someone typed, asking for each hour from a picker seeded
  on the *other* side of noon so an hour that only appears to work by inheriting the draft's half is
  caught. Two controls: the face really is the two-ring one, and a 12-hour picker still commits
  `09:00` for "9 + AM".
- `packages/widgets/test/timepicker-field-controller.spec.mjs` — the 24-hour hours, the refusal that
  is announced, the configured view mode, and the two rings naming two hours from one direction.

## Security and privacy

None. No boundary moves and no value leaves the process differently; the defect was that a person
could not enter half the times their own clock offered.

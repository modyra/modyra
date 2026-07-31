---
"@modyra/styles": minor
---

The floating label belongs to the foundation, not to Material

`mdyFloatingLabels` did nothing under Modern, iOS and Ionic. The host took `.mdy-floating-label`,
the renderer set `.mdy-label--filled` at the right moments, and no stylesheet answered any of it:
measured across all four states, the label stayed `position: static`, `transform: none`, sitting
21–26px above the field exactly as it does with the feature off. An opt-in that silently does
nothing is worse than one that is absent, because nothing says so.

The manoeuvre moves to `modyra.css` — where the label rests, where it rises to, the padding the
control gives up so the risen label has somewhere to land, and the placeholder suppression that
stops a resting label from sitting on a second line of text. None of the numbers move with it.
Every one is a custom property a theme owns:

| property | what it decides | default |
| --- | --- | --- |
| `--mdy-fl-height` | the field's height while floating | `3.5rem`, tracking density |
| `--mdy-fl-rest-y` / `--mdy-fl-rest-scale` | where the label sits at rest | centred, unscaled |
| `--mdy-fl-active-y` / `--mdy-fl-active-scale` | where it goes when active | `0.5rem`, `0.75` |
| `--mdy-fl-label-left` | its inline offset | `1rem` |
| `--mdy-fl-label-height` / `--mdy-fl-gap-mid` | the room a risen label needs | `0.75rem` / `0.125rem` |

**Material's geometry does not move.** The defaults are its numbers, so it declares none of them and
measures identical before and after: resting `translateY(18px) scale(1)`, active `translateY(8px)
scale(0.75)`. What is left in `material-filled-field.css` is its face — the label's size, colour and
weight — and its prefix composition.

Modern and iOS declare their own. Modern's field is 36px and a label cannot rise inside 36px, so a
floating Modern field grows to 52px rather than Material's 56px, with a floor at 44px: unclamped,
density −3 drove it to 36px and put the risen label on top of the value. Its label lines up with the
control's own 10px inset. iOS lines up with its 14px inset and shrinks to 0.8 rather than 0.75,
because iOS reduces a risen label less far. Ionic declares nothing — its 56px field and 16px inset
are what the defaults already describe.

Verified in the built demo, five stylesheets × four states, plus the resting position that the demo
itself cannot reach: every text field it ships is required and pre-filled, so emptying one makes it
invalid and raises the label anyway. That gap is why this went unnoticed, and it is worth closing
with a fixture that can actually rest.

# ADR 0179: Where the keyboard stands when a list opens

Status: Accepted

## Context

A multiselect opens its panel and three renderers put the keyboard in three places. plain lands DOM
focus on an option; lit and Angular leave it on the trigger with `aria-activedescendant` empty. The
symptom a sweep sees is a key: the toggle is declared on the option part and answered at the trigger,
because at the trigger there is nothing else it could act on.

Underneath the divergence is a rule the contract does not state. The controller clears its cursor
whenever the panel opens, for a good reason — *a cursor belongs to one showing of the list, and
carried over, the next opening starts where the last one was left, which is a position this person
never chose*. But clearing it and **not putting it anywhere** leaves the panel open with nothing
singled out, and every renderer then invents where the keyboard should be.

That state is worse than it looks. With nothing singled out, the first arrow press does nothing
visible except pick a starting point — a gesture spent on the control's bookkeeping, and one a
screen-reader user cannot tell apart from "the arrow did not work". And the key that means *choose
this one* has no target, so it either does nothing or acts on something the person was never shown
as current.

## Decision

**Focus goes where the next input will arrive, and how the panel was opened says what kind of input
that is.**

```
opened by keyboard, no filter box     focus → the list, standing on a choice
opened by keyboard, with filter box   focus → the filter box, the choice singled out below it
opened by pointer                     focus stays on the opener; nothing singled out
Escape                                closes and returns focus to the opener, however it opened
```

**The cursor is primed on opening, not left empty**: on the first value already chosen, and on the
first option in the list when nothing is chosen. Somebody opening a field that already holds values
is most likely there to change one of them, and landing on the first chosen puts the rest one arrow
away; landing at the top of the list when the chosen values are fortieth makes them walk there.

**A filter box is the one place focus stays out of the list.** It is where the typing happens, and
moving focus into the list would take the keyboard off the filter on every arrow press. The choice
being pointed at is named by `aria-activedescendant` on the box — which is the whole purpose of that
attribute, and the reason it must sit on the element that holds focus rather than on the trigger.

**A pointer open does not move focus.** Somebody who clicked the opener is about to click a choice.
Moving the keyboard into the list scrolls the focused option into view — which can move the list out
from under their pointer — and draws a focus ring on an option they never touched.

This is one rule reading the modality, not two behaviours for one control. It does mean the intent
that opens the panel has to say how it was raised; a controller cannot infer it, and inferring it
from an event's coordinates is a guess.

## Consequences

`open` and `toggleOpen` gain the modality as an optional field. Optional so that a host that does
not say keeps exactly the behaviour it has today, which makes the change additive rather than a
migration for every caller — but a renderer that never says gets the pointer answer, and a
keyboard-only user gets nothing better than before. Silence is a default, not a neutral position.

The cursor now has a value at a moment when it previously had none, so anything reading `activeKey`
as "the person has navigated" reads it as true one step earlier. `mdy-chip--active` paints on
opening, which is a visible change in all three renderers and moves screenshot baselines.

"The first value already chosen" requires the chosen values and the visible options to be compared
on every open. Under a filter that hides every chosen value there is no such option, and the rule
falls back to the first visible one rather than pointing at something not on screen.

## Alternatives rejected

**Leave the cursor empty and let the first arrow prime it.** This is what the controller does today.
It is defensible on a control that is only ever driven by arrows, and it fails the moment somebody
presses the choose key first — which is exactly what the sweep found two renderers answering from
the trigger.

**Prime the cursor on the first option always, ignoring what is chosen.** Simpler, one rule, no
comparison — and it is the wrong first step for the case that motivates opening the panel at all.

**Move focus into the list regardless of how the panel opened.** One behaviour, no modality on the
intent, no new field on the contract. Rejected because it is actively worse for a pointer user: the
scroll-into-view can move the list under the pointer mid-gesture.

**Infer the modality from the event that opened the panel.** A `PointerEvent` with zero coordinates
is what a keyboard-activated button produces in some browsers and not others, so the inference is a
guess that fails silently on the platform nobody tested. The host knows what it handled; it says so.

## Verification

The contract check is that opening with the keyboard leaves the cursor on a choice, and that the
choice is the first already chosen where one exists — asserted on the controller, where the rule
lives, so a renderer cannot satisfy it by moving focus without the cursor following.

The renderer check is the one that catches the original symptom: with the panel open by keyboard and
no filter box, DOM focus is inside the option list; with a filter box, focus is in the box and
`aria-activedescendant` on that box names an element that exists. A reference naming a missing id and
a reference sitting on an element nobody is standing on are both failures, and the second is what
this decision is about — so the check reads the attribute from the focused element, never from the
trigger.

What stays unguarded: the pointer half. Asserting that focus did *not* move needs a real pointer
gesture, and a synthetic click that focuses the opener first cannot tell "focus stayed" from "focus
was put back".

## Security and privacy

None. The decision moves a focus ring and an ARIA reference; no data crosses a boundary and nothing
is persisted.

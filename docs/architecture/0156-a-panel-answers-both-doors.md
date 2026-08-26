# ADR 0156: A panel answers both doors

Status: Accepted

## Context

A multiselect's list can be opened two ways: with a key on the opener, or with a press on the field.
Measured on the same list in the same state, one renderer answered only the door it came in by:

```
opened with the keyboard   focus on the opener   arrow moves   Escape closes
opened with the pointer    focus on nothing      arrow does nothing   Escape does NOT close
```

A press leaves focus where the pointer left it, and where it left it is the field's box, which is not
focusable — so focus was nowhere. A panel with nothing focused answers no key.

**The way a person opened a panel is not a statement about which hand they will use next.** Reaching
for the mouse to open a list and then for the keyboard to move through it is one task, and it is very
often the same person in the same minute. That person is left holding something they opened and
cannot close, drawn over the field it covers, with nothing focused to say where they are.

It survived because each door was consistent with itself. A check that opens a list one way and then
exercises it finds a correct control; the divergence exists only across the two.

## Decision

**Opening a panel places the reading position, whichever door it was opened by.** The opener takes
focus before the panel opens, on a pointer route exactly as on a keyboard route.

**Where the reading position lands is not decided here.** The opener, the first option and the strip
are all defensible, and a renderer may choose differently from its siblings. What no renderer may do
is place it on one route and not the other.

This does not extend to closing. A panel dismissed because a person pressed something else leaves
focus where they pressed — that press is a statement about where they want to be, and taking focus
back from it would overrule them. Opening carries no such statement: the press said *open this*, and
said nothing about where to stand afterwards.

## Consequences

A pointer press now moves focus, which it did not before. On a page where the person was typing
somewhere else and pressed the field with the other hand, the caret leaves that other control — which
is what opening a list with a press has always meant, and is what the keyboard route already did.

Anything that opens a panel inherits this, including a second affordance beside a field. A door that
opens a panel and leaves the reading position behind is the defect this record names.

## Alternatives rejected

**Leave focus where the pointer left it, and let the panel answer keys from the document.** A panel
listening at the document answers keys nobody aimed at it, including while another control has focus.
The reason a focused element answers keys is that it says who the key was for.

**Move focus into the panel instead of onto the opener.** Defensible, and it is what a modal would
do. It also changes what the keyboard route does today in every renderer, for a defect that is about
one route disagreeing with the other rather than about where either lands — a wider change than the
finding supports, and one this record deliberately leaves open to a renderer that wants it.

**Fix the renderer that diverged and assert the fixed behaviour.** That is the check writing down one
renderer's answer as the contract. What is owed is agreement between the doors, and a check that
names a landing place fails a renderer that chose a different, equally correct one.

## Verification

`e2e/shared/two-ways-in-one-answer.spec.ts`, in every renderer. It opens each way and asks the same
key to dismiss, and asserts **agreement rather than a landing place**.

The keyboard route is asserted first and is the control: if dismissal were broken both ways the two
routes would agree perfectly, and agreement measured on a control that never worked says nothing.
Falsified in both directions — removing the focus call turns the second assertion red in the diverging
renderer and in no other, and blocking the dismissal entirely turns the *first* one red instead, which
is the control reporting that the file could no longer tell the two failures apart.

## Security and privacy

None. Where focus stands changes nothing about what is stored, sent or shown.

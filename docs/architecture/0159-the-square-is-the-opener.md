# ADR 0159: The filled square is what opens the panel

Status: Accepted

## Context

A colours field draws a small square filled with the colour currently held, a box for typing the
value in hex digits, and a caret at the end of the field. Pressing the caret opens a panel of ready
colours. Pressing the square did something different in each renderer: two opened that same panel,
one opened the platform's own colour chooser.

An application that changes renderer therefore changed what the most recognisable element on the
field does, from a document that says nothing on the matter. The square is the shape every operating
system ships and everybody has pressed in every drawing program they have used; a contract that
leaves its meaning to the renderer leaves the field's central question unanswered.

The second pressure is the caret. It and the square opened the same panel, which is one act with two
commands: two accessible names, two stops in the keyboard walk, and two things for a screen reader
to describe where there is one thing to do.

An accessibility and interaction specialist that reads nothing in this repository was consulted in
ordinary words. It had earlier held that a filled square beside a field *is* the platform's colour
control, and withdrew that premise itself: it had assumed such a square opens the system's colour
wheel, which it does not do uniformly on any platform. Its conclusion is that the square opens the
panel everywhere, on the condition that the panel always leads on to every colour.

## Decision

**The filled square is the opener.** In every renderer, pressing it opens the field's panel, and the
panel carries a route to any colour at all.

**The caret is a drawing.** It is out of the keyboard walk and out of the tree assistive technology
reads — both, never one. It still answers a press, because the area sits inside the field.

The contract declares this: `MDY_POPUP_OPENERS.colors.opener` is `nativePicker`, and the relation
naming the panel moves with it.

## Consequences

- **A published relationship moved.** `toggle[aria-controls] → popup` is gone and
  `nativePicker[aria-controls] → popup` replaces it. `contract:diff` classifies this **major**. A
  consumer that located the opener by the caret's part name finds nothing; the opener is now asked
  of the catalogue, which is where a renderer should have been asking all along.
- **One name where there were two.** The caret's accessible name disappears with the caret's role.
  Nothing is taken from anybody: whoever pressed it pressed it to open the panel, and the square
  beside it — larger, and the more recognisable of the two — opens the panel.
- **The caret must not become a dead patch.** Removing its role while leaving its geometry would
  produce an area inside a live control that answers nothing, which reads to a user as "sometimes it
  does not work" and is the hardest kind of report to act on. It keeps its click handler for that
  reason and for no other.
- **Half of one browser check now fails in every renderer rather than in two.** That check asserts
  that pressing the square reaches the hidden native input — the mechanism this decision replaces.
  Its own text records that this half was waiting on a product decision and is to be rewritten in
  that decision's terms once taken. Three renderers failing it identically is agreement, where two
  failing it was divergence.

## Alternatives rejected

**The square opens the platform's chooser everywhere.** The shape's history argues for it, and it
was this record's starting position. It lost to a fact: the native colour control does not open the
system's wheel uniformly on any platform, so "what the shape has always meant" describes an
expectation that no platform actually honours. Building on it would have fixed the divergence by
picking the behaviour that is least predictable.

**Leave the caret a command and let the square open the platform's chooser.** This keeps both routes
and is what one renderer already did. It loses because the two commands then differ in a way no
document declares: a person pressing the square gets a system window in one renderer and a panel in
another, and the field has two openers with one name between them.

**Remove the caret from the keyboard walk only.** Rejected as the worse of the three states. The
keyboard walk and the tree assistive technology reads are different traversals: hiding it from one
leaves it in the other, so it disappears for someone navigating by keyboard and remains for someone
reading with a screen reader. Hidden from those who see it, present for those who do not, which
inverts the intent.

## Verification

`npm run contract:diff` classifies the moved relationship and refuses a silent change of opener.

`battle-tests/browser/one-square-three-answers.spec.ts` asserts that a document describing a colours
field gets one answer about the square rather than one per renderer, and that one accessible name
does not sit on two different acts. Both were red before this decision and are green after.

What is **not** guarded: nothing fails if the caret becomes a dead patch. Its click handler carries a
comment and no check, because the property — an area inside a control answers a press — has no
current expression in this suite. Recorded here as unguarded rather than left to be discovered.

## Security and privacy

None. The decision moves which element carries an opener relationship and which is exposed to
assistive technology. No trust boundary, no data at rest or in transit, and nothing an attacker
gains: every element involved was already rendered and already reachable.

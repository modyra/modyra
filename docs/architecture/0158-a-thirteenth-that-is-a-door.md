# ADR 0158: A thirteenth that is a door

Status: Accepted — the fork below was closed by the user in favour of two elements.

## Context

A colour field takes any colour. Typing `#4361ee` into its text box puts that colour in the model, so
the field's value space is **every colour there is**. Pointing at it opens a panel of **twelve**.

That is not an incomplete panel. It is two routes into one field that do not arrive at the same place,
and the difference is invisible from either one: a person who points has no way to learn that typing
would have taken them further, and a person who types has no way to see where their colour sits among
the ones offered.

The outside view, asked in ordinary words and told nothing of this repository, called it **incoherent
rather than incomplete**, and said that if one route had to lose it should be the presets — a single
entry point, a panel, and *Custom…* at the end.

**The decision below is the user's, and it refuses that trade.** Neither route loses, because what was
missing was never a choice between them: it was the link.

## Decision

**The panel gains a thirteenth square that is not a colour but a door.** Pressing it opens the
platform's own colour chooser, where every tint exists.

**A hex typed into the text box tints that square.** The colour chosen by hand is shown in the panel,
in the place the panel keeps for colours that are not presets — so the typed route and the pointed
route stop being two worlds and become two ways to reach one square.

The twelve presets stay exactly as they are.

## What the outside view answered, and the one place it diverges

Asked in ordinary words, told nothing of this repository. Its answer keeps the decision above and
**changes its shape**, on a ground worth recording in full:

> *A square that is a door when empty and a colour when full is a control that does different things
> depending on how it is set. Press it once full: either the chooser opens again — then it is not a
> colour, and somebody who wants to re-pick that tint after trying a preset has no way — or it selects
> the tint, and the door is gone. There is no third possibility, and no better name fixes it.*

**So the door and the remembered colour are two elements, not one:**

- a **button** that is always and only a door, named *Custom…* — the ellipsis being the convention for
  *this opens something else rather than performing an action*. It never carries the selected mark, it
  never carries a tint, it never changes behaviour. **It sits after the grid, not inside it**: a set
  has a total and a position within that total, and a button inside it says "thirteen of thirteen"
  when there are twelve colours, puts a thing of another kind into the arrow walk, and in several
  role vocabularies is simply not allowed;
- the hand-picked colour becomes a **real thirteenth swatch inside the grid**, of exactly the same
  kind as the twelve: selectable, re-selectable, and carrying the selected mark when it is current.

Separating them dissolves three of the five questions. What remains, answered:

**Where the door sits** — after the grid, and the tension feared here does not exist once it is
outside the set. Someone who does not want it never meets it with the arrows, because the arrows turn
inside the grid; someone who does reaches it with one Tab, because the grid is a single stop. It is
also the convention: *More…*, *Custom…* live at the end of every menu that has them.

**The tint stays.** Disappearing would punish exactly the behaviour a colour chooser exists for — try,
look, change your mind — and the feared "two lit colours" is not a problem once one carries the
selected mark and the other is merely present, as eleven of twelve already are.

**One mark, one meaning: this is the current value.** The door never carries it, because it is not a
value.

### The divergence, and how it closed

The decision as first taken said *a bonus colour which, pressed, opens the chooser*. The answer above
said the thing that opens the chooser **must not be the colour**. Both served the same intent and
differed only in whether that is one element or two.

**Closed by the user in favour of two.** The panel holds a grid of twelve, a thirteenth swatch of the
same kind when a colour has been picked by hand, and — after the grid, outside it — a button that is
always and only a door.

### The same shape, one level up, found while building it

The affordance beside the field today is a `<label>` wrapping the preview swatch and the hidden native
input. So it is **both** the display of the current colour **and** a door to the platform's chooser —
the identical defect this record was written to remove from the thirteenth square, sitting in the part
that was already shipping.

**Not changed here.** Splitting it removes a way to open the chooser from a closed field, which is a
second decision and not this one; recorded so that the next reader meets it as a known shape rather
than discovering it as a surprise.

## Consequences

**The anatomy already holds it.** `colors` declares `nativePicker` as an affordance and `control` as a
hidden native input; the platform chooser is not new. What changes is where it is reachable from, and
that a square in the panel shows its result.

**A preset gains a name, and that is a separate obligation this makes unavoidable.** `presets` carries
strings, so a listener hears `#4361ee` — six characters of hexadecimal read out as a colour. That is a
defect on its own today, independent of this record, and it becomes louder beside a square whose whole
job is to be described rather than shown.

**Two routes to one state is a thing that has to be checked as one.** Typing a hex and choosing the
same colour from the chooser must leave the field indistinguishable. A check that exercises one route
finds a working control, which is how four separate defects survived in this library until the two
routes were put in a single run.

**Three windows onto one value.** The bridge creates a third: the field, the hex box, and the custom
swatch all show the same colour. They must agree in every direction — in particular **choosing one of
the twelve must update the hex box**. Left empty or left on the previous value, the screen carries two
truths at once, and the person who trusts the wrong one is the person who types.

### Why no names ship for the defaults, checked rather than argued

The record above says an approximated colour name claims a meaning it does not have. That is a
principle; here is the measurement that makes it a decision.

**An approximated name passes every check this project has.** "Blue" has an accessible name, has
contrast, is in the computed tree, is translated. Nothing in the suite distinguishes a right name from
a plausible one — the only thing that does is somebody who knows that this blue is the invoices blue.
A palette that guessed would be **green everywhere and wrong**, which is the worst category this
repository has: not a defect the instruments miss, a defect they actively report as health.

So the names come from the document, where that knowledge is, and an entry without one is announced by
its value.

**The custom colour is the one value in the panel that cannot be described to somebody who cannot see
it.** Nobody has named `#4361EE`. Its name will be *Custom, #4361EE* — honest and poor. Approximating
a colour name is worse than the hexadecimal, because a swatch announcing itself as "blue" while being
nearly violet claims a meaning it does not have, and the hexadecimal claims none. **An intrinsic cost
of arbitrary colour, recorded as a cost rather than hidden.**

**The selected mark cannot live inside the swatch.** A tick drawn on an arbitrary colour has to be
legible on yellow and on dark blue, and no fixed ink is both. It goes outside — a ring on the panel's
own background, where the contrast is known — and it is declared as well as drawn.

**Forced colours will erase this control in silence.** Where a person imposes their own palette, the
system replaces background colours: all thirteen swatches become one colour, the control loses every
meaning, and no contrast check notices, because the contrast is excellent — they are merely identical.
This is the one place where telling the system to leave those boxes alone is legitimate, and the
difference from every other case is that here **the colour is the content**, not decoration. The cost
is paid in full or not at all: the swatches must stay distinguishable **without** colour — a name
beside them or reachable — and everything else in the panel obeys the imposed palette as usual.

**The platform's chooser is a window we do not own, and it breaks two things before it breaks
anything else.** The panel must **not** close when focus leaves towards it — a panel that closes on
focus-out or outside-press takes the door with it, and there is nothing left to return focus to. And
where the chooser applies colour as it is dragged, *cancel* must restore the previous value: an undo
that does not undo is the kind of defect nobody meets, because meeting it requires changing your mind.

Focus returns to the button that opened it, explicitly and by us, allowing for a close notice that may
never arrive. Closed with nothing chosen: nothing changes and nothing is announced — announcing a
change that did not happen is worse than silence. Closed with a colour: the value changes, focus
returns to the door, and the change is announced, because the chooser's own confirmation happened
inside its window and nothing perceivable happened in ours.

### The chooser reports a choice, not a dragging

The requirement above — *where the chooser applies colour as it is dragged, cancel must restore the
previous value* — is met by taking nothing to restore.

A colour control fires `input` at every step of a drag through the platform's chooser and `change`
when the person settles. All three renderers took the value on `input`, so the field recorded colours
nobody chose, and abandoning the chooser left whichever one the pointer had been passing over. The
field then held a valid colour that had genuinely been on the screen a moment earlier: **only the
person who cancelled could tell, and only if they remembered what they had.**

They now take it on `change`. There is nothing to restore because nothing was taken, and the colour
being dragged past is shown by the chooser itself, which is where the person is looking.

**What this gives up**, stated rather than glossed: the page no longer previews the drag. A consumer
listening for a value while a person moves the pointer through the chooser hears nothing until they
settle — which is the same trade the record makes everywhere else, that a presentation and a value
are different things.

**What is still unverified**: whether a real platform fires `change` on cancel, and with which value.
No runner opens that chooser, so this is one of the checks that waits for a person with a browser.

**The hex box is not removable.** It is the route that works when that surface does not — and that
surface is one we cannot name, cannot describe and cannot guarantee is operable by keyboard.

## Alternatives rejected

**Drop the presets and keep only the typed route plus the chooser.** The outside view's answer, and it
is coherent. It is also a smaller control than the one this project ships: twelve colours a team has
agreed on are a decision, and a panel that offers them is the reason the field exists rather than a
text box.

**Keep the panel and add nothing.** What is shipping. It leaves a field whose two halves disagree about
what its values are, and neither half can see the disagreement.

**Put a "Custom…" row of text at the end of the panel instead of a square.** Says what it does in
words, and a word in a row of colours reads as a label for them rather than as one of them. A square
carries the tint, which is the half of this decision the text cannot.

## Verification

**Not yet written, deliberately.** The shape of the square depends on the five answers, and a check
written first would pin the author's drawing rather than the decision — the same reason
`a-row-system-three-renderers-disagree-about` is pinned rather than repaired.

Two more that the answer named and that no shape avoids:

- **the panel survives the platform's chooser opening.** Measurable only where that chooser is a
  separate window, which is where it will break;
- **cancel restores the previous value** where the chooser applies colour as it is dragged.

What is already certain and independent of every answer:

- **how many routes exist, from the panel, to a colour that is not a preset.** Zero today. The check
  counts routes rather than naming the square, so any shape that provides one satisfies it;
- **the two routes leave one state**, with the control case in the same run: a field where *neither*
  works makes them agree perfectly;
- **a preset's announced name**, read from the computed accessibility tree rather than from the
  attribute we wrote;
- **the twelve swatches are still distinguishable under an imposed palette**, which is the check that
  would have caught a control quietly reduced to thirteen identical squares.

## Still open, and small

**How many custom colours are kept, and for how long.** One is the minimum; more than one needs a
ceiling and an eviction rule. Within the field's life is the floor; beyond the session it becomes a
stored preference, which is a larger and different decision.

## Security and privacy

None. A colour is not personal data, and the platform's chooser is the platform's own surface — it
receives no value from the page beyond the colour already displayed.

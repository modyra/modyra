# ADR 0158: A thirteenth that is a door

Status: Proposed — the model is decided; five interaction questions are open and named below.

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

## What this does not decide

The model is settled. How the square behaves is not, and five questions are with the outside view
rather than answered here, because answering them from inside the repository would answer them from
what the repository already does:

1. **It is a door, not a colour.** What a listener hears on reaching it, what a viewer sees that stops
   them reading it as a thirteenth colour — and whether it is still only a door once it carries a
   tint somebody typed.
2. **Where it sits.** Proposed last. Someone looking for a colour outside the presets reaches it after
   looking at all the others; someone not looking for it crosses it on every keyboard pass.
3. **What happens to the remembered tint when a preset is chosen.** Kept, and the panel shows two
   colours lit — one chosen, one remembered. Or dropped, and a person who tried a preset and changed
   their mind starts again.
4. **Whether it is marked as selected** when the field's value is exactly its tint. That would be one
   mark for two different facts: *this is the current colour* and *this is the door*.
5. **The platform's chooser is not ours to draw.** Where focus returns when it closes, and what
   happens when it closes with nothing chosen.

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

What is already certain and independent of every answer:

- **how many routes exist, from the panel, to a colour that is not a preset.** Zero today. The check
  counts routes rather than naming the square, so any shape that provides one satisfies it;
- **the two routes leave one state**, with the control case in the same run: a field where *neither*
  works makes them agree perfectly;
- **a preset's announced name**, read from the computed accessibility tree rather than from the
  attribute we wrote.

## Security and privacy

None. A colour is not personal data, and the platform's chooser is the platform's own surface — it
receives no value from the page beyond the colour already displayed.

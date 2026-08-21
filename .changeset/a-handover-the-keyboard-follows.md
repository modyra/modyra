---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
---

The handover moves the face and the caret together

A tap on an hour hands the dial over to the minute after a moment. The dial redrew and the contract
marked the minute segment, **and the browser's focus stayed in the hour box** — so an arrow or a digit
edited the field the person was no longer looking at, and nothing on screen said which one would move.

The cause is in the controller rather than in a renderer. `focus-field` returns a `focus` command, and
the handover dispatches it to itself on a timer, where there is no call for the commands to be
returned from — so they were produced and dropped. `MdyTimepickerFieldControllerOptions` gains
`emit?`, the sink for commands this controller raises without being asked; a renderer passes the same
executor it already uses for a dispatched command. A host that omits it draws exactly what it drew
before.

The decision to hand over at all is unchanged and still differs between renderers: Plain and Lit
advance, Angular does not. That disagreement is a separate question and is not settled here.

**Lit: an arrow on a segment emptied it.** The box bound `nothing` while it was being edited, meaning
to leave the text alone — but `nothing` on a property binding still writes, setting `value` to
`undefined` and clearing the box under the caret. The partial is held and bound instead, so the box
and the draft stay two views of one thing rather than two owners of one field.

# ADR 0206: A field that leaves the scene closes what it holds open

Status: Accepted

## Context

An overlay closed in two ways, and there was a third that nobody owned.

**On an intention.** A press on the trigger, `Escape`, a pointer finishing outside: the controller
receives it and answers with a transition the catalogue declares.

**At end of life.** The component is destroyed, and it destroys its controller with it.

A field taken out of the document by a rule the document itself carries is neither. No intention
arrives, because nobody pressed anything; nothing is destroyed, because the host is still alive and
simply stopped drawing one of its fields. The panel stayed open on a page whose field was gone.

Three of the four renderers passed this without deciding anything. They draw the panel inside the
field's own subtree, so whatever removes the field removes the panel with it. That is not a
guarantee — it is a consequence of where a node happens to sit, and
[ADR 0131](0131-a-rectangle-outside-a-box-is-not-a-clipped-one.md) says in as many words that *where a
renderer puts its popup in the DOM is not decided by this project, and no renderer is required to
change*.

So the contract was resting a promise on a choice it had declared free. The renderer that exercised
the freedom lost the promise, and it read as that renderer's defect. It is not: it is the promise
never having been stated.

**The keyboard is the same instant.** A field that leaves takes its control with it, so a person
standing there is left on `<body>` with their next Tab starting at the top of the page — the loss
`keepKeyboardInPlay` already answers when a control is *disabled*, arriving by a different road.
Designed as two doors they would fight over the same moment: the field goes, the overlay closes, the
keyboard lands somewhere a person can carry on from.

## Decision

A field leaving the document is the **third species of closing**, stated on its own and independent
of where a renderer draws its panel. `closeWhenFieldLeaves(root, { close })` in `@modyra/widgets`
watches the field's element, and when it leaves: closes what the field holds open, and — only if the
keyboard was inside it — puts the keyboard where `keepKeyboardInPlay` decides.

ADR 0131 is **not** superseded. A renderer may still put its popup wherever it likes. What changes is
that the closing no longer depends on that choice: the three renderers that pass today by consequence
pass by decision, and the day one of them moves its panel out, the promise holds.

The watch is on the field's parent, because a node cannot report its own removal. Whether the keyboard
was inside is read *before* the removal, since afterwards there is nothing left to ask.

## Consequences

A host with no `MutationObserver` cannot hold this. The door binds nothing there rather than throwing:
the widget keeps working and the guarantee is simply not held, which is honest about a host this
project does not control.

An adapter has to call it. That is the same exposure every door in this package carries, and the same
answer: an adapter that does not is a renderer where the third closing does not happen, and the
browser tier is where that shows.

The renderers whose panel sits inside the field now do the work twice — the door closes what the DOM
was about to remove anyway. The cost is one observer per open field and a close that finds nothing to
do; the alternative is a promise that holds for three renderers and not the fourth, which is what this
record exists to end.

## Alternatives rejected

**Repair it in the renderer that fails.** The hole reopens the day another renderer exercises the
freedom ADR 0131 grants, and it would then read as a new regression rather than as the same gap. The
measurement that settles this is that *no* renderer owns the teardown: the three that pass do so by
accident of placement.

**Require the panel to sit inside the field.** That is superseding ADR 0131 to protect a promise, and
it trades a freedom with real reasons behind it — a panel clipped by a scrolling ancestor is a panel
a person cannot finish reading — for an implementation detail that happens to imply the guarantee.

## Verification

`packages/widgets/test/a-field-that-leaves-the-scene.spec.mjs` builds the arrangement that had nothing
holding it — the panel drawn outside the field — and removes the field. It asserts the close arrives,
that the keyboard lands on what follows, that a field nobody was standing in takes nobody with it, and
that unbinding stops the watch.

What it does not guard: an adapter that never calls the door. That is the browser tier's, where the
case was reproduced in the first place.

## Security and privacy

None. The door observes the host's own document for a removal it is already performing, and moves
focus within it.

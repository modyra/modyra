# ADR 0155: A press completes on the release

Status: Accepted

## Context

The field a multiselect draws opens its list when a person presses its own empty space. Measured
across the three renderers, they did not agree on *when*:

```
                 while the button is held    dragged away, then released    completed press
plain            OPEN                        stays open                     open
lit              shut                        shut                           open
angular          shut                        shut                           open
```

The middle column is the finding. **Beginning a press and moving away before letting go is how a
person takes a tap back**, on every platform there is; it is the gesture someone uses when they
realise mid-press that they aimed at the wrong thing. Where the control acts on the down-event, that
gesture does nothing — the list is already open by the time the finger moves.

Reading only the completed press finds all three opening and reports agreement. A control that acts
too early ends up in the same state as one that waits; the difference exists only in the moment
between.

WCAG 2.5.2 asks a single-pointer gesture for exactly this: either nothing happens on the down-event,
or the action completes on the up-event so that leaving cancels it.

Both halves are defensible in isolation — the platform's own chooser opens as it is pressed, a button
activates as it is released. What is not defensible is one library shipping both. A person who learns
the control in one application has learned nothing transferable, and a team that changes renderer
changes a behaviour nobody wrote down.

## Decision

**A press on a field's own area completes on the release, and moving away before releasing cancels
it.** The down-event is used only to stop the box taking focus from the control it is about to hand
that focus to.

The tie-break is not a preference between the two platform habits. It is that **the field's empty
space is a forwarding surface for the opener**, and the opener is a button, which activates on
release. A field whose empty space acted sooner would give one control two activation models
depending on which pixel was hit.

## Consequences

The list opens a fraction later than it did in the renderer that opened early, and that is the cost:
the gesture is not free, it buys the cancel.

Anything else that forwards a press to a control it does not contain inherits this. A press that
begins on one surface and is meant for another has to wait for the release, because until the release
there is no way to know the person still means it.

A renderer that reaches this behaviour some other way is conformant. The check below asserts that the
gesture can be taken back, not the listener that achieves it.

## Alternatives rejected

**Converge on the down-event instead.** It is what a native `<select>` does, so it has a real
precedent, and it feels faster. It cannot be cancelled, which is the criterion, and it would put the
field's empty space out of step with the button that same press is forwarded to.

**Leave each renderer as it is and document the difference.** The divergence is not a rendering
detail a document can absorb: it is what a gesture means. Two meanings under one contract is the
thing the contract exists to prevent.

**Act on the down-event and offer an undo.** 2.5.2 does allow completion-on-down where the act can be
reversed, and pressing again does close the list. It answers the letter and not the person: the
take-back gesture people already know stops working, and they are asked to learn a second one that
only this control needs.

## Verification

`e2e/shared/a-press-a-person-can-take-back.spec.ts`, in every renderer. It reads three moments — held,
taken back, completed — because the first two are the only ones where the renderers differ, and it
asserts **the control case in the same run**: a field that answers nothing at all would satisfy
"still shut" twice over, so the completed press must open the list for the earlier readings to mean
anything.

Falsified by restoring the down-event listener in the renderer that had one: red in that renderer and
in no other, in all three engines, and green again when it is put back.

The press is aimed at the caret's centre. The caret takes no pointer events, so the press reaches the
box at every fill, where the field's own centre is the placeholder, the opener or a chip's remove
button depending on how much is chosen — three situations one measurement would report as three
renderers.

## Security and privacy

None. This changes the moment a list opens, not what is stored, sent or shown.

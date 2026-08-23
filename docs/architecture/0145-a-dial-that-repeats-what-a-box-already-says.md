# ADR 0145: A dial that repeats what a box already says

Status: Accepted

## Context

The timepicker's clock face carries `role="slider"`, `tabindex="0"`, and `aria-valuemin`,
`aria-valuemax`, `aria-valuenow` and `aria-valuetext` derived from the same rule its arrow keys
follow. That was written against a real defect: before it, the face was a `<div>` of `<div>`s — no
role, no value, no name, nothing at all to a screen reader.

Two facts about the panel it sits in make that repair the wrong one.

**The hour and the minutes are already `spinbutton`s, and they are on screen at the same time as the
dial.** Measured in the open panel: `role="spinbutton"`, `aria-valuemin`, `aria-valuemax`,
`aria-valuenow`, `aria-label="Hour"` / `"Minute"`, and `ArrowUp` on the hour box moves 3 to 4. Every
value the dial can set, the boxes can set. The dial is a redundant pointer surface — a good thing for
a pointer user, and nothing at all for a keyboard or screen-reader user.

**The contract already says the dial is not a Tab stop.** `timepickerTabOrder` names
`hourControl → minuteControl → periodOption → modeToggle → action → action--confirm`. The face is not
in it, and the renderers enforce that ring. So the DOM offers `tabindex="0"` on an element the
contract's Tab walk skips.

An element with an interactive role that Tab cannot reach is not merely mislabelled. `slider`
promises focusable, valued and operable. **Browse mode ignores `tabindex` entirely**: a screen-reader
user arrowing through the panel with the virtual cursor lands on the face, is told "slider, 3",
presses the keys a slider answers to, and nothing happens — 4.1.2 Name, Role, Value. And because the
hour spinbutton announces the same number, the value is spoken twice with nothing to say whether they
are one thing or two.

The outside view was asked where focus goes when the panel opens and whether the dial is a Tab stop,
with no repository framing. It answered that a control duplicating another control's function gets no
tab stop of its own, that a redundant graphic must be hidden from assistive technology rather than
described, and that `slider` is the wrong role either way — a dial's value space is a set of discrete
marks, not a continuum. Where a dial is the *only* input for a value, it must be exposed and operable
as a set of options with position, and that is not this panel.

## Decision

**The clock face is `aria-hidden="true"`, carries no role and no value, and is not focusable.** It is
a pointer surface: click to set, drag to move the hand, and both remain.

**What it used to announce is announced by the control that is actually operable.** The hour and
minute boxes keep their `spinbutton` role and bounds and gain `aria-valuetext`, so a reader hears
`3 PM` rather than `15`, and `05 minutes` rather than `5`.

`timepickerDialAria` is replaced by `timepickerSegmentAria`, which computes the same three values for
the box instead of for the face. Nothing that was announced stops being announced; it moves to the
element a person can reach.

## Consequences

A screen-reader user can no longer inspect the hands, because there is nothing to inspect: the value
is in the boxes and the dial repeats it. That is the intended loss.

Anyone who had focused the face with a pointer and used the arrows there loses that route. The arrows
do the same thing on the box, which is where focus goes when the panel opens.

The kind's keyboard surface shrinks to what the contract already declared, so the DOM and
`timepickerTabOrder` stop disagreeing.

`timepickerDialAria` is a published export and it is gone. `timepickerSegmentAria` replaces it with
the same shape minus a role that was never true of a box — a consumer that rendered its own face from
it has to stop calling it a slider, which is the point of the change.

This decision is scoped to a panel that shows both inputs at once. **A picker that offers only the
dial in some view must expose it** — operable, in the tab order, and as options with
`aria-posinset`/`aria-setsize`, never as a slider. That case does not exist here today; if it is ever
built, this record is the one to supersede.

## Alternatives rejected

**Keep the slider and put the face in the tab order.** Two tab stops for one value, paid by every
keyboard user on every visit, for no capability they did not already have.

**Keep the slider and leave it out of the tab order** — the status quo. This is the state that
misinforms browse-mode users and speaks the value twice.

**Announce the face as a group of options with position, the way a dial-only picker must.** Correct
where the dial is the only input; here it adds a second reading of a value the boxes already carry.

**Drop `role` but keep `aria-valuenow` on the face.** Value without role is not exposed by any
assistive technology; it is dead markup that looks like coverage.

## Verification

`packages/angular/src/lib/renderers/timepicker/clock-keyboard.spec.ts` asserts the face's exposure
and the segments'; it fails if the face regains a role or a tab stop, or if a box loses its
`aria-valuetext`.

The widget DOM conformance suites (`npm run test:conformance`, `npm run test:angular`) assert the
timepicker's parts and their roles against the catalogue for all three renderers.

`e2e/demo.spec.ts` asserts the face's role and that it takes focus when the panel opens, both of
which this decision reverses. That spec states the pre-decision design and has to be rewritten
against the boxes; until it is, it is a known failure and not evidence of a defect.

What is not verified here: that a real screen reader speaks `3 PM` for the hour. The attribute is
asserted; the speech is not, and no check in this repository can see it.

## Security and privacy

None. The change moves where a time already on screen is announced; it stores nothing, sends nothing,
and exposes nothing that was not already visible.

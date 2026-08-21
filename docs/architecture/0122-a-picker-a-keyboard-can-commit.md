# ADR 0122: Tab moves inside a popup that has controls of its own

Status: Accepted

Amends [ADR 0021](0021-a-dialog-overlay-is-not-a-combobox.md), which recorded that Escape and Tab
both dismiss every overlay.

## Context

`Tab` was declared as `cancel` for every kind with an overlay, and ADR 0021 gave the reason: *"a panel
still floating over a field the user has tabbed away from is the same defect a moment later."* That is
right for a popup holding a list. It is wrong for one holding controls.

A timepicker's popup has six: two number boxes, an AM/PM pair, a mode toggle, and cancel and confirm
buttons. Under the old binding:

> Open the picker, type an hour, press `Tab` to reach the minutes — the picker closes and the draft is
> discarded.

And because nothing else reached the confirm button, **the widget's only way to commit a time was a
pointer.** That is WCAG 2.1.1, not a preference. It shipped because the binding was declared once for
a capability — *has an overlay* — that two different kinds of popup share.

The renderers had diverged around it in the way that always accompanies a rule that does not fit:
nothing focused a number box in any of the three, and the hour→minute handover existed in three
shapes with three different delays — 0ms, 200ms and 300ms — none of them the contract's.

## Decision

**A popup that declares an `actions` bar keeps `Tab`; one that does not still dismisses on it.**

The question is asked of the catalogue rather than of a list beside it. An action bar means a confirm
button inside the overlay, and a confirm button that `Tab` cannot reach is a widget with no keyboard
commit path. A kind that grows an action bar grows this binding with it; one that loses it loses this.

Today that is exactly one kind, and the test asserts that too — so if a second grows one, the
assertion says so rather than the behaviour changing unnoticed.

**Escape is unchanged and is now load-bearing.** With `Tab` moving inside the dialog, `Escape` is the
only way out, and it still cancels with focus returning to the opener. A keyboard user who cannot
leave is worse off than one who cannot commit.

Three things follow, all published rather than left to each renderer:

- **the tab order**, as part names — hour, minute, period on a twelve-hour picker, mode toggle,
  actions — and it wraps at both ends, because a dialog traps;
- **which part carries focus for a field**, so the renderers stop choosing selectors;
- **one advance delay** for the dial's hour→minute handover.

## Consequences

`contract:diff` classifies this **major**: `Tab@open:cancel` is withdrawn for one kind and
`Tab@open:move` declared. A renderer built against the old table and not updated leaves a timepicker
popup open when the user tabs — which is the defect ADR 0021 named, arriving from the other side. The
changeset says so.

The tab order being declared rather than emergent is a cost as well as the point: a renderer that adds
a control to its popup must add it to the order, and one that does not gets a control the keyboard
cannot reach. The alternative was DOM order, which is not one order — the three renderers build the
dialog differently enough that one appends the dimmed layer before the hand and another after it, so
"whatever falls out" would differ per renderer.

**Focus is derived from `focusedField`, not kept beside it.** The picker already had that state with
one expression — which segment is drawn active — and DOM focus was somewhere else entirely. Two states
that can disagree is the shape of most of this widget's defects; this refuses to add another pair.

The published delay is a judgement about reading, not a measurement: the face redraws with twelve
different numbers, and doing that in the same frame as the press takes the number the person chose off
the screen before they have seen it land.

## Alternatives rejected

**Leave `Tab` alone and make the confirm button reachable another way.** There is no other way that is
not a second keyboard convention to learn, and the one people already know is `Tab`.

**`Tab` between the two number boxes only.** What was asked for, and smaller. It leaves the mode
toggle — the control that switches between the dial and the number fields — unreachable from a
keyboard, which is the same defect in a smaller box.

**Declare it per kind in a list.** A list beside the catalogue drifts from it. Asking whether the kind
has an `actions` part is the catalogue answering about itself.

## Verification

`packages/widgets/test/timepicker-focus.spec.mjs`: the binding is `move` for the timepicker and
`cancel` for every other overlay kind; `Escape` still cancels and restores; the tab order wraps at both
ends and omits the period on a 24-hour picker; and exactly one kind declares an action bar today.

The behavioural half — that a draft survives `Tab`, that the confirm button is reachable from the
moment the picker opens, that `document.activeElement` is the hour box on open and the minute box
after the dial hands over — is asserted in the browser tier, on what a person does rather than on what
a handler receives. That distinction is the lesson of finding 338, whose battle asserted a mechanism
and went green over a dial that still flickered under the user's finger.

## Security and privacy

None. No data moves and no trust boundary is touched. The nearest consequence is the one this exists
for: a control that cannot be operated from a keyboard excludes the people who cannot use a pointer,
which is an accessibility failure rather than a security one — but it is a failure of the same kind,
where the system works for some users and quietly does not for others.

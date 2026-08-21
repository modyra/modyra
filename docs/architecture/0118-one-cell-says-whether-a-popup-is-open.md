# ADR 0118: One cell says whether a popup is open

Status: Accepted

## Context

A field can leave play while its popup is open, and nobody has to click anything for it: a
document's rule takes a field out when *another* field changes, so a value arriving from a fetch can
do it while the user is looking at the calendar. `closeOverlayWhenOutOfPlay` is the widget
contract's rule for that, and it expresses the rule by writing the controller's `open` cell to
false. Its own opening sentence states the reason: the click doing nothing is right, the calendar
still being there offering it is not.

In Angular the popup stayed open. `aria-disabled="true"` reached the dial correctly, so the field
was *visibly* out of play and still offering a control whose clicks correctly did not land.

The cause was not the rule and not the wiring. `MdyOverlayControl` held its own
`open = signal(false)` and every template painted from that, while the contract wrote a different
cell. Measured across the three renderers:

| renderer | what the template reads |
|---|---|
| plain | `controller.state().open` |
| angular | the directive's own `signal(false)` |
| lit | the host's own overlay state |

Five controllers call the rule — timepicker, datepicker, daterange, colors, multiselect — so the
divergence covered every kind with a popup, in two renderers of three.

This is the third instance of one shape in a single line of work. A registry with two writes had one
of them missing on a handle; a fix for a synthetic handle did not reach the bound handle beside it;
and here a rule writes a cell nothing paints. In each case one path implemented the contract and its
sibling kept a parallel copy, and no tier could see the difference because both paths were green
about something else.

## Decision

**A kind whose controller owns `open` has no second cell.** The renderer reads the controller's
state and writes through the controller's intents; the directive's own signal exists only for a kind
that has no controller.

`MdyOverlayControl` expresses this as a pair — `isOverlayOpen()` and `setOverlayOpen()` — that a kind
overrides together. Overriding one alone is the defect this record exists to prevent: a reader that
follows the contract while the writer still fills a local cell reports a state nothing updates.

`open()` is a **method**, not a `computed`. A computed evaluated before the controller exists — which
happens whenever a `name` has not yet resolved to a field — would depend on nothing that ever
changes again and would answer "closed" for the life of the component. That is not hypothetical: the
same latch was already fixed once inside `adoptFieldController`.

## Consequences

The rule is now observable in Angular for the kinds that adopt it, and the fixture that proves it is
red per kind before the pair is overridden and green after. A single green at the end could not tell
a repair from a kind that never had the rule.

What this makes harder is real. Routing writes through the controller means the controller's own
intent handling runs — `openPicker()` moves the focused date, `closePicker()` returns commands — and
a renderer that does not execute the commands it is handed now diverges where before it merely
duplicated. Two kinds are in exactly that position and are **not** converted here: `datepicker` and
`daterange` fail the canonical after-Escape comparison the moment their writes go through the
controller, because their renderers drop `restore-focus`. They keep the local cell, and keeping it is
now a stated debt rather than an unnoticed default.

`colors` is a larger exception: the Angular renderer adopts no controller at all and reimplements the
kind, so there is nothing to point at. Lit keeps a parallel copy for every kind.

The seam is also an invitation to be wrong quietly. A kind that overrides neither method compiles,
renders, and silently keeps the old behaviour — which is why the check below is a behavioural fixture
rather than a type.

## Alternatives rejected

**Mirror the controller's `open` into the local cell with an effect.** It would have been three lines
and it is the defect wearing a fix's clothes: two cells, one copying the other, with the copy still
the thing that gets painted. The next rule the contract adds would need its own mirror.

**Close the overlay in Angular when the field reports itself disabled.** A local workaround for a
behaviour the widget owns. It would make this kind pass and leave the rule unimplemented, and the
next renderer would write its own version of the same line.

**Derive `open` from interactivity in the contract instead of writing it.** `leaving-play.ts`
deliberately sets rather than derives, so a field coming back into play does not re-open a popup the
user never asked for a second time. That reasoning is sound and is not disturbed here.

**Convert all five kinds in one commit.** Datepicker and daterange fail a canonical cross-renderer
comparison when converted, and forcing them through would have meant either weakening that
comparison or shipping a focus regression to make an unrelated rule observable.

## Verification

`packages/angular/src/lib/core/a-popup-that-outlives-its-field.spec.ts` opens each converted kind,
takes the field out of play through a sibling's `when` predicate, and asserts that no panel is
visible and the opener announces itself collapsed.

It asserts the panel's visible class and `aria-expanded`, **not** the presence of the popup's
contents. An earlier version asserted the dial's presence and was red for the wrong reason: this
renderer keeps its panel in the DOM and toggles visibility, so the face is there whether or not
anyone can see or reach it.

Not covered: `datepicker`, `daterange` and `colors` in Angular, and every kind in Lit. Their
divergence is stated above rather than guarded, and a battle asserting that the cell the contract
writes is the cell a renderer paints is the check that would make it illegal rather than merely
known.

## Security and privacy

No trust boundary is touched and no data moves. The nearest thing to a security consequence is an
availability one in the accessibility sense: before this, a field taken out of play kept an
interactive-looking popup that answered nothing, which misinforms a user about what the form will
accept. Nothing here changes what is stored, sent, or authorised.

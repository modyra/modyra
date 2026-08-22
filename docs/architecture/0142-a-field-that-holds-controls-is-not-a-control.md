# ADR 0142: A field that holds controls is not a control

Status: Accepted

## Context

A multiselect shows what has been chosen as chips inside the field, and each chip carries a button
that removes it. The whole field is also the thing that opens the list of choices, and it is a
`<button>`. So a button contains buttons.

Two consequences follow, and only the first is visible.

**A press aimed at the field can delete a value.** The chips and the opener share one activation
region, so what a press does is decided by what happens to lie under it. With a single short label,
the remove button sits at the field's midpoint — the place a person aims to open it. The value is
removed, the list does not open, and the second press opens a field that has lost what it held. With
a longer label the same press opens the list normally:

```
label "Alfa"                      trigger 135 wide, ✕ spans 38–70,   midpoint 67  → on the ✕
label "Amministrazione centrale"  trigger 244 wide, ✕ spans 149–179, midpoint 122 → on the label
```

Nothing in the code chooses that. **The text does.** Two people performing the identical gesture get
opposite outcomes because of how long their word is, which also means the failure is not spread thinly
across everyone: it is certain for whoever picks short values and invisible to whoever picks long ones.

**The structure is only survivable by the route it is built through.** HTML forbids a button from
containing interactive content, but that prohibition is a *parser* rule. These elements are created
with `createElement` and `appendChild`, so the DOM keeps the nesting and the accessibility tree, built
from that DOM, carries every inner control correctly. The same markup arriving as text — server
rendered, hydrated, or copied into a documentation page — is parsed, and the parser closes the outer
button before the inner one: the chip strip leaves the control and takes its buttons with it.

An outside accessibility review, given the interaction in plain words and no repository context,
answered the general question without qualification: a control that deletes may not sit inside the
activation region of a control that opens, in any arrangement, regardless of where it lands.

## Decision

**The box that looks like a field is a container, not a control.** It carries no widget role, takes no
focus, and is not pressable.

Inside it, the chip strip and the opener are **siblings**. The opener carries `role="combobox"` with
`aria-expanded`, `aria-controls` and `aria-haspopup`, and occupies the space the chips do not. Pressing
the field's empty area still opens the list — as a behaviour of the container forwarding a press on its
*own* area, not as a consequence of containment.

A press that lands on a chip never reaches the opener, because a chip is not inside it. **The geometry
stops deciding what a press does.**

The invariant is stated structurally and checked that way: *the opener has no operable descendants*.

## Consequences

This changes what the widget contract says a multiselect is made of: `trigger` stops being the parent
of `chips`. It is a structural change to a public contract and consumers with their own templates
against these parts will see it.

The opener stops being a `<button>` element. Everything that styles or selects it as one moves with it,
and each renderer changes the element it draws.

**A decision falls out of the change that must not be left to the implementation**: pressing the *body*
of a chip is no longer a press on the opener, so it no longer opens the list. Either the chip body
forwards to the opener the way empty space does, leaving the ✕ as the only distinct region, or the chip
body is itself operable and takes focus. Both are defensible; silence is not, because it leaves dead
space in the middle of a box that otherwise opens on press.

One geometric rule survives and becomes checkable for the first time, because it is now between
siblings rather than between a parent and its child: the ✕ and the opener each need WCAG 2.5.8's
24×24 target with a clear zone. The ✕ currently measures 32×22.

## Alternatives rejected

**Move the ✕ so it cannot coincide with the midpoint.** Rejected on the ground that decides this whole
record: the hazard's input space is every value a caller may supply — every translation, every
user-typed name, every font fallback, every zoom level, every reader's text-spacing override. **A rule
expressed in resulting geometry cannot be enforced or tested**, because it can only be checked against
the words whoever wrote it thought of. A structural rule has no dependence on content.

**Leave it, since this browser copes.** Rejected. "Chromium's accessibility tree survives our nesting"
is a property of one engine and one construction route, not a contract. The markup is invalid whichever
tree is built from it, and the one route that does not survive — parsing from text — is the one server
rendering takes.

**Remove the ✕ entirely; deselect from the open list instead.** Structurally the cleanest: with nothing
operable inside it, the box may legitimately be one pressable thing. Rejected because removing one
value would cost open–find–deselect–close instead of one press, which is a real loss for the case the
control exists to serve.

**Move the chips out of the field, into a row beneath it.** Also structural, and it has one advantage
the accepted option lacks: the opener's activation area stays constant no matter how many values are
held or how long their names are, where chips-inside squeezes it and at some count leaves nothing to
press. Rejected for now because it separates a value from its control, needs explicit programmatic
association, and makes a filled field look empty — which misreads as "not yet completed" on a required
field. It becomes the right answer if the routine number of chips grows large enough to squeeze the
opener.

## Verification

`battle-tests/browser/a-trigger-with-a-control-inside-it.spec.ts` asserts the invariant directly: the
element that opens the list contains no operable descendants. Red in all three renderers today.

It is asserted against the **DOM**, not against the computed accessibility tree. Run against
Chromium's tree the same property passes, because that engine preserves the nesting — the tree is one
engine's opinion of the structure, and the structure is what this record is about.

`battle-tests/browser/a-choice-made-before-anyone-looked.spec.ts` covers the visible symptom: a press
at the field's midpoint must leave the value unchanged and must open the list.

**What is not guarded:** nothing checks target sizes or their clear zones, because between a parent and
its child the measurement is not meaningful. That check becomes writable once this decision lands, and
it should be written then.

## Security and privacy

No trust boundary moves and no data changes hands: this is a change to which element carries a role and
which elements are its siblings.

One integrity point is worth stating. The current arrangement lets a pointer event perform a
**destructive** action the person did not request, with no confirmation and no announcement, where the
determining factor is caller-supplied text. That is not an attack surface in the usual sense — nobody
gains anything — but it means the length of a value can silently cause the loss of a different value.
A caller who controls the labels a form displays controls which of a user's selections is easiest to
destroy by accident.

Removal is undoable. Nothing announces that it happened, so the undo is available to a person who does
not know they need it; that gap is real regardless of this decision and belongs with it.

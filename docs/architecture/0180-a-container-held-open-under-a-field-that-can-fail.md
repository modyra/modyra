# ADR 0180: A container held open under a field that can fail

Status: Accepted

## Context

A message that appears under a field pushes down everything below it — including the field somebody
is moving toward, at the moment they are already moving. The pointer they aimed lands on the wrong
control, and a person who navigates by pointing pays for a rule they have not broken yet. Taking the
space back when the message clears is the same jump, upward.

So the container is in the document under every field that can fail a rule, whether or not it holds
anything. That is what `errorsReserved` names, and every renderer template guards the list on it.

It has a second effect nobody set out to get, and it is the more valuable one. `aria-describedby`
must name an element that exists; a container that comes and goes with the message gives the
reference a moment at which it points at an element not yet drawn, or at one already gone. A
container that is always there has no such moment, so one reference stands for the life of the
field.

The cost is a container that is named while empty. An accessible-description sweep reads twelve
Angular controls whose `aria-describedby` resolves to nothing, and reports each as a control claiming
a description it does not have. The reading is correct; the conclusion does not follow, and until
this record existed a checker had nothing to read the difference from.

## Decision

**A field that can fail a rule holds the container for its message from the first paint, and keeps
it.** Presence follows what the field *can* do, never what it is currently saying.

**A reference to an empty reserved container is not a defect**, and a check that reads accessible
descriptions must know the difference between the two things it can be looking at:

- a reference naming an element **not on the page** — a defect in every case, because it is a
  promise the document cannot keep, and no rendering of the field will make it resolve;
- a reference naming an element that **is on the page and holds nothing** — the state this record
  describes. The accessible description computes to the empty string, which is what a person hears:
  nothing. Announcing nothing is what an empty container is for.

The distinction is the whole of it, and the two look identical in a failing assertion — both read as
"the description came back empty". A sweep that folds them together sends a reader to the container
when the defect is in the reference, and vice versa.

**A renderer that draws the container only when it has something to say is conforming too.** The
option defaults to "reserved follows visible", so an adapter that has not taken this on keeps what it
draws. What it does not get is the stable reference, and it owns the timing question that comes with
that.

## Amendment: the complement, and what an empty container costs when it is kept

This record says when a container is **held open**. Read alone it invites the converse — that any
empty container should be — and the converse is not decided here. It is decided now, because the
same shape appeared under a field that lists what a person attached.

The two reasons above are the test, and both must fail before a container may go:

- **Does it appear outside the act the person is performing?** The message this record is about
  arrives while somebody is already moving toward the next field: they did not ask for it, they are
  not looking at it, and it moves the target under an aim already taken. A list of attached files
  changes because the person just attached a file — they are looking at the thing that changed, and
  the movement is the answer to their own action. Inside the act, a container may appear; outside it,
  the space is reserved.
- **Must a reference land on it?** `aria-describedby` names the message container, so it must exist
  for the reference to resolve. Nothing names the file list.

**A container that fails both is not kept, and not keeping it means taking it out of the flow rather
than leaving it empty.** In a layout with a gap, an empty child is still a child: it is zero pixels
tall and is charged a full gap anyway. Under a file field that is 21 + 8 = 29 against 21, from an
element holding nothing — and the proof is inside one renderer rather than between two, because the
container beside it is equally empty and costs nothing, being `hidden`. Same box, two treatments, one
of them billed.

So the rule an empty container answers to is not "is it in the document" but **"is it in the flow"**,
and `hidden` is how a container that is kept for a reference stops paying for space it does not use.

## Consequences

Every field with a rule carries an element that is empty most of the time, in the document and in the
accessibility tree. It costs a node per field and a line of vertical space that a design must account
for whether or not anything is wrong.

An emptied container is indistinguishable from one that never held anything, so "has this field ever
failed" cannot be read from the DOM. Nothing needs that today; a feature that did would have to carry
its own state rather than infer it from what is on screen.

And the honest cost of the decision itself: an audit reading the page — rather than reading this
record — will keep reporting those controls, because from the outside a named empty element is
exactly what a mistake looks like. That is why the exemption is written where a checker can read it
instead of being kept as a list of ids, which would go stale the moment a field was renamed.

## Alternatives rejected

**Draw the container with the first message.** The simplest rendering and the one that moves the page
under a person mid-gesture. It also gives `aria-describedby` a moment when it names nothing, which is
the defect this record is careful to keep distinguishable.

**Reserve the space with a margin rather than an element.** Keeps the layout still without an empty
node, and loses the stable reference — the message still arrives in an element that has to be created
and named. It solves the visible half of the problem and none of the announced half.

**Drop the reference while the container is empty.** `aria-describedby` set and unset as messages come
and go. It is correct at every instant and it is a reference that changes under a reader mid-field,
which is the class of problem this decision exists to remove rather than reintroduce.

**List the exempt controls in the checker.** A dozen ids, accurate today. It is a waiver outliving
the thing it waived: it does not move when a field is renamed, it silences the next real defect on
the same control, and it records no reason.

## Verification

An accessible-description sweep asserts the distinction rather than the outcome: a reference whose
target is absent from the document fails, and a reference whose target is present and empty does not.
The check reads this record for the exemption — the ARIA sweep reads ADR 0177 the same way — so a
decision reversed here reverses the check, and neither can drift from the other while a person edits
one of them.

What stays unguarded: that the container is reserved for exactly the fields that *can* fail, rather
than for all of them or for the ones currently failing. `errorsReserved` is a renderer's answer, and
nothing compares it against the field's own rules.

## Security and privacy

None. The decision concerns an empty element's presence and an ARIA reference to it; no data crosses
a boundary and nothing is persisted.

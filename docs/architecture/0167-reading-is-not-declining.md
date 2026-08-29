# ADR 0167: Reading a form is not declining it

Status: Accepted

## Context

ADR 0165 settled *when* a required field speaks: silent while it is empty and nobody has reached it,
speaking once a person has been there and left it that way. It did not settle what "has been there"
means, and three renderers had quietly answered it three ways.

Two doors existed for the same verdict. One filters refusals by whether the field is out of play; the
other also asks whether anybody has been at it. Three controls in one renderer reached for the first,
so a required select announced itself invalid on the first paint — the exact behaviour 0165 was
written to stop, in the renderer whose adoption produced 0165.

Underneath that, a wider divergence: a person tabbing through a form reached some kinds and not
others. A kind whose control is a plain box hears its own blur; a kind whose control is a button that
opens a panel had nobody bound to the trigger, so focus passing through it was never noticed at all.
Which kinds noticed differed by renderer.

The obvious repair — notice the leaving in one place per renderer, so every kind hears it — was built,
measured green across all three, and is **not** what this record decides. Asked outside the
repository what a form should say to somebody who tabs through a required field and leaves it empty,
the answer was that it should say nothing, and the reasoning inverted the question.

## Decision

**A form speaks when the value has been touched, never when only focus has.**

Focus arriving and leaving is an act on attention, not on the value. **Tab is how a person reads a
form** — the same way eyes scroll it. A sighted person scrolling past twenty required fields gets no
red borders; somebody tabbing past them must not get twenty announcements of "invalid". Reading is
not declining, and treating it as declining does not spare the person bad news at the end: it moves
false news to the start, on fields they were about to fill in.

So the test for "has this person been at this field" is **did the value change while they were
there**. Empty to empty is nothing happening. Empty to something to empty is something happening, and
the field may speak.

**Opening a panel and closing it without choosing is an act on the value.** It is the panel's version
of typing and deleting: the person saw the options and took none. The same holds for a calendar and
for a colour palette — engaging with the value space and leaving it empty is one act across every
kind that has one, which is what makes it a rule rather than a per-kind decision.

**A panel is inside its field's focus scope wherever it is rendered.** A field's focus has left when
it has left the control *and* is not inside the panel. Where the panel lives in the document is a
rendering decision taken for clipping reasons and must not reach behaviour — so the scope follows the
declared `aria-controls` link from the control to the panel, not DOM containment. A renderer that
decides by containment answers differently from one that renders its panel in place, which is the
divergence class this repository keeps producing.

```
focus in, focus out, value unchanged        nothing — reading is not declining
value changed, then focus out               speaks
panel opened and closed, nothing chosen     an act on the value; speaks on leaving
panel open, focus inside it                 still in the field; not a leaving
panel rendered elsewhere                    the same, by aria-controls rather than the tree
submit                                      everything, once, focus to the first
```

## Consequences

**The repository contradicts this today, and this record does not fix it.** `errorsVisible` keys off
`touched` — focus has been here — and every kind whose control is an ordinary box marks touched on
blur. Measured: a required text, checkbox, datepicker, timepicker or daterange, focused and left
without typing, announces itself invalid. The kinds that stayed silent were right by accident, and
the repair that would have made them all speak was the wrong repair.

What the rule needs is the distinction between **touched** — focus has been here — and **dirty** —
the value has changed — with the verdict keying off the second. Both flags exist on a field handle.
Changing which one `errorsVisible` reads redefines documented behaviour for every kind in every
renderer at once, so it is a batch of its own and not a line in this one.

The panel-as-focus-scope rule has no implementation yet either. Each renderer decides containment its
own way today, and at least one decides it by the document tree.

**What this record does settle** is the direction, so the next person does not relitigate it from the
symptom. A check that finds "this kind stays silent where that one speaks" now has an answer to which
one is wrong, and it is usually the one that speaks.

## Alternatives rejected

**Announce on leaving, whatever the person did.** The case for it is honesty about where the form
stands, and the cost is paid by the person who reads before writing — which is how a form is read by
anybody who cannot see all of it at once. It is the option the repository half-implements today.

**Announce only on submit.** True but late, and it withholds a correction from somebody who has just
made one and could fix it while it is still in mind.

**Leave each kind to answer for itself.** This is what produced the divergence: the same contract,
answered at different moments depending on whether a kind's control happened to have a blur handler.

## Verification

- `packages/lit/test/a-field-nobody-has-reached.test.mjs` asserts across every kind that can be
  required and empty that none announces itself invalid before anybody reaches it, and — as its
  perimeter — that each one still can announce it, so a renderer that never writes the attribute
  cannot pass by silence.
- Mutation: restoring the door that does not ask about touching, at the one control that used it,
  turns that kind red. Worth stating that the first attempt at this mutation *survived*: it changed
  the native control's path, which the fixture never renders because it asks for the custom combobox.
  A mutation that survives is a statement about coverage, and that path has none.
- `packages/lit/test/where-focus-is-after-a-panel-closes.test.mjs` and its counterpart in `plain`
  assert the one invariant this record produces that needs no contract change: after any panel
  closes, focus is inside the field and never on the document. Both press the close from *inside* the
  panel, because a close with focus still on the opener cannot send it anywhere — the first version
  did that and passed against a renderer that restored nothing.

  The check found the divergence this record names. One renderer's multiselect panel is drawn outside
  the element that binds its keys, so `Escape` from the search box inside it reached no handler at
  all: a person who opened the list, narrowed it and changed their mind was left with no keyboard way
  out. Every other kind closed. The panel now hears the same keys the field does.

  Mutations: removing that binding, and removing the focus restore, each turn it red — in both
  renderers. Two earlier mutations *survived* and both were coverage statements rather than passes:
  one changed a path `Escape` does not take, the other a control the fixture never mounts.

- The consequence above — that ordinary kinds speak on a bare traversal — is **not** guarded. There
  is no check that fails today, because the behaviour it would guard is the behaviour that ships.

- One order is stated in this record and not enforced anywhere: focus moves back to the opener
  *before* the panel is removed. At least one renderer closes first and focuses after, which is safe
  only because its panel is built once and hidden rather than removed. Nothing fails if that changes.

## Amendment: implemented, and where the implementation departs from this record

This record shipped saying the repository contradicted it and that the repair was a batch of its own.
That batch has run; what follows is what was built and the two places it does not match the words
above, so the difference is read rather than discovered.

**What sets the flag changed, not what reads it.** The record proposes that the verdict key off
`dirty` rather than `touched`. That version breaks the submit channel: a refused submit shows a
form's refusals only through `markAllTouched`, so a verdict keyed off `dirty` says nothing at the one
moment the form has been asked and refused, and repairing it means a new flag on the field handle.
Instead a bare blur no longer marks anything, in any controller or renderer, and every path that
changes the value marks `touched` together with `dirty`. `touched` therefore means *this field has
had an answer* rather than *focus has been here*, one flag, no new surface, and the submit channel
is asserted rather than assumed.

**"Speaks on leaving" is not implemented as a separate condition.** The table above says a panel
opened and closed speaks *on leaving*; what ships shows the verdict from the moment the panel closes,
which is when the act is recorded. This is deliberate: every other act on a value — typing, clearing,
choosing — shows its verdict at once, and a second rule that delays one kind of act would be the
per-kind divergence this record was written against. The cost is that somebody who opens a picker,
presses Escape and stays on the field sees the message while still standing there.

**The panel is a field's focus scope, by the declared link.** `focusIsInsideField` reads the
opener's `aria-controls` and answers for the panel wherever it is drawn. Three renderers answered by
containment before it, which is the divergence this record names — a portalled panel read as
"outside" and an in-place one as "inside", from one contract.

**A contradiction resolved rather than left standing.** The canonical after-Escape expectation said
the opposite of this record in prose — *"abandoning an interaction does not touch the field"* — and
was the right answer to a different question: a person who *tabs past* a field has decided nothing,
which is now answered where it belongs. Once a traversal is silent, opening a panel and closing it is
the one gesture on these kinds that corresponds to filling a box and clearing it again, and the table
says so.

**Verification of the batch.** `npm run test`, `test:conformance` and `test:angular` are green. The
new checks are one per renderer — focus in, focus out, nothing typed, and a perimeter proving the
field can still speak — plus the submit channel in Angular and a contract-level check that a
portalled panel belongs to its field. Mutations: restoring `markAsTouched` on blur in one controller
turns three kinds red; replacing the paired mark with `markAsDirty` alone turns three checks red;
answering the focus scope by containment alone turns the portalled case red.

**Still not guarded**: that focus moves back to the opener *before* the panel is removed. It was
unenforced when this record shipped and it is unenforced now.

## Security and privacy

None. This decides when a message a person is entitled to see is shown to them; no data crosses a
boundary, and nothing here is reachable by anyone who cannot already see the form. Worth one line on
the adjacent risk: a verdict shown too early trains people to ignore it, and an ignored verdict on a
field that later holds something genuinely wrong is a correctness problem wearing an accessibility
one's clothes.

# ADR 0160: A form nests six levels deep, and the limit is about people

Status: Accepted

## Context

A layout may hold sections inside sections. `MDY_LAYOUT_MAX_DEPTH` has been `6` since nesting was
introduced, and nothing recorded why — so the next reader has no way to tell a measured limit from a
number somebody typed, and no way to answer the only question anyone actually asks about a limit,
which is whether it can be raised.

The question was put in those terms: *can it be increased or changed deliberately, taking calculated
risks?* A calculated risk needs a number, so the cost of nesting was measured rather than assumed:

```
depth        1     3     6     7    10    20
DOM nodes   11    15    21    23    29    49     ← exactly +2 per level, linear
indent      unchanged at every depth, out to 20
time        flat — no measurable mount cost at any depth
```

**Nothing in the machine justifies six.** The tree grows by two elements a level, the indent does not
grow at all, and nothing slows down. A limit defended on technical grounds would have to be defended
against these numbers and would lose.

The reason it survives is of another kind, and it came from an accessibility and interaction
specialist consulted without any knowledge of this repository: **nobody answers a question whose
applicability depends on six earlier answers.** Depth in a form is not a rendering cost, it is a
memory cost, and it is paid by the person filling it in — who cannot see the structure, only the
question in front of them, and who must hold every branch that led there to know whether it is being
asked of them at all.

A second fact surfaced while measuring, and it changes what this record has to decide. The limit was
enforced on **one** of the two public doors:

```
                          depth 6      depth 7
mounting a whole document mounts       refuses the mount
parsing a document        6 sections   fields kept, arrangement dropped, and said so
layout passed in code     6 sections   7 sections, in silence
```

Three behaviours for one rule, and only the third is wrong. The first two are the reader being the
reader: a document that mounts as a whole is refused as a whole, and a document read for its parts
keeps what it can carry and reports what it dropped — which is what the parser does with every other
malformed member, and the finding is exact:

```json
{"code":"MDY_DYNAMIC_INVALID_LAYOUT","path":"/layout/0","message":"layout nests deeper than 6 levels."}
```

The third said nothing at all. So the same form was legal or illegal depending on how it had been
written down, and the cap read as a property of the document format rather than of the framework.

That makes the answer to the question sharper than the question expected: **the cap could not be
raised deliberately, because it was being exceeded accidentally.** Somebody building structure in
code passed it without choosing to take a risk and without being told there was one.

## Decision

**Six levels, and the limit is about what a person can be asked, not about what a browser can draw.**
It is recorded here in those terms so that a future reader arguing about it argues about the right
thing — and so that measurements showing nesting is cheap are understood as beside the point rather
than as evidence for raising it.

**The limit holds at every door, in the shape that door speaks.** `assertLayoutWithinDepth` applies
it to a layout assembled in code as a `throw` naming the depth, the path and the reason: there is no
document to annotate, no partial result worth returning, and the caller is a programmer who can act
on it now. A document keeps being read the way documents are read — what cannot be carried is dropped
and reported, so a form still reaches the person with the questions it could keep.

The difference is deliberate and is not a softening. A parse produces findings for a caller that is
going to read them; a function call produces a value for a caller that is not. Silence is the failure
mode available only to the second, which is why only the second throws.

**It is not an option, and raising it is not a per-call decision.** A cap that any caller may lift is
a default rather than a limit: it is lifted once by whoever meets it first, in the moment they are
blocked, and never revisited.

## Consequences

- **A working programmatic call can now throw.** Anybody passing a layout deeper than six in code got
  a rendered form before and gets an error now. That is the point of the change and it is still a
  break: the changeset carries the migration, and the message names the depth, the path and the
  reason rather than only the rule.
- **Two shapes of refusal for one rule, permanently.** A document gets a diagnostic it can show
  against a path; code gets a thrown error. They must keep saying the same thing, and nothing but this
  record and a spec ties them together — if the number ever moves, both doors move or the framework
  contradicts itself.
- **Forms that genuinely need more depth have to be split into steps.** Real work for whoever meets
  it, and the cap is what makes them consider a shape the depth argument prefers anyway.
- **The cap is now a promise, so it is a thing to keep.** Before, it was a property of one reader and
  could have been softened without anybody noticing. Written down and enforced at every door, it is
  something consumers may build on — and raising it later is a change to what they were promised, not
  a relaxation of an implementation detail.
- **The reason is now falsifiable.** "Nobody answers a question that depends on six earlier answers"
  is a claim about people, and this record says so plainly rather than dressing it as a technical
  bound. Anybody with evidence to the contrary now has something specific to contradict.

## What raising it would take

Recorded because the question was asked, and because "no" without conditions is indistinguishable
from not having thought about it.

Raising the number is a one-line change and costs nothing this suite can measure. What would have to
be true first is not technical:

- **evidence that people complete such a form.** Not that a browser renders it — that is measured and
  the answer is yes at twenty. The question is whether somebody reaches the end of a branch seven
  conditions deep and answers correctly, and nothing in this repository can answer that. It needs
  people, and until then the number is a judgement rather than a finding;
- **a way for the form to say where the person is.** The argument against depth is that applicability
  becomes unholdable in mind. A structure that showed the branch — a trail, a summary of what has been
  answered — would move the cost off the person's memory and change the premise. Modyra draws no such
  thing today;
- **an owner for the difference.** If a product raises it, forms built at that depth stop being
  portable to a product that has not: the limit stops being a property of the framework and becomes a
  per-deployment fact that a document cannot carry with it.

Where a form genuinely needs more, the answer available now is to split it into steps. That is not a
workaround: a sequence of shallow forms is what the depth argument recommends, and the cap is what
makes somebody consider it.

## Alternatives rejected

**A configurable cap, defaulting to six.** The obvious answer to the question as asked, and it fails
on how a limit is used rather than on what it does: the person who lifts it is by definition the
person it has just blocked, deciding in the moment, for their own branch. What arrives in the product
is a form that is deeper than anybody chose, and a default nobody revisits.

**No cap at all, since nesting is cheap.** Defensible from the measurements alone, which is exactly
why the measurements had to be recorded here. It loses to the fact the measurements cannot see: the
cost is not paid by the machine.

**A warning rather than a refusal.** Would leave the form working and mark it as unwise, which reads
as a limit that is not one. Something warned about and shipped is shipped, and the person filling in
the form is not the one who saw the warning.

**Leave the programmatic door open, since it is the deliberate one.** This was the state before this
record and it is the alternative most easily mistaken for a design. Passing a layout in code is not
evidence of a deliberate choice about depth: nothing was said, so nothing was chosen. A limit
enforced at one entrance is a limit on file formats, not on forms.

## Verification

`assertLayoutWithinDepth` accepts one to six and refuses seven, naming the path at which the
structure passed it — measured at 1, 5, 6, 7 and 20, with `undefined`, an empty layout and a
non-layout as the control cases that must stay silent. `MDY_LAYOUT_MAX_DEPTH` is exported, so a check reads the number rather than
repeating it — a test spelling `6` would keep passing after the constant moved.

The browser tier holds a spec that mounts a structure through both public doors and requires the same
verdict from each, in all three renderers.

The `examples/plain` nested-questionnaire demo shows the refusal happening rather than describing it:
a demo of the happy path does not distinguish a tool that permits from a tool that prevents.

## Security and privacy

Slight, and worth stating rather than dismissing. A cap on nesting depth bounds recursion over a
structure that may arrive from outside — a stored document, a configuration fetched at runtime — so
it is also what stops a hostile or corrupt document from driving unbounded recursion during a parse.
That is a side effect of a decision taken for other reasons, and it is a reason the cap should be a
constant rather than a caller-supplied number: a limit an attacker's input can raise is not a limit.
No personal data is involved and no trust boundary moves.

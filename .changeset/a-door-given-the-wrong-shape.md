---
"@modyra/widgets": major
---

A door handed an object without the field it needs refuses, and says which

A **value** of the wrong shape is a verdict (ADR 0208): it is a person's data, the page survives it,
and the verdict channel reports it. An **argument** of the wrong shape is a defect in the calling
code, and a code defect is answered loudly, to the builder, rather than quietly to the page. Two
audiences, two policies, one coherence — a wrong shape never passes in silence (ADR 0211).

Measured, not supposed: in one evening six probes written by two sessions checking each other passed
the wrong input to a door or a fixture and **not one objected**. `fieldIsRequired` was handed a field
*handle* instead of a field *state*; a handle carries enough of the same names to satisfy a structural
parameter, so the answer was `undefined && …` — and `undefined` reads as "not required" to anyone who
has not read the signature. Four of the six produced a defect that did not exist, and one travelled
most of the way into a report.

Twelve doors now refuse an argument missing a field they declare as required, naming the field and
the shape expected. The roster is derived from each parameter's own shape rather than listed, because
a guard put on one twin and not the other is how a pair drifts.

Two kinds of door stay lenient, and both say so in their own declaration: one that declares an
**optional** field is stating that a partial object is legitimate — `fieldAccessibleName({ ariaLabel })`
is a caller asking exactly that — and one whose parameter is `… | null` is stating that absence is a
state it answers about, which is why `wayBackActionName` still takes null.

**Migration.** Pass the field's *state*, not its handle: `fieldIsRequired({ required, interactivity })`
where the call used to hand over the whole field object. Code that was already passing the declared
shape is unaffected; code that was not was receiving `undefined` and reading it as an answer.

Classified major because a call that returned `undefined` may now throw. The five renderers and the
full suites are unchanged — and the workspace's own demo was not: a lab panel passed
`fieldIsRequired` the required *flag* alone, so it had never once been told whether the field was in
play. It printed "not owed" for every kind and looked correct, because `undefined` is falsy. The
first caller this found was a demo rather than a renderer, which is the more useful warning to hand
on: a consumer relying on the quiet answer breaks at the call site instead of three layers away, and
the answer it was relying on may never have been right.

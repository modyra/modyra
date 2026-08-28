# ADR 0165: Empty is not wrong

Status: Accepted

## Context

A required chooser, empty, on a page that has just loaded. Nobody has reached it. Two parts of this
repository answered opposite questions about whether it announces itself as invalid, and each had a
check defending its answer.

```
showsAsInvalid({ valid, disabled })      !valid && !disabled   → true
visibleErrorsOf(handle, kind).length > 0                       → false
```

The select's field controller used the first at construction and in its binding. One renderer adopted
that controller's rule by hand and then **overwrote it**, with a comment saying why: *"asked as is
this field invalid it is true from the moment a required field is drawn empty, so a control announced
a refusal about a rule nobody had been given a turn at."* The override winning was the only thing
keeping that renderer's answer right, and it is the reason the controller sat unadopted.

Asked outside the repository, in ordinary words, whether a required empty field should announce
itself wrong on load:

**`aria-invalid` is a verdict on an act, not a state.** It says *this field contains something
wrong*. A field that is empty and never touched contains nothing: it is not wrong, it is not filled
in yet. `required` is the word for that, and a screen reader already announces it — adding "invalid"
says two things of which one is false.

**The long form is the demonstration, not the exception.** Twenty required fields announcing
themselves invalid to somebody tabbing through to learn what the form asks is not an edge case; it is
the same wrong rule repeated until it can be heard. The word is spent before the first real error,
and when a real one arrives it sounds like the other twenty.

**A value that arrived already wrong is a different case.** From a restored draft or a server, there
is no turn missing and there *is* something concrete that does not work. Somebody landing on that
field has to be told, or they skip it believing it fine — which is how a corrupted draft gets resent
instead of corrected.

## Decision

**Empty and never touched: silent.** `required` carries what is missing.

**Holding a value that is wrong: says so at once**, touched or not.

Both are `visibleErrorsOf`, which already answers exactly this — `errorsVisible` takes `touched` and
`holdsUnedited` and returns what is *shown*. So this is one call rather than two rules, and
`showsAsInvalid` remains what it is: whether the form would refuse this field, which is a different
question with legitimate other callers.

**One source, three outlets.** The attribute, the border and the message come from the same
"has a shown error" answer. Where they answer at different moments, somebody who sees and somebody
who listens get two different forms — one seeing a clean page while the other hears errors.

## Consequences

`createSelectFieldController` no longer reports `invalid` for a required field nobody has reached.
Two checks asserted the old answer and were changed with their reasons recorded rather than deleted;
one of them is a mutation spec, whose `correct` value **is** the declared right answer, so changing
it is the decision taking effect rather than a test being made to pass.

A consumer reading `state().invalid` as *the form would refuse this* now gets a different answer.
That reading has a name — `showsAsInvalid` — and it is still exported.

Not settled here, and named because it is adjacent and unbuilt: on submit, every empty required field
becomes an error at once, and the outside reading says that wants **one** announcement — "3 fields to
correct" — with focus on the first, rather than twenty. Nothing in this repository does that yet.

Nor is the visible half of `required` settled: a screen reader says "required" from a declared
attribute and there is no automatic visual equivalent, so a form without an asterisk or the word in
its label diverges the other way — the listener knows from the start, the viewer finds out on submit.

## Alternatives rejected

**Keep `showsAsInvalid` and let renderers override it.** What was already happening, and it is what
kept the controller unadopted: a rule the contract states and every consumer has to correct is a rule
stated in the wrong place. It also only worked where somebody knew to correct it.

**Announce on load and stay quiet after.** Not considered seriously once the reason was clear: the
moment a person can act is the moment the verdict matters, and load is the moment it matters least.

**A separate flag for "would be refused" alongside "shows as wrong".** The two already exist and are
already named. The defect was one of them being used where the other belongs, not a missing concept.

## Verification

`packages/widgets/test/select-field-controller.spec.mjs` — a required empty field answers `false`,
and the same field holding a bad value answers `true` without being touched.
`packages/widgets/test/controller-mutations.spec.mjs` carries the same rule as the declared correct
answer, so a controller that regresses to the old one fails as a mutation rather than as a diff.

Not verified: that the three outlets — attribute, border, message — agree in every renderer at every
moment. The rule is stated here and each renderer still decides its own painting.

## Security and privacy

None. Whether a field announces itself invalid changes what is said about a value, never what the
value is or who can read it.

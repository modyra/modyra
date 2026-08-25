# ADR 0154: A part's classes read the same from the record and from the accessor

Status: Accepted

## Context

Two people read the same part of the same contract half an hour apart and reached opposite
conclusions. Neither misread anything:

```
MDY_WIDGET_CONTRACTS.number.parts.control.classes   []
partClasses("number", "control")                    ["mdy-input-wrapper__inliner"]
MDY_FIELD_SHELL_CLASSES.control                     "mdy-input-wrapper__inliner"
```

**All three are published.** The record is what a reader inside the library reaches for; `partClasses`
is what a consumer calls and what a conformance audit runs against. So "does `number.control` carry a
class" had two correct answers, and which one you got depended on which door you came through.

The mechanism: `resolvePart` fell back to the shell's whole vocabulary **by name** when a part
declared no class of its own. And the two vocabularies disagree on one word — the shell calls
`control` the **box that holds** the control, `mdy-input-wrapper__inliner`, while a contract calls
`control` the control. So a text field's `<input>` was handed the class its container wears.

Measured: five parts of 263, all of them `control`, on the five kinds whose control is a bare
`<input>` — text, email, password, textarea, number. And measured in the page: the input does **not**
carry that class; its container does. So the accessor was not merely disagreeing with the record, it
was wrong — a selector built from it reaches an element the contract never named.

The catalogue itself already had the right table: `SHELL_CLASS_FALLBACK`, which lists the nine shell
parts a kind may inherit and deliberately does **not** list `control`. There were two fallbacks for
one question, and only one of them had been thought about.

## Decision

**A part's classes are the same whichever published surface is asked.**

`resolvePart` uses `SHELL_CLASS_FALLBACK` — the same table `define` uses when it builds the record —
rather than indexing the shell's class table by part name. A part with no class of its own resolves
to none, which is what the record says and what the page shows.

The general rule this instance stands for: **an accessor over a published record may narrow, format
or combine what the record holds; it may not answer a question the record answers differently.** Where
it would, one of the two is wrong and the disagreement is the evidence.

## Consequences

- **`partClasses(kind, "control")` returns `[]` for the five text-like kinds**, where it returned one
  class before. Anyone selecting a control that way was selecting its container; the selector was
  finding an element, which is why nothing failed.
- **A state on a class-less part still raises**, unchanged: `partClasses` refuses a state it has
  nothing to hang a modifier on, and that refusal is now reached by more parts.
- **Two fallback tables became one.** A shell part that a kind should inherit has to be added to
  `SHELL_CLASS_FALLBACK` deliberately, rather than appearing because its name matched.
- **The shell keeps using `control` for the box.** Renaming it is the deeper fix and a wider change:
  the word appears in themes, in every renderer's shell builder, and in the class name itself. This
  decision removes the place where the two meanings met, not the collision in the vocabulary.

## Alternatives rejected

**Make the record return what the accessor resolved.** The other way to close the gap, and it was the
first thing considered. Rejected on measurement: the class the accessor added is the container's, so
writing it into the record would make the contract state something the DOM contradicts — a contract
that describes an element that does not exist is worse than two surfaces disagreeing about one that
does.

**Document the record as partial by construction**, and point readers at the accessor. Rejected
because it keeps both answers available and asks every future reader to know which door is which. The
disagreement took two people who were actively talking to each other half an hour to resolve; a
sentence in a doc comment would not have shortened it.

**Rename the shell's `control` to `controlBox`.** The root cause, and it stays open. It touches theme
CSS, the class name `mdy-input-wrapper__inliner` itself and three renderers' shell builders, so it is
a batch of its own rather than a line in this one.

## Verification

- `packages/widgets/test/two-surfaces-one-answer.spec.mjs` — the general property over all 263 parts
  of all 17 kinds, plus the five that regressed and a guard against fixing it by returning nothing
  for everything. Restoring the old by-name fallback turns two of the three red.
- `pnpm run test:contracts` 27/27.

## Security and privacy

None. No trust boundary is touched, nothing is transmitted, and the change is to which class names a
published accessor reports.

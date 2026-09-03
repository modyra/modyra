# ADR 0200: A lint rule is loosened only to keep an intention already stated

Status: Accepted

## Context

`npm run lint` has been red for an unknown length of time, and no workflow runs it. A total run found
107 problems — 92 errors and 15 warnings across 73 files — and none of them had ever stopped anything.

Read by cause rather than by count, most were not defects in the code:

```
53  battle-tests/browser        the browser suite's own
13  site/.astro, site/public    a build's output, gitignored, zero files tracked
28  packages/**                 the library
```

And of the library's own, the largest group was the linter disagreeing with a convention this
repository states in the linter's own configuration. The rule carried the sentence *"the
leading-underscore convention marks them as intentionally unused"* and then honoured it for two of
the four forms that convention takes: arguments and caught errors, but not a binding
(`const { role: _role, ...withoutRole } = projected`) and not an inferred type parameter
(`infer _K`). The letter was narrower than the intention written one line above it.

The remaining groups were deliberate no-op hooks a subclass overrides, an idiom of a compile-time
type test, and a rule cited in the configuration that no plugin loads — "Definition for rule not
found", which is a defect of the configuration reported as a defect of the file.

## Decision

**A lint rule is loosened only where the loosening keeps an intention this repository has already
stated, and the statement is what the comment beside the rule must point at.** Not "this is noisy",
not "this fails a lot": the test is whether a sentence already committed here says the flagged shape
is deliberate.

Two loosenings meet it, and they are the ones taken:

- **generated output leaves the perimeter.** `site/.astro` and the Studio bundle copied beside it are
  written by a build and are gitignored. A finding there is a report about something nobody edits,
  and it cannot be repaired at the source because the source is a generator.
- **the underscore convention is honoured in all four of its forms.** The sentence was already in the
  configuration; only two of the forms were covered. `ignoreRestSiblings` is the same intention in
  the shape the code actually writes.

**And one that does not meet it, so it is refused.** The two Angular template accessibility rules —
`interactive-supports-focus` and `click-events-have-key-events` — are already warnings here, with a
reason recorded beside them: the combobox pattern keeps options non-focusable and puts the keyboard
on the trigger, which is what the widget keyboard contract declares and what ADR 0199's cursor
projection names. They are **not** turned off. The comment beside them says why in one line — *"kept
as warnings so genuinely new interactive elements still surface"* — and that sentence is the whole
value of the setting: a rule that is off reports nothing about the next element somebody adds.

Nor are they satisfied. Putting `tabindex` on the options to quiet them would break the pattern the
contract declares in order to silence a check, which is the trade this project refuses by default.

## Consequences

- Errors fall from 90 to 70 with no change to a line of product code. The remainder are the
  library's, and they are the work — not the configuration's.
- **Loosening before deciding whether this is a gate would be the worse order.** A red lint nobody
  runs and a green lint bought by loosening offer identical protection, and the second hides it
  better. So each entry above names what it keeps, and a future reader can tell a loosening that
  preserved an intention from one that removed a check.
- The rule cited and never loaded is a defect of the configuration, not of the file it accuses. It is
  recorded here and not repaired in the same breath, because removing it and loading its plugin are
  different decisions about whether this repository lints React hooks at all.

## Alternatives rejected

- **Making the code satisfy every rule.** It would have filled deliberate no-op hooks with invented
  bodies and renamed the bindings whose names are the documentation of their omission.
- **Turning the accessibility rules off.** They cost nothing as warnings and they are the only thing
  watching the next interactive element somebody adds to a template.
- **Making lint a gate in the same change.** Whether it becomes one is a separate decision, and taking
  it here would smuggle it in under a tidy-up.

## Verification

`npm run lint` before and after, on an unchanged working tree: 90 errors → 70, and the 20 that went
are the generated files and the underscore forms — no product line was edited to achieve it. The
accessibility warnings are unchanged in number, which is the check that they were not quietly
disabled: a loosening that removed them would show as a drop here.

## Security and privacy

None. Which findings a linter reports changes no shipped behaviour, no data and no trust boundary.
The one adjacent risk is the reason the accessibility rules stay on: a lint exemption written to
silence a keyboard-reachability warning would remove the only automatic notice that a new control is
operable with a pointer and with nothing else, which is the defect class this cycle spent a day
repairing.

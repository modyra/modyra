---
"@modyra/widgets": minor
---

Milestone C, at rest: **all seventeen kinds, all three renderers, one expectation, empty ledgers.**

`MDY_CANONICAL_AT_REST` covers the whole catalogue. Each adapter's suite mounts the widget and hands
over the root; nothing about a renderer appears in the expectation, which is the property that makes
it one suite rather than three that happen to agree.

The table is measured, not reasoned about. `parts` is what every renderer actually shows at rest —
an empirical floor, so one dropping a part is visible even where the contract would permit it.
`optional` is every other part the kind declares, because presence there depends on a free choice
(eager or lazy mounting) or on what the consumer supplied.

Building it took three passes, and each correction came from a renderer disagreeing rather than from
theory:

- **`supportingText` is not canonical.** Two renderers materialise an empty description box at rest;
  the third renders one only when content is supplied. The intersection has to be taken across all
  three, and taking it across two produced an expectation the third could not meet.
- **`optionWrapper` likewise** — one renderer emits it only for a custom option template.
- **`requiredMarker`, `prefix` and `suffix` are consumer-dependent**, not renderer-dependent: they
  appeared "extra" only because one fixture makes every field required and supplies affixes.

`aria-describedby` is deliberately not in any at-rest expectation, for the same reason it was dropped
from `select`: with nothing to describe, what it names follows from whether a renderer builds an
empty description element. It becomes normative once there is something to say.

Falsified by removing the label from one renderer's field shell: fifteen kinds fail.

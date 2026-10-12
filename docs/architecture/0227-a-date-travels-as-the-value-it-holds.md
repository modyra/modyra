# ADR 0227: A date travels in a form's payload as the value the field holds, not as its spelling

Status: Accepted. Amends [ADR 0152](0152-what-a-native-submit-sends.md) for the two date kinds.

## Context

[ADR 0152](0152-what-a-native-submit-sends.md) gave every kind a name to submit under, and put the
name on the control that shows the value. For a date that control is a text box, and a text box
shows a date the way the reader's locale writes one. Measured, every renderer, a range holding
`{ start: "2026-01-02", end: "2026-02-01" }`:

```
r.start = January 2, 2026
r.end   = February 1, 2026
```

A receiver given `01/02/2026` cannot tell the second of January from the first of February, and
neither can the sending side, which is looking at a field that holds the right answer. The single
date had already moved off its box onto a hidden input; the range had not, so the two date kinds
disagreed about what a date is on the wire.

Measured at the same time: Lit's datepicker sent its key **twice**, `d=January 2, 2026` then
`d=2026-01-02`. The shared control projection names every control it binds, and the step that
clears names on parts the shape does not submit from returned early for the hidden-input kinds. A
check that read the payload into an object kept the last value and saw one correct date.

## Decision

- A date kind submits from hidden inputs carrying the value the field holds, never from the box a
  person reads. `datepicker` and `daterange` both have the `hidden` submission shape.
- The `hidden` shape gains an optional `keys`. With keys, the value is read as a record and one
  input is written per key, named `path.key`, in the order listed. A range declares
  `keys: ["start", "end"]`, so its payload keys are unchanged from ADR 0152 — `path.start`,
  `path.end` — and only the values change, from the spelling to the ISO date.
- Every key is sent while the field is in play, empty where the member is absent: a half-filled range
  sends `path.end=` rather than omitting it. A disabled field sends nothing, as ADR 0152 states.
- For a hidden-shaped kind, `applySubmissionNames` clears the name on every control the contract
  declares. No visible box carries a key.
- `submissionEntries(kind, path, value)` states which pairs a value becomes, and
  `syncSubmission(host, kind, path, value, disabled)` writes them; renderers call the latter and do
  not restate how a value becomes keys.

## Consequences

- A receiver that parsed the localized text of a range now gets ISO dates. That is the point, and a
  breaking change for anyone who adapted to the old payload; the release notes say so.
- Text a person typed that the field could not parse is no longer submitted: the field holds no date
  for it, so the payload carries an empty end. Before, the unparsable text travelled. Validation, not
  the payload, is where an unreadable date is reported.
- The `split` shape no longer has a kind using it. It stays in the type, because removing it removes a
  form a consumer may switch on with nothing to replace it.
- A range now carries two more inputs in its subtree. Anything counting "the inputs of a range" counts
  hidden ones too unless it asks for visible boxes.

## Alternatives rejected

- **A new `hidden-split` shape.** Expresses the same thing as a second form a consumer has to learn
  and handle in every exhaustive switch. The smallest public surface is an optional member on the
  form that already means "the value travels in inputs of its own".
- **Leave the range on its boxes.** Keeps a payload a receiver cannot read without knowing the
  sender's locale, and leaves the two date kinds disagreeing.
- **Make the boxes' `value` the ISO date and keep the names on them.** The box is what a person reads
  and types into; making it hold a different string from the one it shows breaks the field.

The shape decision was made with the outside decision service on the stated principle of the smallest
public surface (option A, 94% confidence against a new form or no change).

## Verification

- `battle-tests/browser/what-a-form-sends-is-what-the-field-holds.spec.ts`, *a range sends the two
  dates it holds*, four hosts (plain, Lit, Vue, Angular): reads **every** payload entry, so a key sent
  twice fails it. Red before this decision in all four, and on Lit for the datepicker as well.
- `packages/widgets/test/submission.spec.mjs`: the range names no part, its entries are the held
  dates, both keys survive a partial or null value, the inputs follow the value and leave when
  disabled, and a datepicker's box loses an inherited name.
- `packages/vue/test/a-form-sends-what-each-field-holds.test.mjs`: the range's ISO payload.
- `npm run test:type-surface` records the shape change.

## Security and privacy

The payload carries the same information as before in a different spelling, under the same keys.
Unparsable text a person typed into a date box is no longer sent, which narrows what leaves the page.
No new trust boundary; a disabled field still sends nothing.

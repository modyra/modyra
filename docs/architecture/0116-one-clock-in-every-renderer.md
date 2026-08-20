# ADR 0116: One clock in every renderer

Status: Accepted

## Context

`renderTimepickerField` took `format = "12h"` as a parameter default, and `fields/index.ts` passes
`undefined` for it — so that default *is* what every document-driven Plain timepicker gets. A document
cannot ask for the other one: `mode` in `spec/dynamic-form-v3.schema.json` is multiselect-only,
`enum: ["single","multi"]`, and no field member carries a clock format.

So editing that parameter default was the only way to get a 24-hour picker out of Plain at all. It
was edited, and the four tests that broke were asserting the old default rather than a property.

The three renderers had each written the default down for themselves:

    packages/plain     renderTimepickerField(..., format = "12h")
    packages/angular   format = input<MdyTimeFormat>("12h")
    packages/lit       this.format = "12h"

Three copies of one decision, which is the shape that lets one document render a different clock in
each adapter — the divergence a shared contract exists to prevent.

## Decision

**Every renderer defaults to the 24-hour clock.** A host that wants the other passes `format: "12h"`,
which every renderer already accepts.

24 rather than 12 because of what a default is for. A document cannot yet name a format, so the
default is the *only* clock a document-driven form can get; the 24-hour clock is the one that names
every hour it draws without a second control, and the one most of the world writes. A 12-hour picker
needs its AM/PM control to be reachable to be usable at all, which is a second thing that has to be
right.

## Consequences

**A behaviour change for every consumer of all three renderers.** A form that showed `02:30 PM` now
shows `14:30` unless it asks otherwise. The migration is one option: `format: "12h"` in Plain,
`[format]="'12h'"` in Angular, `format="12h"` in Lit.

Four tests in Plain and four in Lit were rewritten rather than fixed: `13` is a valid hour now, so
"an hour past 12 is marked invalid" was asserting the default. What survives is the property in
24-hour terms — an hour past 23 is marked invalid, the arrows wrap at 23 → 00, the segments advertise
0–23, clearing is not an error.

**The gap this does not close**: a document still cannot ask for either format. With 24-hour as the
default the common case works, and the declarability gap is recorded as its own finding rather than
answered by adding a schema member alongside a release.

## Alternatives rejected

**Plain only.** It was Plain's default that was changed and Plain's wall that was hit. But a default
that differs between adapters means one document renders a different clock in each of them, and the
next reader finds three answers to one question with nothing saying which is right.

**Keep 12-hour and make the format declarable first.** The right long-term shape and the wrong order:
it leaves the only reachable default as the one the reporter could not use, and adding a contract
member is a batch of its own.

**No default — require the host to choose.** Turns every existing call site into a compile error to
answer a question most of them do not care about.

## Verification

- `packages/plain/test/timepicker-bounds.test.mjs` and `packages/lit/test/timepicker-bounds.test.mjs`
  — the segment bounds, the invalid entry, the wrap and the clearing, all in 24-hour terms.
- `packages/angular/src/lib/renderers/timepicker/` — the renderer suite, which drives the segments
  and the dial through the shared contract.

## Security and privacy

None. No boundary moves and no value leaves the process differently; a clock format is what a person
reads.

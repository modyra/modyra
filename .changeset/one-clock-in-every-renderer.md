---
"@modyra/plain": minor
"@modyra/angular": minor
"@modyra/lit": minor
---

Every renderer defaults to the 24-hour clock

The three renderers each wrote the default down for themselves — `"12h"` in all three, in three
places — which is what lets one document render a different clock in each adapter. And in Plain that
parameter default is the *only* clock a document-driven form can get: `fields/index.ts` passes
`undefined` for the format, and a document cannot name one, because no member of the field contract
carries a clock format.

All three now default to `"24h"`. A host that wants the other passes `format: "12h"` — `[format]` in
Angular, the `format` attribute in Lit — which every renderer already accepted.

**This changes what an existing form shows**: `02:30 PM` becomes `14:30` unless the host asks
otherwise. Four tests in Plain and four in Lit moved with it, rewritten in 24-hour terms rather than
patched: an hour past 23 is marked invalid, the arrows wrap at 23 → 00, the segments advertise 0–23.

A document still cannot ask for either format; with 24-hour as the default the common case works, and
that gap is recorded separately. See ADR 0116.

---
"@modyra/core": patch
---

The shared corpus pins how a calendar's locale is judged

`spec/fixtures/dynamic-form` gains one calendar document for each class of tag that the BCP 47 and
UTS 35 grammars treat differently. `en_US`, `x-private`, `i-klingon`, `zh-min-nan` and `root` are
refused as `MDY_DYNAMIC_INVALID_FIELD`, and `art-lojban` is accepted. The TypeScript, Java and Rust
readers agree on all six, and no reader's verdict changes.

Each verdict follows from the UTS 35 syntax alone, not from locale data. `root` has a four-letter
language subtag. `i-klingon` and `x-private` begin with a one-letter subtag. In `zh-min-nan`, `min`
fills a slot that only a region or a variant may fill. `en_US` uses an underscore. `art-lojban` is a
language followed by a variant. The TypeScript verdicts were generated with `Intl.getCanonicalLocales`
on Node 24.21 with ICU 78.3, and the schema audit derives them again on every run, so an engine that
answers differently fails the audit instead of passing silently.

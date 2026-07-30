---
"@modyra/angular": patch
"@modyra/styles": patch
---

The select's list is placed by the contract, not by a copy of it

Closing the colours-palette debt turned up the same shape one widget over. The foundation carried a
second implementation of the popup primitive for the select list: `.mdy-select__dropdown` positioned
itself `absolute` at `top: 100%` while closed, and a sibling rule re-read every `--mdy-overlay-*`
property to switch it to `fixed` while open. Both said what `.mdy-overlay` already says.

That duplicate is also why nobody noticed the class was missing: Angular's select popup wore
`mdy-popup` but not `mdy-overlay`, and the copy was quietly doing the primitive's job. The
framework-free and Lit renderers have carried both all along. Angular's does now, and the two rule
blocks are gone.

Measured before and after, across all four stylesheets — `modyra`, `modyra-modern`,
`modyra-material`, `modyra-ios` — the list's position, offset below its control, width against the
trigger, left edge, radius and background are **byte-identical**. The duplication went; nothing
moved.

A census while there: `multiselect`, `datepicker` and `timepicker` still carry the same copies, and
so does every widget's `--overlay` modal block. Recorded rather than swept in — each is a renderer
class plus a stylesheet block, and each deserves its own before-and-after.

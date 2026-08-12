---
"@modyra/plain": patch
---

The conformance kit answers all ten sections for the framework-free renderer.

`npm run test:conformance-browser` reported eight of ten: *Declared rules reach the control* and
*A value the options do not contain is shown* printed "not run — the config does not export
`declaresRules`". The browser config re-exports the Node config's `mount`, and those two sections ask
the **fixture**, not the page — so the flag simply had not travelled with the function it belongs to.
The same renderer was described twice, and one description was missing a word.

It now reports `CONFORMANT · 17 kind(s) · 10 of 10 section(s) run`, keyboard behaviour and the
accessibility audit included.

Closes finding S (`docs/contract-gaps.md`).

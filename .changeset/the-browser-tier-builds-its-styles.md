---
"@modyra/core": patch
---

The browser battle tier builds the stylesheet it copies

Second missing build in the same chain: with core built, the host build reached
`packages/styles/dist/modyra-default.css` and found nothing there. `battle:browser` and
`battle:browser:ci` now build styles too. Verified by deleting `packages/core/dist` and
`packages/styles/dist` and running the CI script in its exact form: 191 green, 59 red, 0 new.

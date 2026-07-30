---
"@modyra/studio-codegen": minor
"@modyra/studio-target-angular": patch
"@modyra/studio-target-react": patch
"@modyra/studio-target-json": patch
---

Exporting an arranged form no longer loses the arrangement in silence

Planned as "the code generators pass `layout` to the component they emit". They emit no component:
both targets produce a form *module* — a schema, its validators, and the stubs they reference — and
no markup at all. There is nowhere for an arrangement to go, which is a reasonable thing for a
target to be.

Losing the work without saying so is not. A form arranged over four breakpoints exported as a flat
schema with nothing said about it, and the first anyone found out was when they rendered it.

`arrangementDiagnostics` reports the loss through the channel every other target limitation already
uses: one `info` diagnostic naming how many layout nodes were dropped, that the JSON target carries
them, and that `layoutNodeAttributes`/`layoutSlotStyle` apply them to your own markup. `info`, not a
warning — a target that does not draw has not failed, and an arranged project stays compatible.

`TargetCapabilities` gains an optional `supportsLayout`, false by default because most targets emit
no markup. The JSON target declares it, since it serialises the whole contract and `layout` is part
of the contract — and the test checks the layout is genuinely in the emitted `contract.json` rather
than merely unreported.

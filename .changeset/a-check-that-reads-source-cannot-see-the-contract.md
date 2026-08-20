---
"@modyra/widgets": patch
---

The theme class audit resolves a state class composed from the contract

`audit-theme-classes.mjs` reads renderer sources for class names as literal text. Angular writes
`[class.mdy-input-wrapper--disabled]`; Lit stopped writing it and started composing it from
`MDY_FIELD_STATE_CLASSES.control` and `.controlStates` — the right change, and the class is still on
the element. Read as text it looked like a renderer that had dropped the state, so the gate reported
**11 classes missing across 9 kinds** and punished exactly the refactor it exists to encourage.

Confirmed at runtime before changing the gate: a disabled Lit field's wrapper reads
`mdy-input-wrapper mdy-input-wrapper--disabled`.

The scanner now resolves the three published base/modifier families the way it already resolved the
chip alias — a member read off a published constant is as literal as the constant. Not an allowlist:
eleven entries would hide the pattern, and the next renderer that does the right thing would hit it
again.

**What it still cannot see**, stated rather than discovered: a renderer that reaches for the family
and then composes it wrongly. Falsified in both directions — a renderer that stops referencing the
vocabulary is still reported (the 11 come back), and one that references it is credited with the
whole family. A conformance check that reads source cannot see a contract being honoured *through*
the contract, and cannot see it dishonoured there either; only a rendered DOM can.

---
"@modyra/widgets": major
"@modyra/plain": patch
---

A timepicker segment names the control inside it.

`hour` and `minute` are the containers the header lays out. Each holds the `<input type="number">` a
user types into, and that input was not a declared part — so no anatomy, relation, state or
equivalence check reached it. A segment holding a bare `<div>` conformed.

`hourControl` and `minuteControl` are now optional parts with the `input` semantic, parented to their
segment and carrying `mdy-timepicker-segment-input`. The catalogue change alone is **minor**: they
describe elements every renderer already drew.

**The breaking half is `projectTimepickerFieldA11y`.** Its `hour` and `minute` parts carried
`role="spinbutton"`, `aria-label` and `aria-valuenow` — control semantics on a container — and a
renderer applying them to its input ended up with two elements claiming to be `hour`. The projection
now returns four parts where it returned two:

| part | apply to | carries |
| --- | --- | --- |
| `hour`, `minute` | the segment container | its classes and the `focused` state |
| `hourControl`, `minuteControl` | the `<input>` inside it | the id, the control class, `role="spinbutton"`, `aria-label`, `aria-valuenow` |

**Migration:** a renderer that applied `parts.hour` to its hour input should apply
`parts.hourControl` there instead, and `parts.hour` to the segment around it. Same for the minute.
Applying only the old two leaves the input with no role and no accessible value, and TypeScript will
not report it — the attributes moved rather than disappearing.

Two resolver defects surfaced with it. `inspectWidgetDom`'s fallback lookup matched parts on classes
alone, so two parts sharing a selector each resolved to both elements — `daterange`'s `startControl`
and `endControl` had the same hole. Both resolvers now read one rule, declared order among the parts
that share a selector.

The decision behind this is [ADR 0014](https://github.com/modyra/modyra/blob/main/docs/architecture/0014-the-contract-names-the-responsible-element.md): the contract names the element responsible for something, not the region containing it.

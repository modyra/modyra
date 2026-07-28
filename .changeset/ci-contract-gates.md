---
"@modyra/widgets": patch
---

Record the extended catalog anatomy in the completeness evidence (the boolean wrapper, the
multiselect wrapper, the calendar's weekday header and week rows, the colour picker's ordering) and
gate it permanently: `npm run test:contracts` runs the golden Angular surface, the completeness
evidence, the widgets suite, the framework-free renderer's catalog and DOM conformance and the
readiness audit, and CI runs it alongside the Studio suite.

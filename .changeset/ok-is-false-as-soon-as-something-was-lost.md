---
"@modyra/core": major
---

`ok` is false as soon as something was lost

`parseDynamicForm` reported `ok: true` beside a diagnostic it had graded `severity: "error"`. A
document putting a condition inside the field it governs — where a person puts it the first time —
had the condition dropped and the field kept, and said the parse succeeded. A consumer mounting on
`ok` then rendered a conditional field with no condition.

`ok` is now `!diagnostics.some((d) => d.severity === "error")`, in either mode.

It is not a statement about usability. A lenient parse still returns everything it could read, and
`fields`, `acceptedCount` and `rejectedCount` still say how much that was. What `ok: false`
withdraws is only the claim that nothing was lost.

**Migration.** A lenient caller reading `ok` will see `false` for documents that reported `true`.
Nothing in the type changed, so a build will not point at it. If you want the previous behaviour —
"the envelope was understood" — read `version !== null` instead. If you want "is there a form to
mount", read `fields.length`. Strict-mode callers are unaffected: `ok` there already required zero
refusals.

See ADR 0184.

---
"@modyra/core": patch
---

A field a schema declared is no longer destroyed by the control that showed it.

A renderer claims a field when it mounts a control and releases it when that control is destroyed —
an `@if` closing, a wizard step leaving, a tab switching. The engine took the last release as
permission to delete the field, and then:

```js
form.fieldNames();   // the field is gone
form.getValue();     // throws: "Flat value does not match schema shape"
form.state.valid();  // true — nothing left to fail
```

A form that crashes on read and calls itself valid, from an arrangement every application has.

The engine already refused to do this inside a keyed collection, and its reason applies one level
out: *the field belongs to the row, not to the controls that happen to be showing it.* A field a
schema declared belongs to the schema. It is now recorded as owned — by the typed form for its
fields and groups, by an array manager for the leaves of a row — and a control releasing its claim
releases the showing of the field, never the field.

**A field a control invented still dies with it.** In the declarative mode `name="adhoc"` is the only
place a field is ever mentioned, so the control is its owner; making those immortal would fill a
long-lived form with ghosts. That case is asserted alongside the others.

Only Angular could reach the defect in practice — the framework-free and Lit renderers never call
`removeField` — but the cause was in the engine, and so is the fix.

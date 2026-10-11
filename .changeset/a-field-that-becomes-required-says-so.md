---
"@modyra/react": patch
"@modyra/preact": patch
---

A field that becomes required re-renders the component that reads it

The field hook returns `required` and `constraints` for `aria-required` and native bounds on your own
control, but the store a component subscribes to did not watch them. A rule that made a field
required, or bounded it, left the control describing the old rule until something else changed. The
store now watches both.

`useMdyDynamicForm` applied the document's validators in an effect, so the first render, and every
server render, saw the fields as not required and the form as valid, and the server's markup
disagreed with the hydrated client. The validators are now applied when the form is created as
well, and still re-applied when `fields` changes.

No migration.

---
"@modyra/react": patch
"@modyra/preact": patch
---

A field and a widget keep answering under React Strict Mode

In development Strict Mode mounts a component, runs its effect cleanups, and mounts it again with the
same memoized values. `useMdyField` destroyed its store in that cleanup, and the widget hooks
destroyed their controller there, so what the remount held was dead: the field rendered once and then
never again, and a select field stopped following its form.

A field store now observes the form only while something is subscribed to it. It stops at the last
unsubscribe and resumes at the next subscribe, and `useMdyField` no longer destroys it. A widget
controller that comes back from a cleanup is built again before the component renders with it.

Preact has no Strict Mode rehearsal. Its store gets the same lifetime so that the two exported
functions behave alike. No API changes; nothing to migrate.

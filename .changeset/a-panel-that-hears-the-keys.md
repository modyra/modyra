---
"@modyra/lit": patch
---

Escape closes a multiselect from inside its own panel

A person who opened the list, typed to narrow it and then changed their mind had no keyboard way
out. `Escape` closed it from the trigger and did nothing from the search box — which is where they
are, because opening the list puts them there.

The panel is drawn outside the element that binds the field's keys, so a keydown inside it bubbled
somewhere else entirely and reached no handler. Every other kind closed from both places; this one
was measured against them in the same run, which is the only way the difference shows — each
renderer is consistent with itself.

The panel now hears the same keys the field does.

Guarded by a new check in both this renderer and the framework-free one: after any panel closes,
focus is inside the field and never on the document. It presses the close from *inside* the panel,
because a close with focus still on the opener cannot send focus anywhere — the first version of
the check did exactly that, and passed against a renderer that restored nothing.

ADR 0167 records the rule underneath: a field's boundary follows the link its opener declares to its
panel, not where the panel sits in the document. Two renderers that answer "has this field been
left" by walking the tree give different answers for the same contract, and only a run that puts
them side by side shows it.

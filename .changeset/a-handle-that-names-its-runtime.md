---
"@modyra/angular": patch
---

A handle from `mdyForm()` names the runtime that owns it

A widget controller resolves which reactive runtime to observe a field handle through by asking the
registry that handle was registered in. The handles `mdyForm().f.*` hands out were registered against
their *form* but never against their *runtime*, so `observerFor` fell back to a fresh vanilla runtime:
the controller's own state — a timepicker's draft, a select's query, a calendar's month — lived on
signals an Angular `computed` cannot read.

Under Zone.js this is invisible. Zone redraws on every event, so a template binding that never
established its dependency is repainted anyway and shows the right thing for the wrong reason. Without
Zone.js the display simply freezes: on a timepicker the arrows, a dragged hand and a clicked number
all move the draft and commit correctly, and the face never moves.

The handles are now registered through the same `_own` the rest of the form's shapes use, which
records the runtime as well as the form.

One consequence worth stating: a form built outside an injection context has no `Injector`, so its
controllers' effects are now reported as unavailable (`MDY_EFFECTS_UNAVAILABLE`) rather than silently
running on a runtime whose signals nothing else could see. The diagnostic is the honest form of what
was already not working.

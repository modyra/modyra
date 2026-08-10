---
"@modyra/angular": patch
---

A control rendered outside a form now says which control it is.

`NG0201: No provider for InjectionToken MDY_FORM_ADAPTER` is true and unhelpful: it names the token,
never the control, and the one that escaped the form is exactly the one that has to be found. The
error now reads `<mdy-control-text> bound to "email" is outside a form`, and says that a control
must be a descendant of `<mdy-form>` — including when it is rendered into an overlay or a dialog
body, which is where this usually happens.

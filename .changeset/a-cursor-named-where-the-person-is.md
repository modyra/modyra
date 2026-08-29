---
"@modyra/lit": patch
---

A cursor named where the person is standing

Lit's multiselect put `aria-activedescendant` on the trigger while opening the list moves the keyboard
into the filter box. A reference on an element a person is not standing on says nothing: the cursor
moved through the options and the one element that could have announced it was not the one being read.

It is on the filter box now where there is one, and stays on the trigger where there is not — which is
the rule Plain already states in its own comment.

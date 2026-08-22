---
"@modyra/angular": minor
---

`<mdy-dynamic-form>` takes an id scope

Ids come from the field's path, so two forms built from one document claim one set of them, and the
library said so — advising `[idScope]` on the controls. A consumer of `<mdy-dynamic-form>` has no
controls to bind it on: the component builds its own. The advice was correct for someone assembling
controls by hand and impossible for everyone using the door the package advertises.

The component now takes `idScope` and forwards it to every control it renders, which is the shape
plain has had at its own document-level door. The collision warning names both routes.

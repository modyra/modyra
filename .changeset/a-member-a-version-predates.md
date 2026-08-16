---
"@modyra/core": minor
---

A member a version predates is named, not ignored

Version 1 of the Dynamic Form Contract is a flat field list: `layout`, `rules` and `validations` are
not in its vocabulary. An envelope that carried one had it dropped without a word — so an author who
wrote rules against the wrong version number got a document the parser called clean, a lint with
nothing to report, and a form where the rules simply were not there. All three places they could have
learned were quiet.

`parseDynamicForm` now reports `MDY_DYNAMIC_UNSUPPORTED_VERSION` against the member's own path,
naming it and the version that has it. A v1 document that stays inside its vocabulary is unaffected,
and the same members at version 2 or 3 are read as before.

In strict mode this refuses the document, which is what strict mode means: a partly valid document is
never accepted, and a document whose rules will not run is exactly that.

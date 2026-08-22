---
"@modyra/lit": patch
---

The datepicker and daterange elements run their base's update pass

Both overrode `updated()` without calling up, so everything the base does after a render was skipped
for those two kinds: the control's accessible name was never applied, and a page carrying an id twice
— two forms built from one document, which is what `id-scope` exists for — went unreported. Every
other element in the package already called up; these two did not.

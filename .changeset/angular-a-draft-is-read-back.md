---
"@modyra/angular": patch
---

A draft is read back, not only written.

`<mdy-form>` enabled the draft while constructing, and a declarative form holds no fields until its
controls have claimed them. The engine names a form by the paths it holds, so the restore compared a
draft written by a form of one field against a form of none, refused it as another form's work —
correctly, by its own rule — and the page came up empty while the draft sat in storage untouched.

The writing half worked throughout, which is what made it look like it worked: a consumer watching
storage fill had every reason to believe the feature was fine, and the person who needed it found out
at the moment they could least afford to.

The draft now starts after the first render, when the form has the shape it will keep.

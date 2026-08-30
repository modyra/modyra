---
"@modyra/core": minor
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
---

A verdict is said to somebody who has been at the field

Two renderers disagreed about when a refusal reaches a person, and each was half right. plain showed
every error the moment the form was mounted: a required field nobody had reached was painted red and
told them so, which is being told off for arriving. lit showed none until the field was touched: a
value arriving from a draft or a server that the field cannot hold left the control marked wrong with
the reason withheld — over something the person never typed and cannot correct without being told.

**Neither could do better, because nothing distinguished the two kinds of refusal.** A rule the person
has not answered yet and a value already in the field are both "invalid" and are not the same news.

- **`MdyFieldError.origin` gains `"shape"`**, and `valueShape` marks its refusals with it. A validator
  can now declare the origin of what it refuses; where it declares none, the origin is `"validation"`
  as before. **If you switch exhaustively on `origin` with no default, add the case.**
- **`errorsVisible` answers the question it was always asked**: shown once the field is touched, or
  immediately for a refusal about what is already there — `shape`, `server`, `entry`. A person can
  neither cause those by inaction nor see the reason unless it is said.
- **`visibleErrorsOf` is exported**, because nine plain call sites were each deciding it separately.
- **`aria-invalid` follows what is shown, not what is wrong.** A control marked wrong beside a message
  nobody rendered is a verdict with no explanation. Every field projection reads the same rule.

Also in lit, found by the specs this unblocked: a multiselect never marked itself touched on blur, a
checkbox's label carried no error class, and a native select pointed `aria-describedby` at nothing —
so its refusal was announced with no way to read it.

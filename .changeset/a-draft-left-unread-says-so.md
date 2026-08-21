---
"@modyra/core": minor
---

A draft left unread says so, under `MDY_DRAFT_NOT_RESTORED`

A stored draft whose recorded form shape is not this form's is left where it is rather than restored
— that is ADR 0107, and it is right: the form that wrote it can still read it. What was missing is
that nothing said so. A consumer could not tell a key holding **nothing** from a key holding work
this form declined to read, and the two need different answers: the first is a fresh start, the
second is somebody's typing still on disk that nothing will offer them again.

The shape moves for ordinary reasons — a field added, a collection row arriving from a server — so
this is not a tampering path. The neighbouring case already reports per field: a draft entry the form
cannot hold arrives on `onViolation` as `draft-shape` with the path, and the rest is restored. A whole
draft going unread was the quieter half of the same story.

`MDY_DRAFT_NOT_RESTORED` is published beside `MDY_DRAFT_KEY_IN_USE`, and reaches a `diagnostics` sink
by code and the console by sentence, as the other draft diagnostics do. The message names `version` in
the draft options, which is the deliberate spelling of "this shape change was intended".

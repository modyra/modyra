---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
---

A daterange keeps what is typed into it. Its two text inputs took keystrokes and discarded them: a
well-formed range typed into them left the value at `{ start: null, end: null }` and both boxes
empty, so a person who typed a range, tabbed away and saw nothing had no way to learn that the
calendar was the only door. Both renderers did it, so the repair is in the shared controller: a
`type` intent carries one end as **text**, `parseEntry` reads it in the host's locale, a half-written
range is held as a half-written range, and text the field cannot read stays on screen in
`state.entryText` where it can be corrected instead of being erased on the way out.

**Breaking for a consumer that builds `MdyDaterangeFieldState` itself**: `entryText` is a required
member, as it already is on the datepicker's state. Reading the state is unaffected. A renderer that
parses text itself and dispatches only on success should dispatch `{ type: "type", end, text }`
instead — that is what made an unreadable entry vanish.

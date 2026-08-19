---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
---

A timepicker holds a time the form can hold. It committed the value in the notation it displays, so
a twelve-hour picker — the default — handed the form `"02:30 PM"`, which is not what
`MDY_VALUE_CONTRACTS.timepicker` declares a time is: the field was invalid the moment it was
answered, with "This field holds a time (HH:mm)" beside a value the user picked from its own dial,
and the payload carried a notation nothing downstream parses. The value is canonical `HH:mm`
wherever it is held; which notation a person reads is the field's own, projected as
`state.display`.

**Breaking for a consumer that builds `MdyTimepickerFieldState` itself**: `display` is a required
member. A renderer should paint `state.display` rather than `state.value`, which is what keeps a
twelve-hour control from showing a twenty-four-hour time.

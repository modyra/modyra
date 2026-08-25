---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A form built with these controls now submits

Put these controls in a `<form>`, press a submit button, and the browser sent **nothing** — measured,
all three renderers, `new URLSearchParams(new FormData(form)).toString()` returning `""`. A control
without a `name` is not serialised, and no control wrote one.

Every kind now declares how its value is submitted, and the key is the **field's path** — `colour`,
not the scoped widget id. Ten of the fourteen kinds measured now send their value identically in
plain, Lit and Angular.

**`radio` and `segmented` change what they send.** They were the two kinds that already carried a
name, and it was the scoped id: `f3a9-colour=b` becomes `colour=b`. A consumer parsing the old key
has to change. The scope keeps the job it was added for — outside a form, where nothing is submitted
and the name only groups the set, it is still used.

**A checkbox says what it means.** An unchecked box is absent from a payload in HTML, so `false` and
"never sent" arrived identical; and a checked box with no `value` sends `on`. A boolean now sends its
model value, with a hidden companion carrying `false` under the same key ahead of it — so the key is
always present, and when checked the later value is the answer. Both are disabled with the field.

**`select` and `multiselect` gained hidden inputs**, because they draw no form control at all. One
per value, in order, so a multiselect keeps both.

New in `@modyra/widgets`: `submissionFor`, `submissionNames`, `submissionDefects`, `submitFalsePart`,
`groupSubmitName`, `syncSubmitValues`, `MdySubmissionShape`. `checkbox` and `toggle` gain an optional
`submitFalse` part.

Still sending nothing in plain and Angular: `datepicker`, `daterange`, `timepicker`, `colors`. In Lit
`daterange` and `colors` send their value twice under one key. See ADR 0152.

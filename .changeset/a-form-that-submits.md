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
not the scoped widget id. Thirteen of the fourteen kinds measured now send their value identically in
plain, Lit and Angular.

**`radio` and `segmented` change what they send.** They were the two kinds that already carried a
name, and it was the scoped id: `f3a9-colour=b` becomes `colour=b`. A consumer parsing the old key
has to change. The scope keeps the job it was added for — outside a form, where nothing is submitted
and the name only groups the set, it is still used.

**A checkbox says what it means.** An unchecked box is absent from a payload in HTML, so `false` and
"never sent" arrived identical; and a checked box with no `value` sends `on`. A boolean now sends its
model value, with a hidden companion carrying `false` — so the key is always present. The companion
goes quiet while the box is ticked, so the payload carries **one** key either way: `ok=true` or
`ok=false`, never both, and nothing at the receiving end has to know which repeat wins.

**If you select controls by position, check your selectors.** `select`, `multiselect`, `checkbox` and
`toggle` now render a hidden input, so a field can hold more inputs than it used to. The hidden one is
always placed **after** the visible control, so `querySelector("input")` and `.first()` still find the
control a person can see — but `querySelectorAll("input")[2]` may now be a different element than it
was. `input:not([type="hidden"])` is the selector that survives either way.

**`select` and `multiselect` gained hidden inputs**, because they draw no form control at all. One
per value, in order, so a multiselect keeps both.

New in `@modyra/widgets`: `submissionFor`, `submissionNames`, `submissionDefects`, `submitFalsePart`,
`groupSubmitName`, `syncSubmitValues`, `MdySubmissionShape`. `checkbox` and `toggle` gain an optional
`submitFalse` part.

Thirteen of the fourteen kinds measured now agree across plain, Lit and Angular. The one that does
not is `datepicker`: Angular sends `01/02/2026` where the other two send `2026-01-02` — the text the
box shows rather than the value the model holds. The name is right in all three; what the control's
`value` carries is a divergence that predates this and is now visible. See ADR 0152.

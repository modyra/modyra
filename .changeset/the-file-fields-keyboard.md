---
"@modyra/widgets": patch
---

The file field's keyboard, and the one question a browser test can only record.

Three behaviours are now asserted in a real browser: the browse affordance is reachable from the
keyboard, it is a real `<button>` rather than a styled `div` — the difference a screen reader and the
Enter key both notice — and the tab order is measured rather than assumed.

Opening the picker ends in a native OS dialog Playwright cannot see, so "Enter opens the file
chooser" is deliberately **not** asserted. A green there would mean nothing.

**Measured and recorded, not decided**: both the hidden `input[type="file"]` and the browse button
are tab stops, so a keyboard user meets one affordance twice — once announced as "choose file", once
as "Browse". The input is visually hidden by the clip technique, which keeps it focusable on purpose,
and the button forwards clicks to it. Which element should own the affordance is a genuine design
question with two defensible answers — the contract's `label[for]` names the input, but the button is
the one a sighted keyboard user can see themselves land on — so the test pins the current state and
says so, rather than settling it in passing.

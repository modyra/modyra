---
"@modyra/studio-ui": patch
---

Two rows at `sm` and one at `md`, from the same three fields — proved and kept proved

Reported as not being able to set different layouts between SM, MD and LG. Driven end to end in
Studio, it works: a row of `username`, `password` and `mail` told to be **two tracks wide at `sm` and
three at `md`** draws username and password together with the mail below at `sm`, and all three on
one line at `md`. A row is a grid, and a grid wraps — the third field goes to a second line when
there are only two tracks for it.

The regression test asserts it from the **drawn cells**, by their measured y positions, rather than
from the width control. The per-breakpoint tests already covered what the control says; this covers
what the form does with it, which is the half a user actually sees. It also re-checks `sm` after
setting `md`, because "each size holds its own arrangement" is the property that made this worth
authoring per breakpoint in the first place.

No behaviour changed. What was missing was the proof.

Worth knowing, and not changed: a row offers as many track counts as it has fields, so **a row of two
fields can only take two distinct widths across four sizes** — at least two sizes must match. Whether
a row should be able to declare more tracks than it holds, with Contract v3's per-slot `column`
placing fields into the gaps, is a product decision rather than a defect.

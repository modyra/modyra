---
"@modyra/widgets": minor
"@modyra/styles": patch
---

A field says it is unusable in one vocabulary, and the audit can read both halves.

`MDY_FIELD_STATE_CLASSES` names `mdy-input-wrapper--disabled`, which is true of ten kinds and false
of seven: `checkbox`, `toggle`, `slider`, `radio`, `segmented`, `multiselect` and `file` have their
own wrapper class, so the themes reach those states **structurally** instead —
`.mdy-checkbox__control:disabled + .mdy-checkbox__indicator`, `.mdy-slider:disabled`. Both mechanisms
are legitimate. Only the first was checkable, so for seven of seventeen kinds half the expression of
"this field is unusable" sat outside everything this repository audits.

`MDY_STATE_EXPRESSION` declares which mechanism each kind uses, and the style audit checks the
declared one. Giving those seven wrappers state classes instead would have been wrong twice over: it
mints seven classes no theme paints, and it contradicts `statesFor`'s rule that a part redeclaring
its class does not inherit the shell's states — narrowed one batch earlier, and verified here to
still throw.

**It found a defect on the first honest run.** `file` reaches its states by neither mechanism: twelve
declared classes and **no theme rule anywhere** touching `:disabled` or `aria-invalid`. A disabled
file field looked exactly like a usable one, and an invalid one exactly like a valid one, in all four
themes. The dropzone now dims when its input is disabled and takes the error border when it is
invalid — reached structurally, the way its six siblings already are.

The declaration states what a kind is **expected** to do, not what the themes were found doing. That
distinction is the reason the gap surfaced instead of being written down as intended.

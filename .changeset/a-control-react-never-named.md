---
"@modyra/react": minor
---

A document can name a React control, and the contract decides how

The conformance kit asks every renderer the same question: a document declares what this control is
called and takes its caption away — is the control announced by that name? React answered no for all
seven kinds it is asked about, and a control announced as nothing is not a small defect: it is a
field a screen reader cannot introduce.

`MdyTextField` and `MdyBooleanField` accept `ariaLabel`, and `MdyTextField` accepts `step`. Both are
declarations rather than rules — they change what the control offers and never refuse a value — which
is why `step` is here and `min`/`max` are deliberately not: those refuse a value, which makes them
rules, and a prop that quietly validated would blur the line the two channels exist to draw.

**The name is not written here.** It is handed to `fieldNameAttributes`, which decides whether the
control carries `aria-labelledby` or `aria-label` and never both — because two names on one element
is not two names: the computation takes the reference and stops, and the `aria-label` beside it is
text nobody will ever hear. Lit, Angular and Plain already ask that door; React was the renderer that
asked nobody.

Measured with the kit: react goes from 8 of 13 sections to **11 of 13**, conformant, with the two
other new answers being a field the kit can now disable and ids it can scope. Each half was mutated
separately and takes down exactly its own kinds — the text control's name, five; the box's, two; the
stride, one.

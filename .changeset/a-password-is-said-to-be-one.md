---
"@modyra/widgets": minor
"@modyra/core": minor
"@modyra/plain": patch
---

The contract says a password is not a text field: `MDY_WIDGET_CONTRACTS[kind].controlType` names the
native control a kind is drawn with, and `concealed` — on the widget contract and on
`MDY_VALUE_CONTRACTS` — says the control does not show what is typed into it. The one difference
between the two kinds was said nowhere a renderer could read it, so every adapter kept a private map
from kind to input type and the failure mode of one that does not is a password in clear text.
`@modyra/plain` reads the contract instead of its own map. Both members are optional; nothing an
adapter does today breaks. See ADR 0099.

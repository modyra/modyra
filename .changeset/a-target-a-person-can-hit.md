---
"@modyra/styles": patch
"@modyra/lit": patch
---

A chip's remove button is a target a person can hit, and pressing a chip's body does one thing.

**The target.** The ✕ measured 32×22 — two pixels short of the 24 CSS px **2.5.8 Target Size
(Minimum)** asks for, because the chip is 24 tall counting its own border and the button inside it
took `height: 100%` of what was left. The spacing exemption was unavailable: the nearest other target
is 13px away. The button now states a 24px floor and grows into the chip's border, so the row does not
grow around it.

Two pixels is not a rounding error for the people that criterion exists for. Aiming for the middle is
the only strategy a head pointer or a switch has, and the control beside this one deletes a value.

**The body.** `@modyra/lit` opened the list when a chip's body was pressed, where the other two
renderers focused the chip and left the list closed. Its box asked whether the press had crossed a
`<button>` on the way up, and a chip is a `<span>` — so a chip fell through to the opener. The box now
forwards a press on **its own** area only, which is what ADR 0142 says it does: what a press does is
decided by what it landed on, not by what that thing is made of.

All three now focus the chip and open nothing, which is the published answer for a composite with a
roving tab stop — it puts the keyboard where the pointer went, and it is the only route by which
somebody who arrived with a mouse reaches the strip's key map.

---
"@modyra/widgets": minor
"@modyra/vue": minor
---

`file` completes the native kinds, and a rule renderers could not read is published

The file field is the deepest anatomy the catalogue declares: a dropzone holding the control and a
content box, and inside that box the button that clears a selection. Nothing before it went past two
levels, so it is where a walk over the declared structure either holds or is revealed as a trick that
worked twice. It holds — the component places the control and the dropzone, because it has a
projection and a handler to put in them, and derives everything beneath.

Getting there found three declarations the walk was not reading, each named by the kit rather than
guessed:

- a part declared a `button` was drawn as a `<span>`, because the tag map held only the elements that
  draw nothing. The first kind to declare an operable part inside a derived subtree found it;
- `MDY_ARIA_DISABLED_PARTS` names the few parts drawn at all times that are not natively disabled, and
  **no renderer could read it**: it was enforced by the DOM contract and exported by neither barrel,
  so every adapter had to know the three names by heart. A rule declared in one place and obeyed from
  memory in four is the shape this contract exists to remove. It is now published, indexed among the
  vocabularies, and exercised by a check that asserts its properties rather than pinning its contents
  — pinning them would have been the fifth copy;
- the caption names the control, which the relations declare and this kind's projection does not
  carry.

`drawDeclaredUnder` is deliberately **not** exported. It is the walk this package's components share,
nothing outside calls it, and a published name nobody can exercise is surface kept without ever being
checked.

Falsified by making the walk stop honouring the ARIA rule: the kit answers `clear is drawn at all
times, so it must say whether it can act with aria-disabled`.

---
"@modyra/vue": patch
"@modyra/lit": patch
"@modyra/plain": patch
"@modyra/angular": patch
---

A door into a panel says what pressing it does, in the reader's language

Measured across four renderers from the accessibility tree: every combobox opener agreed and every
button opener diverged. That is the whole cause — a combobox takes its name from the field's label,
which the label association does for free, while a button has to be given one, and each renderer was
on its own.

- **The field's caption no longer overwrites a door's own name.** Plain and Lit named the element a
  person operates with the field's label, over the action name the opener had already given itself,
  producing `"T, button"`: the caption repeated, saying nothing about what pressing it does, and in
  English on a translated page.
- **Vue reads the dictionary.** Its date, time and colour openers composed `Choose ` + the field's
  label in English source, so those names could not be translated at all — not a missing translation,
  a door never taken. Vue also had no locale of its own: it defaulted to `en` rather than reading the
  page, which is the same root as its calendar starting the week on Sunday everywhere.
- **The range opener stops borrowing the calendar's message.** Angular named it `Toggle calendar` for
  something that is not a calendar; `daterangeChooseRange` already existed and now every renderer
  reads it.
- **A prompt is shown, not announced.** Vue's select pointed its name at itself, so the placeholder
  inside the closed control became part of what the control *is*: a reader heard `"T Select…"`.
- **The second door works from a pointer again.** `colors.alsoOpensFrom` is declared as a door a
  pointer may use, carrying no relation of its own (ADR 0177). Vue drew the element and wired nothing
  to it, so the swatch a person aims at did nothing while the same press two pixels away opened the
  panel.

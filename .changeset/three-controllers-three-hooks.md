---
"@modyra/react": minor
---

The three field controllers published last release get the hooks the guide promises

`headless-recipes.md` says this adapter ships a hook for each widget controller. Publishing three
controllers that had been written and unreachable made that sentence false for three kinds, and a
promise a guide makes is the one place a gap is invisible — nobody looks for a hook the documentation
says exists.

`useMdyColorsField`, `useMdyFileField` and `useMdySelectField`. The last is the one beside
`useMdySelect` and not the same thing: that one takes a value and a callback and is for a host with no
form; this one takes a field handle and reads it, so a value changed anywhere else — a draft restored,
a server correction, a cross-field rule — reaches the widget without a setter.

`useMdyFileField` carries what a value cannot: the candidates the field refused. A size limit or an
accept list turns files away and nothing in the form records it, so a host showing its own message
about it has no other source.

Two of the three were invisible to the check that guards this claim: it treats a kind named anywhere
in the guide's prose as a documented exception, and `file` and `select` are ordinary words. That check
belongs to another session and is reported rather than changed here.

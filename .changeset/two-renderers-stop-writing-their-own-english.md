---
"@modyra/plain": minor
"@modyra/lit": minor
---

The framework-free and Lit renderers read the message tables

Both wrote their own English. The same control was "Open the calendar" in one,
"Open date picker" in the other, and "Toggle calendar" in the table neither of
them opened — forty-one strings and five locales with exactly one consumer.

**Framework-free**: every renderer that shows a word takes an optional trailing
`messages`, and `renderField` fills it in. A field that declares a `locale` now
speaks it without any extra wiring: the tag that formats a date and the tag that
names a button are the same tag.

**Lit**: `MdyFieldElement` gains a `locale` property and a `messages` getter, so
every element inherits both. The two calendars had a private `locale` getter of
their own; it is now the base's fallback rather than a third answer.

Some visible words change with this, because the table's wording wins:
"Confirm" becomes "OK", "Choose a file" becomes "Select file", "Clear" becomes
"Clear selection".

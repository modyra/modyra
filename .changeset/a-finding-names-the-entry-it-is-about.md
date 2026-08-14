---
"@modyra/core": patch
---

A document's finding names the entry it is about, not the array it is in

Every per-field diagnostic carried `path: "/fields"` — the line the array opens on:

```
a duplicate name, three fields down   written on line 6, reported on line 3
a kind nobody declared, deep in list  written on line 7, reported on line 3
a name that is a path, on the last    written on line 6, reported on line 3
```

So a two-hundred-line document assembled by a CMS sent the reader to the same line whichever entry
was wrong, and an editor's underline stopped being worth more than the console message it duplicates.

A finding reported while a field is being read now carries `/fields/<index>`. An envelope-level
refusal — an unsupported version, a body that is not a list — still carries `/fields`, because it is
about the list.

**A duplicate names the second occurrence.** The first is legitimate until the second exists, and the
second is the one a reader has to change.

Nothing in `@modyra/eslint-plugin` changes: it walks the literal as far as the path reaches and
underlines the deepest node it got to, which is why a more precise path lands correctly with no edit
there — and the console message gains the same precision for consumers who never install it.

Found by `battle-tests/adversarial/tooling/`.

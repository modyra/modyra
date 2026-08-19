---
"@modyra/core": patch
---

An option a field does not read is reported, the way a form's is

`createForm` names an option it does not know — the decision that a misplaced one must be said was
already taken, and for this reason: it is indistinguishable from not having asked. `field()` did not
follow it, and the contrast lived inside a single option:

```
sanitize: "strict"    the value is sanitized
sanitize: "stict"     refused by name, at construction
sanitise: "strict"    built, never sanitized, nothing said
```

`sanitise` is the British spelling and the ordinary way to get it wrong, and it left a field
unsanitized while its author believed otherwise. `asyncDebounce` for `asyncDebounceMs` is the same
shape at a different cost: every keystroke reaches the server.

Said rather than refused, because the bag grows with the library.

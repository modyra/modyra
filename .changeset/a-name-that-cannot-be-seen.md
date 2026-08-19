---
"@modyra/core": patch
---

A name that cannot be seen, and a path without a limit

Two doors on the same string.

**A name carrying an invisible character** was accepted — zero-width space, BOM, an RTL override, a
directional isolate — so a document could declare `amount` twice, once really and once invisibly, and
the duplicate check that exists precisely for names that collide saw two different names. The
framework knows this class exactly: `sanitize: "text"` strips it from every **value**, and
`security.md` explains why with `"admin‮"`, which looks like `admin` and is not. A name never met
the sanitizer, and a name is what a value is filed under.

**A path had no limit.** A hundred thousand nested groups parsed clean in 65ms and produced a field
whose name was two hundred thousand characters. Nesting stays unbounded — a form's shape is the
author's business — but a path is the payload key, the draft key and the widget id, and every read of
that value carries it: `MDY_MAX_DYNAMIC_PATH_LENGTH` is 512, reported as `MDY_DYNAMIC_PATH_TOO_LONG`.

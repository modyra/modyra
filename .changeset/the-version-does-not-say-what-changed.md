---
"@modyra/core": patch
"@modyra/widgets": patch
---

Eighteen subpaths removed at a patch version

`@modyra/core` goes from twenty subpath entries to six and `@modyra/widgets` from
six to three. Under semver that is a major; it ships as a patch because the
library has no consumers and every import that would break is in this repository
and was updated alongside.

The complete migration table and the reasoning are ADR 0039 — including why this
is bounded to one release rather than a habit, and how "no consumers" was
established rather than assumed.

Three subpath families moved to a different package (`@modyra/widgets` for the UI
vocabulary, `@modyra/styles` for the colour arithmetic); the rest were entries
whose every export was already reachable from the package's main entry, so they
were a second door rather than a second surface.

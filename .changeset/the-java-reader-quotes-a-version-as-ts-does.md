---
"@modyra/core": patch
---

The Java reader quotes an unknown version as the TypeScript reader does

`sdk/java/modyra-contract` now writes the declared value in the `MDY_DYNAMIC_UNSUPPORTED_VERSION`
message at `/version` exactly as `JSON.stringify` does in the TypeScript reader: `1e21` reads `1e+21`
(not `1.0E21`), `1e-7` reads `1e-7`, an integer past double precision reads the double it parses to,
`1e400` reads `null`, a nested `1.0` reads `1`, control characters and lone surrogates are escaped in
lower-case hex, and object keys follow ECMAScript property order. Code, severity, path and which
documents are refused do not change.

**Migration for Java consumers.** Only the message text of that one diagnostic changes, and only for
a declared version that is not a whole number within Java `int` range, a boolean, or a string free of
control characters and lone surrogates. Code that matches the code and path is unaffected. The
`@modyra/core` header carries the note into a release; the npm package itself does not change.

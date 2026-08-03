---
"@modyra/widgets": minor
---

`npx modyra-conformance` — the conformance kit runs outside this repository.

The suites that check Modyra's own renderers were reachable only by cloning it. They are now a `bin`
on this package, so an implementer can check a renderer against the contract without reading four
test files to work out how.

```bash
npx modyra-conformance ./my-adapter.config.mjs
```

A config exports `{ name, kinds, mount }` — optionally `absentParts` and `mountScoped` — and owns its
own environment, because a renderer needs a DOM and only its author knows how theirs is set up.

Reported: DOM anatomy and relations, the state matrix, renderer equivalence at rest, lifecycle, and
multi-instance isolation. **Keyboard behaviour and the accessibility audit are reported as not run**,
with the reason, rather than omitted — neither is answerable outside a real browser, and an
implementer has to know what was not covered.

Nothing new is checked: every suite already existed and both of this repository's Node-drivable
renderers report CONFORMANT through it. What changes is who can run them.

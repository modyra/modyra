---
"@modyra/styles": patch
---

A theme selector cannot close the stylesheet it is written into

`compileMdyTheme` guarded its `selector` against breaking out of the **CSS rule** — `}`, `;`, `@` and
comment sequences all end a rule and turn what follows into a stylesheet nobody wrote. It did not
guard the other container. A stylesheet is often written into a `<style>` block, and `</style>` ends
that block wherever it appears, including inside a selector:

```js
compileMdyTheme({ name: "acme", seed: "#6458ef", selector: "</style><script>alert(1)</script>" });
// compiled, character for character, into the CSS
```

`seed` and `name` already refused it; `selector` did not, because none of the guarded characters
appear in `</style>`.

`<` is now refused. It is not valid anywhere in a CSS selector — proposed as a combinator and
abandoned — so nothing correct is taken away. **`>` is deliberately still allowed**: `.a > .b` is the
ordinary child combinator, and a guard that took the pair for symmetry would break every theme
scoping a rule to a direct child.

Nothing in Modyra feeds this: Studio does not call `compileMdyTheme`. It matters where an application
compiles a theme from a name a customer supplies — per tenant, per brand — which is what a theme
compiler is for.

The guard still does not decide *which* selectors a theme should accept. That remains the caller's.

See ADR 0111.

---
"@modyra/core": patch
---

A theme's `selector` and `model` are validated, like its `seed` and `name` already were.

`compileMdyTheme` refuses a seed that is not a colour and a name that is not an identifier, and
derives the default selector from that validated name. An **explicit** `selector` went in unchecked
and is interpolated into the generated stylesheet six times, so one closing brace ended the rule and
everything after it became CSS the theme's author never wrote:

```
@layer mdy.themes {
  } body { display:none } .x { {
```

`@modyra/core/theme-compiler` is a public subpath with no callers inside the repository — it exists
to be used from outside, and the obvious use is compiling a theme per tenant, where the colour and
the selector come from data. There that was persistent CSS injection.

A selector may no longer contain `{`, `}`, `;`, `@` or a comment sequence: each of those leaves the
position a selector occupies. Everything a theme actually uses is unaffected — `.acme`, `#app`,
`:root`, `[data-tenant="acme"]`, comma-separated lists, combinators — and the CSS generated for an
unchanged theme is byte-for-byte what it was. This keeps interpolated text inside its position; it
does not decide which selectors a caller should accept from someone else.

An unknown `model` now says so and lists the models that exist, instead of arriving as
`TypeError: Cannot read properties of undefined (reading 'light')` three calls further down.

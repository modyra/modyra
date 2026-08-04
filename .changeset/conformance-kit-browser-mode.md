---
"@modyra/widgets": minor
"@modyra/plain": patch
---

The conformance kit can run its two browser sections.

Keyboard behaviour and the accessibility audit could not be answered in Node — focus, native key
defaults and computed accessible names are not simulable — so they ran nowhere, for anyone. A config
may now export one more function:

```js
export async function openBrowserSession(kind) {
  return { press(key), focusOpener(), evaluate(source), close() };
}
```

and both sections run: **8 of 8 sections**.

The assertions stay in the kit and are evaluated in the page; the config supplies only the transport.
`@modyra/widgets` therefore takes no browser dependency, an implementer drives it with whatever they
already test with, and the rules stay in one place instead of being re-derived per renderer — which
is the failure the kit exists to prevent.

`@modyra/plain` ships a reference transport, `conformance.browser.config.mjs`, backed by Playwright
and the built example. Run it with `npm run test:conformance-browser`.

What the sections claim is bounded on purpose. The accessibility section checks that every operable
element has a name the platform computes; it is not an axe pass. The keyboard section asserts `open`
and `cancel` only — `move` is reported as unasserted, because what "the active option moved" looks
like is not one thing and the contract pins neither form of it.

It found real divergences on its first run, recorded as contract gap Q.

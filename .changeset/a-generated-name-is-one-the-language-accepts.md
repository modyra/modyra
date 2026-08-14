---
"@modyra/studio-codegen": patch
---

A generated stub is named something the language accepts

`buildStubsModule` names each stub from what someone typed into the editor, choosing between the name
as written and a sanitized one with `isValidIdentifier`. That function answers about an identifier's
**shape** — a letter, `_` or `$`, then letters, digits, `_`, `$` — and every reserved word has that
shape:

```ts
export function class(value: unknown): readonly string[] { … }
```

Thirteen ordinary names produced a module that does not compile, and none of them is exotic:
`default` is what someone calls the fallback rule, `import` the one that runs on an imported row,
`new` the one for a new record. Studio generates code other people compile.

Shape and legality are now two questions, because they genuinely are: `isValidIdentifier` still asks
about shape, which is the right question for a **property key** (`{ class: 1 }` is legal and quoting
it would be noise), and the new `isValidBindingName` asks whether something can be *declared*.
`toBindingName` repairs one that cannot — prefixing `_`, which is what a leading digit already gets,
so there is one repair shape to recognise and the original word stays readable.

Reserved under **module** semantics, which is what is generated: `await` is reserved there and not in
a sloppy script, and `let`, `static` and `yield` are reserved under strict mode, which a module always
is. TypeScript's soft keywords — `type`, `as`, `satisfies` — are deliberately absent: they are legal
declaration names, and refusing them would rename code that compiles.

Found by `battle-tests/adversarial/studio/`, the first battle against a Studio package.

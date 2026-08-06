# Modyra for Visual Studio Code

Reads a Modyra form contract while you write it.

Three things, none of which ESLint or a JSON schema can do:

- **Hover a `kind`** — the widget's parts, root class, overlay behaviour and configuration variants,
  read from `@modyra/widgets` at the moment you ask. The catalogue is the UI contract, so a kind
  that gains a part gains it here on the same build.
- **Go to definition from a layout slot** — jump from a name in `layout`, `rules` or `validations`
  to the field that declares it, instead of scrolling the `fields` array.
- **Schema on files that look like contracts** — `*.form.json`, `*.contract.json` and anything under
  a `contracts/` directory get the v3 contract schema without a `$schema` key.

For diagnostics — an unknown kind, a choice with no options, a slot naming a field nothing declares
— install `@modyra/eslint-plugin` for TypeScript contracts, or point a JSON document's `$schema` at
`spec/dynamic-form-v3.schema.json`. Those findings are the parser's, and this extension does not
duplicate them.

## What decides what

Everything that decides anything is in `src/catalog-hover.ts` and `src/slot-definition.ts`, which
know nothing about the editor and are tested without one. `src/extension.ts` registers the two
providers and converts offsets to positions — nothing else.

A field reference is decided by the document, not by a list of paths: a string matching a declared
field name is a reference to it, wherever it sits, except under the content-bearing keys where a
match is a coincidence. Being wrong there costs an offered jump, never a diagnostic.

## Build

```sh
npm run build:vscode
npm run test:vscode
```

`build.mjs` bundles to CommonJS. The extension host loads CJS while this package and everything it
reads are ES modules, and `jsonc-parser`'s UMD build hides a `require` that only fails once a
document is open — so the bundle is checked for exactly one external, `vscode`, which the host
injects.

## Not published

`private: true`. Packaging and publishing to the marketplace is a release step, and releases are out
of scope for automation here.

## License

MIT

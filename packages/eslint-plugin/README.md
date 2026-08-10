# @modyra/eslint-plugin

Reports the Dynamic Form Contract's own diagnostics while you write a contract, instead of on a dev
build once the form has failed to render it.

A `select` with no options, a name already taken, a layout slot pointing at a field that does not
exist — the contract has always known about these. It said so in the console, after the field had
already gone missing. This says it in the editor, on the line that caused it.

## Install

This package is not on npm yet. It is built from this repository, so use it through a workspace
link or a file dependency:

```sh
npm install --save-dev file:../path/to/modyra/packages/eslint-plugin
```

The `@modyra/eslint-plugin` name is reserved for it and the install line becomes the usual one when
it is published.

## Use

```js
// eslint.config.js
import modyra from "@modyra/eslint-plugin";

export default [modyra.configs.recommended];
```

Or wire the rule yourself:

```js
import modyra from "@modyra/eslint-plugin";

export default [
  {
    plugins: { modyra },
    rules: { "modyra/valid-dynamic-form": "error" },
  },
];
```

Nothing else is needed for the findings to appear in Visual Studio Code: the ESLint extension
surfaces them like any other rule.

## The rule

### `modyra/valid-dynamic-form`

Finds object literals that describe a form document — a `version` of 1, 2 or 3 alongside `fields` or
`schema` — and reports what `parseDynamicForm` says about them. The diagnostic code travels with the
message, so a finding here is searchable against the same finding in the console and in CI.

```ts
const form = {
  version: 3,
  fields: [{ name: "country", kind: "select" }],
  //       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  //       Dropped dynamic field "country": kind "select" requires a valid
  //       options array. (MDY_DYNAMIC_OPTIONS_REQUIRED)
};
```

**It reports nothing about a document it cannot fully read.** A contract assembled from a spread, a
helper call or an imported constant is only partly visible to a linter, and the invisible part is
indistinguishable from an absent one — a rule that guessed would report fields as missing because it
could not see where they came from. Silence is the deliberate choice:

```ts
const form = {
  version: 3,
  fields: [...baseFields, { name: "vat", kind: "text" }], // no findings, at all
};
```

Nothing is executed to read a literal. Identifiers are not resolved, modules are not loaded, and no
expression is evaluated — the rule runs in an editor over whatever repository is open, and a linter
that ran the code it lints would be running a stranger's.

## What this does not cover

Contracts written as `.json` get their shape checked by `spec/dynamic-form-v3.schema.json` through a
`$schema` key, with no extension and no plugin.

Neither surface can check a cross-reference against a running system, and neither replaces parsing an
untrusted document at runtime. A contract that arrives over the network is still `parseDynamicForm`'s
to judge.

## Why the rule holds no rules

It has no list of kinds, no table of which kinds need options and no name grammar. It reconstructs
the document and asks the parser. A second statement of what a valid contract is would agree on the
day it was written and drift from the next release onward — see
[ADR 0024](../../docs/architecture/0024-an-author-time-check-calls-the-parser.md).

## License

MIT

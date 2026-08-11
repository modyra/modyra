# @modyra/eslint-plugin

## 0.2.2

### Patch Changes

- 9256c38: The rule reads the document the parser reads, `__proto__` included.

  An author-time check has no notion of validity of its own: it reconstructs the document a source
  literal denotes and reports what `parseDynamicForm` says about it (ADR 0024). The reconstruction
  built objects by assignment — and `out.__proto__ = value` is the one case where assignment creates no
  property at all: it sets a prototype. `JSON.parse` does the opposite, and the document is JSON at
  runtime, so the two sides read different documents:

  - a child key named `__proto__` vanished from the rule's copy, so `MDY_DYNAMIC_UNSAFE_NAME` — raised
    by the parser at runtime — was never shown while the author was writing it;
  - a node with a crafted `__proto__` **inherited** `node: "field"`, so the rule saw a valid field
    where the runtime raised `MDY_DYNAMIC_INVALID_NODE`. The editor said a document was fine and the
    application refused it.

  Properties are now defined rather than assigned, which is what JSON produces for every key including
  that one. Nothing changes for any other key, and the global prototype was never involved: the crafted
  object was only ever the reconstruction's own prototype.

- Updated dependencies [2e29f30]
- Updated dependencies [2e29f30]
- Updated dependencies [c47d0ac]
- Updated dependencies [6921584]
- Updated dependencies [6581883]
- Updated dependencies [2e29f30]
- Updated dependencies [cf498d8]
- Updated dependencies [985685b]
- Updated dependencies [b048e2c]
- Updated dependencies [d5c1774]
- Updated dependencies [94474e4]
- Updated dependencies [039b0b9]
- Updated dependencies [062881c]
- Updated dependencies [c090eac]
- Updated dependencies [992b36d]
- Updated dependencies [850a463]
- Updated dependencies [90fdf00]
- Updated dependencies [df1aaeb]
- Updated dependencies [c47d0ac]
- Updated dependencies [2a38f16]
- Updated dependencies [6921584]
  - @modyra/core@2.1.1

## 0.2.1

### Patch Changes

- Updated dependencies [0b64826]
- Updated dependencies [ba5f5f9]
- Updated dependencies [faf3275]
- Updated dependencies [206b0b3]
- Updated dependencies [3d8391b]
- Updated dependencies [495ff44]
- Updated dependencies [8b88c9f]
  - @modyra/core@2.1.0

## 0.2.0

### Minor Changes

- c6b8904: A contract's diagnostics arrive while the contract is being written.

  `@modyra/eslint-plugin` is new. Its one rule, `modyra/valid-dynamic-form`, finds object literals that
  describe a form document and reports what `parseDynamicForm` says about them — an unknown kind, a
  choice with no options, a duplicate name, a layout slot naming a field nothing declares. The findings
  are the parser's: the rule holds no list of kinds, no table of which kinds need options and no name
  grammar, so it cannot drift from the contract it reports on. In Visual Studio Code the ESLint
  extension surfaces them like any other rule; no separate extension exists or is needed.

  A document the rule cannot fully read — assembled from a spread, a helper or an imported constant —
  produces no findings at all, deliberately. Nothing is executed to read a literal: identifiers are not
  resolved and modules are not loaded, because the rule runs in an editor over whatever repository is
  open.

  `spec/dynamic-form-v3.schema.json` is new alongside it, for contracts authored as JSON, and
  `spec/dynamic-form-v2.schema.json` has been corrected: it listed 14 of the 17 kinds the parser
  accepts, was closed against the `validations` slot that v2 documents carry, and admitted a layout
  child only as a name, so it rejected a nested row that the parser accepts and that the shared corpus
  contains. `npm run test:contract-schema` holds both schemas to the kinds and slots the parser
  accepts.

  Neither surface can see a cross-reference — JSON Schema cannot express one, and a linter only sees
  one file — so a contract that arrives over the network is still `parseDynamicForm`'s to judge.

### Patch Changes

- Updated dependencies [2037ba5]
- Updated dependencies [3161bad]
  - @modyra/core@2.0.0

---
"@modyra/eslint-plugin": minor
---

A contract's diagnostics arrive while the contract is being written.

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

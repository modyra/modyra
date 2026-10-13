---
"@modyra/core": patch
---

The Java reader names an unknown member on every surface, and counts a tree, as the TypeScript reader does

`sdk/java/modyra-contract` now reports `MDY_DYNAMIC_UNKNOWN_MEMBER` wherever the TypeScript reader
does, with its path, sentence and order, and answers `acceptedCount` and `rejectedCount` for a tree
document as it does:

- an unknown member is an **error** on the document envelope (`/`, "the document carries …"), on every
  layout node and slot at any depth (`/layout/0/children/1/columns/0/0`, "a layout node carries …" or
  "a layout slot carries …", each held to the list of its own shape), on every rule (`/rules/0`, "a
  rule carries …") and on every validation (`/validations/0`, "a validation carries …"). Fields,
  validators and options were already reported. The subject is kept in either mode — the finding is
  about what nothing reads, not a refusal — so a strict parse withholds the document and neither mode
  is `ok`. A document that declares no version is read for its own members too, and names each
  versioned slot it carries whether or not it lists fields;
- a finding under a layout, rule or validation entry counts as a rejection of that entry, so a nested
  layout with an unknown member at every level reports as many rejections as findings;
- a tree document's counts are about what it **declared**: every field node, inside a collection's row
  template too, plus every node that is neither a field nor a container, counted before anything is
  refused. A schema turned down whole reports everything it declared as rejected (it used to report
  nothing in and nothing out); a leaf the walk turns down is one rejection; a clean document with
  collections reports the cells its templates declare as accepted (`nested-collections.json` is
  accepted 5, not 0);
- an array where a layout node, rule or validation belongs passes the "must be an object" door as it
  does in JavaScript and is refused by the check after it ("layout node has an invalid shape.", "rule
  has an unsupported effect/operator or references an unknown field.", "validation needs a non-empty
  message."), so both readers say the same thing about the same entry;
- `requiresContext` on a v2 or v3 document is refused with the TypeScript reader's sentence:
  `Unsupported dynamic form config version for "requiresContext": it arrived with version 4, and this
  document says 2. Set "version": 4 to use it.`

The member lists and kind sets the Java reader holds a document to are now checked by its own suite
against `packages/core/src/dynamic/members.ts`, `parse.ts` and `field-kinds.ts` in the same checkout,
so a member added to one reader and not the other fails the Java build rather than producing a
document one reader reports and the other accepts.

**Migration for Java consumers.** A document that parsed `ok` with a member outside the contract on
its envelope, a layout node or slot, a rule or a validation now parses with an error and, in strict
mode, with no fields, layout or rules — the same document the TypeScript gate already refused. Code
reading `acceptedCount` or `rejectedCount` on a tree document sees the declared counts the TypeScript
reader reports; a refused tree is no longer 0/0, and a template cell counts as accepted though it is
not in `fields`. Code matching the old `requiresContext` sentence ("requiresContext arrived with
version 4, …") must match the sentence above; the code and path are unchanged. The `@modyra/core`
header carries the note into a release; the npm package itself does not change.

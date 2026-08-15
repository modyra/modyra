# ADR 0071: A document is answered the same in both its shapes

Status: Accepted

## Context

A dynamic document can be written as a flat list of fields or as a tree, and the tree is the shape
the current spec describes — the one a CMS sends. The same defect written both ways got two answers:

| the defect | as a flat list | as a v2 tree |
| --- | --- | --- |
| a kind nobody declared | `MDY_DYNAMIC_UNKNOWN_KIND` | kept 0, **said nothing** |
| no kind at all | `MDY_DYNAMIC_UNKNOWN_KIND` | kept 0, **said nothing** |
| a select with no options | `MDY_DYNAMIC_OPTIONS_REQUIRED` | kept 0, **said nothing** |
| a pattern that backtracks | `MDY_DYNAMIC_PATTERN_TOO_COSTLY` | kept 1, **said nothing** |

And the counts a consumer reports with did not add up. Three children entered a document, none came
back, and `rejectedCount` was `0` — so a host reporting "3 fields, 1 rejected, here is why" had no
figure that described what happened.

The sharpest form: **`strict` approved a document whose only field it had dropped.**
`ok: true, fields: [], diagnostics: []`. Strict mode is documented as the check to run before saving
a contract or accepting one into a registry, and *"any diagnostic makes `ok` false"* — so with no
diagnostic, `ok` stayed true for a document that renders nothing where a select was.

The cause is one line of plumbing. `parseDynamicFields` reports through a diagnostic sink, and the
flat path installs one. The tree walk ran **outside** it, so every refusal it made went nowhere —
`flattenDynamicForm` drops a leaf its parse refuses, and nothing was listening.

## Decision

**The tree walk reports through the same sink the flat list does.** A defect a flat document is told
about is one a tree document is told about, with the leaf's own path.

**The counts are about the document, not about what survived it.** `acceptedCount + rejectedCount`
equals what the document declared. A schema refused wholesale — before the walk runs at all — is
still counted, by reading how many fields the raw object says it has.

**That count is taken defensively.** It walks the raw object over an explicit stack with a step
bound, because it runs on a document the validator may already have refused: it cannot recurse on a
shape it was handed, and it cannot assume any node is well formed. A node that is neither a field nor
a container it can descend counts as one declaration — something was written there and it did not
become a field.

## Consequences

`strict` now refuses documents it used to approve. That is the point, and it is a behaviour change
for any pipeline that was storing a document strict had blessed: a document whose fields were being
dropped silently now fails the check that exists to catch it.

`rejectedCount` grows for tree documents, because it was zero for all of them. A host printing it
sees a number where it saw nothing.

The defensive counter is a second reader of the document's shape, beside `validateDynamicSchema` and
`flattenDynamicForm`. Three readers of one shape can drift; this one is deliberately the least
knowing of the three — it counts, it does not interpret — and its bound means a document cannot make
it expensive.

## Alternatives rejected

**Report from `flattenDynamicForm` directly.** It is public, and a function a consumer calls for a
flattened form should not push into a parse result they did not ask for. Installing the sink around
the call keeps the reporting where the parse is.

**Count only what the walk visits.** It leaves the sharpest case — a schema refused before the walk —
reporting nothing entered and nothing rejected, which is the shape that let `strict` approve an empty
result.

**Make the tree parser reject the whole document on any leaf defect.** It is defensible and it is the
opposite of what lenient mode is for: `ai-generated-forms.md` says valid fields survive and
diagnostics explain the rest, which is what the previews it was written for need.

## Verification

- `battle-tests/adversarial/dynamic-contract/what-the-parser-says-it-did.battle.test.mjs` — the same
  defect in both shapes, the counts adding up, and strict refusing what it dropped.
- The flat spelling of each defect is asserted in the same battles as the control, so a repair that
  silenced the list instead of teaching the tree fails there.

## Security and privacy

`strict` is the gate a registry or a save path runs before accepting a document from outside. It was
approving documents whose fields it had discarded, so a stored contract could render nothing where a
control was declared. Closing it means an untrusted document is refused by the check that exists to
refuse it, rather than being stored with a verdict it did not earn.

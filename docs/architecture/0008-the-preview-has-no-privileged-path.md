# ADR 0008: The preview has no privileged path

Status: Accepted

## Context

Studio's live preview built its form by reading the project model directly and calling `createForm`.
It never called `compileToContract`. So the form a designer *watched* and the contract a designer
*exported* were produced by two different pieces of code, and nothing compared them.

Measured on the checkout fixture: the export reported two `UNSUPPORTED_FEATURE` drops while the
preview ran all of it and reported none. With a field that could not compile, the export returned
`contract: null` and the preview built the form anyway, including the field that had blocked it.
**You could build what you could not export**, and nothing said so.

That is not a cosmetic gap. A designer validates a form by using it. If the thing they used is not
the thing that ships, the validation was of something else.

The gap had a cause worth recording: nothing could build a running form from the contract's *tree*.
Every consumer flattened it, and flattening fixes an array at however many rows its initial value
happened to have, so a row added later has no descriptor. The contract could **describe** a nested
form that nothing could **instantiate** — so the only way to get a live nested form was to read some
other model. The privileged path was a workaround for a missing capability, not a shortcut.

## Decision

The preview is a builder of everything beneath it and obeys the rules beneath it. It builds through
the contract:

```
project → compileToContract → parseDynamicForm → form
```

There is exactly one path. The model-reading path is **deleted**, not deprecated — left in place it
would drift, which is the failure this decision exists to end.

**A project that does not compile does not preview.** The compiler's diagnostics are returned with
the result, so the builder can say precisely what is blocking it and point at the field.

The preview may add exactly one category of thing the contract does not carry: **an affordance that
stands in for an absent host.** A server validator is symbolic at design time — there is no
implementation to call — so the preview supplies a mock. That is the preview presenting its own
dynamics, not inventing form semantics, and it is the boundary of what "builder" permits. It is
labelled as such at its definition so a later audit does not reopen it as an inconsistency.

Anything the contract *cannot yet express* is fixed by extending the contract, not by routing around
it. Cross-field validation was added to the contract ([ADR 0007](0007-expressions-are-data.md)) rather
than left as a preview-only capability.

## Consequences

- Previewing work in progress now fails where it used to half-work. This is the cost, taken
  deliberately: a preview that disagrees with the export is worse than a preview that refuses.
- The preview reports what the export drops — the checkout fixture now surfaces one warning where it
  used to show none. Honest, and noisier.
- Pressure that used to be absorbed by the preview's own code path now lands on the contract, where
  it is visible and versioned. That is the intended direction.
- `@modyra/studio-preview` depends on `@modyra/studio-contract`. No cycle: `studio-contract` depends
  only on `core` and `studio-model`.

## Alternatives rejected

- **Keep both paths, add a test comparing them.** A comparison test proves they agree on the cases it
  lists. The two code paths still exist, and the next feature lands in one of them.
- **Preview from the model, warn when the export would differ.** A warning beside a working form is
  read as a note, not a blocker. The measured behaviour — preview silent, export dropping two
  features — is what that design produces in practice.
- **Let the preview keep server validators as real contract data.** Would put a mock in the exported
  schema: a fake shipping as though it were the form's specification.

## Verification

- `packages/studio-preview/test/live-form-builder.test.mjs` — the two tests that pinned the
  divergence are **inverted**, with the decision recorded in their comment. The uncompilable-field
  project must now return `form: null` carrying `UNCOMPILABLE_FIELD`, and preview and export
  diagnostics must match.
- `npm run test:studio` — the whole builder suite, including arrays, nested groups, drafts and the
  mock server, run against a form built through the contract.

## Security and privacy

Improved, indirectly. A validation rule that exists only in the preview is a rule the shipped form
does not enforce — a control the designer believes is present and is not. Making the previewed form
the exported form removes a class of "I tested it and it worked" that was true and irrelevant.

The mock server never leaves the preview session and is not part of any exported artefact.

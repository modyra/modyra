# Architecture decision records

Why Modyra is built the way it is. Each record states the pressure that forced a decision, what was
decided, what it costs, the alternatives that lost and why, and the check that fails if the decision
is violated.

**Every architectural or security decision belongs here.** A decision recorded only in a commit
message, a changeset, or a coordination file under `.modyra/` is a decision the next reader will
relitigate from scratch — and `.modyra/` is git-ignored, so it is not a durable record at all.

Use [TEMPLATE.md](TEMPLATE.md). A record is not complete without **Verification** and **Security and
privacy**; where either is genuinely empty, say so explicitly rather than omitting the section — an
absent section reads as an oversight, and "no security impact" is a finding.

## The records

| | | |
| --- | --- | --- |
| [0001](0001-project-and-contract-model.md) | Project and contract model | What a Studio project is, and how it relates to the contract it compiles to |
| [0002](0002-ids-and-paths.md) | Ids and paths | Stable node ids for editing, dotted paths for reading — and where each belongs |
| [0003](0003-command-engine.md) | Command engine | Every edit is a command, which is what makes undo, redo and grouping possible |
| [0004](0004-target-plugin-api.md) | Target plugin API | How a code-generation target is added without changing the model |
| [0005](0005-expressions-and-references.md) | Expressions and references | The portable operator set, and why a reference is an id rather than an accessor |
| [0006](0006-one-ui-contract.md) | One UI contract, many consumers | `@modyra/widgets` is the UI contract; renderers consume it and never redefine it |
| [0007](0007-expressions-are-data.md) | Expressions are data, never code | No `eval` on a document that arrives over a network. The security decision of the dynamic contract |
| [0008](0008-the-preview-has-no-privileged-path.md) | The preview has no privileged path | What a designer watches is what a designer exports |
| [0009](0009-client-validation-is-defence-in-depth.md) | Client validation is defence in depth | The trust boundary, stated plainly: the server is the authority |
| [0010](0010-every-claim-has-an-executable-check.md) | Every claim has an executable check | Ratchets, gates, and why a check nobody has watched fail is only a claim |
| [0011](0011-a-capability-names-its-event.md) | A capability names its event | A boolean answers *whether* and leaves *how* to each renderer, which is a specification by accident — **superseded by 0013** |
| [0012](0012-a-choice-is-a-radio-by-role-or-by-tag.md) | A choice is a radio, by tag or by role | All three renderers already chose `radiogroup`; the open question was whether the tag is required |
| [0013](0013-the-dismissal-names-its-gesture.md) | The dismissal names its gesture | One event cannot express where a gesture began *and* ended, which is what the dismissal rule turns on |
| [0014](0014-the-contract-names-the-responsible-element.md) | The contract names the responsible element | Naming the region and not the element inside it let three widgets conform that nobody could operate |
| [0015](0015-light-text-while-it-is-readable.md) | Light text while it is readable | The contrast ratio and a reader disagree about saturated colour, and the ratio was winning |
| [0016](0016-a-multiselect-is-one-kind-and-the-mode-is-not-the-contracts.md) | A multiselect is one kind, and its mode is not the contract's | Decided on a premise that was false — the mode was already contract data — **superseded by 0017** |
| [0017](0017-a-varianted-kind-names-its-anatomy-per-configuration.md) | A varianted kind names its anatomy per configuration | A disjunction says something is operable; ADR 0014 asks which element, and only a variant can answer |
| [0018](0018-a-select-declares-whether-it-filters.md) | A select declares whether it filters | One widget, three behaviours and one of them broken, because the distinction was not contract data |
| [0019](0019-typescript-7-compiles-the-libraries.md) | TypeScript 7 compiles the libraries | Two consumers pin the compiler and the rest of the repository was waiting for them |
| [0020](0020-a-hidden-native-control-is-never-painted.md) | A hidden native control is never painted | Paint on a clipped pixel is invisible to review and to screenshots, and one engine ended the page over it |
| [0021](0021-a-dialog-overlay-is-not-a-combobox.md) | A dialog overlay is not a combobox | The combobox opening keys were declared for four kinds that hold no options, and no renderer implemented them |
| [0022](0022-a-theme-expresses-its-own-colour-model.md) | A theme expresses its own colour model | Two themes could not state their own design system, so a brand colour produced white text at 1.85:1 |
| [0023](0023-a-popup-is-positioned-not-dressed.md) | A popup is positioned, not dressed | A container that paints is a wrapper around the thing it was meant to present |
| [0024](0024-an-author-time-check-calls-the-parser.md) | An author-time check calls the parser | The contract already knows what is wrong with a document; an editor check that says so again is a second answer that drifts |
| [0025](0025-a-tag-publishes-and-nothing-else-does.md) | A tag publishes, and nothing else does | A release pipeline whose publish step was a dry run stayed green for four versions while npm served none of them |
| [0026](0026-a-row-exists-because-it-was-declared.md) | A row exists because it was declared | A collection keyed by data, where what is mounted must not decide what exists |
| [0027](0027-a-register-and-its-summary-are-both-checked.md) | A register and its summary are both checked | A maintainer's defect register and the page consumers read, held to the same statuses |
| [0028](0028-a-status-sentence-names-a-version.md) | A status sentence names a version | One "pre-1.0" line over a workspace whose packages have never shared a maturity |
| [0029](0029-a-widget-does-not-repair-the-model.md) | A widget does not repair the model | A select erased a value it could not render, and the data that would have let a person fix it went with it |
| [0030](0030-a-declared-fact-survives-composition.md) | A declared fact survives composition | `compose(required(), …)` produced a field that was not required, silently, and three copies of one rule disagreed |
| [0031](0031-a-field-name-is-a-path.md) | A field name is a path, in a schema as everywhere else | A schema keyed by `"shipping.city"` described a shape no read could produce, so every flattened document mounted into a form that threw on `getValue()` |
| [0032](0032-a-computed-is-a-function-of-its-inputs.md) | A computed is a function of its inputs | The vanilla graph allowed a signal write inside a computed and Angular refuses it, so shared code could pass every test on one adapter and throw on another |
| [0033](0033-one-engine-in-the-tree.md) | One engine in the tree | Exact sibling pins installed `@modyra/core` twice after a partial release, and a `required()` from one engine was not required to the other |
- [ADR 0034: A draft is not a linked signal](0034-a-draft-is-not-a-linked-signal.md) — a value derived from a handle is a computed; a draft resets on the event that starts it, never on its source
- [ADR 0035: The colour arithmetic lives with the themes](0035-the-colour-arithmetic-lives-with-the-themes.md) — `color-utils` and `theme-compiler` ship with the stylesheets they generate, measured to be a leaf with no edge either way

## Security-relevant records

Start here for a security review: [0007](0007-expressions-are-data.md) (untrusted documents are never
executed), [0009](0009-client-validation-is-defence-in-depth.md) (the trust boundary and the draft
storage exposure), [0010](0010-every-claim-has-an-executable-check.md) (which of those properties are
held by a test rather than by prose), [0024](0024-an-author-time-check-calls-the-parser.md) (the same
refusal to execute a document, at the editor boundary),
[0025](0025-a-tag-publishes-and-nothing-else-does.md) (the registry credential, and why no publish
token is stored).

## Changing a record

A decision that no longer holds is **superseded**, not edited into agreement with the present. Write
the new record, and set the old one's status to `Superseded by [ADR NNNN]`. The reasoning that was
correct under the old constraints is what makes the new decision legible.

A decision that still holds but has grown may be **amended in place**, with the amendment marked as
such — [0005](0005-expressions-and-references.md) carries one.

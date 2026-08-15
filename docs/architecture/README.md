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
- [ADR 0036: The UI contract lives in one package](0036-the-ui-contract-lives-in-one-package.md) — icons, keyboard policy and the option filter move to `@modyra/widgets`, which had been importing them sideways from the engine
- [ADR 0037: A vocabulary does not belong to a parser](0037-a-vocabulary-does-not-belong-to-a-parser.md) — the seventeen field kinds were the property of the JSON reader that happened to declare them; a shared vocabulary lives in a leaf owned by nobody who uses it
- [ADR 0038: An adapter does not redeclare what it derives](0038-an-adapter-does-not-redeclare-what-it-derives.md) — narrowing an upstream type for a framework's signals is legitimate; restating its members is drift with a delay
- [ADR 0039: A breaking change shipped as a patch](0039-a-breaking-change-shipped-as-a-patch.md) — eighteen subpaths removed at `2.1.2 → 2.1.3`, why that was bounded rather than habitual, and the complete migration table
- [ADR 0040: A collection owns its subtree](0040-a-collection-owns-its-subtree.md) — nested collections: gates compose along the whole chain, ownership is explicit, and the eight semantics decided before a line of runtime
- [ADR 0041: History crosses structural changes](0041-history-crosses-structural-changes.md) — undo acts on the value as it is now: a declared, removed or renamed row is undoable the moment it happens, at any depth; only the value is restored
- [ADR 0042: An adversarial suite attacks from outside](0042-an-adversarial-suite-attacks-from-outside.md) — `battle-tests/` consumes published entry points only and exists to falsify public claims: every battle cites a registered claim, proves it attacked, and writes a replayable artefact when it breaks something
- [ADR 0043: A collection nests without a limit](0043-a-collection-nests-without-a-limit.md) — an array may hold an array, a form may nest as deep as it needs, and a document is bounded by the caller rather than by a number; supersedes ADR 0040's one-positional-level rule
- [ADR 0044: A binding belongs to the row](0044-a-binding-belongs-to-the-row.md) — what a control said about a cell travels with the row across a rename or a move, as its value and its marks already did
- [ADR 0045: A declaration is all or nothing](0045-a-declaration-is-all-or-nothing.md) — a row whose value raises while it is read is not declared; a row reads the object it was given, prototype chain included; a schema is read by its own properties
- [ADR 0046: An adapter states no less than the engine](0046-an-adapter-states-no-less-than-the-engine.md) — a capability the engine gains ships only when every package that restates it has it, checked by a consumer program rather than by a green suite; a nested collection's value has the same type as a top-level one
- [ADR 0047: An expression reads what a field could name](0047-an-expression-reads-what-a-field-could-name.md) — a document's predicate passes the engine's path guard and answers from the value's own properties; `""` stays the root reference
- [ADR 0048: A panel does not print what it masks](0048-a-panel-does-not-print-what-it-masks.md) — a masked field's value is taken out of the errors beside it, and a snapshot describes a file rather than handing it over
- [ADR 0049: A released custodian owes no focus](0049-a-released-custodian-owes-no-focus.md) — `release()` ends the borrow, so a widget being torn down places no focus; a named target is still honoured, and the fallback keeps the case it was written for
- [ADR 0050: A document cannot make the form stop answering](0050-a-document-cannot-make-the-form-stop-answering.md) — a pattern whose shape backtracks exponentially is refused like one that will not parse, and the field survives the refusal
- [ADR 0051: An option is recognised by what it holds](0051-an-option-is-recognised-by-what-it-holds.md) — `oneOf` compares an object option by its members, so a draft's round trip is not tampering, and every forgery it refused it still refuses
- [ADR 0052: A widget announces only the states it has](0052-a-widget-announces-only-the-states-it-has.md) — `readonly` leaves the kinds whose contract never had it, in both halves, and `aria-checked` holds one of the three values the standard allows
- [ADR 0053: A widget id is refused where it is used, not only where it is asked about](0053-a-widget-id-is-refused-where-it-is-used.md) — the part-id builders throw on an id that cannot be referenced; the joining factory does not, and nothing is repaired silently
- [ADR 0054: A list shows the choice it will not erase](0054-a-list-shows-the-choice-it-will-not-erase.md) — an option is keyed by what it holds, a survivor keeps the label it was painted with and gets a part, and a radio group stops being the exception
- [ADR 0055: A runtime that cannot recompute is not the one to run on](0055-a-runtime-that-cannot-recompute-is-not-the-one-to-run-on.md) — Solid's server build freezes every derived value and reported an invalid form as valid; the adapter probes the graph and falls back to one that answers
- [ADR 0056: A project file does not decide what the generated module does](0056-a-project-file-does-not-decide-what-the-generated-module-does.md) — an operand outside the expression vocabulary was printed unquoted into generated source; refused at the compiler and reported where the project is read
- [ADR 0057: An argument is refused where it arrives](0057-an-argument-is-refused-where-it-arrives.md) — seven public entry points took a value they could not use and left the form to fail later; the reactive setters, the whole-value write and the initial are checked at the call
- [ADR 0058: A rename moves a key, not a row](0058-a-rename-moves-a-key-not-a-row.md) — a renamed row was appended, and the value and the handle kept two different orders for one list
- [ADR 0059: A step of history is a state the form was in](0059-a-step-of-history-is-a-state-the-form-was-in.md) — a bulk write cost one undo per row and a restored row came back last, so the path back passed through states the form was never in
- [ADR 0060: A refusal reaches somebody](0060-a-refusal-reaches-somebody.md) — three spellings of a server's refusal were dropped by the guard that drops a hostile path, so a person saw nothing and believed it went through
- [ADR 0061: A rule that says nothing says nothing](0061-a-rule-that-says-nothing-says-nothing.md) — the validator everybody writes has no `else`, returns `undefined`, and made the form unreadable from the first question asked of it
- [ADR 0062: The form says what no field can](0062-the-form-says-what-no-field-can.md) — three renderers had nowhere to show a refusal that names no field, which made it a missing part rather than three oversights
- [ADR 0063: A value a control cannot read stays where it can be corrected](0063-a-value-a-control-cannot-read-stays-where-it-can-be-corrected.md) — `14:30` typed into a 12-hour picker was erased with nothing said; the judgement moves into the controller and the entry is kept and explained
- [ADR 0064: A typed form refuses a path it does not declare](0064-a-typed-form-refuses-a-path-it-does-not-declare.md) — one transposed letter attached a rule nothing could satisfy and the Submit button stopped working, with nothing said
- [ADR 0065: What is said about a path is said about what is under it](0065-what-is-said-about-a-path-is-said-about-what-is-under-it.md) — the three interactivity setters reached only leaves, so a section a consumer excluded stayed editable and stayed in the payload
- [ADR 0066: A bound beside the field is a rule](0066-a-bound-beside-the-field-is-a-rule.md) — two spellings of a limit rendered identically and only one was enforced, so a tampered draft outside the bound was valid and submittable

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

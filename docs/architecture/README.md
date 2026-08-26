# Architecture decision records

Why Modyra is built the way it is. Each record states the pressure that forced a decision, what was
decided, what it costs, the alternatives that lost and why, and the check that fails if the decision
is violated.

**Every architectural or security decision belongs here.** A decision recorded only in a commit
message, a changeset, or a file version control ignores is a decision the next reader will
relitigate from scratch — an untracked file is not a durable record at all.

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
- [ADR 0067: A track spans what the field holds](0067-a-track-spans-what-the-field-holds.md) — a slider with no declared bound drew a track ending at 100 and put the thumb there for a value of 150, in both renderers, each having invented the default separately
- [ADR 0068: A draft does not go backwards](0068-a-draft-does-not-go-backwards.md) — a tab that had been open a while replaced a newer draft and stamped it with an earlier time, so the one field a later reader could use said the opposite
- [ADR 0069: An unreadable condition does not open](0069-an-unreadable-condition-does-not-open.md) — a misspelled operator evaluated to `true` and showed a section to everyone, and a condition's pattern carried no cost gate
- [ADR 0070: A server is asked about a value the field accepts](0070-a-server-is-asked-about-a-value-the-field-accepts.md) — a tax id typed group by group sent four requests for values `minLength(11)` already rejects, and `when` loses because it restates a bound the field declared
- [ADR 0071: A document is answered the same in both its shapes](0071-a-document-is-answered-the-same-in-both-its-shapes.md) — the tree parser dropped fields in silence where the flat list reported them, and `strict` approved a document whose only field it had discarded
- [ADR 0072: A positional change set carries its whole list](0072-a-positional-change-set-carries-its-whole-list.md) — a compacted list of changed rows said nothing about where they were, so a server applying it by position wrote the wrong row
- [ADR 0073: A verdict a person can see is one the form counts](0073-a-verdict-a-person-can-see-is-one-the-form-counts.md) — a picker showed an unreadable entry as an error and the form called itself submittable, sending the field empty
- [ADR 0074: A file the field turned away is something the page says](0074-a-file-the-field-turned-away-is-something-the-page-says.md) — the transition reported what it refused, no renderer showed it, and no message table had a word for it
- [ADR 0075: A popup that opens says so](0075-a-popup-that-opens-says-so.md) — the lifecycle policy answered `announce` for every open and close, and two of the three renderers read neither
- [ADR 0076: A state belongs to something that can be in it](0076-a-state-belongs-to-something-that-can-be-in-it.md) — the one opener the contract gave no role wore `aria-invalid` and `aria-required` where nothing could read them
- [ADR 0077: The opener a contract names is the one a keyboard reaches](0077-the-opener-a-contract-names-is-the-one-a-keyboard-reaches.md) — two date inputs claimed the popup's state while the part that opens it was not a tab stop, and lit's pickers had no keyboard door at all
- [ADR 0078: A widget announces the refusal it makes](0078-a-widget-announces-the-refusal-it-makes.md) — twelve kinds refused every change while read-only and said nothing, because the rule that made silence right had since been implemented
- [ADR 0079: A rule a document writes is a rule the form keeps](0079-a-rule-a-document-writes-is-a-rule-the-form-keeps.md) — the parser guarded `rules` as behaviour and nothing applied one, so a document saying to disable a field produced a form that sent it
- [ADR 0080: A path is an instruction a row's shape can refuse](0080-a-path-is-an-instruction-a-row-shape-can-refuse.md) — one extra segment in a draft key built a row and a member no document declared, and the form called itself ready
- [ADR 0081: A secret is excluded by the name a person writes](0081-a-secret-is-excluded-by-the-name-a-person-writes.md) — `exclude` matched one exact path, so the guide's own example — a card number in a list — was the case it could not answer
- [ADR 0082: A commit word answers for the control a person types in](0082-a-commit-word-answers-for-the-control-a-person-types-in.md) — a range is neither `live` nor `confirm`, and a colours field has two controls that commit differently
- [ADR 0083: A form reports what it could not do](0083-a-form-reports-what-it-could-not-do.md) — the diagnostics vocabulary was published and nothing took a sink, so a check that stopped running was invisible on every surface
- [ADR 0084: A contract version names the anatomy](0084-a-contract-version-names-the-anatomy.md) — parts were removed and an element changed while the number that exists to say so stayed at 1
- [ADR 0085: A name a package exports belongs to one function](0085-a-name-a-package-exports-belongs-to-one-function.md) — two hooks shipped under `useMdyField`, and `export *` yielded to the local one in silence
- [ADR 0086: A derived form starts at an empty its schema accepts](0086-a-derived-form-starts-at-an-empty-its-schema-accepts.md) — a bridge seeded a sentinel its own schema refused, so one emptiness got two answers and `required` contradicted `valid`
- [ADR 0087: A target answers with everything it knows about the project](0087-a-target-answers-with-what-it-knows-about-the-project.md) — three code targets called a project compatible that the contract compiler reports errors on, and said nothing about a kind they cannot draw
- [ADR 0088: A draft is not replaced by one belonging to another form](0088-a-draft-is-not-replaced-by-one-belonging-to-another-form.md) — two live forms on one key meant the last save deleted the other's work, and nothing said so
- [ADR 0089: A field that says it is a secret is treated as one](0089-a-field-that-says-it-is-a-secret-is-treated-as-one.md) — the contract's `sensitive` flag reached no protection, so a secret was autosaved in clear and printed in the panel
- [ADR 0090: A rule with a bug in it is a verdict, not an outage](0090-a-rule-with-a-bug-in-it-is-a-verdict-not-an-outage.md) — a validator that threw made every later read of the form throw, and a predicate that threw stopped the form being built
- [ADR 0091: A form that has ended answers with one voice](0091-a-form-that-ended-answers-with-one-voice.md) — a destroyed form called itself submittable with nothing to submit, and a late write reached one surface of two
- [ADR 0093: A field that leaves play takes its overlay with it](0093-a-field-that-leaves-play-takes-its-overlay-with-it.md) — a rule took a field out of play and left its calendar open, expanded, and answering nothing
- [ADR 0094: One question about emptiness, one answer](0094-one-question-about-emptiness-one-answer.md) — `required` refused a value `isEmpty` called filled, so a rule opened a section the form was still refusing to submit
- [ADR 0095: A flat pair carries the shape of a row](0095-a-flat-pair-carries-the-shape-of-a-row.md) — a collection with no rows had no template, so a form rebuilt from the flat pair accepted a row and held nothing
- [ADR 0096: A row the form was not built with is a change](0096-a-row-the-form-was-not-built-with-is-a-change.md) — `reset()` threw a new row away while `getChanges()` reported nothing, so a patch never carried the rows a user made
- [ADR 0097: A member nobody declared is reported](0097-a-member-nobody-declared-is-reported.md) — the published schema closes every object and the parser closed none, so the one check a stored document meets said nothing
- [ADR 0098: A fixture's context lives beside it](0098-a-fixtures-context-lives-beside-it.md) — v4's conditions read what the host supplies, and the shared corpus had no way to say what that is
- [ADR 0099: A password is said to be one](0099-a-password-is-said-to-be-one.md) — the published description of a password was the description of a text field, so masking was private knowledge in every adapter
- [ADR 0100: A position is an identity](0100-a-position-is-an-identity.md) — a fully disabled row left the payload, so every row after it was sent at a position it does not have
- [ADR 0101: A collection asks for its own rows](0101-a-collection-asks-for-its-own-rows.md) — a question scoped to a path was answered by a scan of the whole form, so declaring rows cost more the more rows there were
- [ADR 0102: A change set is a payload too](0102-a-change-set-is-a-payload-too.md) — a positional list was carried whole out of the form value, so a disabled cell left through the change set that a submit withheld
- [ADR 0103: A patch names cells, in a list too](0103-a-patch-names-cells-in-a-list-too.md) — a partial positional row rebuilt the cells it did not name from the schema, so a form could not read the change set its own door produced
- [ADR 0104: Change is decided by `Object.is`](0104-change-is-decided-by-object-is.md) — the conformance gate accepted a runtime whose default equality was `===`, so a field written `-0` over `0` re-rendered nothing
- [ADR 0105: One handle registry per realm](0105-one-handle-registry-per-realm.md) — a module-level registry is per copy, so two copies of the engine in one tree turned the cross-runtime guard off
- [ADR 0106: A door named for a contract reads it](0106-a-door-named-for-a-contract-reads-it.md) — the Angular component was named for the dynamic contract and took only the parsed half, so a document's rules vanished and each host wrote the parse step again
- [ADR 0107: A draft is read by the form that wrote it](0107-a-draft-is-read-by-the-form-that-wrote-it.md) — the write side compared the recorded form shape and the read side did not, so the draft the writer refused to replace was the one the reader restored
- [ADR 0108: A seed a theme can be read on](0108-a-seed-a-theme-can-be-read-on.md) — the default primary sat in the 13% of sRGB where the rule picks light text that cannot reach AA, so the filled button shipped at 4.09:1
- [ADR 0109: An element nobody bound says so](0109-an-element-nobody-bound-says-so.md) — the element surface was the one published door that failed in silence: an empty custom element, no control, and nothing said
- [ADR 0110: A promise is declared where the popup is](0110-a-promise-is-declared-where-the-popup-is.md) — `aria-haspopup` was a literal at fourteen openers with no common source, so two kinds promised a popup neither renderer opened
- [ADR 0111: A selector cannot close the sheet it is written into](0111-a-selector-cannot-close-the-sheet.md) — the theme compiler guarded a selector against escaping its CSS rule and not against escaping the `<style>` block around it
- [ADR 0112: A radio group has nowhere to jump](0112-a-radio-group-has-nowhere-to-jump.md) — `Home` and `End` were declared for every kind that navigates options, and three renderers independently declined to implement them on a radio group
- [ADR 0113: A field name cannot break the value it is in](0113-a-field-name-cannot-break-the-value-it-is-in.md) — a field named `toString` shadowed the method every string conversion goes through, so `${value}` threw in the consumer's own code
- [ADR 0114: A dev-time advisory is pinned, not waived](0114-a-dev-time-advisory-is-pinned-not-waived.md) — twenty-three alerts across eight packages that no published tarball carries, pinned inside their own majors because an unbounded override took `fast-uri` across one
- [ADR 0115: An hour carries the half of the day it is in](0115-an-hour-carries-the-half-of-the-day-it-is-in.md) — a 24-hour picker could not be moved off the half of the day it opened on, because the one seam that writes took 1–12 while every other surface spoke 0–23
- [ADR 0116: One clock in every renderer](0116-one-clock-in-every-renderer.md) — three renderers each wrote down their own default format, so one document could render a different clock in each adapter
- [ADR 0117: A row is not a target](0117-a-row-is-not-a-target.md) — a boolean's wrapper was a `<label>`, so the empty remainder of the row toggled the field, and removing it left the drawn box unclickable
- [ADR 0118: One cell says whether a popup is open](0118-one-cell-says-whether-a-popup-is-open.md) — the contract closes a popup whose field leaves play by writing the controller's `open`, and Angular painted a cell of its own
- [ADR 0119: An overlay's boundary is the contract's, not the renderer's](0119-a-branch-is-declared-once.md) — four renderers each answered "is this press inside the popup" and three could get the portalled part wrong in silence
- [ADR 0120: A picker that offers only some of the times](0120-a-picker-that-offers-only-some-times.md) — a granularity as data, refused by name where it is declared, obeyed by the face, the arrows, the typing and the drag alike
- [ADR 0121: A legitimate value must not be indistinguishable from its own absence](0121-a-value-indistinguishable-from-its-own-absence.md) — four defects in one evening shared a guard that asked whether a value was usable when it needed to ask whether it was there
- [ADR 0122: Tab moves inside a popup that has controls of its own](0122-a-picker-a-keyboard-can-commit.md) — Tab dismissed every overlay, so a timepicker's confirm button was unreachable and its only commit path was a pointer
- [ADR 0123: A default is published, or it is copied](0123-a-default-is-published-or-it-is-copied.md) — four renderers each spelled the clock default out and two had already drifted, while the view a picker opens in was a capability no document could reach
- [ADR 0124: The public pitch is a single claim set](0124-the-public-pitch-is-a-single-claim-set.md) — three surfaces answered "what is Modyra" three ways, and the positioning that could have stopped it lived in an untracked directory
- [ADR 0125: A chip strip is one thing to a keyboard](0125-a-chip-strip-is-one-thing-to-a-keyboard.md) — twelve choices cost twenty-six tab stops, and reordering was being built on the strip that the fix for it has to rebuild
- [ADR 0126: Focus is placed, not dropped](0126-focus-is-placed-not-dropped.md) — removing a chip returned a keyboard user to the top of the page, and the pin that found it asserted a threshold rather than a rule
- [ADR 0127: A strip that scrolls, against the published practice](0127-a-strip-that-scrolls-against-the-practice.md) — an outside review ranked the scrolling row last but one and called it a deliberate 1.4.10 departure, and the one-row-per-control rule is why it was taken anyway
- [ADR 0128: A chip is one thing, not a cell](0128-a-chip-is-one-thing-not-a-cell.md) — the APG's composite pattern is grid, and the design had already removed the children grid exists to reach
- [ADR 0129: One way back, not three](0129-one-way-back-not-three.md) — a clear-all with no undo is worse than no clear-all, and an undo that covers the loudest action and not the quiet ones is worse than none
- [ADR 0130: A popup outlives the box it opens from](0130-a-popup-outlives-the-box-it-opens-from.md) — superseded: the clipping it was built on was a rectangle compared against a rectangle, and every popup is `position: fixed`
- [ADR 0131: A rectangle outside a box is not a clipped one](0131-a-rectangle-outside-a-box-is-not-a-clipped-one.md) — the defect did not exist; the battle written to prove it now pins the property instead
- [ADR 0132: A part's name says what it is for, its role says what it is](0132-a-part-name-is-what-it-is-for.md) — one kind took its role as its part name, and a consumer asking the other kind for it got `undefined`
- [ADR 0133: A chip's mark is drawn, never written](0133-a-mark-that-is-never-text.md) — the argument that decided it turned out to be false, and the decision stands on the two reasons that were not why it was taken
- [ADR 0134: The projection decides an id, and every renderer applies it](0134-the-projection-decides-an-id.md) — an `aria-labelledby` the contract emits resolved in one renderer and pointed at nothing in another
- [ADR 0135: An id is a function of the document, not of mount order](0135-an-id-is-a-function-of-the-document.md) — two renderers minted ids from a counter, so the same declaration got a different id depending on what was mounted first
- [ADR 0136: A version one runtime accepts is a version all of them accept](0136-one-contract-version-set.md) — TypeScript accepted a version Rust and Java refuse, so a document built a form in one runtime and did not exist for the other two
- [ADR 0137: A row that wraps where one line stops being a layout rule](0137-a-row-that-wraps-where-it-must.md) — the scroll departure was paid for with an announcement no role could carry, and reflow was owed to a sighted person all along
- [ADR 0138: A chip is an item in a list, not a number in a range](0138-a-chip-is-an-item-not-a-number.md) — the quantity chip gives up the spinbutton published practice prescribes, because a role that carries a value cannot carry a position
- [ADR 0139: A select has two shapes, and one renderer only ever draws one of them](0139-a-select-has-two-shapes.md) — `searchable` switches between a native control and a combobox, the contract describes only the combobox, and plain never leaves it
- [ADR 0140: A popup that holds a draft is a dialog, and the catalogue says so](0140-a-popup-that-holds-a-draft-is-a-dialog.md) — the kind declares the popup's role, modality is a separate property from it, and a draft's dialog is named by the field's label
- [ADR 0141: An id built from a value escapes it](0141-an-id-built-from-a-value-escapes-it.md) — a published id is a handle a consumer may select with, so caller data is hex-escaped into it rather than embedded raw
- [ADR 0142: A field that holds controls is not a control](0142-a-field-that-holds-controls-is-not-a-control.md) — the box becomes a container, the chip strip and the opener become siblings, and a press stops being decided by the length of a word
- [ADR 0143: A widget box inside the shell every kind sits in](0143-a-widget-box-inside-the-shell-every-kind-sits-in.md) — one part name means one element, so a kind that draws two boxes declares two parts and its parts hang off the inner one
- [ADR 0144: A slot that is always there](0144-a-slot-that-is-always-there.md) — the way back reserves its line whether or not it is offered, because a cost that moves is one nobody can learn
- [ADR 0145: A dial that repeats what a box already says](0145-a-dial-that-repeats-what-a-box-already-says.md) — a redundant graphic is hidden from assistive technology, and what it announced moves to the control a person can reach
- [ADR 0146: A form carries its own scope](0146-a-form-carries-its-own-scope.md) — every form has an id scope whether or not anybody asked, because the person who pays for a collision is not the one who reads the warning
- [ADR 0147: The cluster at the end of a field](0147-the-cluster-at-the-end-of-a-field.md) — the undo joins the controls it is the opposite of, in a slot reserved so nothing slides under a thumb
- [ADR 0148: A strip a browsing reader can reach](0148-a-strip-a-browsing-reader-can-reach.md) — a listitem does not switch a screen reader's mode, so the strip's whole keyboard model never reached somebody who arrived by browsing
- [ADR 0149: A form answers its own reset by returning to the initial values](0149-a-form-that-answers-its-own-reset.md)
- [ADR 0150: What is submitted is what was on screen](0150-what-the-browser-gave-back.md) — the browser writes into a person's form and tells nobody, so the field showed one value while the form held another
- [ADR 0151: The floor is Baseline widely available, and everything below it is declared](0151-the-platform-floor.md) — the repository never said which browsers it works in, and arrived here one rule at a time
- [ADR 0152: A form built with these controls submits, and the payload carries the field's own names](0152-what-a-native-submit-sends.md) — no control wrote a `name`, so a native submit sent nothing at all
- [ADR 0153: A control's accessible name is what it is for, never what it holds](0153-a-name-is-what-a-control-is-for.md) — the check asked a chooser to answer to the grey word inside it, so it failed the renderer that was right
- [ADR 0154: A part's classes read the same from the record and from the accessor](0154-one-part-one-answer.md) — two published surfaces gave opposite answers about the same part, and neither reader was misreading
- [ADR 0155: A press completes on the release](0155-a-press-completes-on-the-release.md) — one renderer opened a list while the button was still down, so the gesture a person uses to take a tap back did nothing
- [ADR 0156: A panel answers both doors](0156-a-panel-answers-both-doors.md) — a list opened with the mouse answered no key, because a press leaves focus where it landed and it landed on nothing
- [ADR 0157: A key that waits for something to have happened](0157-a-key-that-waits-for-something-to-have-happened.md) — a key that does nothing because the moment is wrong is indistinguishable from one nobody implemented
- [ADR 0158: A thirteenth that is a door](0158-a-thirteenth-that-is-a-door.md) — a field that takes every colour offered twelve, and neither of its two routes could see the disagreement
- [ADR 0092: A condition travels with the form](0092-a-condition-travels-with-the-form.md) — `when` and `asyncWhen` were closures, so a schema carrying one was not data and the document half could not say what the typed half said

## Security-relevant records

Start here for a security review: [0007](0007-expressions-are-data.md) (untrusted documents are never
executed), [0009](0009-client-validation-is-defence-in-depth.md) (the trust boundary and the draft
storage exposure), [0010](0010-every-claim-has-an-executable-check.md) (which of those properties are
held by a test rather than by prose), [0024](0024-an-author-time-check-calls-the-parser.md) (the same
refusal to execute a document, at the editor boundary),
[0025](0025-a-tag-publishes-and-nothing-else-does.md) (the registry credential, and why no publish
token is stored), [0111](0111-a-selector-cannot-close-the-sheet.md) (the one place a caller's string
reaches a stylesheet, and which container it is held inside).

## Changing a record

A decision that no longer holds is **superseded**, not edited into agreement with the present. Write
the new record, and set the old one's status to `Superseded by [ADR NNNN]`. The reasoning that was
correct under the old constraints is what makes the new decision legible.

A decision that still holds but has grown may be **amended in place**, with the amendment marked as
such — [0005](0005-expressions-and-references.md) carries one.

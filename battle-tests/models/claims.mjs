/**
 * The public promises this suite exists to disprove.
 *
 * A claim is a sentence about behaviour a consumer may rely on, stated without naming an
 * implementation. Every battle test cites at least one, and citing an unregistered id is an error:
 * an attack whose target cannot be named is an attack nobody can act on when it lands.
 *
 * `publicEvidence` lists where the promise is made — an exported symbol, a decision record, a
 * documented guarantee. `permittedDifferences` lists what the contract explicitly allows to differ,
 * so a differential test narrows its exclusions to a reviewed list rather than a broad ignore.
 */

import { assertSeverity } from "./severity.mjs";

/** @type {ReadonlyArray<Readonly<Record<string, unknown>>>} */
const CLAIMS = [
  {
    id: "COL-001",
    title: "Rendering never creates or removes a record row.",
    area: "collection",
    severity: "S0",
    publicEvidence: [
      "@modyra/core MdyRecordHandle.keys — the declared keys, in declaration order",
      "docs/architecture/0026-a-row-exists-because-it-was-declared.md",
    ],
  },
  {
    id: "COL-002",
    title: "Record identity is the domain key, not presentation order.",
    area: "collection",
    severity: "S0",
    publicEvidence: [
      "@modyra/core MdyRecordHandle.row/cell — stable per key across upsert/remove/upsert",
    ],
  },
  {
    id: "COL-003",
    title: "Validity of declared rows is independent from mounted cells.",
    area: "collection",
    severity: "S1",
    publicEvidence: [
      "@modyra/core MdyRecordHandle.validOf",
      "@modyra/core MdyTypedForm.state.valid",
    ],
  },
  {
    id: "COL-004",
    title: "Numeric record keys remain object keys.",
    area: "collection",
    severity: "S0",
    publicEvidence: ["@modyra/core MdyRecordHandle.value — Readonly<Record<string, TItemValue>>"],
  },
  {
    id: "COL-005",
    title: "Removing a row removes its value and settles descendant async work.",
    area: "collection",
    severity: "S0",
    publicEvidence: [
      "@modyra/core MdyRecordHandle.remove",
      "@modyra/core MdyTypedForm.fieldNames",
    ],
  },
  {
    id: "COL-006",
    title: "A waiting cell binds when its row arrives and waits again after removal.",
    area: "collection",
    severity: "S1",
    publicEvidence: [
      "@modyra/core MdyRecordHandle.cell — inert until the row is declared, same object throughout",
    ],
  },
  {
    id: "COL-007",
    title: "Rename preserves the state promised by the public contract, bindings included.",
    area: "collection",
    severity: "S1",
    publicEvidence: [
      "@modyra/core MdyRecordHandle.rename — carries value, validity and touched",
      "docs/architecture/0044-a-binding-belongs-to-the-row.md",
    ],
  },
  {
    id: "COL-008",
    title: "A row declared without a value is the row the template describes.",
    area: "collection",
    severity: "S1",
    publicEvidence: [
      "@modyra/core MdyRecordHandle.upsert — value is optional",
      "@modyra/core record(item) — the item descriptor is the template every row is built from",
      "@modyra/core MdyFieldDescriptor.initial",
    ],
  },
  {
    id: "LIF-001",
    title: "Destroy leaves no observable reactive or asynchronous work.",
    area: "lifecycle",
    severity: "S1",
    publicEvidence: [
      "@modyra/core MdyTypedForm.destroy",
      "@modyra/core MdyDestroyedScopeError",
    ],
  },
  {
    id: "LIF-002",
    title: "Repeated mount/unmount does not alter form value or registration ownership.",
    area: "lifecycle",
    severity: "S1",
    publicEvidence: [
      "@modyra/core MdyTypedForm.claimField/removeField",
      "@modyra/core MdyTypedForm.getValue",
    ],
  },
  {
    id: "VAL-001",
    title: "The latest applicable async validation result wins.",
    area: "validation",
    severity: "S0",
    publicEvidence: ["@modyra/core MdyFieldOptions.asyncValidators/asyncDependsOn/asyncTimeoutMs"],
  },
  {
    id: "VAL-002",
    title: "Disabled values are retained in edit state and excluded from submission.",
    area: "validation",
    severity: "S0",
    publicEvidence: [
      "@modyra/core MdyTypedForm.getValue vs submitValue",
      "@modyra/core MdyInteractivity",
    ],
  },
  {
    id: "VAL-003",
    title: "Hidden or unmounted controls do not alter validation semantics.",
    area: "validation",
    severity: "S1",
    publicEvidence: ["@modyra/core MdyTypedForm.state.valid", "@modyra/core MdyGroupOptions.when"],
  },
  {
    id: "VAL-004",
    title: "A native constraint never promises less than the validators it came from.",
    area: "validation",
    severity: "S1",
    publicEvidence: [
      "@modyra/core factsOf/factsOfAll/mergeFacts",
      "@modyra/core MDY_VALIDATOR_FACTS — what a validator says about itself",
      "docs/architecture/0030 — an external schema's constraints crossing over",
    ],
  },
  {
    id: "API-001",
    title: "A published call that cannot do what it was asked says so.",
    area: "validation",
    severity: "S2",
    publicEvidence: [
      "@modyra/core MdyFormOptions.devWarnings — \"the calls that could not do anything\"",
      "@modyra/core MdyTypedForm.rename — the diagnostic that names both keys and says what to do",
      "docs/architecture/0057 — an argument refused where it arrives, by name, in production",
    ],
  },
  {
    id: "VAL-005",
    title: "A server is asked only about a value the field's own rules accept.",
    area: "validation",
    severity: "S2",
    publicEvidence: [
      "@modyra/core serverValidator — `when`, documented as skipping the call for invalid input",
      "docs/guides/comparison-reactive-forms.md — serverValidator set beside Angular AsyncValidatorFn",
      "docs/guides/typed-forms.md — the debounce, cancellation and last-wins that bound a run",
    ],
  },
  {
    id: "DYN-001",
    title: "Typed and dynamic forms agree for the supported common subset.",
    area: "dynamic-contract",
    severity: "S2",
    publicEvidence: [
      "@modyra/core parseDynamicForm/buildDynamicFormSchema",
      "docs/architecture/0024-an-author-time-check-calls-the-parser.md",
    ],
  },
  {
    id: "DYN-002",
    title: "Collection kind survives flattening and reconstruction.",
    area: "dynamic-contract",
    severity: "S1",
    publicEvidence: ["@modyra/core flattenDynamicForm/flattenDynamicSchema"],
  },
  {
    id: "DYN-003",
    title: "A contract's findings are the parser's, wherever they are reported.",
    area: "dynamic",
    severity: "S2",
    publicEvidence: [
      "@modyra/eslint-plugin — the findings are the parser's; this package positions them",
      "@modyra/eslint-plugin static-value — the whole document is refused when any part is unknown",
    ],
  },
  {
    id: "DYN-004",
    title: "A slot the parser validates and accepts changes the form it describes.",
    area: "dynamic-contract",
    severity: "S0",
    publicEvidence: [
      "@modyra/core MdyDynamicRule — a rule fires an effect on the field it names",
      "@modyra/core parseDynamicForm strict mode — a partly valid document is never accepted",
      "docs/guides/ai-generated-forms.md — the worked example a generated document is written against",
    ],
  },
  {
    id: "DYN-005",
    title: "A limit the contract states is enforced at every door that pays its cost.",
    area: "dynamic-contract",
    severity: "S2",
    publicEvidence: [
      "@modyra/core MDY_MAX_DYNAMIC_PATH_LENGTH — a path is the payload key, the draft key, the widget id",
      "@modyra/core parseDynamicForm/buildDynamicFormSchema — two public doors onto one document",
      "docs/architecture/0043-a-collection-nests-without-a-limit.md — the agreement between parser and builder",
    ],
  },
  {
    id: "REA-001",
    title: "Every handle a form hands out is observed through its owning runtime.",
    area: "reactivity",
    severity: "S1",
    publicEvidence: [
      "@modyra/core observerFor/registerHandleOwner/getFieldHandleOwner",
      "@modyra/core MdyTypedForm.f — field handles, collection handles and row trees alike",
      "docs/architecture/0033-one-engine-in-the-tree.md",
    ],
  },
  {
    id: "REA-002",
    title: "Cross-runtime misuse produces the documented diagnostic and no silent stale view.",
    area: "reactivity",
    severity: "S1",
    publicEvidence: [
      "@modyra/core MDY_CROSS_RUNTIME_OBSERVATION",
      "@modyra/core MdyCrossRuntimeObservationError",
    ],
  },
  {
    id: "REA-003",
    title: "A condition the published diagnostic vocabulary names is reported with its code.",
    area: "reactivity",
    severity: "S3",
    publicEvidence: [
      "@modyra/core reactivity-diagnostics — structured diagnostics replace ad-hoc console.warn so a consumer can route them",
      "@modyra/core MdyDiagnostics — a sink a consumer installs, taking a code and a severity",
      "@modyra/core observerFor — reports through the sink when it has one and to the console when it does not",
    ],
  },
  {
    id: "SUB-001",
    title: "Submission contains no undeclared path introduced by rendering.",
    area: "submission",
    severity: "S0",
    publicEvidence: ["@modyra/core MdyTypedForm.submitValue/buildSubmitEvent"],
  },
  {
    id: "SUB-002",
    title: "The shape of a form's value follows the schema, not the order controls mounted.",
    area: "submission",
    severity: "S1",
    publicEvidence: [
      "@modyra/core MdyTypedForm.getValue/submitValue",
      "@modyra/core record(item) — the item descriptor is a row's shape",
    ],
  },
  {
    id: "PER-001",
    title: "Draft restore reconstructs declared collection structure without resurrecting removed rows.",
    area: "persistence",
    severity: "S0",
    publicEvidence: [
      "@modyra/core MdyDraftOptions",
      "@modyra/core draftShapeMatches",
      "docs/architecture/0034-a-draft-is-not-a-linked-signal.md",
    ],
  },
  {
    id: "PER-002",
    title: "Undo and redo preserve the documented structural semantics.",
    area: "persistence",
    severity: "S1",
    publicEvidence: [
      "@modyra/core MdyTypedForm.undo/redo/canUndo/canRedo",
      "docs/architecture/0041-history-crosses-structural-changes.md",
    ],
  },
  {
    id: "PER-003",
    title: "A restored draft is as valid as the state it was saved from.",
    area: "persistence",
    severity: "S1",
    publicEvidence: [
      "@modyra/core oneOf — the anti-tampering guard for option fields",
      "@modyra/core value-contracts — an option's value is whatever the option list holds",
      "docs/guides/typed-forms.md — a draft restores what the user had",
    ],
  },
  {
    id: "PER-004",
    title: "A draft is not replaced by one saved before it.",
    area: "persistence",
    severity: "S1",
    publicEvidence: [
      "@modyra/core MdyDraftOptions — a key identifies the form, so two views of one form share it",
      "@modyra/core the draft envelope's `savedAt`, written on every save",
      "docs security guide — a draft lives where every script on the origin can write it",
    ],
  },
  {
    id: "SCH-001",
    title: "Any Standard Schema v1 library's findings reach the fields they name.",
    area: "schema-adapters",
    severity: "S1",
    publicEvidence: [
      "@modyra/standard-schema — one adapter for every Standard Schema v1 library (Zod, Valibot, ArkType)",
      "@modyra/standard-schema — a structural copy of the spec, zero dependencies",
      "@modyra/standard-schema — issues are attributed to their dotted field paths",
    ],
  },
  {
    id: "SEC-001",
    title: "Unsafe path segments never register fields or pollute prototypes.",
    area: "security",
    severity: "S0",
    publicEvidence: [
      "@modyra/core isSafeFieldPath/assertSafeDynamicFieldNames",
      "@modyra/core applyValueSecurity/draftShapeMatches",
      "docs/architecture/0031-a-field-name-is-a-path.md",
    ],
  },
  {
    id: "SEC-003",
    title: "A sanitized value cannot form markup, wherever it entered the form.",
    area: "security",
    severity: "S0",
    publicEvidence: [
      "@modyra/core applyValueSecurity/MdySanitizeProfile",
      "docs/guides/security.md — strict removes <, backtick and >; the value can never form markup",
      "docs/guides/security.md — field sanitize, then security.sanitize, then off",
    ],
  },
  {
    id: "SEC-004",
    title: "A document cannot make the form stop answering.",
    area: "security",
    severity: "S0",
    publicEvidence: [
      "@modyra/core buildDynamicValidators — a document supplies `pattern`",
      "@modyra/core — an invalid RegExp source is skipped with a diagnostic",
      "docs/guides/usage-modes.md — a document is untrusted input",
    ],
  },
  {
    id: "SEC-005",
    title: "A kind whose meaning is how the control behaves says so where an adapter reads it.",
    area: "security",
    severity: "S1",
    publicEvidence: [
      "@modyra/core MDY_FIELD_KINDS — password is a kind of its own, distinct from text",
      "spec/dynamic-form-v3.schema.json — a document names a kind, and arrives from outside the application",
      "@modyra/widgets MDY_WIDGET_CONTRACTS — the framework-agnostic UI contract every adapter implements",
    ],
  },
  {
    id: "SEC-002",
    title: "A value the panel masks is not readable elsewhere in the same panel.",
    area: "security",
    severity: "S0",
    publicEvidence: [
      "@modyra/core/devtools mdyFormSnapshot/isSensitivePath",
      "docs/guides/devtools.md — values of sensitive paths are replaced with bullets",
      "docs/guides/devtools.md — in both the table and the JSON view",
    ],
  },
  {
    id: "SEC-006",
    title: "A field the form was told to keep out of a draft is not written to storage.",
    area: "security",
    severity: "S0",
    publicEvidence: [
      "@modyra/core MdyDraftOptions.exclude — never persisted nor restored",
      "docs/guides/typed-forms.md — always exclude passwords, card numbers, tokens and any other sensitive field",
      "docs/guides/typed-forms.md — the default storage is plain text, readable by every script on the origin, and survives logout",
    ],
  },
  {
    id: "SSR-001",
    title: "A widget command that needs a DOM is not executed where there is none.",
    area: "lifecycle",
    severity: "S1",
    publicEvidence: [
      "@modyra/widgets ssrRuntimeCapabilities/browserRuntimeCapabilities",
      "@modyra/widgets processWidgetCommands",
      "packages/widgets/src/runtime.ts — on a server it would be told to focus something that does not exist",
    ],
  },
  {
    id: "A11Y-001",
    title: "Partial and late rendering never produces dangling ID references after settling.",
    area: "accessibility",
    severity: "S1",
    publicEvidence: [
      "@modyra/widgets/testing inspectUnmount/idsUnder",
      "@modyra/widgets/testing MDY_PAINT_BEATS",
    ],
  },
  {
    id: "A11Y-005",
    title: "A field taken out of play does not leave the keyboard with nowhere to stand.",
    area: "accessibility",
    severity: "S2",
    publicEvidence: [
      "@modyra/widgets createFocusCustodian/focusTrigger/restoreFocusTrigger — placing focus is something this package already does",
      "@modyra/core MdyDynamicRule — a document can take a field out of play while a user is in it",
      "@modyra/core MdyInteractivity — read-only keeps a field reachable, disabled does not",
    ],
  },
  {
    id: "LOC-001",
    title: "A localized date is read in the reader's own order, and an impossible one is refused.",
    area: "localization",
    severity: "S0",
    publicEvidence: [
      "@modyra/core/datetime parseLocalizedDate/localeDateOrder",
      "docs/guides/i18n.md — day/month order from Intl.DateTimeFormat.formatToParts,",
      "docs/guides/i18n.md — two-digit years map to 2000-2099, Feb 30 rejected, leap years validated",
    ],
  },
  {
    id: "LOC-003",
    title: "A form that speaks a language speaks it in its refusals too.",
    area: "localization",
    severity: "S2",
    publicEvidence: [
      "@modyra/widgets messagesForLocale — a field that declares a locale speaks it",
      "@modyra/core MdyDynamicValidation.message — required, because a validation nobody can read is a field that will not submit for no stated reason",
      "spec/dynamic-form-v3.schema.json $defs.validators — required, email, min, max, minLength, maxLength, pattern",
    ],
  },
  {
    id: "A11Y-003",
    title: "A palette derived from any brand colour keeps its text above the contrast floor.",
    area: "accessibility",
    severity: "S1",
    publicEvidence: [
      "@modyra/styles derivePalette/contrastRatio/MDY_ON_COLOR_FLOOR",
      "docs/architecture/0015 — the floor is 3.5:1, deliberately",
    ],
  },
  {
    id: "A11Y-004",
    title: "A widget asserts only the ARIA states its kind declares, on the part that carries them.",
    area: "accessibility",
    severity: "S1",
    publicEvidence: [
      "@modyra/widgets stateCarriers — which part exposes each state, per kind",
      "@modyra/widgets widget-states — an undeclared state asserted is as much a defect as a declared state unchecked",
      "@modyra/widgets widget-states — readonly is declared only where the concept means something",
    ],
  },
  {
    id: "UI-001",
    title: "An open overlay keeps its shape while its anchor moves.",
    area: "widgets",
    severity: "S2",
    publicEvidence: [
      "@modyra/widgets stabilizeOverlayPlacement — the shape is a decision taken when it opened",
      "@modyra/widgets decideOverlayPlacement/MdyOverlayDecision — placement, maxHeight, alignment, fits",
    ],
  },
  {
    id: "UI-002",
    title: "The same key does the same thing on every widget offering the same affordance.",
    area: "widgets",
    severity: "S2",
    publicEvidence: [
      "@modyra/widgets widgetKeyIntent/keyBindingFor — the canonical keyboard mapping",
      "@modyra/widgets — framework adapters must not reinterpret these keys",
    ],
  },
  {
    id: "UI-003",
    title: "A select holds the option the user chose, whatever an option's value is.",
    area: "widgets",
    severity: "S0",
    publicEvidence: [
      "@modyra/widgets createSelectController — keyFor is optional and defaults to String(option.value)",
      "@modyra/core value-contracts — an option's value is whatever the option list holds",
      "@modyra/widgets MdySelectControllerOptions — TValue is unconstrained",
    ],
  },
  {
    id: "UI-004",
    title: "A choice the list no longer offers is still shown as the choice it is.",
    area: "widgets",
    severity: "S2",
    publicEvidence: [
      "@modyra/widgets optionsWithUnrecognizedValue — what it will not erase, it has to show",
      "@modyra/widgets options-reconciliation — unrecognised values are named by themselves",
      "@modyra/core value-contracts — an option's value is whatever the option list holds",
    ],
  },
  {
    id: "LOC-002",
    title: "What a user types matches the label they can see.",
    area: "localization",
    severity: "S2",
    publicEvidence: [
      "@modyra/widgets typeaheadMatch — the first option whose label starts with the query",
      "@modyra/widgets filterOptionsByQuery — the list a search narrows to",
      "docs/guides/i18n.md — labels are the consumer's own text",
    ],
  },
  {
    id: "UI-005",
    title: "An overlay closes only on an interaction that happened entirely outside it.",
    area: "widgets",
    severity: "S2",
    publicEvidence: [
      "@modyra/widgets createLightDismiss — called at most once per interaction, when one completes entirely outside",
      "@modyra/widgets isPrimaryInteraction — primary pointer, primary button",
      "@modyra/widgets MdyLightDismiss — an interaction beginning while closed decides nothing",
    ],
  },
  {
    id: "UI-006",
    title: "A widget does not replace a value the model holds in order to make itself consistent.",
    area: "widgets",
    severity: "S1",
    publicEvidence: [
      "@modyra/widgets options-reconciliation — the widget does not write to the model to make itself consistent",
      "@modyra/widgets options-reconciliation — erasing the value destroys the one thing that would let the user fix it",
      "@modyra/core MDY_VALUE_CONTRACTS — a timepicker's value is nullable",
    ],
  },
  {
    id: "UI-007",
    title: "A stepper lands on the values its step declares.",
    area: "widgets",
    severity: "S2",
    publicEvidence: [
      "@modyra/widgets createValueWidgetController — increment/decrement take a step",
      "HTMLInputElement.stepUp/stepDown — the control this widget replaces snaps to the step",
      "CLAUDE.md — a migration preserves validation and runtime behaviour unless change is authorized",
    ],
  },
  {
    id: "UI-008",
    title: "A widget answers for any value the model may legitimately hold, including one already judged invalid.",
    area: "widgets",
    severity: "S1",
    publicEvidence: [
      "@modyra/core MdyTypedForm.patchValue — a public path that admits a value of another shape",
      "@modyra/core MDY_VALUE_CONTRACTS — a wrong shape is a verdict the form reports, not a write it refuses",
      "@modyra/widgets optionsWithUnrecognizedValue — a value the option list does not know is shown, not thrown on",
    ],
  },
  {
    id: "UI-009",
    title: "A part the widget contract declares is built by every renderer, or the contract says when it is not.",
    area: "widgets",
    severity: "S2",
    publicEvidence: [
      "@modyra/widgets MDY_WIDGET_CONTRACTS — 249 parts across 17 kinds, each declaring its classes, attributes, states and (31 of them) an ARIA role",
      "@modyra/widgets MDY_FORM_SHELL_STRUCTURE — a node declares `optional`, so the package has a way to say a part may be absent",
      "CLAUDE.md — widgets is the complete framework-agnostic UI contract, consumed rather than redefined",
    ],
  },
  {
    id: "UI-010",
    title: "A capability the widget contract declares reaches the thing it describes.",
    area: "widgets",
    severity: "S3",
    publicEvidence: [
      "@modyra/widgets MDY_WIDGET_CONTRACTS capabilities.anchoring — minWidth, minSpace, matchAnchorWidth, alignment, declared per kind",
      "@modyra/widgets decideOverlayPlacement/overlayStyleProperties — the published path from a decision to the element",
      "@modyra/widgets MDY_CSS_PROPERTIES.overlay — the custom properties an overlay is positioned with",
    ],
  },
  {
    id: "STU-001",
    title: "Generated code compiles.",
    area: "studio",
    severity: "S1",
    publicEvidence: [
      "@modyra/studio-codegen buildStubsModule — emits a module a consumer compiles",
      "@modyra/studio-codegen isValidIdentifier — decides whether a name is emitted as written",
      "@modyra/studio-codegen — a name that cannot be a binding is sanitized before it is emitted",
    ],
  },
  {
    id: "STU-002",
    title: "A rule the author wrote reaches the generated form, or is reported as lost.",
    area: "studio",
    severity: "S1",
    publicEvidence: [
      "@modyra/studio-codegen buildFormModule — MISSING_VALIDATOR_VALUE reports a rule it omits",
      "@modyra/studio-codegen — a validator with no usable value is omitted rather than emitted empty",
      "docs/guides/usage-modes.md — a generated form is the project a person authored",
    ],
  },
  {
    id: "STU-003",
    title: "A field the author declared reaches the output, or is reported as dropped.",
    area: "studio",
    severity: "S1",
    publicEvidence: [
      "@modyra/studio-contract compileToContract — the project's contract output",
      "@modyra/studio-model loadProject — reports what it cannot use",
      "@modyra/core parseDynamicForm — a contract's findings are the parser's",
    ],
  },
  {
    id: "STU-004",
    title: "The conformance suite refuses a target that should not ship.",
    area: "studio",
    severity: "S1",
    publicEvidence: [
      "@modyra/studio-codegen runConformanceSuite — every target must pass this before it ships",
      "@modyra/studio-codegen conformance — checks safe file paths and a stable diagnostic shape",
      "@modyra/studio-codegen StudioTarget — a generated file carries a path, a language, a role and content",
    ],
  },
  {
    id: "STU-005",
    title: "The model reports a layout it cannot use, rather than raising on it.",
    area: "studio",
    severity: "S1",
    publicEvidence: [
      "@modyra/studio-model loadProject — returns { project, diagnostics }",
      "@modyra/studio-model STUDIO_LAYOUT_MAX_DEPTH and LAYOUT_TOO_DEEP",
      "@modyra/studio-codegen arrangementDiagnostics — reads the layout a loaded project carries",
    ],
  },
  {
    id: "STU-006",
    title: "A command sequence is validated to its end before any of it is applied.",
    area: "studio",
    severity: "S1",
    publicEvidence: [
      "@modyra/studio-editor createSequenceCommand — validates each step against the project the one before it produced",
      "@modyra/studio-editor CommandHistory — validates, and rejects a command whose diagnostics contain an error",
      "@modyra/studio-model StudioDiagnostic — severity is error, warning or info",
    ],
  },
  {
    id: "STY-001",
    title: "A colour that came from sRGB is in sRGB.",
    area: "styles",
    severity: "S2",
    publicEvidence: [
      "@modyra/styles isInSrgb — the gamut predicate, with a declared tolerance",
      "@modyra/styles hexToOklch/oklchToLinearRgb — the transform whose error the tolerance exists for",
      "@modyra/styles derivePalette — emits a palette a consumer writes into a stylesheet",
    ],
  },
  {
    id: "A11Y-002",
    title: "Focus is borrowed by a widget and handed back once.",
    area: "accessibility",
    severity: "S1",
    publicEvidence: [
      "@modyra/widgets createFocusCustodian — focus is borrowed, not taken",
      "docs/guides/ui-toolkit.md — focus restoration when overlays close",
    ],
  },
  {
    id: "PKG-001",
    title: "Packed consumers observe the same public behaviour as workspace tests.",
    area: "lifecycle",
    severity: "S2",
    publicEvidence: [
      "package.json exports maps of the published packages",
      "docs/architecture/0025-a-tag-publishes-and-nothing-else-does.md",
    ],
  },
  {
    id: "ADP-001",
    title: "An adapter that publishes a door consumes the contract behind it.",
    area: "dynamic-contract",
    severity: "S2",
    publicEvidence: [
      "@modyra/react useMdyDynamicForm — the document path, published and consumed",
      "@modyra/plain mountMdyForm — the same path, named differently",
      "@modyra/angular MdyDynamicFormComponent — a door named for the contract",
      "battle-tests/charter/fable5-hunts.md — H-1",
    ],
  },
  {
    id: "DEV-001",
    title: "The panel describes a value it cannot serialize rather than raising on it.",
    area: "lifecycle",
    severity: "S1",
    publicEvidence: [
      "@modyra/core/devtools mdyFormSnapshot",
      "@modyra/core serialize — a BigInt and a cycle are described so that reading a form's value is never the thing that fails",
      "docs/guides/devtools.md — the panel a developer opens when something is already wrong",
    ],
  },
  {
    id: "EXP-001",
    title: "A condition decides the same thing however it is spelled.",
    area: "dynamic-contract",
    severity: "S1",
    publicEvidence: [
      "@modyra/core evaluateExpression — a closed operator set over a form value, with no eval",
      "@modyra/core MdyFieldOptions.when — the same question asked as a predicate",
      "docs/architecture/0092-a-condition-travels-with-the-form.md",
    ],
  },
];

const BY_ID = new Map();
for (const entry of CLAIMS) {
  assertSeverity(entry.severity);
  if (BY_ID.has(entry.id)) throw new Error(`duplicate claim id ${entry.id}`);
  BY_ID.set(
    entry.id,
    Object.freeze({
      ...entry,
      publicEvidence: Object.freeze([...entry.publicEvidence]),
      permittedDifferences: Object.freeze([...(entry.permittedDifferences ?? [])]),
    }),
  );
}

export const MDY_BATTLE_CLAIMS = Object.freeze([...BY_ID.values()]);

/** The claim, or an error naming the registry — a test may not cite a promise nobody wrote down. */
export function claim(id) {
  const found = BY_ID.get(id);
  if (!found) {
    throw new Error(
      `unregistered claim ${JSON.stringify(id)}; register it in battle-tests/models/claims.mjs ` +
        `(known: ${[...BY_ID.keys()].join(", ")})`,
    );
  }
  return found;
}

export function claimsFor(ids) {
  return ids.map((id) => claim(id));
}

/** The severity of a set of claims is the severity of its worst member. */
export function worstSeverity(ids) {
  return claimsFor(ids)
    .map((entry) => entry.severity)
    .sort()[0];
}

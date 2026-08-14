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

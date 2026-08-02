/**
 * Conformance testing kit for Modyra widget adapters.
 */

export { runCommandExecutionTests } from "./command-tests.js";
export { assertWidgetDomContract, inspectWidgetDom } from "./dom-tests.js";
export type { MdyDomContractIssue, MdyDomContractIssueCode, MdyDomContractOptions, MdyDomPartMap } from "./dom-tests.js";
export { assertWidgetStructureContract, inspectWidgetStructure } from "./structure-tests.js";
export { inspectUnsupportedStateAria, inspectWidgetState } from "./state-tests.js";
export { collectStateMatrix, normalizeStateLedger } from "./state-matrix.js";
export type { MdyStateFixture, MdyStateMatrixOptions, MdyStateMatrixResult, MdyStateMatrixRow } from "./state-matrix.js";
export type { MdyStateInspectOptions, MdyStateIssue, MdyStateIssueCode } from "./state-tests.js";
export type { MdyStructureContractIssue } from "./structure-tests.js";
export { portalRootFor } from "./portal.js";
export { canonicalWidgetSnapshot, compareToCanonical, MDY_CANONICAL_AFTER_ESCAPE, MDY_FOCUS_WITHIN, MDY_CANONICAL_AT_REST, MDY_CANONICAL_DISABLED, MDY_CANONICAL_EMPTY, MDY_CANONICAL_INVALID, MDY_CANONICAL_OPEN } from "./canonical.js";
export type { MdyCanonicalExpectation, MdyCanonicalOptions, MdyCanonicalOverlay, MdyCanonicalPart, MdyCanonicalRelationship, MdyCanonicalSnapshot } from "./canonical.js";

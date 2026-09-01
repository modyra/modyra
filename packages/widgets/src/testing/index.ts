/**
 * Conformance testing kit for Modyra widget adapters.
 */

export { expectedWeekdayOrder, inspectCalendarWeekStart, MDY_CALENDAR_ISSUE } from "./calendar.js";
export type { MdyCalendarIssue, MdyCalendarIssueCode } from "./calendar.js";
export { runCommandExecutionTests } from "./command-tests.js";
export { findPartElement, findPartElements } from "./part-lookup.js";
// `MDY_SEMANTIC_ELEMENTS` is what a conformance run judges an element category against, so it is
// also the answer to "what may I draw for this part" — a renderer author who cannot read it
// invents a mapping instead, and the invention is what the run then refuses.
export { assertWidgetDomContract, inspectWidgetDom, MDY_SEMANTIC_ELEMENTS } from "./dom-tests.js";
export type { MdyDomContractIssue, MdyDomContractIssueCode, MdyDomContractOptions, MdyDomPartMap } from "./dom-tests.js";
export { assertWidgetStructureContract, inspectWidgetStructure } from "./structure-tests.js";
export { inspectUnsupportedStateAria, inspectWidgetState } from "./state-tests.js";
export { collectStateMatrix, normalizeStateLedger, missingFixtureMembers } from "./state-matrix.js";
export { idsUnder, inspectCoexistence, inspectUnmount, MDY_LIFECYCLE_ISSUE, MDY_LIFECYCLE_TRANSITIONS } from "./lifecycle.js";
export type { MdyLifecycleIssue, MdyLifecycleIssueCode, MdyLifecycleTransition, MdyUnmountObservation } from "./lifecycle.js";
export type { MdyStateFixture, MdyStateMatrixOptions, MdyStateMatrixResult, MdyStateMatrixRow } from "./state-matrix.js";
export type { MdyStateInspectOptions, MdyStateIssue, MdyStateIssueCode } from "./state-tests.js";
export type { MdyStructureContractIssue } from "./structure-tests.js";
// Re-exported: the runtime needs it too, so it lives at the package root and this entry
// forwards it rather than holding a second copy.
export { canonicalWidgetSnapshot, compareToCanonical, MDY_CANONICAL_AFTER_ESCAPE, MDY_FOCUS_WITHIN, MDY_CANONICAL_AT_REST, MDY_CANONICAL_DISABLED, MDY_CANONICAL_EMPTY, MDY_CANONICAL_FILLED, MDY_CANONICAL_FILLED_OBSERVATION, MDY_CANONICAL_INVALID, MDY_CANONICAL_OPEN } from "./canonical.js";
export type { MdyCanonicalExpectation, MdyCanonicalOptions, MdyCanonicalOverlay, MdyCanonicalPart, MdyCanonicalRelationship, MdyCanonicalSnapshot } from "./canonical.js";

export { MDY_PAINT_BEATS, settleFor } from "./paint-beat.js";
export type { MdyPaintBeat } from "./paint-beat.js";

/**
 * Conformance fixtures for the select's transitions.
 *
 * They shipped in the runtime entry, which put test data in the bundle of every consumer that
 * imported a class name. They belong to the harness they were written for.
 */
export { selectTransitionFixtures } from "../select/fixtures/transitions.js";
export type { MdySelectTransitionFixture } from "../select/fixtures/transitions.js";
export { MDY_TESTING_VOCABULARIES, type MdyTestingVocabulary } from "./vocabularies.js";

export {
  MDY_NOT_READ,
  reading,
  readingOf,
  readingText,
  readAccessibleName,
  readPartAttribute,
  readPartPresence,
  unread,
} from "./reading.js";
// Only the union. Its two halves and the reason union are reachable through it — a consumer narrows
// on `read` and switches on `reason` without naming either — so exporting them adds three words to
// the surface that buy nothing a reader does not already have. `unread` still takes a reason, and a
// literal is checked against the union at the call site.
export type { MdyAccessibleName, MdyPartObservation, MdyReading } from "./reading.js";

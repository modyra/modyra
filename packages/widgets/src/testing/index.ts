/**
 * Conformance testing kit for Modyra widget adapters.
 */

export { runCommandExecutionTests } from "./command-tests.js";
export { assertWidgetDomContract, inspectWidgetDom } from "./dom-tests.js";
export type { MdyDomContractIssue, MdyDomContractIssueCode, MdyDomContractOptions, MdyDomPartMap } from "./dom-tests.js";
export { assertWidgetStructureContract, inspectWidgetStructure } from "./structure-tests.js";
export { inspectUnsupportedStateAria, inspectWidgetState } from "./state-tests.js";
export type { MdyStateInspectOptions, MdyStateIssue, MdyStateIssueCode } from "./state-tests.js";
export type { MdyStructureContractIssue } from "./structure-tests.js";

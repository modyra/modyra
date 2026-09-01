/**
 * Conformance testing kit for Modyra reactivity adapters.
 */

export {
  reactivityContractLedger,
  resetReactivityContractLedger,
  runReactivityContractTests,
} from "./reactivity-contract.js";
// `MdySkippedReactivityCheck` is deliberately not here. `MdyReactivityTestHarness` is a parameter
// type — a consumer constructs one, so it has to be nameable. A skipped check is only ever read,
// off `reactivityContractLedger()`, where its shape arrives structurally. Exporting the name would
// add a word to the public surface that buys a reader nothing they do not already have.
export type { MdyReactivityTestHarness } from "./reactivity-contract.js";

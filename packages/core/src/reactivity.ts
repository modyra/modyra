/**
 * The reactive contract and its reference runtime, kept together for the consumers that want both.
 *
 * A module that only names the types should import `./reactivity-contract.js` — that is the whole
 * point of the split, and this file exists so the ones that genuinely need `vanillaReactivity()` do
 * not have to say it twice.
 */
export * from "./reactivity-contract.js";
export { vanillaReactivity } from "./vanilla-reactivity.js";

/**
 * Core reactivity contract tests: run the shared suite against the vanilla
 * implementation used by Node and CLI consumers, and by any adapter with no signals of its own.
 */
import { vanillaReactivity } from "../dist/index.js";
import { runReactivityContract } from "./reactivity-contract.mjs";

runReactivityContract("vanillaReactivity", () => vanillaReactivity());

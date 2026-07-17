/**
 * Core reactivity contract tests: run the shared suite against the vanilla
 * implementation used by Node/CLI consumers and by the React/Lit adapters.
 */
import { vanillaReactivity } from "../dist/index.js";
import { runReactivityContract } from "./reactivity-contract.mjs";

runReactivityContract("vanillaReactivity", () => vanillaReactivity());

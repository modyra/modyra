/**
 * Solid reactivity contract tests.
 */
import { solidReactivity } from "../dist/index.js";
import { runReactivityContract } from "../../core/test/reactivity-contract.mjs";

runReactivityContract("solidReactivity", () => solidReactivity());

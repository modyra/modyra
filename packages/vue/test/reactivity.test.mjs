/**
 * Vue reactivity contract tests.
 */
import { vueReactivity } from "../dist/index.js";
import { runReactivityContract } from "../../core/test/reactivity-contract.mjs";

runReactivityContract("vueReactivity", () => vueReactivity());

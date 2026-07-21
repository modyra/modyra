/**
 * Preact reactivity contract tests.
 *
 * Preact has no signal primitive, so the engine runs on the core's vanilla
 * graph. The contract suite verifies that graph; `createStore` behavior is
 * covered separately in `preact.test.mjs`.
 */
import { vanillaReactivity } from "@modyra/core";
import { runReactivityContract } from "../../core/test/reactivity-contract.mjs";

runReactivityContract("preact/vanillaReactivity", () => vanillaReactivity());

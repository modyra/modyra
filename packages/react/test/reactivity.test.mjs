/**
 * React reactivity contract tests.
 *
 * React has no signal primitive, so the engine runs on the core's vanilla
 * graph. The contract suite verifies that graph; `createStore` behavior is
 * covered separately in `react.test.mjs`.
 */
import { vanillaReactivity } from "@modyra/core";
import { runReactivityContract } from "../../core/test/reactivity-contract.mjs";

runReactivityContract("react/vanillaReactivity", () => vanillaReactivity());

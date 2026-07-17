/**
 * Lit reactivity contract tests.
 *
 * Lit uses the core's vanilla graph via `createLitForm` and `MdyFormController`.
 * The contract suite verifies the underlying reactivity implementation.
 */
import { vanillaReactivity } from "@modyra/core";
import { runReactivityContract } from "../../core/test/reactivity-contract.mjs";

runReactivityContract("lit/vanillaReactivity", () => vanillaReactivity());

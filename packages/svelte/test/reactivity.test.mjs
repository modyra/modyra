/**
 * Svelte reactivity contract tests.
 *
 * @modyra/svelte runs on the core's vanilla graph (see index.ts's header
 * comment for why: Svelte's runes need compilation, its stores don't
 * auto-track). The contract suite verifies that graph; `toStore` behavior
 * is covered separately in `svelte.test.mjs`.
 */
import { vanillaReactivity } from "@modyra/core";
import { runReactivityContract } from "../../core/test/reactivity-contract.mjs";

runReactivityContract("svelte/vanillaReactivity", () => vanillaReactivity());

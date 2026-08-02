/**
 * `@modyra/lit`'s conformance config — a second renderer, so the config contract is shown to be
 * adapter-agnostic rather than shaped around one implementation.
 *
 *   node scripts/conformance-cli.mjs packages/lit/conformance.config.mjs
 *
 * The interesting difference from `packages/plain`'s is `absentParts`. This renderer mounts its
 * popups lazily — measured, not assumed: its conformance manifest records every overlay kind as
 * `lazy`, where Plain records all six as `eager`. At rest it therefore renders none of its popup,
 * and says so. Plain declares a hand-maintained list instead, because an eagerly-mounted popup is
 * genuinely in the DOM and only a few of its parts are missing.
 *
 * Both are conformant. The contract leaves mount strategy free, which is exactly why each adapter
 * has to state its own answer rather than inherit one.
 */
import { installDomGlobals } from "./test/support/dom-env.mjs";

installDomGlobals();

const fixture = await import("./test/support/state-fixture.mjs");
const { overlayOnlyParts } = await import("../widgets/dist/index.js");

export const name = "@modyra/lit";
export const kinds = fixture.KINDS;
export const mount = fixture.mount;

/** Nothing inside the popup exists until the popup does. */
export const absentParts = Object.fromEntries(
  kinds.map((kind) => [kind, overlayOnlyParts(kind)]),
);

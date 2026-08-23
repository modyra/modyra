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

/**
 * Two instances that are meant to differ.
 *
 * The prose here used to say this renderer minted `mdy-field-N` per element and so could not produce
 * two instances sharing ids. That counter went with [ADR 0135](../../docs/architecture/0135-an-id-is-a-function-of-the-document.md),
 * which made an id a function of the field's path, and the claim outlived the mechanism: two mounts
 * of one document shared every id, and the suite reported it against a config that said it could not
 * happen.
 *
 * A form carries a scope now ([ADR 0146](../../docs/architecture/0146-a-form-carries-its-own-scope.md)),
 * and its default is a function of the document — which cannot separate two forms built from the
 * *same* document. This renderer computes an id while rendering, before its element is in a
 * document, so it has nothing to compare against and the twin case is the consumer's to answer. This
 * is where it answers it.
 */
export const mountScoped = (kind, scope) => mount(kind, { idScope: scope });

/**
 * Kinds whose anatomy depends on configuration, and the values this renderer supports.
 *
 * Declared because a suite that mounts one variant reports full coverage having rendered half the
 * widget — the same shape as the gap the variants exist to close. The names are the config's own.
 */
/**
 * This config passes the kit's `rules` and `value` to its fixture.
 *
 * Declared rather than assumed: without it the kit cannot tell a renderer that ignores a declared
 * constraint from a config that never handed it one, and reporting the first when it is the second
 * would be an accusation the kit cannot support.
 */
export const declaresRules = true;

export const variants = { multiselect: ["single", "multi"] };

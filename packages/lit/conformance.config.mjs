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
export const mount = async (kind, asked) => {
  const mounted = await fixture.mount(kind, asked);
  return {
    ...mounted,
    /**
     * Put a value in the model, whatever a document's declaration would have done with it.
     *
     * Not the same door as an initial value: a declaration of the wrong shape is refused with a
     * warning, correctly. What the engine *holds* is what a form writes into it, and a value of the
     * wrong shape held there is a verdict the control has to stay on the page to show.
     */
    hold: (value) => { mounted.handle.set(value); },
  };
};

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
/**
 * This config passes the kit's `config` — a document's declarations that are not rules — to its
 * fixture, which sets them as properties.
 *
 * Undeclared, the kit skipped that whole section for this renderer and reported it "not
 * established": three separate measurements this night read its silence as a renderer that ignores
 * a declaration, when it was a config that had never been handed one.
 */
// NOT declared yet, deliberately. Turning it on made the kit ask this renderer the section it had
// been skipping, and the answer was that a datepicker announces the field's path where the document
// declared a name.
//
// **What that answer is has not been established, and the first explanation written here was wrong.**
// It said the element's `ariaLabel` property collides with the one `HTMLElement` reflects; measured,
// this environment reflects it and the attribute does arrive. Probing further, the same setup makes
// a text field and a datepicker behave identically, while the kit's section separated them — so the
// bench is the variable and not the renderer, and the name a platform actually computes is not
// something this environment can answer.
//
// The flag lands with a diagnosis from a reader that computes names the way a browser does, not
// before: a gate whose red nobody can explain teaches people to skip it.
// export const declaresConfig = true;

// Both shapes, because this renderer draws both: a select that filters is the combobox and one that
// does not is the platform's chooser, which has no trigger and no popup and is the better control
// for a plain list.
export const variants = { multiselect: ["single", "multi"], select: ["native", "custom"] };

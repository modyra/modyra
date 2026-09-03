/**
 * `@modyra/vue`'s conformance config, written before the renderer it describes.
 *
 * The kit refuses a config by naming what it lacks, before it drives anything — so a config written
 * first is a work list, and a config written last can only report that everything is missing. That
 * is the whole reason this file exists ahead of a single rendered kind: what it prints today is the
 * order the units that follow have to be built in.
 *
 * The DOM is installed here, as every config installs its own: a framework runtime needs more
 * globals than a hand-written renderer, and this package's harness says which and why.
 */
import { installDomGlobals } from "./test/support/dom-env.mjs";

installDomGlobals();

export const name = "@modyra/vue";

/**
 * The kinds this adapter draws, which is none of them yet.
 *
 * Declared as an empty list rather than as the seventeen it will eventually answer, because a config
 * naming a kind it cannot mount reports a renderer that is broken rather than one that is unwritten
 * — and those need opposite work. A kind joins this list in the commit that makes it mountable.
 */
export const kinds = [];

/**
 * Mounting one widget, which nothing here can do yet.
 *
 * Named and refusing rather than absent: a missing export is reported by the kit as a config defect,
 * and this is not one — it is the renderer that is missing, and the message says so. The shape below
 * is the shape a real mount owes, kept here as the specification the first kind has to satisfy:
 * `root`, `parts`, `drive`, `settle`, `dispose`, plus `control`, `value` and `press` where the
 * adapter can answer them.
 */
export const mount = async (kind) => {
  throw new Error(
    `@modyra/vue draws no widgets yet, so ${kind} cannot be mounted. This config exists before the `
    + "renderer on purpose: it is the bench the skeleton is built against, and `kinds` is empty until "
    + "a kind can be drawn and inspected.",
  );
};

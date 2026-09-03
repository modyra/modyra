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

const { createApp, h } = await import("vue");
const { MdyTextField } = await import("./dist/index.js");
const { createVueForm, field } = await import("./dist/index.js");

export const name = "@modyra/vue";

/**
 * The kinds this adapter draws.
 *
 * A kind joins this list in the commit that makes it mountable, never before: a config naming a kind
 * it cannot mount reports a renderer that is broken rather than one that is unwritten, and those
 * need opposite work.
 */
export const kinds = ["text", "email", "password", "textarea"];

/**
 * Mounting one widget, ready for the kit to inspect.
 *
 * `root`, `parts`, `drive`, `settle` and `dispose` are owed. `drive` answers `false` for every state
 * this adapter cannot reach yet, which is the honest word for it: the kit skips what a renderer says
 * it cannot do and reports a state silently unreachable as conformance.
 */
export const mount = async (kind) => {
  if (!kinds.includes(kind)) {
    throw new Error(`@modyra/vue draws ${kinds.join(", ")} so far, and ${kind} is not among them.`);
  }
  const host = document.createElement("div");
  document.body.append(host);
  const form = createVueForm({ value: field("") });
  const app = createApp({
    render: () => h(MdyTextField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, kind }),
  });
  app.mount(host);

  const root = () => host.firstElementChild;
  return {
    root: root(),
    parts: () => ({
      root: root(),
      label: host.querySelector(".mdy-label"),
      inputWrapper: host.querySelector(".mdy-input-wrapper"),
      // The control is whichever tag the kind declares, asked of the page rather than assumed: this
      // renderer draws a textarea for one of these kinds and an input for the rest.
      control: host.querySelector("input, textarea"),
      supportingText: host.querySelector(".mdy-supporting-text"),
      errors: host.querySelector(".mdy-control__errors"),
    }),
    // Nothing yet: the states the kit drives arrive with the units that make them reachable, and
    // saying so is what keeps a state nobody can reach out of the conformance count.
    drive: () => false,
    settle: async () => { await new Promise((resolve) => setTimeout(resolve, 0)); },
    dispose: () => { app.unmount(); host.remove(); },
    control: () => host.querySelector("input, textarea"),
    value: () => host.querySelector("input, textarea")?.value ?? "",
  };
};

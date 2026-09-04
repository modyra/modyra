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
const { MdyTextField, MdyBooleanField, MdySliderField, MdyFileField, MdyOptionField, MdySelectField } = await import("./dist/index.js");
const { createVueForm, field } = await import("./dist/index.js");
const { MDY_CANONICAL_EMPTY, findPartElements } = await import("@modyra/widgets/testing");
const { MDY_WIDGET_CONTRACTS } = await import("@modyra/widgets");

export const name = "@modyra/vue";

/**
 * The kinds this adapter draws.
 *
 * A kind joins this list in the commit that makes it mountable, never before: a config naming a kind
 * it cannot mount reports a renderer that is broken rather than one that is unwritten, and those
 * need opposite work.
 */
export const kinds = ["text", "email", "password", "textarea", "number", "checkbox", "toggle", "slider", "file", "radio", "segmented", "select"];

/** Which component draws a kind, read from the shape rather than from a list of names. */
const BOOLEAN = new Set(["checkbox", "toggle"]);
const GROUP = new Set(["radio", "segmented"]);
// The shape with a panel of ours. The other one is the platform's chooser, which this package does
// not draw, so it is not among the variants declared below.
const NEEDS_OPTIONS = new Set(["radio", "segmented", "select"]);
/** Two options, because a group with one cannot show a roving focus moving. */
const GROUP_OPTIONS = [{ value: "a", label: "First" }, { value: "b", label: "Second" }];

/**
 * Mounting one widget, ready for the kit to inspect.
 *
 * `root`, `parts`, `drive`, `settle` and `dispose` are owed. `drive` answers `false` for every state
 * this adapter cannot reach yet, which is the honest word for it: the kit skips what a renderer says
 * it cannot do and reports a state silently unreachable as conformance.
 */
/**
 * This config passes the kit's `rules` and `value` through to the field it builds, so the sections
 * that need them run instead of reporting themselves unestablished.
 */
export const declaresRules = true;

// Both shapes of the select are drawn here, so both are declared: the combobox this package builds
// and the platform's chooser it hands a non-filtering field to. A shape left off this list is one
// the suite never mounts — a defect in it stays green, which was measured rather than assumed.
export const variants = { select: ["native", "custom"] };

export const mount = async (kind, { rules, value, variant } = {}) => {
  if (!kinds.includes(kind)) {
    throw new Error(`@modyra/vue draws ${kinds.join(", ")} so far, and ${kind} is not among them.`);
  }
  const host = document.createElement("div");
  document.body.append(host);
  // The empty the kind declares, so the form starts where the contract says it starts rather than at
  // a string this file chose.
  const form = createVueForm({
    value: field(value === undefined ? MDY_CANONICAL_EMPTY[kind] : value, [], rules ? { rules } : undefined),
  });
  const app = createApp({
    render: () => (kind === "select"
      ? h(MdySelectField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, options: GROUP_OPTIONS,
          // `custom` is the shape that filters; asked for neither, the state matrix means the one
          // whose states it describes, which is the one with an `open`.
          searchable: variant === undefined || variant === "custom" })
      : GROUP.has(kind)
      ? h(MdyOptionField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, kind, options: GROUP_OPTIONS })
      : kind === "file"
      ? h(MdyFileField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}` })
      : kind === "slider"
      ? h(MdySliderField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}` })
      : BOOLEAN.has(kind)
      ? h(MdyBooleanField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, kind })
      : h(MdyTextField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, kind })),
  });
  app.mount(host);

  const root = () => host.firstElementChild;
  return {
    root: root(),
    // Resolved from the catalogue, never from a selector this file chose. A map written by hand is a
    // map written for one kind: the first version named the text field's wrapper class and was right
    // for four kinds by resemblance, then reported a checkbox's wrapper as missing while it was on
    // the page. `findPartElements` is the same lookup the kit uses on itself.
    parts: () => Object.fromEntries(
      MDY_WIDGET_CONTRACTS[kind].structure.nodes
        .map((node) => [node.part, findPartElements(host, kind, node.part)])
        .filter(([, found]) => found.length > 0)
        .map(([part, found]) => [part, found.length === 1 ? found[0] : found]),
    ),
    // Nothing yet: the states the kit drives arrive with the units that make them reachable, and
    // saying so is what keeps a state nobody can reach out of the conformance count.
    // Only what this renderer can actually be put into. `open` is answered for the kind that draws
    // a panel; every other state is still `false`, which keeps a state nobody can reach out of the
    // conformance count rather than reporting it as met.
    drive: (state) => {
      if (state !== "open" || kind !== "select") return false;
      const trigger = host.querySelector(".mdy-select__trigger");
      if (trigger === null) return false;
      trigger.click();
      return true;
    },
    settle: async () => { await new Promise((resolve) => setTimeout(resolve, 0)); },
    dispose: () => { app.unmount(); host.remove(); },
    control: () => host.querySelector("input, textarea"),
    // The field's value, not the control's text. What a kind holds when it holds nothing is the
    // kind's own answer — a number field is empty at `null` and a text field at `""` — and reading
    // the DOM string reports `""` for both, which is right for one of them by accident.
    value: () => form.f.value.value(),
  };
};

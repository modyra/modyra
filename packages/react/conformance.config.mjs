/**
 * What the conformance kit needs to inspect `@modyra/react`.
 *
 * Written with the first components rather than after them, so every kind that lands is judged by
 * the kit on the day it lands instead of accumulating unwatched. The Vue march proved the order: the
 * suite finds what a reading does not.
 *
 * `root`, `parts`, `drive`, `settle` and `dispose` are owed. `drive` answers `false` for every state
 * this adapter cannot reach yet, which is the honest word for it — the kit skips what a renderer
 * says it cannot do, and reports a state silently unreachable as conformance.
 */
import { installDomGlobals } from "./test/support/dom-env.mjs";

installDomGlobals();

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { createForm, field } = await import("./dist/index.js");
const { MdyTextField, MdyBooleanField, MdyOptionField, MdySelectField, MdyMultiselectField } = await import("./dist/index.js");
const { MDY_CANONICAL_EMPTY, findPartElements } = await import("@modyra/widgets/testing");
const { MDY_WIDGET_CONTRACTS } = await import("@modyra/widgets");

/** The package this config speaks for, as the kit reports it. */
export const name = "@modyra/react";

/** The kinds this adapter draws. */
export const kinds = ["text", "email", "password", "textarea", "number", "checkbox", "toggle", "radio", "segmented", "select", "multiselect"];

/** This config passes the kit's `rules` and `value` through to the field it builds. */
export const declaresRules = true;

/**
 * The kit's `config` — a document's declarations that are not rules — is passed through by `mount`,
 * and this says `false` anyway, because the components do not yet read it.
 *
 * Measured by turning it on: seven kinds are asked, and all seven fail. A document that declares the
 * control's name gets a control announced as nothing (`ariaLabel` is not a prop any of these
 * components accepts), and a number told `step: 2` carries no step. Declaring `true` here would put
 * eight findings on a shared gate; declaring it and saying nothing would hide them.
 *
 * The repair is not a prop added to each component: the renderer that already reads a document's
 * name writes the same expression once per kind, which is the shape this repository keeps removing.
 * It belongs with the kinds, where a door can be asked for instead of copied.
 */
export const declaresConfig = false;

/**
 * Which component draws each kind, and what it is told beyond the field.
 *
 * One entry per kind rather than a chain of conditions: a kind added to `kinds` and to no component
 * fails here by name, instead of being drawn by whichever branch happened to be last.
 */
const DRAWN_BY = {
  text: [MdyTextField, {}],
  email: [MdyTextField, {}],
  password: [MdyTextField, {}],
  textarea: [MdyTextField, {}],
  number: [MdyTextField, {}],
  checkbox: [MdyBooleanField, {}],
  toggle: [MdyBooleanField, {}],
  radio: [MdyOptionField, { options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }],
  segmented: [MdyOptionField, { options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }],
  // Searchable, because that is the shape with a panel of ours. The chooser the platform draws is
  // the same kind and a different control, and the kit judges whichever one is mounted.
  select: [MdySelectField, { searchable: true, options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }],
  // `single` is the mode's default and the shape a set of toggles has; the bag is the same component
  // with a stepper and a count per row, and the kit judges whichever one is mounted.
  multiselect: [MdyMultiselectField, { searchable: true, options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }],
};

/** Long enough for React to commit what was just rendered. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

export const mount = async (kind, { rules, value, config } = {}) => {
  if (!kinds.includes(kind)) {
    throw new Error(`@modyra/react draws ${kinds.join(", ")} so far, and ${kind} is not among them.`);
  }
  const host = document.createElement("div");
  document.body.append(host);
  // The empty the kind declares, so the form starts where the contract says rather than at a string
  // this file chose: a number field is empty at `null` and a text field at `""`.
  const form = createForm({
    value: field(value === undefined ? MDY_CANONICAL_EMPTY[kind] : value, [], rules ? { rules } : undefined),
  });
  const root = createRoot(host);
  const [Component, extra] = DRAWN_BY[kind];
  root.render(React.createElement(Component, {
    field: form.f.value, kind, label: "Given", widgetId: `react-${kind}`, ...extra, ...(config ?? {}),
  }));
  // React commits on its own schedule, and one macrotask is not always enough: read too early and
  // the host is still empty, which the kit reports as a widget that drew nothing.
  await settled();

  return {
    root: host.firstElementChild,
    // Resolved from the catalogue, never from a selector this file chose — and searched from the
    // document, because a part may be drawn outside the field it belongs to.
    parts: () => Object.fromEntries(
      MDY_WIDGET_CONTRACTS[kind].structure.nodes
        .map((node) => [node.part, findPartElements(document.body, kind, node.part)])
        .filter(([, found]) => found.length > 0)
        .map(([part, found]) => [part, found.length === 1 ? found[0] : found]),
    ),
    // Only what this renderer can actually be put into. `open` is answered for the kind that draws
    // a panel; every other state is still `false`, which keeps a state nobody can reach out of the
    // conformance count rather than reporting it as met.
    drive: (state) => {
      // Taking a field out of play is the form's answer, not the control's: a renderer that only
      // set the attribute would report a widget disabled while the engine still accepted a value.
      if (state === "disabled") { form.setDisabled("value", () => true); return true; }
      if (state === "readonly") { form.setReadonly("value", () => true); return true; }
      if (state !== "open") return false;
      // The element that opens a panel is the button that says it opens one. More than one element
      // can carry `aria-expanded`, and pressing the one that is not a button does nothing at all —
      // which would hand the kit a shut widget and let it call the emptiness conformant.
      //
      // The press is not verified here because it cannot be: this runs before React has drawn the
      // result, and the kit settles afterwards. What catches a press that did nothing is the
      // inspection that follows, where a panel that never opened is its required parts missing.
      const opener = host.querySelector("button[aria-expanded]") ?? host.querySelector("[aria-expanded]");
      if (opener === null) return false;
      opener.click();
      return true;
    },
    settle: settled,
    dispose: () => { root.unmount(); host.remove(); },
    // The control the kind declares, resolved from the catalogue: the option kinds draw one input
    // per choice, and a bare `querySelector` would answer with whichever came first as though it
    // were the widget's control.
    control: () => findPartElements(document.body, kind, MDY_WIDGET_CONTRACTS[kind].parts.optionControl ? "optionControl" : "control")[0]
      ?? host.querySelector("input, textarea"),
    // The field's value, not the control's text: what a kind holds when it holds nothing is the
    // kind's own answer, and reading the DOM string reports `""` for both a number and a text field.
    value: () => form.f.value.value(),
    /** Put a value in the model — what the engine holds, rather than what a document declares. */
    hold: (value) => { form.f.value.set(value); },
  };
};

/**
 * Two instances that are meant to differ.
 *
 * Optional, and the kit says so when it is missing: two mounts of the same fixture share their field
 * names and so share their ids, which is documented behaviour rather than a defect. A renderer that
 * can scope its ids says how here, and this one does it with the id a document declares.
 */
export const mountScoped = async (kind, scope) => {
  const host = document.createElement("div");
  document.body.append(host);
  const form = createForm({ value: field(MDY_CANONICAL_EMPTY[kind], []) });
  const root = createRoot(host);
  const [Component, extra] = DRAWN_BY[kind];
  root.render(React.createElement(Component, {
    field: form.f.value, kind, label: "Given", widgetId: `react-${kind}-${scope}`, ...extra,
  }));
  await settled();
  return {
    root: host.firstElementChild ?? host,
    parts: () => ({}),
    settle: settled,
    dispose: () => { root.unmount(); host.remove(); },
  };
};

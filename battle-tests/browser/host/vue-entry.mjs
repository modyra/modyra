/**
 * The page a browser battle attacks, rendered by `@modyra/vue`.
 *
 * Everything a host does — parsing a document, building a layout, holding the forms, answering what
 * was submitted — lives in `shared-host.mjs`, which every renderer answers with. What is here is the
 * step that is genuinely Vue's: mounting one component and taking it down again.
 */
import { createApp, h } from "vue";
import {
  createVueForm,
  MdyBooleanField,
  MdyColorsField,
  MdyDatepickerField,
  MdyDaterangeField,
  MdyFileField,
  MdyFormErrors,
  MdyMultiselectField,
  MdyOptionField,
  MdySelectField,
  MdySliderField,
  MdyTextField,
  MdyTimepickerField,
} from "@modyra/vue";
import { createBattleHost } from "./shared-host.mjs";

/**
 * The component that draws each kind, and the props that choose which of its shapes to draw.
 *
 * **Eleven components for seventeen kinds**, because the catalogue says several kinds are one shape:
 * a text field and an email field differ by a native type, not by an anatomy. The kind travels as a
 * prop rather than as a tag, which is the whole difference from a renderer that registers one
 * element per kind.
 *
 * The same table the Vue demo draws from. A second derivation of "which component draws a kind"
 * would be a copy that drifts the day a kind moves, and this is the one fact both pages need.
 */
const DRAWN_BY = {
  text: [MdyTextField, { kind: "text" }],
  email: [MdyTextField, { kind: "email" }],
  password: [MdyTextField, { kind: "password" }],
  textarea: [MdyTextField, { kind: "textarea" }],
  number: [MdyTextField, { kind: "number" }],
  checkbox: [MdyBooleanField, { kind: "checkbox" }],
  toggle: [MdyBooleanField, { kind: "toggle" }],
  radio: [MdyOptionField, { kind: "radio" }],
  segmented: [MdyOptionField, { kind: "segmented" }],
  // No shape forced: whether a select filters is the document's word, forwarded below, and
  // `variantOf` turns it into the native or the custom shape as it does for every other host.
  select: [MdySelectField, {}],
  multiselect: [MdyMultiselectField, { mode: "single" }],
  slider: [MdySliderField, {}],
  file: [MdyFileField, {}],
  datepicker: [MdyDatepickerField, {}],
  daterange: [MdyDaterangeField, {}],
  timepicker: [MdyTimepickerField, {}],
  colors: [MdyColorsField, {}],
};

/** What the document says about a field that is the form's business rather than the component's. */
const NOT_A_PROP = ["name", "kind", "label", "initialValue", "validators"];

/**
 * How `@modyra/vue` puts one field on the page: an application rendering one component.
 *
 * **Its own container, not the group itself.** Mounting an application into a node empties that node
 * first, so mounting straight into the group a document declared would delete the field mounted
 * before it. The container is what makes several fields in one group possible.
 *
 * **`widgetId` is never passed.** The component derives it from the field's path and its form's
 * scope, which is what a consumer who names nothing gets. A host that writes the bare name puts the
 * path's separator into ids and gives two forms built from one document the same ids. A host that
 * joins a prefix with `__` writes the id delimiter, which the id policy refuses, so nothing renders.
 * A scope the caller asked for travels as `idScope`, the way the other hosts hand it over.
 */
function mountOneField({ declared, handle, into, idPrefix }) {
  const drawn = DRAWN_BY[declared.kind];
  // Refused rather than skipped: a kind this renderer cannot draw is a hole, and a host that
  // quietly mounts sixteen of seventeen reports as a renderer that merely fails the seventeenth.
  if (drawn === undefined) {
    throw new Error(`[modyra] Unknown dynamic field kind: ${JSON.stringify(declared)}`);
  }
  const [component, shape] = drawn;

  const props = { ...shape };
  // Everything else the document says about the field is the component's to render — a bound, a
  // step, the options. Forwarding only what this host happens to name makes a renderer look like it
  // ignores a property the document declared.
  for (const [name, value] of Object.entries(declared)) {
    if (NOT_A_PROP.includes(name)) continue;
    if (value === undefined || value === null) continue;
    props[name] = value;
  }
  props.field = handle;
  props.label = declared.label ?? declared.name;
  if (idPrefix !== null && idPrefix !== undefined) props.idScope = String(idPrefix);

  const container = document.createElement("div");
  into.append(container);
  const app = createApp({ render: () => h(component, props) });
  app.mount(container);

  // What the host could not do for itself. A panel this component opens is teleported to the body,
  // so it is not under the host and removing the host would leave it on the page.
  return {
    dispose() {
      app.unmount();
      container.remove();
    },
  };
}

/**
 * The form's own error region, placed by the host as a Vue application does.
 *
 * The shared host hands the form over by assigning `.form` to the element it is given, which is the
 * custom-element convention. A Vue component takes the form as a prop instead, so the element here is
 * a plain container whose `form` setter mounts the component with it.
 */
function errorSummaryElement() {
  const container = document.createElement("div");
  let app = null;
  Object.defineProperty(container, "form", {
    set(form) {
      app?.unmount();
      app = createApp({ render: () => h(MdyFormErrors, { form }) });
      app.mount(container);
    },
  });
  return container;
}

window.battleVue = createBattleHost({
  createForm: createVueForm,
  mountOneField,
  errorSummaryElement,
});

window.battleVueReady = true;

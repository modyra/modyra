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
  select: [MdySelectField, { searchable: true }],
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
 * **`widgetId` is always passed**, never left to the component. Vue requires it and React can derive
 * one, so a host that passes it always is correct for both, and the day a renderer that could have
 * generated one is added, nothing here changes.
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
  props.widgetId = idPrefix === null || idPrefix === undefined
    ? declared.name
    : `${idPrefix}__${declared.name}`;

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

window.battleVue = createBattleHost({
  createForm: createVueForm,
  mountOneField,
});

window.battleVueReady = true;

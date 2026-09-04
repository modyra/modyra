/**
 * The page a browser battle attacks, rendered by `@modyra/react`.
 *
 * Everything a host does lives in `shared-host.mjs`; what is here is the step that is genuinely
 * React's — putting one component on the page and taking it down again.
 *
 * **The form is made outside React on purpose.** `useMdyForm` is the door a component author uses,
 * and it is a hook: it belongs to a component's lifetime, which is not what a host has. `createForm`
 * is the same form without that binding, and React's components read a handle through their own
 * hooks either way — so this host drives the published components exactly as an application does,
 * and the only thing it declines is a lifetime it does not have.
 */
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  createForm,
  MdyBooleanField,
  MdyOptionField,
  MdyTextField,
} from "@modyra/react";
import { createBattleHost } from "./shared-host.mjs";

/**
 * The component that draws each kind, and the prop that chooses which of its shapes to draw.
 *
 * **Three components, nine kinds** — the catalogue says the text-like kinds are one anatomy, the two
 * boolean kinds another, the two choice kinds a third. The eight that are missing are missing from
 * the package, not from this table, and a kind absent here is refused loudly below rather than
 * skipped: a host that quietly mounts nine of seventeen reports a renderer that fails the other
 * eight, which is a different and much worse claim than "these are not written yet".
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
};

/** What the document says about a field that is the form's business rather than the component's. */
const NOT_A_PROP = ["name", "kind", "label", "initialValue", "validators"];

/**
 * How `@modyra/react` puts one field on the page: a root rendering one component.
 *
 * **Committed synchronously.** React schedules work, and the host answers `mounted` to a caller that
 * reads the page on the next line. Without `flushSync` the answer would be true and the page empty
 * for a tick — a race that reports as a renderer drawing nothing, intermittently, which is the
 * hardest shape of all to diagnose.
 *
 * **`widgetId` is passed even though React need not be given one.** It is optional here because
 * `useId` can produce one and required in other renderers; passing it always is correct for both,
 * and it keeps ids the same across renderers so a spec comparing them is comparing renderers rather
 * than two id schemes.
 */
function mountOneField({ declared, handle, into, idPrefix }) {
  const drawn = DRAWN_BY[declared.kind];
  if (drawn === undefined) {
    throw new Error(`[modyra] Unknown dynamic field kind: ${JSON.stringify(declared)}`);
  }
  const [component, shape] = drawn;

  const props = { ...shape };
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
  const root = createRoot(container);
  flushSync(() => root.render(createElement(component, props)));

  return {
    dispose() {
      // Out of React's hands before the node goes: a root unmounted after its container is detached
      // cannot run the cleanup its effects declared.
      root.unmount();
      container.remove();
    },
  };
}

window.battleReact = createBattleHost({
  createForm,
  mountOneField,
});

window.battleReactReady = true;

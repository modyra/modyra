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
const { MdyTextField } = await import("./dist/index.js");
const { MDY_CANONICAL_EMPTY, findPartElements } = await import("@modyra/widgets/testing");
const { MDY_WIDGET_CONTRACTS } = await import("@modyra/widgets");

/** The package this config speaks for, as the kit reports it. */
export const name = "@modyra/react";

/** The kinds this adapter draws. */
export const kinds = ["text", "email", "password", "textarea", "number"];

/** This config passes the kit's `rules` and `value` through to the field it builds. */
export const declaresRules = true;

const TEXT_LIKE = new Set(kinds);

/** Long enough for React to commit what was just rendered. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

export const mount = async (kind, { rules, value } = {}) => {
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
  root.render(React.createElement(TEXT_LIKE.has(kind) ? MdyTextField : MdyTextField, {
    field: form.f.value, kind, label: "Given", widgetId: `react-${kind}`,
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
    drive: () => false,
    settle: settled,
    dispose: () => { root.unmount(); host.remove(); },
    control: () => host.querySelector("input, textarea"),
    // The field's value, not the control's text: what a kind holds when it holds nothing is the
    // kind's own answer, and reading the DOM string reports `""` for both a number and a text field.
    value: () => form.f.value.value(),
  };
};

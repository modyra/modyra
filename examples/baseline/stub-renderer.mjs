/**
 * A renderer built from the published contract alone, for issue #2.
 *
 * The rule it follows: read `MDY_WIDGET_CONTRACTS[kind]`, create one element per node in
 * `structure.nodes`, put it under the node's `parent`, give it the classes `parts[node].classes`
 * names, and stop. Nothing about this file was written by reading a renderer in this repository —
 * that is the point of the exercise, and a file that peeked would answer a different question.
 *
 * It is deliberately naive in one respect that a real renderer would not be: it draws the required
 * nodes and skips the optional ones, because that is what "optional" invites a first reader to do.
 * What conformance says about that choice is the measurement.
 */
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

/** The tag a semantic element is drawn with, guessed from its name — the contract names roles, not tags. */
const TAG = {
  root: "div", group: "div", container: "div", label: "label", text: "span",
  input: "input", status: "div", presentation: "span", image: "span",
  submission: "input", button: "button", list: "ul", listitem: "li",
};

/** Kinds this stub claims. Two, because the issue says one that passes beats none. */
export const KINDS = ["text", "checkbox"];

export function mount(kind) {
  const contract = MDY_WIDGET_CONTRACTS[kind];
  const host = document.createElement("div");
  document.body.append(host);

  const made = new Map();
  // `order` is what the contract gives for sibling sequence; nodes arrive parent-before-child here
  // because the contract lists them that way, and a reader has nothing else to go on.
  for (const node of [...contract.structure.nodes].sort((a, b) => a.order - b.order)) {
    if (node.optional) continue;
    const element = document.createElement(TAG[node.element] ?? "div");
    const part = contract.parts[node.part] ?? {};
    for (const one of part.classes ?? []) element.classList.add(one);
    // `role` and `attributes` sit on the same part object as `classes`. Reading only the classes is
    // the easy mistake: the tree comes from `structure.nodes` and the look from `parts`, so a reader
    // who takes the tree from one and the classes from the other can stop before the rest.
    if (part.role) element.setAttribute("role", part.role);
    for (const [k, v] of Object.entries(part.attributes ?? {})) {
      if (v !== null && v !== undefined) element.setAttribute(k, String(v));
    }
    const parent = node.parent ? made.get(node.parent) : host;
    // A required node whose parent was skipped has nowhere to go. Reported rather than dropped:
    // silently reparenting it to the root would hide the question this exercise exists to ask.
    if (parent === undefined) {
      element.dataset.mdyStubOrphan = `${node.part} wants ${node.parent}, which is optional`;
      host.append(element);
    } else {
      parent.append(element);
    }
    made.set(node.part, element);
  }

  return {
    root: made.get("root") ?? host,
    // **Where each part is.** `MdyStateFixture.parts()` returns an `MdyDomPartMap`, whose own
    // declaration says it plainly: `Record<string, Element>`, and *"parts absent from the map are
    // treated as not rendered"*. Returning `{}` therefore reports a widget with nothing in it,
    // whatever was drawn — which is what this file did, and why its findings were about the fixture
    // rather than about the drawing.
    //
    // Nothing here inspects the DOM to find them: the loop above already knows which element it made
    // for each part, so the map is that knowledge handed over rather than rediscovered.
    parts: () => Object.fromEntries(made),
    // The value the field holds. Optional in the type — "when the adapter can name it" — but a
    // renderer that draws an input can name it, and declining leaves the kit comparing against
    // `undefined` where the contract's `valueSlot` says what to read.
    value: () => {
      const control = made.get("control") ?? made.get("indicator");
      if (control === undefined) return undefined;
      const slot = contract.valueSlot;
      return slot === "checked" ? control.checked === true : control.value ?? "";
    },
    //
    // `false` is the honest answer for a renderer that draws and does not drive: the kit collects
    // those as `undrivable` and says so, instead of reporting a state as observed when nothing put
    // the widget in it.
    drive: () => false,
    settle: () => undefined,
    dispose: () => host.remove(),
  };
}

/**
 * Two instances that must not share ids — the section a config unlocks by exporting this.
 *
 * The scope is taken and ignored, because this renderer writes no ids at all: the contract's parts
 * carry classes, roles and attributes, and nothing here derives an id from a field name. Answering
 * the question badly is more informative than declining it, since what the suite reports is exactly
 * what a renderer that forgot ids looks like from outside.
 */
export function mountScoped(kind, _scope) {
  return mount(kind);
}

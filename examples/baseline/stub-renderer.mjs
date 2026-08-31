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
    parts: () => ({}),
    // The member the reference config does not show, because it delegates to a fixture that has it.
    // It is declared — `MdyStateFixture` in `@modyra/widgets/testing`, and the tool's own header
    // says `mount` returns one — but a reader who copies the reference and not the header meets it
    // as a crash inside the kit rather than as a requirement.
    //
    // `false` is the honest answer for a renderer that draws and does not drive: the kit collects
    // those as `undrivable` and says so, instead of reporting a state as observed when nothing put
    // the widget in it.
    drive: () => false,
    settle: () => undefined,
    dispose: () => host.remove(),
  };
}

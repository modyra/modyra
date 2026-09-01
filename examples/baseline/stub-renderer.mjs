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
import { MDY_VALUE_CONTRACTS } from "@modyra/core";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_RELATIONS } from "@modyra/widgets";

/** The tag a semantic element is drawn with, guessed from its name — the contract names roles, not tags. */
const TAG = {
  root: "div", group: "div", container: "div", label: "label", text: "span",
  input: "input", status: "div", presentation: "span", image: "span",
  submission: "input", button: "button", list: "ul", listitem: "li",
};

/** Kinds this stub claims. Two, because the issue says one that passes beats none. */
export const KINDS = ["text", "checkbox"];

/**
 * The rules a document declares, put where a control carries them.
 *
 * The kit hands them in the contract's vocabulary and asks that they reach the control; on an
 * `<input>` the platform already has the words, so the translation is a rename and nothing more.
 * A rule with no native spelling is left alone rather than approximated — a renderer that invented
 * an attribute would be answering a question nobody asked.
 */
const ATTRIBUTE = {
  required: "required", minLength: "minlength", maxLength: "maxlength",
  min: "min", max: "max", pattern: "pattern", step: "step",
};

export function mount(kind, asked = {}) {
  const contract = MDY_WIDGET_CONTRACTS[kind];
  const host = document.createElement("div");
  document.body.append(host);

  const made = new Map();
  // `order` is what the contract gives for sibling sequence; nodes arrive parent-before-child here
  // because the contract lists them that way, and a reader has nothing else to go on.
  // **Neither the declared order nor `order` gives a tree.** `order` is a sibling sequence — two nodes
  // under different parents both carry `order: 0` — so sorting the whole list by it puts children
  // before parents. And the declared order is not parent-before-child either: `checkbox` lists
  // `indicator` before the `label` it names as its parent. What survives both is walking the tree:
  // take a node once its parent exists, and order siblings by `order`.
  const remaining = [...contract.structure.nodes].sort((a, b) => a.order - b.order);
  const inTreeOrder = [];
  while (remaining.length > 0) {
    const ready = remaining.findIndex((node) => node.parent === undefined
      || inTreeOrder.some((done) => done.part === node.parent));
    // A node whose parent never arrives is a cycle or a dangling name; taking it in declared order
    // keeps the loop finite and lets the report say what happened rather than hanging.
    inTreeOrder.push(...remaining.splice(ready === -1 ? 0 : ready, 1));
  }
  for (const node of inTreeOrder) {
    // **A part conditioned on the document is drawn when this renderer has what the condition names.**
    // `presentWhen` is the contract's own word for it, and of the five conditions the two kinds carry
    // only one can be decided from here: a field has a label, so `documentDeclaresIt` is satisfied for
    // `label` and for nothing else — no prefix, suffix or supporting text was handed to this
    // renderer. `fieldIsRequired`, `errorsAreVisible` and `fieldCanBeInvalid` describe a state at
    // rest this mount is not in, and are skipped rather than guessed at.
    //
    // That the widget is *for a field*, and that the field has a label, is the one thing nothing told
    // this renderer: the kit's config contract documents `mount(kind, asked)` and the three shapes
    // `asked` takes, none of which carries a field. The reference config invents `{ name: "f", kind,
    // label: "F" }` because its author knew to.
    const conditioned = node.optional && node.presentWhen === "documentDeclaresIt" && node.part === "label";
    if (node.optional && !conditioned) continue;
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
    if (node.part === "label") element.textContent = "F";
    // An id, because a relation is an IDREF and a part that is pointed at needs one.
    element.id = `stub-${kind}-${node.part}`;
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

  // **What was asked for, applied.** The kit documents a second argument and says a mount may not
  // accept it and drop it: the sections that pass one report against what they asked for. Rules are
  // the shape this renderer can honour, so it honours them; the others it does not claim.
  const control = made.get("control") ?? made.get("indicator");
  // **The relations the contract declares, drawn from the declaration.** `MDY_WIDGET_RELATIONS` says
  // which part points at which and with what attribute; earlier this file hard-coded `label[for]`,
  // which it had learned from a finding's wording rather than from anything published. A relation
  // whose targets were not drawn is skipped rather than pointed at nothing — a dangling IDREF is a
  // worse answer than an absent one.
  for (const relation of MDY_WIDGET_RELATIONS[kind] ?? []) {
    const from = made.get(relation.from);
    const targets = relation.to.map((part) => made.get(part)).filter((one) => one !== undefined);
    if (from === undefined || targets.length === 0) continue;
    from.setAttribute(relation.attribute, targets.map((one) => one.id).join(" "));
  }
  if (control !== undefined && asked.rules) {
    for (const [rule, value] of Object.entries(asked.rules)) {
      const attribute = ATTRIBUTE[rule];
      if (attribute === undefined || value === false || value === null) continue;
      control.setAttribute(attribute, value === true ? "" : String(value));
    }
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
    // **What the field holds, read from the catalogue that says so.** `valueSlot` declares *where* a
    // value is drawn and never *what* it is; the shape lives in `MDY_VALUE_CONTRACTS`, which the
    // widgets index names as a vocabulary living elsewhere. Reading `valueSlot` for the shape was
    // this file's own mistake, and it produced `""` for a field that holds `false`.
    value: () => {
      const shape = MDY_VALUE_CONTRACTS[kind]?.shape;
      if (shape === "boolean") return false;
      if (shape === "string") return "";
      return undefined;
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
export function mountScoped(kind, scope) {
  // The scope is what keeps two live instances from claiming one id. It arrives for exactly that
  // reason, and ignoring it produced the collision the isolation section reported the moment this
  // renderer started emitting ids at all — a section that had been reporting "not run" because
  // there was nothing that could collide.
  const fixture = mount(kind, {});
  for (const element of fixture.root.querySelectorAll?.("[id]") ?? []) {
    element.id = `${scope}-${element.id}`;
  }
  return fixture;
}

/**
 * Declared, because it is now true: `mount` takes the kit's `rules` and writes them onto the control.
 *
 * The kit is explicit that this export is a claim rather than a switch — it "cannot tell a renderer
 * that ignores a constraint from a config that never handed it one". Exporting it to unlock a
 * section this renderer does not serve would turn a section that honestly reads *not established*
 * into one that reports a defect against a request that never arrived.
 */
export const declaresRules = true;

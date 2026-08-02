/**
 * Finding a widget's parts in a rendered tree, from the contract and nothing else.
 *
 * A conformance harness that hardcodes where a part lives knows the widget from outside the
 * contract, and every such place is a rule the specification does not actually express — the suite
 * passes because the tester was told the answer, not because the contract said it.
 *
 * The hard case, and the reason this exists rather than a plain class lookup: a kind may declare two
 * parts with the same classes. A date range's `startControl` and `endControl` are the same input
 * twice, and no selector separates them. What separates them is already in the contract — the
 * anatomy declares their `order` — so they are resolved by their declared position among the
 * elements that share their classes, rather than by a harness counting to two.
 */
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "../catalog.js";
import type { MdyPartContract } from "../contract.js";

/**
 * A kind's parts keyed by name.
 *
 * Each kind's `parts` is typed with its own closed set of part names, and this module is
 * deliberately generic over all of them — a lookup that only accepted one kind's names could not
 * serve a harness iterating the catalogue.
 */
const partsOf = (kind: MdyWidgetKind): Readonly<Record<string, MdyPartContract | undefined>> =>
  MDY_WIDGET_CONTRACTS[kind].parts as Readonly<Record<string, MdyPartContract | undefined>>;

/**
 * The parts of `kind` that carry exactly the classes `part` carries, in declared order.
 *
 * Length 1 for almost every part, which is the uninteresting case: the part is alone under its
 * selector and the first match is it.
 */
function partsSharingClassesWith(kind: MdyWidgetKind, part: string): readonly string[] {
  const parts = partsOf(kind);
  const key = (name: string): string => [...(parts[name]?.classes ?? [])].sort().join(" ");
  const target = key(part);
  if (target === "") return [part];

  return MDY_WIDGET_CONTRACTS[kind].structure.nodes
    .filter((node) => key(node.part) === target)
    .sort((a, b) => a.order - b.order)
    .map((node) => node.part);
}

/**
 * Escapes a class name for use in a selector.
 *
 * Hand-rolled rather than `CSS.escape`, which is a browser global this package must not require:
 * `@modyra/widgets` loads and computes in a process with no DOM, and a bare `CSS.escape` reference
 * turns that into a `ReferenceError` the moment a selector is built.
 */
function escapeClassName(name: string): string {
  return name.replace(/[^\w-]/g, (character) => `\\${character}`);
}

/** The CSS selector the contract's declared classes amount to, or `null` where it declares none. */
export function partSelector(kind: MdyWidgetKind, part: string): string | null {
  const classes = partsOf(kind)[part]?.classes ?? [];
  if (classes.length === 0) return null;
  return classes.map((name) => `.${escapeClassName(name)}`).join("");
}

/**
 * The element rendered for a kind's part, or `null` when it is not in the tree.
 *
 * Document order is the tie-break, matched against the anatomy's declared order, because that is
 * the only thing distinguishing two parts a renderer draws with the same classes. A renderer that
 * emits them the other way round is reporting a different widget, and this returns the wrong
 * element for both — which is the correct outcome: the anatomy says which comes first.
 */
export function findPartElement(
  root: ParentNode,
  kind: MdyWidgetKind,
  part: string,
): Element | null {
  const selector = partSelector(kind, part);
  if (selector === null) return null;

  const siblings = partsSharingClassesWith(kind, part);
  const index = siblings.indexOf(part);
  if (index < 0) return null;

  const matches = root.querySelectorAll(selector);
  return matches[index] ?? null;
}

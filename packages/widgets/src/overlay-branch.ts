/**
 * What counts as inside an open overlay.
 *
 * The dismissal rule is written about a **logical branch** rather than an element: the invoker that
 * opens the popup, the popup, its descendants, anything the renderer portalled elsewhere, and any
 * child popup all count as inside. Containment in the widget's root answers most of that and misses
 * exactly one part — the portalled one, which is legitimately somewhere else in the document.
 *
 * That gap used to be each renderer's to fill, on the reasoning that only a renderer knows where its
 * own portal went. It does not have to: a widget that portals a popup **declares the relationship**,
 * because its opener names the popup through `aria-controls`, and `portalRootFor` follows that
 * declaration out. So the branch is derivable from the widget's own root, and four renderers were
 * each answering a question the contract can answer once.
 *
 * `also` is for what containment cannot reach and `aria-controls` does not name: a part of the field
 * rendered outside the root the overlay was anchored to — chips beside a search box, a footer the
 * host owns. A renderer names those elements; it does not re-derive the portal.
 */
import { portalRootFor } from "./portal.js";

/**
 * Anything that can answer whether a node is beneath it.
 *
 * Structural rather than `Element`: a host that is not itself a DOM element — a Lit controller's
 * own view object — answers containment perfectly well, and demanding the full interface would put
 * a cast at every call site to satisfy a type nothing here reads.
 */
export interface MdyOverlayRoot {
  contains(node: Node): boolean;
}

/** The roots an interaction may land on without being outside. */
export interface MdyOverlayBranch {
  /**
   * The widget's own root. Its descendants are inside, and so is whatever it portalled — the portal
   * is found from the root rather than supplied, so a renderer cannot forget it.
   */
  readonly root: MdyOverlayRoot | null | undefined;
  /** Further roots this kind owns that the widget root does not contain. */
  readonly also?: ReadonlyArray<MdyOverlayRoot | null | undefined>;
}

/** Whether a root is a real element, and so has a portal that can be followed out of it. */
function asElement(root: MdyOverlayRoot | null | undefined): Element | null {
  return root !== null && root !== undefined && "querySelectorAll" in root ? (root as Element) : null;
}

/** A DOM node, asked of a value that arrived as `unknown` from an event. */
function asNode(target: unknown): Node | null {
  if (target === null || typeof target !== "object") return null;
  return typeof (target as { nodeType?: unknown }).nodeType === "number" ? (target as Node) : null;
}

/**
 * Whether `target` lies within the overlay's logical branch.
 *
 * A target that is not a node is outside: an interaction the renderer could not locate is not one
 * that happened inside, and answering "inside" would be the safer-looking mistake — a popup that
 * never dismisses.
 */
export function overlayBranchContains(branch: MdyOverlayBranch, target: unknown): boolean {
  const node = asNode(target);
  if (node === null) return false;
  const { root } = branch;
  if (root?.contains(node)) return true;
  const element = asElement(root);
  if (element && portalRootFor(element)?.contains(node)) return true;
  return (branch.also ?? []).some((element) => element?.contains(node) === true);
}

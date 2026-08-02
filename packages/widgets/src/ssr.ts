/**
 * What of a widget exists before a browser does.
 *
 * A widget's anatomy divides in two. The **static** half is the closed control — the label, the
 * wrapper, the trigger, the supporting text and the error list. It is markup and nothing else, so a
 * server can emit it, and every kind has one. The **dynamic** half is the overlay: the popup and
 * everything under it, which is only meaningful once something can open it.
 *
 * The split is derived from the anatomy rather than restated beside it. A second hand-maintained
 * table would drift the moment a kind gained a part, and it would drift silently, because nothing
 * about a form on a server looks wrong until the markup reaches a client that disagrees with it.
 *
 * This is a statement about *anatomy*, not about a rendering strategy. A renderer that mounts its
 * popup eagerly emits the dynamic parts while closed; one that mounts lazily emits them on open.
 * Both are conformant, and the choice is what this split makes expressible — it is not made here.
 */
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "./catalog.js";
import type { MdyWidgetStructureNode } from "./structure.js";

/** Every part reachable from `roots` by following `parent`, the roots included. */
function subtree(nodes: readonly MdyWidgetStructureNode[], roots: readonly string[]): ReadonlySet<string> {
  const inside = new Set(roots);
  // The anatomy is a flat list of parent references, so containment is transitive and a single
  // pass is not enough: a gridcell's parent is a grid whose parent is the popup. Iterating to a
  // fixed point costs nothing at this size and does not depend on the list being ordered.
  for (let changed = true; changed; ) {
    changed = false;
    for (const node of nodes) {
      if (node.parent !== undefined && inside.has(node.parent) && !inside.has(node.part)) {
        inside.add(node.part);
        changed = true;
      }
    }
  }
  return inside;
}

/**
 * The parts of a kind that only exist alongside an overlay: the popup and its whole subtree.
 *
 * Empty for a kind that has no popup, which is most of them.
 */
export function dynamicParts(kind: MdyWidgetKind): readonly string[] {
  return dynamicPartsOf(MDY_WIDGET_CONTRACTS[kind].structure.nodes);
}

/**
 * The same derivation over a bare node list, so it can be exercised on anatomies the catalogue does
 * not contain — in particular ones whose nodes are not listed parent-before-child.
 *
 * The catalogue's are, today, which is exactly why this exists: a derivation that only works on
 * sorted input would pass every test in this repository and put a part that lives inside a popup
 * into the half a server is told to emit.
 */
export function dynamicPartsOf(nodes: readonly MdyWidgetStructureNode[]): readonly string[] {
  const popups = nodes.filter((node) => node.element === "popup").map((node) => node.part);
  if (popups.length === 0) return [];
  const inside = subtree(nodes, popups);
  return nodes.map((node) => node.part).filter((part) => inside.has(part));
}

/**
 * The parts of a kind a server can emit: the closed control.
 *
 * Never empty. A widget with no static anatomy would be one that renders nothing until it is
 * opened, and no kind is that.
 *
 * ## Nothing in this repository reads this, on purpose
 *
 * `dynamicParts` has a consumer — the conformance manifests decide eager versus lazy overlays with
 * it. `staticParts` and {@link isFullyServerRenderable} do not, and none is being invented for them.
 *
 * They answer "what would a server emit", and the server half of the roadmap was scoped out by an
 * explicit decision: no framework SSR renderer ships here, so no code in this repository has that
 * question. What exists is the contract-level guarantee — every kind's projection is computable
 * with no DOM — and these two are the shape of the answer a host implementing SSR would need.
 *
 * That is a deliberate export without an internal caller, not an unfinished one. Wiring a consumer
 * to make the number look better would be a consumer that exists to be counted.
 */
export function staticParts(kind: MdyWidgetKind): readonly string[] {
  const dynamic = new Set(dynamicParts(kind));
  return MDY_WIDGET_CONTRACTS[kind].structure.nodes
    .map((node) => node.part)
    .filter((part) => !dynamic.has(part));
}

/**
 * Whether a kind's anatomy is entirely static, so a server emits all of it.
 *
 * Equivalent to having no overlay, and derived from the anatomy rather than read off
 * `capabilities.overlay` — the two must agree, and a contract test says so rather than one of them
 * being trusted.
 */
export function isFullyServerRenderable(kind: MdyWidgetKind): boolean {
  return dynamicParts(kind).length === 0;
}

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
import { dynamicPartsOf } from "./structure.js";

/**
 * The derivation itself lives with the anatomy it reads, so the catalogue can apply it while it is
 * being built — a part inside a popup is present when the popup is, and that is a fact about the
 * shape rather than about servers. Re-exported here because this is the door it was published from.
 */
export { dynamicPartsOf } from "./structure.js";

/** The parts of a kind that exist only once its overlay does. */
export function dynamicParts(kind: MdyWidgetKind): readonly string[] {
  return dynamicPartsOf(MDY_WIDGET_CONTRACTS[kind].structure.nodes);
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
